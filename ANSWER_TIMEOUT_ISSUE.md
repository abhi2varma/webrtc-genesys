# Call Answer Timeout Issue - Root Cause Analysis

## Issue Summary
When clicking the Accept button in WWE, the call fails with "Cannot answer the call - Timeout" after ~27 seconds.

## Timeline from Logs (with ans.txt)

```
05:24:37.968  ✅ User clicks Accept button in WWE
05:24:37.969  ✅ WWE calls answer() method
05:24:37.984  ✅ WWE sends Answer command to Workspace API
05:24:38.052  ✅ Workspace API returns success (statusCode: 0)
              ⏱️  27 seconds of silence...
05:25:05.031  ❌ ERROR: "call disconnected"
05:25:05.037  ❌ "Cannot answer the call - Timeout"
05:25:05.101  ❌ Call state → "Released"
```

## Root Cause

**The webrtc-gateway-bridge (Genesys SIP Endpoint) is not receiving or processing the Answer event from T-Server.**

### Call Flow Analysis

#### What SHOULD Happen:
```
1. Call arrives → WWE shows Accept button
2. User clicks Accept
3. WWE → Workspace API: POST /api/v2/me/calls/{callId} {"operationName": "Answer"}
4. Workspace API → T-Server: AnswerCall request
5. T-Server → SIP Server: Send answer signal to registered DN
6. SIP Server → Genesys SIP Endpoint: Incoming answer event
7. Genesys SIP Endpoint: Send 200 OK (SIP answer)
8. Call connects ✅
```

#### What's Actually Happening:
```
1. Call arrives → WWE shows Accept button ✅
2. User clicks Accept ✅
3. WWE → Workspace API: POST /api/v2/me/calls/{callId} {"operationName": "Answer"} ✅
4. Workspace API → T-Server: AnswerCall request ✅
5. T-Server → SIP Server: Send answer signal to registered DN ✅
6. SIP Server → Genesys SIP Endpoint: Incoming answer event ❌ NOT RECEIVED
7. Genesys SIP Endpoint: Never sends 200 OK ❌
8. Timeout after 27 seconds → Call disconnects ❌
```

## The Missing Link: T-Server to SIP Endpoint Communication

### Problem

The webrtc-gateway-bridge is a **standalone Genesys SIP Endpoint** but it's not properly integrated with T-Server's call control mechanism.

**Direct Genesys Registration (Working)**:
- Genesys Softphone registers to T-Server
- T-Server knows: DN 1002 = this specific SIP endpoint
- When WWE sends Answer → T-Server sends signal to registered endpoint
- Endpoint receives event and answers

**Through webrtc-gateway-bridge (Broken)**:
- webrtc-gateway-bridge registers to T-Server (via Asterisk registration-monitor)
- T-Server knows: DN 1000 is registered
- When WWE sends Answer → T-Server tries to send signal
- ❌ **webrtc-gateway-bridge doesn't have proper T-Server integration**
- ❌ It only handles direct SIP INVITE/Answer, not T-Server events

## Why This Happens

The webrtc-gateway-bridge was designed as a simple WebRTC-to-SIP bridge. It:
- ✅ Registers the DN to T-Server (via AMI/Asterisk)
- ✅ Receives incoming SIP INVITE
- ✅ Can make outgoing calls
- ❌ **Does NOT listen for T-Server call control events**
- ❌ **Does NOT implement Genesys SIPEndpoint protocol fully**

### What's Missing

1. **T-Server Event Subscription**: The endpoint needs to subscribe to call events for the DN
2. **EventRinging Handler**: When call arrives, T-Server sends EventRinging
3. **Answer Event Listener**: When WWE answers, endpoint must detect and send 200 OK

## Solution Options

### Option 1: Implement T-Server Event Handling in webrtc-gateway-bridge (Recommended)

The webrtc-gateway-bridge needs to:

1. **Subscribe to T-Server events** for the registered DN
2. **Listen for Answer events** from T-Server
3. **Send SIP 200 OK** when Answer event is received

**Implementation**:

```javascript
// In webrtc-gateway-bridge/src/main.js

// Add T-Server event listener
async function initializeTServerIntegration() {
  // Connect to Workspace API WebSocket for call events
  const ws = new WebSocket('ws://192.168.210.54:8090/api/v2/me/calls');
  
  ws.on('message', (data) => {
    const event = JSON.parse(data);
    
    // Handle Answer event
    if (event.notificationType === 'StatusChange' && 
        event.call.state === 'Talking' && 
        currentCallState === 'Ringing') {
      // T-Server is telling us to answer the call
      answerCurrentCall();
    }
  });
}

function answerCurrentCall() {
  if (webRTCWindow && currentSIPSession) {
    // Send 200 OK via WebRTC/SIP
    webRTCWindow.webContents.send('answer-call', {
      callId: currentCallId
    });
  }
}
```

### Option 2: Use T-Server Answer Mechanism Directly

Instead of relying on WWE → T-Server → SIP Endpoint chain, answer directly:

**Implementation**:

```javascript
// Modify WWE integration
// When Accept button is clicked, also trigger direct SIP answer

// In browser console or custom WWE extension:
function onAcceptButtonClick() {
  // Normal WWE answer
  WWE.answer(callId);
  
  // ALSO send direct answer to webrtc-gateway-bridge
  fetch('https://127.0.0.1:8000/AnswerCall', {
    method: 'POST',
    body: JSON.stringify({ callId: callId })
  });
}
```

### Option 3: Bypass T-Server Call Control (Simplest)

Configure the DN to use "Direct SIP Answering" mode:

**Genesys Configuration**:
```
DN Configuration:
  - use-register-bc-for-voice-calls: false
  - direct-inward-dialing: true
  - Answer mode: Automatic (at SIP level)
```

This makes the SIP endpoint answer directly without waiting for T-Server signal.

### Option 4: Use SIP INFO or UPDATE for Answer Signal

Configure T-Server to send SIP INFO when Answer is requested:

**T-Server Configuration** (sip.conf or application settings):
```
answer-method=INFO
```

Then implement INFO handler in webrtc-gateway-bridge.

## Recommended Solution: Option 1 + Direct Answer Fallback

### Step 1: Add Workspace API WebSocket Connection

```javascript
// webrtc-gateway-bridge/src/workspace-client.js
const WebSocket = require('ws');

class WorkspaceClient {
  constructor(workspaceUrl, sessionId) {
    this.url = workspaceUrl;
    this.sessionId = sessionId;
    this.ws = null;
    this.callHandlers = [];
  }
  
  connect() {
    this.ws = new WebSocket(`${this.url}/api/v2/me/calls`, {
      headers: {
        'Cookie': `WORKSPACE-SESSIONID=${this.sessionId}`
      }
    });
    
    this.ws.on('message', (data) => {
      const event = JSON.parse(data);
      this.handleCallEvent(event);
    });
  }
  
  handleCallEvent(event) {
    if (event.notificationType === 'StatusChange') {
      const { call } = event;
      
      // Call answered from WWE
      if (call.state === 'Talking' && this.currentCallState === 'Ringing') {
        this.emit('answer-requested', call);
      }
    }
  }
  
  onAnswerRequested(handler) {
    this.callHandlers.push(handler);
  }
}

module.exports = WorkspaceClient;
```

### Step 2: Integrate with Main Process

```javascript
// webrtc-gateway-bridge/src/main.js

const WorkspaceClient = require('./workspace-client');
let workspaceClient = null;

// After login
app.post('/api/register', (req, res) => {
  const { dn, workspaceSessionId } = req.body;
  
  // Initialize Workspace client
  workspaceClient = new WorkspaceClient(
    'ws://192.168.210.54:8090',
    workspaceSessionId
  );
  
  workspaceClient.connect();
  
  workspaceClient.onAnswerRequested((call) => {
    // Answer the call in the WebRTC window
    if (webRTCWindow) {
      webRTCWindow.webContents.send('answer-call', {
        callId: call.id,
        callUuid: call.callUuid
      });
    }
  });
  
  res.json({ success: true });
});
```

### Step 3: Handle Answer in WebRTC Window

```javascript
// webrtc-gateway-bridge/src/webrtc/renderer.js (or similar)

ipcRenderer.on('answer-call', (event, { callId, callUuid }) => {
  // Find the active SIP session
  const session = sipEndpoint.getSessionByCallId(callId);
  
  if (session && session.state === 'ringing') {
    // Send 200 OK
    session.accept();
    console.log('Call answered:', callId);
  }
});
```

## Quick Fix for Testing

While implementing the full solution, you can test with a workaround:

### Temporary Workaround: Auto-Answer at SIP Level

**Edit**: `webrtc-gateway-bridge` to auto-answer all incoming calls:

```javascript
// In the SIP INVITE handler
sipEndpoint.on('invite', (session) => {
  console.log('Incoming call');
  
  // Auto-answer after 1 second (gives time for WWE to process)
  setTimeout(() => {
    if (session.state === 'ringing') {
      session.accept();
    }
  }, 1000);
});
```

This will make calls auto-answer, bypassing the T-Server Answer mechanism entirely.

## Testing the Fix

### Test 1: Verify T-Server Sends Answer Event

Check T-Server/SIP Server logs when you click Accept:

```bash
# On Genesys server
tail -f /path/to/SIP_P*.log | grep -i "answer\|200 OK"
```

Look for:
- T-Server processing Answer request from WWE
- T-Server sending answer signal to DN
- Any errors or timeouts

### Test 2: Verify webrtc-gateway-bridge Receives Event

Add logging in webrtc-gateway-bridge:

```javascript
console.log('[Call Event]', event.notificationType, event.call.state);
```

Check if:
- StatusChange event is received
- State changes from Ringing → Talking

### Test 3: Verify SIP 200 OK is Sent

Capture SIP traffic:

```bash
# On Asterisk server
sudo docker exec -it webrtc-asterisk asterisk -rx "pjsip set logger on"
sudo docker logs -f webrtc-asterisk | grep "200 OK"
```

Should see:
```
<--- Transmitting SIP Response (XXX bytes) to UDP:192.168.210.81:5060 --->
SIP/2.0 200 OK
```

## Next Steps

1. **Immediate**: Test with auto-answer workaround to confirm other parts work
2. **Short-term**: Implement Workspace API integration for Answer events
3. **Long-term**: Full T-Server call control integration in webrtc-gateway-bridge

## Files to Modify

1. `webrtc-gateway-bridge/src/main.js` - Add Workspace client init
2. `webrtc-gateway-bridge/src/workspace-client.js` - New file for WS integration
3. `webrtc-gateway-bridge/package.json` - Add `ws` dependency if not present

## Configuration Needed

1. Workspace API session ID (from WWE login)
2. WebSocket URL: `ws://192.168.210.54:8090/api/v2/me/calls`
3. Proper authentication/session management

## Success Criteria

After fix:
- ✅ Click Accept in WWE
- ✅ webrtc-gateway-bridge receives Answer event
- ✅ 200 OK sent within 2 seconds
- ✅ Call connects successfully
- ✅ Audio flows bidirectionally
- ✅ No timeout errors

## Conclusion

The issue is that **webrtc-gateway-bridge doesn't implement T-Server's call control events**. It needs to be enhanced to:
1. Listen for Answer events from T-Server (via Workspace API)
2. Send SIP 200 OK when Answer is received
3. Properly integrate with T-Server's call state management

This is a **software integration issue**, not a configuration problem.
