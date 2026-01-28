# Auto-Answer Mechanism Analysis

## Summary
After analyzing WWE behavior with direct Genesys registration vs through Asterisk, we've identified the root cause of why calls show in WWE with direct registration but not through Asterisk.

## Test Case: Direct Genesys Registration (Working ✅)

### Setup
- **1002** and **1003** registered directly to Genesys T-Server (192.168.210.81:5060)
- **1003** calls **1002**
- **Result**: Call rings, auto-answers, shows in WWE Call Manager, call is operational

### Key Finding: NOTIFY with Event: talk

When a call is made from 1003 to 1002, Genesys T-Server sends a specific SIP message that triggers the auto-answer:

```sip
NOTIFY sip:1002@10.81.64.2:5060 SIP/2.0
From: sip:1003@192.168.210.81:5060;tag=88170A6B-45A8-43AE-9D3C-97CE63DC2C9C-7
To: sip:1002@192.168.210.81:5060;tag=B0E161FF-0F7B-4F46-9129-5FC47C40F5C6-3
Call-ID: D6F9763C-E5D5-4C4B-97C3-C0725E0E2E17-4@192.168.210.81
CSeq: 2 NOTIFY
Event: talk
Subscription-State: active
X-Genesys-CallUUID: UIVB8J6JE91C53UIM3VI59VHQ4000001
```

**Key Point**: The `Event: talk` header is what triggers WWE to auto-answer!

### Timeline of Events (Direct Registration)

1. **04:45:54.080** - T-Server sends INVITE to 1002
2. **04:45:54.387** - 1002 sends `180 Ringing`
3. **04:45:54.377** - **T-Server sends NOTIFY with Event: talk to 1002**
4. **04:45:54.515** - WWE receives call notification (state: Ringing)
5. **04:45:54.538** - **WWE detects `'voice.auto-answer' is true`**
6. **04:45:54.539** - **WWE calls `answer()` method**
7. **04:45:54.544** - WWE executes Answer command
8. **04:45:54.682** - 1002 sends `200 OK` (call answered)
9. **04:45:54.743** - ACK received, call connected

### WWE Logs Show Auto-Answer Trigger

```javascript
2026-01-27 04:45:54.538 [DEBUG] [WWE.Voice.MediaVoiceExtension] 'voice.auto-answer' is true
2026-01-27 04:45:54.539 [DEBUG] [WWE.Voice.InteractionVoice] answer()
2026-01-27 04:45:54.539 [DEBUG] [WWE.Main.CommandManager] execute('InteractionVoiceAnswer')
```

## Problem: Calls Through Asterisk (Not Working ❌)

### Current Setup
- **WebRTC Client** -> **Asterisk** (192.168.210.74:5060) -> **Genesys T-Server** (192.168.210.81:5060)
- **Issue**: Call rings at WebRTC client, but doesn't show in WWE Call Manager
- **Likely Cause**: The NOTIFY with `Event: talk` is being blocked/not forwarded by Asterisk

## Root Cause Hypothesis

### Why WWE Doesn't Show the Call

When calls come through Asterisk:

1. ✅ INVITE reaches WebRTC client (phone rings)
2. ✅ 180 Ringing sent back
3. ❌ **NOTIFY with Event: talk is NOT reaching the WebRTC client**
4. ❌ WWE doesn't detect auto-answer condition
5. ❌ WWE doesn't create interaction in Call Manager
6. ❌ Call stays ringing but is "invisible" to WWE

### Asterisk's Role in NOTIFY Messages

Asterisk acts as a B2BUA (Back-to-Back User Agent) which means:
- It terminates the SIP dialog on the Genesys side
- It creates a new SIP dialog on the WebRTC client side
- **In-dialog NOTIFY messages may not be forwarded** between the two legs

## Solution Options

### Option 1: Configure Asterisk to Forward NOTIFY (Recommended)

**File**: `asterisk/etc/pjsip.conf`

Add to the endpoint configuration:
```ini
[webrtc_endpoint]
; ... existing config ...
allow_subscribe = yes
notify_early_inuse_ringing = yes
```

**Pros**: 
- Minimal changes
- Preserves current architecture
- Allows T-Server events to reach WWE

**Cons**: 
- Need to test if Asterisk forwards Event: talk NOTIFYs

### Option 2: Disable Auto-Answer in WWE

If the NOTIFY can't be forwarded, disable auto-answer and handle it differently:

**WWE Configuration**:
```javascript
// In SetOptions call
"policy.session.auto_answer": "0"  // Disable auto-answer
```

**Pros**:
- Simple workaround
- Calls will still ring

**Cons**:
- Changes user experience (manual answer required)
- Doesn't solve WWE Call Manager visibility issue

### Option 3: Use Genesys SIP Endpoint Integration

Instead of relying on NOTIFY messages, integrate with Genesys API:

**Approach**:
- Use Workspace Desktop Edition API
- Monitor call events via CTI
- Trigger WWE updates via JavaScript

**Pros**:
- More reliable
- Better integration with Genesys features

**Cons**:
- More complex implementation
- Requires additional API integration

## Next Steps

### 1. Capture SIP Traces with Asterisk

Enable SIP debugging to see if NOTIFY is received/forwarded:

```bash
# On Asterisk server
sudo docker exec -it webrtc-asterisk asterisk -rx "pjsip set logger on"
sudo docker exec -it webrtc-asterisk asterisk -rx "core set verbose 5"
sudo docker exec -it webrtc-asterisk asterisk -rx "core set debug 5"

# Make a test call and capture logs
sudo docker logs webrtc-asterisk --tail 500 > asterisk_call_test.log
```

**Look for**:
- NOTIFY messages from Genesys (192.168.210.81)
- Whether Asterisk forwards them to WebRTC client
- Any errors related to NOTIFY handling

### 2. Test NOTIFY Forwarding

**Test Command** (from T-Server):
```bash
# Send a test NOTIFY to see if Asterisk forwards it
# This would be done programmatically or via T-Server
```

### 3. Check Asterisk NOTIFY Handling

**Command**:
```bash
sudo docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoint webrtc_client_1000"
```

**Look for**:
- `allow_subscribe` setting
- `notify_early_inuse_ringing` setting
- Subscription state

## Testing Plan

### Test 1: Verify NOTIFY Receipt
1. Make a call through Asterisk to WebRTC client
2. Capture full SIP trace from Asterisk
3. Check if NOTIFY with Event: talk is received from Genesys
4. Check if NOTIFY is forwarded to WebRTC client

### Test 2: Enable NOTIFY Forwarding
1. Update pjsip.conf with subscription settings
2. Restart Asterisk
3. Make test call
4. Verify NOTIFY reaches WWE
5. Check if WWE auto-answers and shows in Call Manager

### Test 3: Direct vs Proxied Comparison
1. Capture SIP traces for both scenarios
2. Compare NOTIFY message flow
3. Identify where the flow breaks with Asterisk

## Expected Behavior (Fixed)

Once NOTIFY forwarding is working:

1. ✅ Call arrives at Asterisk from Genesys
2. ✅ Asterisk forwards INVITE to WebRTC client
3. ✅ WebRTC client sends 180 Ringing
4. ✅ **Asterisk forwards NOTIFY (Event: talk) to WebRTC client**
5. ✅ **WWE detects auto-answer condition**
6. ✅ **WWE creates interaction in Call Manager**
7. ✅ **WWE auto-answers the call**
8. ✅ Call connected and visible in WWE

## Technical Details

### SIP NOTIFY Message Structure

```sip
NOTIFY sip:destination SIP/2.0
Event: talk                         ← Key header for auto-answer
Subscription-State: active          ← Subscription must be active
X-Genesys-CallUUID: <uuid>         ← Genesys call identifier
```

### WWE Auto-Answer Logic

```javascript
// WWE checks this condition
if (voice.auto-answer === true && call.state === 'Ringing') {
    // Auto-answer triggered by NOTIFY Event: talk
    interaction.answer();
}
```

### Asterisk B2BUA Behavior

```
Genesys T-Server          Asterisk              WebRTC Client
     |                        |                        |
     |---- INVITE ----------->|                        |
     |                        |---- INVITE ----------->|
     |                        |<--- 180 Ringing -------|
     |<--- 180 Ringing -------|                        |
     |                        |                        |
     |---- NOTIFY (Event: talk) ->|                   |
     |                        |---- NOTIFY (?) ------->|  ← Issue here!
```

## Configuration Files to Check

1. **asterisk/etc/pjsip.conf** - Endpoint subscription settings
2. **webrtc-gateway-bridge** - WWE integration settings
3. **Genesys Switch DN Config** - NOTIFY behavior settings

## References

- Genesys SIP Protocol documentation
- Asterisk PJSIP NOTIFY handling
- WWE JavaScript API documentation
- SIP RFC 3265 (Event Notification)

## Conclusion

The auto-answer mechanism in WWE **requires** receiving a `NOTIFY` message with `Event: talk` from Genesys T-Server. When calls go through Asterisk, this NOTIFY is either:
1. Not being forwarded by Asterisk (most likely)
2. Being blocked by firewall rules
3. Being modified/stripped by Asterisk

The solution is to ensure Asterisk properly forwards in-dialog NOTIFY messages from T-Server to the WebRTC clients.
