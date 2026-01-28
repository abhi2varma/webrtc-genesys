# WWE Call Integration Issue

## Date: 2026-01-28 07:00 UTC

## Problem

Calls from DN 1003 to DN 1002 are:
- ✅ Received by the WebRTC Bridge
- ✅ Auto-answered by the bridge (500ms delay)
- ❌ **NOT appearing in WWE interface**

## Root Cause Analysis

### How WWE Gets Call Notifications (Working Case)

From `logs.txt`, the working flow is:

```
1. T-Server detects incoming call to DN 1002
2. T-Server sends event to Workspace API
3. Workspace API pushes WebSocket message to WWE:
   {
     "notificationType": "StatusChange",
     "call": {
       "id": "UIVB8J6JE91C53UIM3VI59VHQ4000001",
       "state": "Ringing",
       "participants": [{"phoneNumber": "1003"}],
       "dnis": "1002"
     }
   }
4. WWE displays the call
5. WWE auto-answers via Workspace API: POST /api/v2/me/calls/{id} {"operationName":"Answer"}
6. Workspace API tells T-Server to answer
7. T-Server sends SIP NOTIFY to SIP endpoint
8. SIP endpoint answers the call
```

### Current WebRTC Integration Flow

```
1. Asterisk receives call from DN 1003 to DN 1002
2. Asterisk sends SIP INVITE to WebRTC bridge (DN 1002)
3. WebRTC bridge detects incoming_call
4. WebRTC bridge auto-answers immediately (500ms)
5. ❌ T-Server NEVER knows about this call!
6. ❌ Workspace API never receives the event
7. ❌ WWE never gets notified
```

## The Missing Link

**T-Server is not aware of the WebRTC calls happening in Asterisk!**

The WebRTC calls are happening at the SIP level (Asterisk), but T-Server (the Genesys call controller) doesn't know about them.

## Solution Options

### Option 1: Register DNs Directly to Genesys SIP Server (RECOMMENDED)

Instead of registering to Asterisk, register WebRTC clients directly to Genesys SIP Server:

**Changes needed:**
- Configure Genesys SIP Server to accept WebRTC connections
- Point WebRTC gateway to Genesys SIP Server instead of Asterisk
- T-Server will then track all calls naturally

**Benefits:**
- ✅ Full T-Server integration
- ✅ All WWE features work (hold, transfer, conference, etc.)
- ✅ Proper call reporting and recording
- ✅ Native Genesys behavior

**Drawbacks:**
- Requires Genesys SIP Server WebRTC support
- May need Genesys configuration changes

### Option 2: Bridge Asterisk Events to T-Server via Workspace API

Create a middleware that:
1. Listens to Asterisk AMI events
2. Converts them to Workspace API calls
3. Creates "virtual calls" in T-Server

**Changes needed:**
- Extend `ami-auto-answer-handler.py` to send Workspace API events
- Authenticate with Workspace API as the agent
- Send MakeCall/AnswerCall commands on behalf of the agent

**Benefits:**
- ✅ Works with current Asterisk setup
- ✅ T-Server gets notified of calls

**Drawbacks:**
- ❌ Complex - reverse engineering the call flow
- ❌ May not support all call features
- ❌ Requires agent credentials

### Option 3: Use Genesys SIP Endpoint Emulation

Make the WebRTC bridge behave exactly like Genesys SIP Endpoint:
1. Register to Genesys SIP Server (not Asterisk)
2. Accept SIP NOTIFY for auto-answer
3. Report call state back to T-Server

**Changes needed:**
- Change registration target in `wwe-webrtc-gateway.html`
- Update SIP handling to match Genesys protocol
- Remove Asterisk from the path

**Benefits:**
- ✅ Native integration with T-Server
- ✅ Simplest architecture
- ✅ All WWE features work

**Drawbacks:**
- Need to ensure Genesys SIP Server accepts WebSocket connections

## Recommended Approach

**Option 3** is the best solution because:
1. It's how the native Genesys SIP Endpoint works
2. No middleware or complex bridging needed
3. T-Server naturally tracks all calls
4. WWE gets all events via its existing WebSocket to Workspace API

### Implementation Steps

1. **Check Genesys SIP Server Configuration**
   - Verify it supports WebSocket (WSS) connections
   - Check if DNs can register via WebSocket

2. **Update WebRTC Gateway Configuration**
   ```javascript
   // In wwe-webrtc-gateway.html, change:
   sipServer: 'wss://103.167.180.166:8443/ws'  // Currently Asterisk
   // To:
   sipServer: 'wss://GENESYS-SIP-SERVER:PORT/ws'  // Genesys SIP Server
   ```

3. **Remove Asterisk from Call Path**
   - Asterisk becomes optional (only for media relay if needed)
   - WebRTC clients connect directly to Genesys

4. **Test Registration**
   - Verify DN registers to Genesys SIP Server
   - Check T-Server shows DN as registered
   - Test call flow from DN 1003 to DN 1002

## Current Status

- ✅ WebRTC bridge working
- ✅ Auto-answer mechanism working
- ❌ T-Server integration missing
- ❌ WWE not receiving call events

## Next Steps

1. Identify Genesys SIP Server address and WebSocket support
2. Test direct registration to Genesys SIP Server
3. Update WebRTC gateway configuration
4. Test end-to-end call flow with WWE

