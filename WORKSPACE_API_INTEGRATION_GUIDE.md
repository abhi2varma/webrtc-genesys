# Workspace API Integration Guide

## Overview
The webrtc-gateway-bridge now includes Workspace API integration to detect when WWE answers calls and automatically send SIP 200 OK responses.

## How It Works

### Architecture

```
WWE (Browser) ← WebSocket → Workspace API ← Events ← T-Server
                                ↓
                        workspaceClient.js
                                ↓
                        webrtc-gateway-bridge
                                ↓
                        WebRTC SIP Endpoint
                                ↓
                            SIP 200 OK
                                ↓
                            Asterisk
                                ↓
                            T-Server
```

### Flow

1. **Login**: WWE logs in, obtains `WORKSPACE-SESSIONID` cookie
2. **Registration**: DN registers via webrtc-gateway-bridge
3. **Workspace Connect**: Bridge connects to Workspace API WebSocket with session ID
4. **Call Arrives**: T-Server sends call to DN → WebRTC client rings
5. **WWE Shows Call**: Workspace API sends call event → WWE displays Accept button
6. **User Clicks Accept**: WWE sends Answer to T-Server
7. **T-Server Signals**: T-Server changes call state from Ringing → Talking
8. **Workspace Event**: Workspace API sends StatusChange event
9. **Bridge Detects**: workspaceClient detects state change Ringing → Talking
10. **Auto-Answer**: Bridge sends `answer_call` command to WebRTC gateway
11. **SIP 200 OK**: WebRTC endpoint sends 200 OK to Asterisk
12. **Call Connected**: Audio flows, call is established

## Installation

### 1. Install Dependencies

```bash
cd webrtc-gateway-bridge
npm install ws
```

The `ws` package is required for WebSocket client functionality.

### 2. Files Added

- `src/workspace-client.js` - WebSocket client for Workspace API
- Updated `src/main.js` - Integration and event handling

## Configuration

### Workspace API URL

Default: `ws://192.168.210.54:8090`

To change:

```javascript
// In src/main.js, InitWorkspace endpoint
workspaceClient = new WorkspaceClient({
  workspaceUrl: 'ws://YOUR_WORKSPACE_SERVER:8090'
});
```

## Usage

### Method 1: Automatic (Recommended)

When WWE logs in and calls RegisterDn, include the Workspace session ID:

```javascript
// From WWE browser console or custom integration
fetch('https://127.0.0.1:8000/RegisterDn', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    users: ['1000'],
    addresses: ['1000'],
    workspaceSessionId: document.cookie
      .split('; ')
      .find(row => row.startsWith('WORKSPACE-SESSIONID='))
      ?.split('=')[1]
  })
});
```

### Method 2: Manual Initialization

Initialize separately after login:

```javascript
// Get Workspace session ID from cookie
const sessionId = document.cookie
  .split('; ')
  .find(row => row.startsWith('WORKSPACE-SESSIONID='))
  ?.split('=')[1];

// Initialize Workspace connection
fetch('https://127.0.0.1:8000/InitWorkspace', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: sessionId,
    workspaceUrl: 'ws://192.168.210.54:8090' // optional
  })
});
```

## Events Handled

### 1. call-answered
**Triggered when**: WWE Answer command changes call state from Ringing → Talking

**Action**: Sends `answer_call` command to WebRTC gateway → SIP 200 OK sent

**Log**: `[Workspace] 🎯 Call answered in WWE`

### 2. call-ringing
**Triggered when**: New incoming call detected (state = Ringing)

**Action**: Stores call info in `webrtcStatus.incomingCall`

**Log**: `[Workspace] 📞 Call ringing`

### 3. call-released
**Triggered when**: Call ends (state = Released)

**Action**: Clears call status

**Log**: `[Workspace] Call released`

### 4. connected
**Triggered when**: WebSocket connection established

**Log**: `[Workspace] ✅ Connected to Workspace API`

### 5. disconnected
**Triggered when**: WebSocket connection closed

**Action**: Auto-reconnect (up to 5 attempts)

**Log**: `[Workspace] ⚠️ Disconnected from Workspace API`

## Testing

### 1. Enable Debug Logging

Check webrtc-gateway-bridge console for logs:

```
[Workspace] Connecting to Workspace API: ws://192.168.210.54:8090
[Workspace] ✅ Connected to Workspace API
[Workspace] Event received: { type: 'StatusChange', callId: 'XXX', state: 'Ringing' }
[Workspace] 📞 Call ringing: XXX
[Workspace] Event received: { type: 'StatusChange', callId: 'XXX', state: 'Talking' }
[Workspace] 🎯 Call answered in WWE: XXX
[Workspace] ✅ Answer command sent to WebRTC gateway
```

### 2. Test Call Flow

**Step 1**: Start webrtc-gateway-bridge
```bash
cd webrtc-gateway-bridge
npm start
```

**Step 2**: Login to WWE with DN 1000

**Step 3**: Register DN with Workspace session
```javascript
// In WWE browser console
const sessionId = document.cookie.split('; ').find(row => row.startsWith('WORKSPACE-SESSIONID='))?.split('=')[1];

fetch('https://127.0.0.1:8000/RegisterDn', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    users: ['1000'],
    addresses: ['1000'],
    workspaceSessionId: sessionId
  })
}).then(r => r.json()).then(console.log);
```

**Step 4**: Make test call from another DN (e.g., 1003)
```javascript
// In WWE (logged in as different agent)
// Make call to 1000
```

**Step 5**: Verify in webrtc-gateway-bridge console:
- ✅ "Call ringing" message
- ✅ WWE shows Accept button
- ✅ Click Accept
- ✅ "Call answered in WWE" message
- ✅ "Answer command sent" message
- ✅ Call connects within 2 seconds

### 3. Verify SIP 200 OK Sent

On Asterisk server:

```bash
# Enable SIP logging
sudo docker exec -it webrtc-asterisk asterisk -rx "pjsip set logger on"

# Watch for 200 OK
sudo docker logs -f webrtc-asterisk | grep "200 OK"
```

Should see:
```
<--- Transmitting SIP Response to UDP:192.168.210.81:5060 --->
SIP/2.0 200 OK
```

## Troubleshooting

### Issue: "Cannot connect to Workspace API"

**Cause**: Session ID invalid or expired

**Solution**:
1. Re-login to WWE
2. Get fresh session ID
3. Call InitWorkspace with new session ID

### Issue: "Call answered but no 200 OK"

**Cause**: WebRTC gateway not receiving answer command

**Solution**:
1. Check browser console for errors
2. Verify mainWindow is not null
3. Check sendWebRTCCommand logs
4. Ensure WebRTC gateway HTML is loaded

### Issue: "Reconnection failed"

**Cause**: Workspace API unavailable or session expired

**Solution**:
1. Check Workspace API is running: `curl http://192.168.210.54:8090/api/v2/status`
2. Verify network connectivity
3. Re-login to WWE to get fresh session

### Issue: "Event received but not processed"

**Cause**: Event format changed or unhandled message type

**Solution**:
1. Check console logs for raw event data
2. Verify message structure in workspace-client.js
3. Add additional message type handlers if needed

## Advanced Configuration

### Custom Event Handlers

Add custom logic when calls are answered:

```javascript
// In src/main.js, setupWorkspaceEventHandlers function
workspaceClient.on('call-answered', async (callData) => {
  logger.info('[Workspace] 🎯 Call answered:', callData);
  
  // Custom logic here
  await notifyExternalSystem(callData);
  
  // Then answer the call
  await sendWebRTCCommand('answer_call', {
    callId: callData.callId,
    callUuid: callData.callUuid
  });
});
```

### Multiple DN Support

The integration automatically handles multiple DNs:

```javascript
// Register multiple DNs
['1000', '1001', '1002'].forEach(async (dn) => {
  await fetch('https://127.0.0.1:8000/RegisterDn', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      users: [dn],
      workspaceSessionId: sessionId
    })
  });
});
```

Each call is matched by call ID, so answers are handled correctly.

### Auto-Reconnect Configuration

Modify reconnection settings in workspace-client.js:

```javascript
class WorkspaceClient extends EventEmitter {
  constructor(config) {
    super();
    this.maxReconnectAttempts = 10;  // Default: 5
    this.reconnectDelay = 5000;       // Default: 3000ms
    // ...
  }
}
```

## API Reference

### POST /InitWorkspace

Initialize Workspace API connection.

**Request**:
```json
{
  "sessionId": "WORKSPACE-SESSIONID value",
  "workspaceUrl": "ws://192.168.210.54:8090" // optional
}
```

**Response**:
```json
{
  "success": true
}
```

### POST /RegisterDn (Enhanced)

Register DN with optional Workspace session.

**Request**:
```json
{
  "users": ["1000"],
  "addresses": ["1000"],
  "workspaceSessionId": "session-id-here" // optional
}
```

**Response**:
```json
{
  "RegisterDnResult": true
}
```

## WebSocket Message Format

### From Workspace API

**Call Ringing**:
```json
{
  "notificationType": "StatusChange",
  "call": {
    "id": "UIVB8J6JE91C53UIM3VI59VHQ4000005",
    "state": "Ringing",
    "callUuid": "UIVB8J6JE91C53UIM3VI59VHQ4000005",
    "dnis": "1000",
    "participants": [
      {
        "phoneNumber": "1003",
        "formattedPhoneNumber": "1003"
      }
    ]
  }
}
```

**Call Answered** (state change):
```json
{
  "notificationType": "StatusChange",
  "call": {
    "id": "UIVB8J6JE91C53UIM3VI59VHQ4000005",
    "state": "Talking",
    "callUuid": "UIVB8J6JE91C53UIM3VI59VHQ4000005"
  }
}
```

## Success Criteria

After implementation:
- ✅ WWE receives calls and shows Accept button
- ✅ User clicks Accept
- ✅ Workspace API sends state change event
- ✅ Bridge detects answer within 500ms
- ✅ SIP 200 OK sent within 2 seconds
- ✅ Call connects successfully
- ✅ No timeout errors
- ✅ Audio flows bidirectionally

## Next Steps

1. Test with single DN
2. Test with multiple simultaneous calls
3. Test reconnection scenarios
4. Monitor for memory leaks in long-running sessions
5. Add call statistics/metrics
6. Implement call transfer/hold support

## Support

For issues or questions:
1. Check logs in webrtc-gateway-bridge console
2. Verify Workspace API connectivity
3. Check WWE browser console for errors
4. Review SIP logs on Asterisk server
5. Verify T-Server call routing
