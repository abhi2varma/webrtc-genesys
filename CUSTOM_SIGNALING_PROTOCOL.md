# Custom WebRTC Signaling Protocol

## Overview

Replace JsSIP with a lightweight custom protocol for WebRTC signaling.

---

## Architecture

```
Browser (Custom Client)
    ↓ WebSocket (JSON messages)
Kamailio (Signaling Server)
    ↓ SIP
Asterisk (Media Server)
    ↓ SIP
Genesys
```

---

## Protocol Design

### WebSocket Messages (JSON)

All messages follow this format:
```json
{
  "type": "message_type",
  "payload": { ... },
  "id": "unique_message_id"
}
```

---

## Client → Server Messages

### 1. Register
```json
{
  "type": "register",
  "payload": {
    "dn": "5001",
    "password": "Genesys2024!WebRTC",
    "displayName": "Agent 5001"
  },
  "id": "reg-123"
}
```

### 2. Call (INVITE)
```json
{
  "type": "call",
  "payload": {
    "to": "1003",
    "sdp": "v=0\r\no=...",
    "iceServers": [...]
  },
  "id": "call-456"
}
```

### 3. Answer
```json
{
  "type": "answer",
  "payload": {
    "callId": "xyz",
    "sdp": "v=0\r\no=..."
  },
  "id": "ans-789"
}
```

### 4. Hangup
```json
{
  "type": "hangup",
  "payload": {
    "callId": "xyz",
    "reason": "user_hangup"
  },
  "id": "bye-012"
}
```

### 5. Hold
```json
{
  "type": "hold",
  "payload": {
    "callId": "xyz",
    "hold": true
  },
  "id": "hold-345"
}
```

### 6. DTMF
```json
{
  "type": "dtmf",
  "payload": {
    "callId": "xyz",
    "digit": "5"
  },
  "id": "dtmf-678"
}
```

### 7. ICE Candidate
```json
{
  "type": "iceCandidate",
  "payload": {
    "callId": "xyz",
    "candidate": {
      "candidate": "candidate:...",
      "sdpMid": "audio",
      "sdpMLineIndex": 0
    }
  },
  "id": "ice-901"
}
```

---

## Server → Client Messages

### 1. Registered
```json
{
  "type": "registered",
  "payload": {
    "dn": "5001",
    "expires": 3600,
    "server": "192.168.210.54"
  },
  "id": "reg-123"
}
```

### 2. Registration Failed
```json
{
  "type": "registrationFailed",
  "payload": {
    "reason": "Invalid credentials",
    "code": 403
  },
  "id": "reg-123"
}
```

### 3. Incoming Call
```json
{
  "type": "incomingCall",
  "payload": {
    "callId": "xyz",
    "from": "1003",
    "displayName": "Queue 1003",
    "sdp": "v=0\r\no=..."
  },
  "id": "inc-234"
}
```

### 4. Call Progress (Ringing)
```json
{
  "type": "callProgress",
  "payload": {
    "callId": "xyz",
    "state": "ringing"
  },
  "id": "prog-567"
}
```

### 5. Call Accepted
```json
{
  "type": "callAccepted",
  "payload": {
    "callId": "xyz",
    "sdp": "v=0\r\no=..."
  },
  "id": "call-456"
}
```

### 6. Call Ended
```json
{
  "type": "callEnded",
  "payload": {
    "callId": "xyz",
    "reason": "normal_clearing",
    "duration": 120
  },
  "id": "end-890"
}
```

### 7. ICE Candidate (from remote)
```json
{
  "type": "iceCandidate",
  "payload": {
    "callId": "xyz",
    "candidate": {
      "candidate": "candidate:...",
      "sdpMid": "audio",
      "sdpMLineIndex": 0
    }
  },
  "id": "ice-123"
}
```

### 8. Error
```json
{
  "type": "error",
  "payload": {
    "message": "Call failed",
    "code": 486,
    "details": "User busy"
  },
  "id": "err-456"
}
```

---

## REST API (for DN/Genesys Info)

### Get DN Info
```http
GET /api/dn/5001
Authorization: Bearer <token>

Response:
{
  "dn": "5001",
  "status": "available",
  "genesysAgent": "agent001@domain",
  "skills": ["sales", "support"]
}
```

### Get Genesys Status
```http
GET /api/genesys/status
Authorization: Bearer <token>

Response:
{
  "connected": true,
  "server": "192.168.210.81:5060",
  "registeredAgents": 45
}
```

---

## Call Flow Example

### Outbound Call

```
Browser                 Kamailio                Asterisk
   |                       |                       |
   |--register------------>|                       |
   |<-registered-----------|                       |
   |                       |                       |
   |--call (SDP offer)---->|                       |
   |                       |--INVITE (SDP)-------->|
   |<-callProgress---------|<-180 Ringing----------|
   |                       |                       |
   |                       |<-200 OK (SDP)---------|
   |<-callAccepted---------|                       |
   |  (SDP answer)         |                       |
   |                       |                       |
   |--iceCandidate-------->|--UPDATE-------------->|
   |<-iceCandidate---------|<-UPDATE---------------|
   |                       |                       |
   |    [RTP/SRTP Media - Direct or via TURN]     |
   |                       |                       |
   |--hangup-------------->|                       |
   |                       |--BYE----------------->|
   |<-callEnded------------|<-200 OK---------------|
```

---

## Advantages Over JsSIP

### 1. Simpler Client
- No 300KB JsSIP library
- Direct WebRTC API usage
- Lighter page load

### 2. Server-Side Control
- Kamailio filters codecs (no Opus in SDP)
- Kamailio handles SIP complexity
- Easier to enforce business rules

### 3. Better Integration
- REST API for DN/Genesys info
- Custom authentication
- Easier to extend

### 4. Faster Setup
- No ICE gathering on server
- Simpler SDP negotiation
- Direct PCMU codec enforcement

### 5. Better Monitoring
- All signaling visible in Kamailio logs
- Centralized call records
- Easier troubleshooting

---

## Implementation Phases

### Phase 1: Basic Registration
- WebSocket connection
- Register/Unregister
- Keep-alive

### Phase 2: Outbound Calls
- Call initiation
- SDP offer/answer
- ICE candidate exchange
- Hangup

### Phase 3: Call Control
- Hold/Resume
- Mute/Unmute
- DTMF

### Phase 4: Advanced Features
- Inbound calls
- Transfer
- Conference
- Recording

---

## Security Considerations

### Transport
- WSS (WebSocket Secure)
- TLS 1.2+
- Certificate validation

### Authentication
- JWT tokens for REST API
- SIP digest for registration
- TURN credentials per session

### Media
- DTLS-SRTP mandatory
- SHA-256 fingerprints
- Perfect Forward Secrecy

---

## Migration Strategy

### Step 1: Parallel Deployment
- Keep JsSIP version at `/index-minimal.html`
- New custom version at `/index-custom.html`
- Test both side-by-side

### Step 2: Feature Parity
- Ensure all JsSIP features work
- Verify call quality
- Test edge cases

### Step 3: Cutover
- Update default route to custom client
- Monitor for issues
- Keep JsSIP as fallback

### Step 4: Cleanup
- Remove JsSIP library
- Archive old code
- Update documentation

---

**Status:** Ready to implement
**Next:** Build custom WebRTC client

