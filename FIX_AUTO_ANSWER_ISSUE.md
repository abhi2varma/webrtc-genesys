# Fix: WWE Auto-Answer Not Working

## Problem Statement
- Incoming calls ring at the WebRTC client ✅
- WWE receives the call notification ✅
- WWE attempts to auto-answer ✅
- **But the call never gets answered** ❌
- Call stays in "Ringing" state forever

## Root Cause
WWE is configured for **3PCC (Third-Party Call Control) mode**, where Genesys T-Server controls all call operations. When WWE sends an "Answer" command, it goes to T-Server, but T-Server doesn't know how to forward it to the WebRTC client/Asterisk.

### Evidence from Logs

```javascript
// WWE detects auto-answer is enabled
'voice.auto-answer' is true
answer()

// WWE sends Answer to Genesys API
$.ajax({
  "url":"/api/v2/me/calls/JBNIHE6GIL09DCQ7KUREMIUHVC000001",
  "data":"{\"operationName\":\"Answer\"}"
})
SUCCEED with: { "statusCode": 0 }

// But call stays in Ringing state
"state": "Ringing"  ← Never changes to "Talking"

// WWE executes 3PCC mode setup
execute('Add3PCCSupportForDN')
```

**What's missing:** WWE never calls the IWSIPEndpoint bridge to answer the call on the WebRTC client.

---

## Solution: Change Device to External Service Mode

You need to configure the device in Genesys Configuration Server to use **External Service** control instead of T-Server control.

### Option 1: Change Device Switch to External Service (Recommended)

1. Open **Genesys Administrator** or **Genesys Configuration Manager**

2. Navigate to: **Environment → Resources → DNs → 1002**

3. In the **DN Properties**, change the **Switch** from:
   - `SIP_Switch` (T-Server)
   
   To:
   - `External Service` or create a new switch type for WebRTC

4. **OR** Navigate to: **Environment → Switches → SIP_Switch**

5. In the **Switch Annex** tab, add the parameter:
   ```
   [voice]
   use-external-routing = true
   ```

6. Save and restart T-Server

---

### Option 2: Configure WWE for SIP Endpoint Control

If changing the switch configuration is not feasible, you can configure WWE to use the SIP Endpoint for call control directly.

1. In **Genesys Configuration Server**, navigate to the **Device** (P_1002 or similar)

2. Go to the **Annex** tab

3. Add/modify these parameters:
   ```
   [voice]
   media-type = sip-endpoint
   control-mode = endpoint
   ```

4. In WWE configuration, ensure:
   ```json
   {
     "voice.sip-endpoint-control": true,
     "voice.auto-answer": true
   }
   ```

5. Save and have the agent logout/login

---

### Option 3: Implement Custom Call Control Integration

If neither of the above options work, you need to implement a custom integration layer that:

1. **Listens to Genesys T-Server events** (DN_IN_SERVICE, EventRinging, EventEstablished)
2. **Forwards call control commands** from T-Server to the WebRTC client via the Electron bridge
3. **Maps T-Server commands** (Answer, Hold, Transfer) to SIP Endpoint API calls

This requires:
- Modifying the `webrtc-gateway-bridge` to listen to T-Server events
- Implementing a T-Server protocol adapter
- Creating a bidirectional sync between T-Server call state and WebRTC call state

---

## Verification Steps

After applying the fix:

### 1. Check WWE Logs for SIP Endpoint Control
```bash
grep "IWSIPEndpoint.*Answer\|AcceptCall" logs.txt
```
**Expected:** Should see WWE calling the bridge to answer calls

### 2. Check Call State Transitions
```bash
grep "state.*Ringing\|state.*Talking" logs.txt
```
**Expected:** Calls should transition from "Ringing" to "Talking"

### 3. Test Auto-Answer
1. Make a call to DN 1002 from DN 1003
2. WWE should auto-answer within 1-2 seconds
3. Call should connect and both parties should have audio

---

## Technical Background

### 3PCC (Third-Party Call Control) Mode
- T-Server controls all call operations
- WWE sends commands to T-Server API
- T-Server sends SIP messages to the phone/endpoint
- **Requires full T-Server ↔ Asterisk integration**

### SIP Endpoint Control Mode
- WebRTC client controls calls directly
- WWE sends commands to the SIP Endpoint (Electron bridge)
- Electron bridge controls the WebRTC client (JsSIP)
- T-Server only observes call state (not controls it)
- **This is what you need for WebRTC clients!**

---

## Related Files
- `webrtc-gateway-bridge/src/main.js` - Electron bridge API
- `nginx/html/wwe-webrtc-gateway.html` - WebRTC client (JsSIP)
- WWE configuration in Genesys Config Server
- Device configuration (DN 1002 / Place P_1002)

---

## Quick Test

To quickly test if this is the issue, try making an **outbound call** from WWE (agent dials 1003):

**Expected Result:**
- If outbound calls work but inbound calls don't auto-answer
- **Confirms:** WWE can control the WebRTC client for outbound, but not for inbound
- **Root Cause:** Inbound calls are using T-Server control mode

---

## Additional Debugging

### Check WWE Device Configuration
```bash
grep -C 10 "deviceUri.*27379f71" logs.txt | grep -E "control|mode|3pcc|endpoint"
```

### Check for SIP Endpoint Commands
```bash
grep "IWSIPEndpoint" logs.txt | grep -v "Ping"
```

Should see commands like:
- `IWSIPEndpointRegisterDN`
- `IWSIPEndpointGetDnSIP`
- **Missing:** `IWSIPEndpointAnswerCall` or similar

---

## Summary

**The Issue:** WWE is in 3PCC mode expecting T-Server to control calls, but T-Server doesn't have integration with Asterisk/WebRTC for call control.

**The Fix:** Configure WWE/Device to use SIP Endpoint control mode so WWE directly controls the WebRTC client via the Electron bridge.

**Test:** After fix, incoming calls should auto-answer and WWE should send commands to `https://127.0.0.1:8000/` to control the WebRTC client.
