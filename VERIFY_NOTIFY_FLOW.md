# Verify NOTIFY Event:talk Flow

## Summary of Current Understanding

From `logs.txt`, we confirmed the Genesys SIP Endpoint auto-answer flow:

1. ✅ T-Server sends INVITE to Genesys Softphone (DN 1002)
2. ✅ Softphone sends 180 Ringing
3. ✅ WWE detects auto-answer enabled, sends Answer to Workspace API
4. ✅ **T-Server sends NOTIFY with `Event: talk` to the Softphone**
5. ✅ Softphone receives NOTIFY → Auto-answers immediately
6. ✅ Softphone sends 200 OK
7. ✅ Call connects

## Key Question

**Does Genesys T-Server send the NOTIFY to our WebRTC clients registered via Asterisk?**

### Scenario 1: Direct Registration (Working - from logs.txt)
```
Genesys Softphone → Registers directly to T-Server (192.168.210.81:5060)
Call arrives → T-Server sends NOTIFY → Softphone receives → Auto-answers ✅
```

### Scenario 2: Our Setup (To Verify)
```
WebRTC Client → Registers to Asterisk (via WSS)
Asterisk → Registers to T-Server (via registration-monitor)
Call arrives → T-Server sends NOTIFY to ??? → WebRTC Client receives?
```

## The Critical Issue

**NOTIFY Destination Problem:**

When Asterisk registers DN 1002 to Genesys, the contact address is:
```
Contact: sip:1002@192.168.210.54:5061
```

This means T-Server will send NOTIFY to:
```
NOTIFY sip:1002@192.168.210.54:5061
```

**But the WebRTC client is connected via WebSocket!**
```
Contact: sip:r1c4lsod@192.168.210.54:15114;transport=WS
```

## Test Plan

### Test 1: Check What T-Server Sends

**On Genesys Server (192.168.210.81):**

```bash
# Capture SIP traffic to see NOTIFY destination
sudo tcpdump -i any -n -s 0 -vvv 'port 5060 or port 5061' -A | grep -A 20 "Event: talk"
```

**Expected:**
```
NOTIFY sip:1002@192.168.210.54:5061 SIP/2.0
...
Event: talk
```

**Question:** Is this being sent to port 5061 (Asterisk) or somewhere else?

---

### Test 2: Check if Asterisk Receives NOTIFY

**On Docker Host (192.168.210.54):**

```bash
# Check Asterisk logs for incoming NOTIFY
docker exec webrtc-asterisk tail -f /var/log/asterisk/full | grep -i "notify"
```

**Expected if working:**
```
Received SIP message:
NOTIFY sip:1002@192.168.210.54:5061 SIP/2.0
...
Event: talk
```

---

### Test 3: Check if Asterisk Forwards NOTIFY to WebRTC Client

**In Browser Console (WebRTC Client):**

The gateway already logs NOTIFY messages:

```javascript
// Already in wwe-webrtc-gateway.html line 393-422
this.ua.on('newMessage', (e) => {
    const request = e.request;
    console.log(`📩 Received SIP message: ${request.method}`);
    
    if (request.method === 'NOTIFY') {
        const eventHeader = request.getHeader('Event');
        console.log(`📩 NOTIFY Event: ${eventHeader}`);
    }
});
```

**Expected if working:**
```
📩 Received SIP message: NOTIFY
📩 NOTIFY Event: talk
🎯 AUTO-ANSWER TRIGGER: Received NOTIFY with Event: talk
📞 Auto-answering incoming call...
```

---

## Expected Results

### ✅ Scenario A: NOTIFY is Forwarded (Everything Works)

1. T-Server sends NOTIFY to Asterisk (192.168.210.54:5061)
2. Asterisk receives it
3. Asterisk forwards to WebRTC client via WebSocket
4. Gateway's `newMessage` handler detects `Event: talk`
5. Gateway auto-answers
6. ✅ Call connects

### ❌ Scenario B: NOTIFY Not Forwarded (Current Problem)

1. T-Server sends NOTIFY to Asterisk (192.168.210.54:5061)
2. Asterisk receives it (maybe?)
3. ❌ Asterisk doesn't forward to WebRTC client
4. ❌ WebRTC client never receives NOTIFY
5. ❌ No auto-answer
6. ❌ Call stays ringing

### ❌ Scenario C: NOTIFY Not Even Sent

1. T-Server doesn't send NOTIFY at all
2. Because the registration is "second-hand" via Asterisk
3. T-Server doesn't know about the WebRTC client
4. ❌ No NOTIFY sent
5. ❌ No auto-answer

---

## Solution Options

### If Scenario B (NOTIFY Not Forwarded):

**Option 1: Configure Asterisk to Forward NOTIFY**

Add to `pjsip.conf` for the WebRTC endpoint template:

```ini
[agent_dn](!)
; ... existing config ...
; Allow NOTIFY messages to be forwarded
allow_subscribe=yes
notify_early_inuse_ringing=yes
```

**Option 2: Use AMI Handler to Send NOTIFY**

The `ami-auto-answer-handler.py` already exists. We need to:
1. Make it send NOTIFY via Asterisk to the WebRTC client
2. Configure it to monitor for incoming NOTIFY from T-Server

```python
async def forward_notify_to_webrtc(self, dn, event_type):
    """Send NOTIFY to WebRTC client via Asterisk"""
    await self.manager.send_action({
        'Action': 'PJSIPNotify',
        'Endpoint': dn,
        'Variable': f'Event={event_type}'
    })
```

**Option 3: Direct Bridge API Trigger (Simplest)**

Instead of relying on NOTIFY forwarding, use the Workspace API integration:

1. ✅ WWE calls Answer → Workspace API
2. ✅ Bridge's Workspace Client detects state change (Ringing → Talking)
3. ✅ Bridge calls `/answer` endpoint
4. ✅ Gateway answers

This is **already implemented** in `workspace-client.js`!

---

### If Scenario C (NOTIFY Not Sent at All):

**This means T-Server doesn't treat Asterisk-registered endpoints the same as direct registrations.**

**Solution: Use Workspace API Only**

Forget about NOTIFY. The bridge's Workspace Client integration is the correct approach:

```javascript
// Already in main.js line 375-392
workspaceClient.on('call-answered', async (callData) => {
  logger.info('[Workspace] 🎯 Call answered in WWE:', callData);
  
  await sendWebRTCCommand('answer_call', {
    callId: callData.callId,
    callUuid: callData.callUuid,
    dnis: callData.dnis
  });
});
```

---

## Quick Test: Make a Call Now

**Let's test with current setup:**

1. **Ensure Bridge is Running:**
   ```powershell
   # Check if bridge is running
   Get-Process | Where-Object { $_.ProcessName -like "*Electron*" -or $_.ProcessName -like "*WebRTC*" }
   ```

2. **Open Bridge Logs:**
   - Bridge should show: `[Workspace] ✅ Connected to Workspace API`
   - If not, WWE didn't call `/InitWorkspace`

3. **Make Test Call:**
   - 1003 calls 1002
   - Watch bridge logs
   - Watch browser console (F12) on WWE page

4. **Check Logs:**

   **If NOTIFY is working:**
   ```
   [Browser Console] 📩 Received SIP message: NOTIFY
   [Browser Console] 📩 NOTIFY Event: talk
   [Browser Console] 🎯 AUTO-ANSWER TRIGGER
   [Bridge] Call answered successfully
   ```

   **If Workspace API is working:**
   ```
   [Bridge] [Workspace] 📞 Call ringing
   [Bridge] [Workspace] 🎯 Call answered in WWE
   [Bridge] [Workspace] ✅ Answer command sent to WebRTC gateway
   [Browser] Answering call...
   ```

   **If neither working:**
   ```
   [Bridge] Incoming call from: 1003
   [Bridge] Call ringing...
   (nothing else - call stays ringing)
   ```

---

## Recommended Approach

Based on the Genesys SIP Endpoint Application architecture you're using:

### Primary Method: Workspace API (Already Implemented ✅)

This is the **standard Genesys approach** for bridging external endpoints:

```
Call → T-Server → WWE (via Workspace API)
WWE Answer → T-Server state change (Ringing → Talking)
Bridge detects state change → Answers call via WebRTC
```

**Requires:**
1. ✅ Workspace Client connected (check `/InitWorkspace` is called)
2. ✅ Event handlers setup (already in `main.js`)
3. ✅ Answer command forwarding (already implemented)

### Secondary Method: NOTIFY Forwarding (Nice to Have)

If we can get NOTIFY messages forwarded, it provides a redundant trigger:

```
T-Server → NOTIFY Event:talk → Asterisk → WebRTC Client → Auto-answer
```

**Requires:**
- Asterisk configured to forward NOTIFY
- OR AMI handler to relay NOTIFY
- OR T-Server sends NOTIFY directly to WebRTC client (unlikely)

---

## Action Items

1. **Verify Workspace Client Connection:**
   - Check if WWE calls `/InitWorkspace`
   - Check bridge logs for `[Workspace] ✅ Connected`

2. **Test Current Flow:**
   - Make test call 1003 → 1002
   - Check which mechanism triggers (if any)

3. **Debug Based on Results:**
   - If neither works → Fix WWE integration
   - If Workspace works → We're done! (NOTIFY is bonus)
   - If only NOTIFY works → Debug Workspace Client

4. **Enable Detailed Logging:**
   ```bash
   # On Asterisk container
   docker exec webrtc-asterisk asterisk -rx "core set verbose 10"
   docker exec webrtc-asterisk asterisk -rx "core set debug 10"
   docker exec webrtc-asterisk asterisk -rx "pjsip set logger on"
   ```

---

## Test Commands

### On Windows (Bridge Host):

```powershell
# Check bridge is running
tasklist | findstr "electron"

# Read recent bridge logs (if running in terminal)
# Or check the Electron app console
```

### On Linux Server (Asterisk):

```bash
# Enable SIP debugging
docker exec webrtc-asterisk asterisk -rx "pjsip set logger on"

# Watch for NOTIFY messages
docker exec webrtc-asterisk tail -f /var/log/asterisk/full | grep -i notify

# Check registered endpoints
docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints"

# Check active channels
docker exec webrtc-asterisk asterisk -rx "core show channels"
```

### In Browser (WWE Page):

```javascript
// Open Console (F12)
// Watch for gateway logs (they're already there)

// Manually test NOTIFY handler
// (This won't actually answer a call, just tests the handler)
console.log("WebRTC Gateway should be logging SIP messages automatically");
```

---

## Expected Outcome

After verification, we'll know:

1. ✅ **Which mechanism is working** (Workspace API or NOTIFY or both)
2. ✅ **What needs to be fixed** (if neither is working)
3. ✅ **How to configure WWE properly** (if Workspace API isn't connecting)

The **most likely scenario**: Workspace API integration works once WWE calls `/InitWorkspace`, and NOTIFY forwarding is not needed (it's a Genesys-specific feature that may not work through Asterisk proxy).
