# 🎯 AUTO-ANSWER ROOT CAUSE & SOLUTION

## **Problem Summary**

When calls are routed through Asterisk to the `webrtc-gateway-bridge`, **auto-answer fails** even when:
- ✅ `BusinessCall: 1` flag is set in T-Server call extensions
- ✅ Agent has auto-answer enabled in Genesys
- ✅ DN is properly registered to T-Server via `registration-monitor`

## **Root Cause Analysis**

### **Working Direct Genesys Registration (`logs.txt`):**

```
Timeline:
04:45:54.079 - T-Server sends INVITE to DN 1002
04:45:54.079 - SIP Endpoint sends 180 Ringing
04:45:54.079 - T-Server sends NOTIFY with Event: talk ← AUTO-ANSWER TRIGGER!
04:45:54.079 - SIP Endpoint receives NOTIFY
04:45:54.079 - SIP Endpoint sends SIP 200 OK (auto-answer) ✅
04:45:54.079 - Call connected
```

**Key Discovery from Line 1093-1120 in `logs.txt`:**

```sip
NOTIFY sip:1002@10.81.64.2:5060 SIP/2.0
Event: talk
Subscription-State: active

→ GSeptSIPconn(5):Answer(st:R)  ← AUTO-ANSWER TRIGGERED!
→ SIP/2.0 200 OK  ← IMMEDIATE ANSWER!
```

### **Broken Asterisk Scenario (`with ans.txt`):**

```
Timeline:
05:10:58.644 - Asterisk sends INVITE to WebRTC client
05:10:58.652 - WebRTC client sends 180 Ringing
05:10:58.903 - T-Server sends call event to WWE (Ringing state)
              ⚠️ T-Server sends NOTIFY to Asterisk ⚠️
              ❌ Asterisk DOES NOT forward NOTIFY to WebRTC client
              ❌ webrtc-gateway-bridge never receives NOTIFY
              ❌ No auto-answer triggered
              ❌ No SIP 200 OK sent
[30 seconds later]
05:11:28.XXX - Call times out
```

## **The Missing Link**

**T-Server sends `NOTIFY` with `Event: talk` to trigger auto-answer on the SIP endpoint.**

In direct registration:
- T-Server → SIP Endpoint (receives NOTIFY) → Auto-answers

With Asterisk proxy:
- T-Server → Asterisk (receives NOTIFY) → ❌ **DOES NOT FORWARD** → WebRTC client never sees it
- Asterisk acts as a B2BUA (Back-to-Back User Agent), **terminating** both call legs
- NOTIFY messages are **in-dialog** messages that don't get forwarded across B2BUA boundaries by default

## **Why Asterisk Doesn't Forward NOTIFY**

1. **B2BUA Architecture**: Asterisk terminates both SIP dialogs (T-Server ↔ Asterisk, Asterisk ↔ WebRTC)
2. **No REFER/NOTIFY Forwarding**: Asterisk doesn't have built-in logic to forward NOTIFY messages across dialogs
3. **Call Flow Isolation**: Each leg is independent - events on one leg don't automatically propagate to the other

## **Solution Options**

### **Option 1: Implement NOTIFY Handling in WebRTC Gateway** ✅ **RECOMMENDED**

**Status:** Partially implemented in `nginx/html/wwe-webrtc-gateway.html`

**Approach:**
1. ✅ Added `newMessage` event handler to detect incoming NOTIFY
2. ✅ Check for `Event: talk` header
3. ✅ Auto-answer call if NOTIFY received

**Issue:** Asterisk needs to be configured to forward NOTIFY messages

**Implementation:**
```javascript
// Already added to wwe-webrtc-gateway.html
this.ua.on('newMessage', (e) => {
    const request = e.request;
    if (request.method === 'NOTIFY') {
        const eventHeader = request.getHeader('Event');
        if (eventHeader === 'talk') {
            // Auto-answer the current session
            if (this.currentSession && !this.currentSession.isEstablished()) {
                this.currentSession.answer({
                    mediaConstraints: { audio: true, video: false }
                });
            }
        }
    }
});
```

### **Option 2: Asterisk Dialplan NOTIFY Forwarding** 

**Create custom dialplan logic to forward NOTIFY messages:**

```asterisk
; In extensions-sip-endpoint.conf
[genesys-agent]
exten => _X.,1,NoOp(Call from Genesys ${EXTEN})
    same => n,Set(PJSIP_SEND_SESSION_REFRESH=invite)
    same => n,Set(MASTER_CHANNEL(PJSIP_HEADER(add,X-Genesys-CallUUID))=${PJSIP_HEADER(read,X-Genesys-CallUUID)})
    same => n,Dial(PJSIP/${EXTEN},60,g)
    same => n,Hangup()

; Handle NOTIFY forwarding (custom AMI script needed)
exten => notify,1,NoOp(NOTIFY Received from Genesys)
    same => n,System(/usr/local/bin/forward-notify.sh "${PJSIP_HEADER(read,Event)}" "${EXTEN}")
    same => n,Hangup()
```

**Challenges:**
- Asterisk dialplan doesn't natively support NOTIFY forwarding
- Requires custom AMI/ARI scripting
- Complex to maintain

### **Option 3: AMI Event Monitoring + Auto-Answer** ⭐ **MOST PRACTICAL**

**Monitor Asterisk events and trigger auto-answer when T-Server sends NOTIFY:**

1. Create AMI monitor script that watches for NOTIFY events
2. When `Event: talk` NOTIFY is received from Genesys
3. Send auto-answer command to WebRTC client via bridge API

**Implementation:**

```python
# asterisk/ami-notify-monitor.py
import asyncio
from asterisk.ami import AMIClient

class NotifyMonitor:
    async def handle_notify(self, event):
        if event.get('Event') == 'talk':
            call_id = event.get('Uniqueid')
            channel = event.get('Channel')
            
            # Trigger auto-answer via bridge API
            await self.trigger_auto_answer(channel)
    
    async def trigger_auto_answer(self, channel):
        # Extract DN from channel name
        dn = self.extract_dn(channel)
        
        # Call bridge API to answer
        async with aiohttp.ClientSession() as session:
            await session.post(f'https://127.0.0.1:8000/auto-answer/{dn}')
```

**Add to `webrtc-gateway-bridge/src/main.js`:**

```javascript
// Auto-answer API endpoint
apiApp.post('/auto-answer/:dn', (req, res) => {
  const dn = req.params.dn;
  logger.info(`Auto-answer triggered for DN: ${dn}`);
  
  // Send command to WebRTC gateway
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.executeJavaScript(`
      if (window.gateway && window.gateway.currentSession) {
        window.gateway.currentSession.answer({
          mediaConstraints: { audio: true, video: false }
        });
      }
    `);
  }
  
  res.json({ success: true });
});
```

### **Option 4: Direct SIP NOTIFY Injection** (Most Complex)

**Use `pjsip send notify` command via AMI:**

```bash
# When T-Server sends NOTIFY to Asterisk
# Forward it to the WebRTC client
asterisk -rx "pjsip send notify talk_event 1002"
```

**Requires:**
1. Custom notify template in `pjsip_notify.conf`
2. AMI monitoring to detect incoming NOTIFY from T-Server
3. Automatic triggering of outbound NOTIFY to WebRTC client

## **Recommended Implementation Path**

### **Phase 1: Quick Fix (Option 3 - AMI Monitor)**

1. ✅ WebRTC gateway already has NOTIFY handler (just added)
2. Create AMI monitor script to detect NOTIFY from T-Server
3. Trigger auto-answer via bridge API
4. **Test with agent-level auto-answer enabled**

### **Phase 2: Proper Solution (Option 1 + Asterisk Config)**

1. Configure Asterisk to forward NOTIFY messages to WebRTC clients
2. Rely on JsSIP `newMessage` handler (already implemented)
3. Remove AMI monitoring workaround

## **Testing Steps**

1. **Enable auto-answer at agent level in Genesys**
2. **Monitor Asterisk logs for incoming NOTIFY:**
   ```bash
   docker exec asterisk asterisk -rvvvv
   pjsip set logger on
   ```
3. **Check if NOTIFY reaches Asterisk:**
   - If YES → implement forwarding (Option 1 or 4)
   - If NO → check T-Server configuration
4. **Monitor bridge logs for auto-answer events**

## **Current Status**

- ✅ Root cause identified: Missing NOTIFY forwarding
- ✅ WebRTC gateway updated to handle NOTIFY
- ⏳ Need to verify if Asterisk receives NOTIFY from T-Server
- ⏳ Need to implement NOTIFY forwarding mechanism
- ⏳ Test with agent-level auto-answer enabled

## **Expected Behavior After Fix**

```
Timeline:
1. T-Server sends INVITE to Asterisk (DN 1002)
2. Asterisk forwards INVITE to WebRTC client
3. WebRTC client sends 180 Ringing
4. T-Server sends NOTIFY with Event: talk to Asterisk
5. Asterisk forwards NOTIFY to WebRTC client ← FIX NEEDED HERE
6. WebRTC gateway receives NOTIFY
7. WebRTC gateway auto-answers (sends SIP 200 OK)
8. Call connects ✅
```

## **Files Modified**

- ✅ `nginx/html/wwe-webrtc-gateway.html` - Added NOTIFY handler
- ⏳ Need: AMI monitoring script or Asterisk dialplan changes
- ⏳ Need: Bridge API auto-answer endpoint

## **Next Steps**

1. **Test NOTIFY receipt**: Enable verbose logging and check if Asterisk receives NOTIFY from T-Server
2. **Implement forwarding**: Based on test results, choose Option 1, 3, or 4
3. **Test auto-answer**: Call 1002 from 1003 with auto-answer enabled at agent level
4. **Verify logs**: Confirm NOTIFY is received and processed by WebRTC gateway
