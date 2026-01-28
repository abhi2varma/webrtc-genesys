# Workspace API Integration for WWE Call Control

## Overview

**CORRECTED APPROACH:** The WebRTC Gateway Bridge integrates with Genesys WWE using the **Workspace API WebSocket**, not SSE/DN_EVENT. This follows the standard Genesys SIP Endpoint Application pattern.

## Problem Statement

WWE needs to control the WebRTC endpoint (answer, hangup, hold, etc.) but the endpoint is not a native Genesys component. The bridge acts as a **Genesys SIP Endpoint Application** that:
1. Registers DNs to Asterisk (via WebRTC)
2. Listens for WWE call control commands via Workspace API
3. Translates them to SIP/WebRTC actions

## Architecture

### Correct Call Flow

```
┌─────────────┐         ┌──────────────────┐         ┌────────────────┐
│   Asterisk  │         │  Genesys         │         │     WWE        │
│   (WebRTC)  │   SIP   │  T-Server        │ WorkspaceAPI │  (Browser)    │
└──────┬──────┘ ◄──────►└────────┬─────────┘◄──────►└────────┬───────┘
       │                         │                            │
       │  INVITE (1003→1002)     │                            │
       ├────────────────────────►│                            │
       │                         │  EventRinging              │
       │                         ├───────────────────────────►│
       │                         │                            │
       │                         │                    Agent sees call
       │                         │                    Auto-answer ON
       │                         │                            │
       │                         │  AnswerCall command        │
       │                         │◄───────────────────────────┤
       │                         │                            │
       │                         │  State: Ringing → Talking  │
       │                         ├───────────────────────────►│
       │                         │       (WebSocket)          │
       │                         │                            │
       │                         ▼                            │
       │            ┌─────────────────────────┐              │
       │            │  Workspace API          │              │
       │            │  WebSocket Connection   │              │
       │            └───────────┬─────────────┘              │
       │                        │                            │
       │                        │ StatusChange event         │
       │                        │ call.state = "Talking"     │
       │                        ▼                            │
       │            ┌─────────────────────────┐              │
       │            │  Bridge Workspace       │              │
       │            │  Client                 │              │
       │            │  (workspace-client.js)  │              │
       │            └───────────┬─────────────┘              │
       │                        │                            │
       │                        │ emit('call-answered')      │
       │                        ▼                            │
       │            ┌─────────────────────────┐              │
       │            │  Bridge Main Process    │              │
       │            │  (main.js)              │              │
       │            └───────────┬─────────────┘              │
       │                        │                            │
       │                        │ sendWebRTCCommand()        │
       │                        │ 'answer_call'              │
       │                        ▼                            │
       │            ┌─────────────────────────┐              │
       │            │  WebRTC Gateway         │              │
       │            │  (iframe/JsSIP)         │              │
       │            └───────────┬─────────────┘              │
       │                        │                            │
       │  SIP 200 OK            │                            │
       │◄───────────────────────┘                            │
       │                                                     │
       │  ✅ Call Connected                                  │
       │                                                     │
```

## Implementation

### 1. Workspace API Client (`workspace-client.js`)

Already implemented! This file:
- Connects to Workspace API WebSocket at `ws://192.168.210.54:8090/api/v2/me/calls`
- Listens for call state changes (Ringing → Talking)
- Emits events when WWE answers a call

```javascript
// Key method in workspace-client.js
handleCallStatusChange(message) {
  const call = message.call;
  const previousState = this.activeCalls.get(callId);
  const newState = call.state;
  
  // Detect answer event: Ringing → Talking
  if (previousState === 'Ringing' && newState === 'Talking') {
    this.emit('call-answered', {
      callId: callId,
      callUuid: call.callUuid,
      dnis: call.dnis
    });
  }
}
```

### 2. Bridge Main Process (`main.js`)

Event handler already exists:

```javascript
// Setup Workspace event handlers
function setupWorkspaceEventHandlers() {
  workspaceClient.on('call-answered', async (callData) => {
    logger.info('[Workspace] 🎯 Call answered in WWE:', callData);
    
    // Send answer command to WebRTC gateway
    await sendWebRTCCommand('answer_call', {
      callId: callData.callId,
      callUuid: callData.callUuid,
      dnis: callData.dnis
    });
    
    logger.info('[Workspace] ✅ Answer command sent to WebRTC gateway');
  });
}
```

### 3. Initialization

The Workspace Client needs to be initialized when WWE logs in:

```javascript
// POST /InitWorkspace - WWE calls this on login
app.post('/InitWorkspace', async (req, res) => {
  const { sessionId, workspaceUrl } = req.body;
  
  // Initialize Workspace client with session ID from WWE
  workspaceClient = new WorkspaceClient({
    workspaceUrl: workspaceUrl || 'ws://192.168.210.54:8090'
  });
  
  setupWorkspaceEventHandlers();
  workspaceClient.connect(sessionId);
  
  res.json({ success: true });
});
```

## Critical Requirements

### 1. WWE Must Call `/InitWorkspace`

**Without this, the Workspace Client never connects!**

WWE needs to be configured to call:
```javascript
POST https://127.0.0.1:8000/InitWorkspace
{
  "sessionId": "<WORKSPACE-SESSIONID cookie value>",
  "workspaceUrl": "ws://192.168.210.54:8090"
}
```

This is typically done in WWE's voice channel configuration or custom gadget.

### 2. Session ID from WWE Login

The Workspace API requires authentication via the `WORKSPACE-SESSIONID` cookie. The bridge gets this from WWE when it calls `/InitWorkspace`.

### 3. Call Must Route Through T-Server

For WWE to see the call, the dialplan must route through Genesys:

```
DN 1002 → Asterisk → Genesys SIP Server → T-Server → WWE
                                             ↓
                                   (Call state tracked)
```

## Testing

### 1. Check Workspace Client Connection

Look for this in bridge logs after WWE login:
```
[Workspace] Connecting to Workspace API: ws://192.168.210.54:8090
[Workspace] ✅ Connected to Workspace API
```

If you don't see this, WWE is NOT calling `/InitWorkspace`.

### 2. Test Answer Flow

1. Make call from DN 1003 → 1002
2. Check logs:
   ```
   [Workspace] 📞 Call ringing: { callId: '...', ...}
   [Workspace] 🎯 Call answered in WWE: {...}
   [Workspace] ✅ Answer command sent to WebRTC gateway
   ```

3. If you see "Call answered in WWE" but no "Answer command sent", the WebRTC gateway isn't responding.

### 3. Manual Test of Workspace Client

You can manually test the Workspace API connection:

```javascript
// In browser console (on WWE page)
// Get session ID
const sessionId = document.cookie.match(/WORKSPACE-SESSIONID=([^;]+)/)[1];

// Connect WebSocket
const ws = new WebSocket('ws://192.168.210.54:8090/api/v2/me/calls');
ws.onopen = () => {
  ws.send(JSON.stringify({
    messageType: 'Authorization',
    sessionId: sessionId
  }));
};
ws.onmessage = (e) => console.log('Event:', JSON.parse(e.data));
```

You should see call events when calls arrive/change state.

## WWE Configuration

WWE needs to know about the bridge endpoint. This is typically done via:

### Option 1: WWE Environment Configuration

In WWE's environment config:
```javascript
{
  "voice": {
    "sip-endpoint": {
      "enabled": true,
      "url": "https://127.0.0.1:8000",
      "init-on-login": true
    }
  }
}
```

### Option 2: Custom WWE Gadget/Extension

Create a gadget that calls the bridge APIs:

```javascript
// On WWE login
WWE.on('login', function(userData) {
  // Initialize bridge
  $.post('https://127.0.0.1:8000/InitWorkspace', {
    sessionId: document.cookie.match(/WORKSPACE-SESSIONID=([^;]+)/)[1],
    workspaceUrl: 'ws://192.168.210.54:8090'
  });
});
```

## Troubleshooting

### Problem: WWE doesn't show calls

**Cause:** Call not routed through T-Server

**Fix:** Check Asterisk dialplan routes to `@genesys_sip_server`

### Problem: WWE shows call but can't answer

**Cause:** Workspace Client not connected

**Fix:** 
1. Check WWE calls `/InitWorkspace`
2. Check bridge logs for Workspace connection
3. Verify session ID is valid

### Problem: Answer times out

**Cause:** Bridge doesn't receive call-answered event

**Fix:**
1. Check Workspace Client is listening for state changes
2. Verify T-Server sends StatusChange events
3. Test WebSocket connection manually

## Files Modified

1. ~~`webrtc-gateway-bridge/src/main.js`~~ - No changes needed, already has handlers
2. ~~`webrtc-gateway-bridge/src/workspace-client.js`~~ - Already implemented
3. ~~`nginx/html/wwe-webrtc-gateway.html`~~ - Already waits for answer command

## What Was Wrong in Previous Implementation

I initially tried to implement an SSE `/DN_EVENT` endpoint, which is NOT how Genesys SIP Endpoint applications work. The correct approach is:

- ❌ ~~SSE endpoint for DN events~~
- ❌ ~~Direct notification to WWE~~
- ✅ **Workspace API WebSocket** (already implemented)
- ✅ **Listen for T-Server call state changes** (already implemented)
- ✅ **React to WWE actions via state changes** (already implemented)

## Next Steps

1. **Verify WWE Configuration:** Ensure WWE is configured to use the bridge as a SIP Endpoint
2. **Check /InitWorkspace Call:** Monitor bridge logs during WWE login
3. **Test Call Flow:** Make a test call and watch the Workspace event flow
4. **Enable Auto-Answer in WWE:** Check WWE settings for voice channel

## Success Criteria

✅ Bridge logs show: `[Workspace] ✅ Connected to Workspace API`
✅ Call arrives: `[Workspace] 📞 Call ringing`
✅ WWE shows incoming call notification
✅ Auto-answer triggers: `[Workspace] 🎯 Call answered in WWE`
✅ Answer sent: `[Workspace] ✅ Answer command sent to WebRTC gateway`
✅ Call connects within 2 seconds
✅ No timeout errors

