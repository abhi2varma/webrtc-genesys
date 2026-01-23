# Electron App ↔ WWE Voice Integration

## Overview

This document explains how the Electron app (`webrtc-gateway-bridge`) provides voice capabilities to WWE (Workspace Web Edition), replicating the functionality of the Genesys softphone.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         WWE (Browser UI)                         │
│                                                                   │
│  - Shows incoming call notifications from Genesys T-Server       │
│  - Provides call control UI (Answer, Hangup, Hold, etc.)        │
│  - Polls Electron app for incoming call detection                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ HTTPS REST API (Port 8000)
                     │ - /RegisterDn
                     │ - /GetIncomingCall (polled)
                     │ - /AnswerCall
                     │ - /HangUp
                     │ - /MakeCall
                     │
┌────────────────────▼────────────────────────────────────────────┐
│             Electron App (webrtc-gateway-bridge)                 │
│                                                                   │
│  - Loads WebRTC Gateway iframe                                   │
│  - Handles SIP registration/calls via JsSIP                      │
│  - Exposes WWE-compatible REST API on localhost:8000            │
│  - Stores call state (incoming_call, callActive, etc.)          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ WebSocket (WSS)
                     │ wss://103.167.180.166:8443/ws
                     │
┌────────────────────▼────────────────────────────────────────────┐
│                    Nginx (HTTPS/WSS Proxy)                       │
│                      Port 8443 (HTTPS)                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ WebSocket Proxy
                     │
┌────────────────────▼────────────────────────────────────────────┐
│                  Kamailio (SIP Proxy)                            │
│                    Port 8080 (WebSocket)                         │
│                                                                   │
│  - Receives REGISTER from Electron app                           │
│  - Rewrites Contact header to Asterisk address                   │
│  - Forwards REGISTER to Genesys SIP Server                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ SIP REGISTER
                     │ Contact: sip:DN@192.168.210.54:5060
                     │
┌────────────────────▼────────────────────────────────────────────┐
│               Genesys SIP Server (192.168.210.81)                │
│                                                                   │
│  - Receives REGISTER with Asterisk contact                       │
│  - Routes calls to Asterisk                                      │
│  - Notifies T-Server of DN state changes                         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ SIP Protocol
                     │
┌────────────────────▼────────────────────────────────────────────┐
│              Genesys T-Server (Call Control)                     │
│                                                                   │
│  - Tracks all DN registrations and states                        │
│  - Sends call notifications to WWE                               │
│  - Controls call routing and features                            │
└─────────────────────────────────────────────────────────────────┘
```

## Call Flow for Incoming Calls

### 1. Registration Phase

```
Electron App ──REGISTER──> Kamailio ──REGISTER (Contact rewritten)──> Genesys SIP Server
                                                                              │
                                                                              ▼
                                                                       Genesys T-Server
                                                                       (DN 1002 = Active)
```

### 2. Incoming Call Detection by WWE

**Key Issue:** WWE needs to know about incoming calls, but T-Server only sends notifications for calls that it routes. Since the Electron app receives the SIP INVITE directly from Asterisk, we need a mechanism for WWE to detect this.

**Solution:** WWE polls the Electron app's `/GetIncomingCall` endpoint.

```javascript
// WWE polls this endpoint every 1-2 seconds
GET https://127.0.0.1:8000/GetIncomingCall

// Response when incoming call exists:
{
  "hasIncomingCall": true,
  "callerId": "1003",
  "timestamp": 1234567890
}

// Response when no incoming call:
{
  "hasIncomingCall": false
}
```

### 3. Call Flow: Agent 1003 calls Agent 1002 (Electron app)

```
┌─────────┐                                           ┌─────────┐
│ Agent   │                                           │ Agent   │
│  1003   │                                           │  1002   │
│ (WWE)   │                                           │(Electron│
└────┬────┘                                           └────┬────┘
     │                                                     │
     │ 1. Makes call to 1002 from WWE                     │
     │                                                     │
     ▼                                                     │
┌─────────────┐                                           │
│  Genesys    │                                           │
│  T-Server   │                                           │
└──────┬──────┘                                           │
       │                                                  │
       │ 2. T-Server routes via Genesys SIP Server       │
       ▼                                                  │
┌─────────────┐                                           │
│  Genesys    │                                           │
│ SIP Server  │                                           │
└──────┬──────┘                                           │
       │                                                  │
       │ 3. SIP INVITE to 1002@192.168.210.54:5060       │
       ▼                                                  │
┌─────────────┐                                           │
│  Asterisk   │                                           │
└──────┬──────┘                                           │
       │                                                  │
       │ 4. SIP INVITE via WSS to Electron app           │
       │    (JsSIP detects incoming call)                 │
       ▼                                                  ▼
       ────────────────────────────────────>  ┌──────────────────┐
                                               │ Electron App     │
                                               │ - Stores call in │
                                               │   incomingCall   │
                                               │ - Event: ringing │
                                               └──────────────────┘
                                                        │
       ┌────────────────────────────────────────────────┘
       │ 5. WWE polls /GetIncomingCall
       │    Response: { hasIncomingCall: true, callerId: "1003" }
       ▼
┌─────────────┐
│    WWE UI   │
│  Shows      │
│  Incoming   │
│  Call from  │
│    1003     │
└──────┬──────┘
       │
       │ 6. Agent clicks "Answer" in WWE
       │    WWE sends: POST https://127.0.0.1:8000/AnswerCall
       ▼
┌──────────────────┐
│  Electron App    │
│  - Calls         │
│    answer_call() │
│  - JsSIP accepts │
│    the session   │
└──────┬───────────┘
       │
       │ 7. SIP 200 OK sent to Asterisk
       ▼
┌─────────────┐
│  Asterisk   │──> Genesys SIP Server ──> T-Server ──> WWE
└─────────────┘    (Call Connected notification)
```

## Current Implementation Status

### ✅ Completed Features

1. **Registration to Genesys**
   - Electron app registers DN via WebSocket → Kamailio → Genesys
   - Kamailio rewrites Contact header correctly
   - T-Server sees DN as "Active"

2. **Electron REST API for WWE**
   - ✅ `/RegisterDn` - Triggers SIP registration
   - ✅ `/UnregisterDn` - Unregisters DN
   - ✅ `/GetDnSIP` - Returns current DN
   - ✅ `/GetIsEndpointActive` - Always returns true (endpoint available)
   - ✅ `/GetSIPEndpointParameters` - Returns registration status
   - ✅ `/MakeCall` - Initiates outbound call
   - ✅ `/HangUp` - Ends active call
   - ✅ `/AnswerCall` - Answers incoming call
   - ✅ `/GetIncomingCall` - Returns incoming call state (for WWE polling)
   - ✅ `/GetCallStatus` - Returns current call state
   - ✅ `/Hold` - Mutes audio
   - ✅ `/Retrieve` - Unmutes audio
   - ✅ `/Ping` - Keep-alive

3. **WebRTC Event Handling**
   - ✅ `registered` - Updates status
   - ✅ `unregistered` - Clears status
   - ✅ `incoming_call` - Stores call details in `webrtcStatus.incomingCall`
   - ✅ `call_accepted` - Sets `callActive = true`
   - ✅ `call_ended` - Clears call state

### 🔧 Needs Verification

1. **WWE Polling Configuration**
   - ❓ Does WWE automatically poll `/GetIncomingCall`?
   - ❓ Or does it need configuration to use the Electron app for incoming calls?

2. **WebRTC Gateway Event Mapping**
   - ❓ Verify that the WebRTC gateway HTML sends correct events
   - ❓ Check event names match what Electron app expects

3. **Call Control Event Flow**
   - ❓ When WWE sends `/AnswerCall`, does JsSIP properly accept?
   - ❓ When WWE sends `/HangUp`, does JsSIP properly terminate?

## Testing Plan

### Test 1: Registration
```bash
# 1. Start Electron app
cd webrtc-gateway-bridge
npm start

# 2. Log into WWE with DN 1002
# - WWE should call /RegisterDn
# - Electron app should register via WSS
# - Check Asterisk: sudo docker-compose exec asterisk asterisk -rx "pjsip show contacts"
# Expected: Contact for 1002 shows as Avail
```

### Test 2: Incoming Call Detection
```bash
# 1. Log into WWE with DN 1002 (Electron app)
# 2. From another softphone (DN 1003), call 1002
# 3. Check Electron app logs - should show "Incoming call from 1003"
# 4. WWE should show incoming call notification
# Expected: WWE UI shows "Incoming call from 1003"
```

### Test 3: Answer Call from WWE
```bash
# 1. Incoming call is ringing (from Test 2)
# 2. Click "Answer" button in WWE UI
# 3. Check Electron logs - should show "AnswerCall called"
# 4. Audio should connect
# Expected: Call connects, audio works both ways
```

### Test 4: Hangup from WWE
```bash
# 1. Active call (from Test 3)
# 2. Click "Hangup" button in WWE UI
# 3. Check Electron logs - should show "HangUp called"
# Expected: Call terminates, WWE shows call ended
```

### Test 5: Outbound Call
```bash
# 1. Log into WWE with DN 1002 (Electron app)
# 2. Use WWE UI to make call to 1003
# 3. WWE should call /MakeCall
# 4. Electron app should initiate SIP call
# Expected: Call connects to 1003
```

## Configuration

### Electron App (`webrtc-gateway-bridge`)

**File:** `webrtc-gateway-bridge/src/main.js`

```javascript
const config = {
  bridge: {
    host: '127.0.0.1',
    port: 8000  // WWE connects to this port
  },
  gateway: {
    url: 'https://103.167.180.166:8443',
    iframeUrl: 'https://103.167.180.166:8443/wwe-webrtc-gateway.html',
    sipServer: 'wss://103.167.180.166:8443/ws'
  },
  wwe: {
    allowedOrigins: [
      'http://192.168.210.54:8090',   // WWE local IP
      'https://103.167.180.166:8443'   // WWE via HTTPS proxy
    ]
  }
};
```

### WWE Device Configuration

In Genesys Administrator:
1. Create DN `1002` with type "WebRTC"
2. Set place to "Agent_1002_Place"
3. Set SIP Server to Genesys SIP Server
4. Device should show as "Active" when registered

## Known Issues & Solutions

### Issue 1: Contact Header Invalid
**Problem:** Kamailio was preserving client's invalid Contact (e.g., `xyz@invalid`)
**Solution:** Fixed in `kamailio-proxy.cfg` to rewrite Contact to `sip:DN@192.168.210.54:5060`
**Status:** ✅ Fixed (needs deployment)

### Issue 2: WWE Not Detecting Incoming Calls
**Problem:** T-Server doesn't notify WWE about calls directly to SIP endpoints
**Solution:** WWE must poll `/GetIncomingCall` endpoint on Electron app
**Status:** ⚠️ Needs verification

### Issue 3: Registration Not Reaching Genesys
**Problem:** Nginx was proxying WebSocket directly to Asterisk, bypassing Kamailio
**Solution:** Reverted Nginx to proxy `/ws` to Kamailio (port 8080)
**Status:** ✅ Fixed

## Next Steps

1. ✅ Deploy Contact header fix to server
2. ⚠️ Verify WWE polls `/GetIncomingCall`
3. ⚠️ Test Answer/Hangup commands from WWE
4. ⚠️ Test full call flow with audio
5. ⚠️ Document any additional WWE configuration needed

## References

- `KAMAILIO_CONTACT_HEADER_FIX.md` - Kamailio Contact header rewriting fix
- `REGISTRATION_TO_GENESYS_SOLUTION.md` - Registration flow documentation
- `INCOMING_CALL_FIX.md` - Call routing through T-Server
- `webrtc-gateway-bridge/README.md` - Electron app documentation
