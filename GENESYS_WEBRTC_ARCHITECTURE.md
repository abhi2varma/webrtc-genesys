# Genesys WebRTC Integration Architecture

## Document Reference
- **WRTC Developer Guide**: en-WRTC-8.5.2-Developer-book.pdf
- **GWS Deployment Guide**: en-GWS-8.6.0-Dep-book.pdf

## What We're Building

We are creating an **open-source alternative** to the Genesys WebRTC Gateway that integrates with:
1. **WWE (Workspace Web Edition)** - Genesys agent desktop interface
2. **Asterisk** - As the PBX backend (instead of Genesys SIP Server)
3. **Kamailio** - As the SIP proxy/WebSocket gateway

## Official Genesys WebRTC Architecture

### Genesys WRTC 8.5.2 Components:

```
┌─────────────────────────────────────────────────────────────┐
│                    Genesys Ecosystem                        │
│                                                             │
│  ┌──────────┐      ┌───────────────┐      ┌─────────────┐ │
│  │   WWE    │◄────►│  WebRTC GW    │◄────►│ Genesys SIP │ │
│  │ (Browser)│      │  (WRTC 8.5.2) │      │   Server    │ │
│  └──────────┘      └───────────────┘      └─────────────┘ │
│       │                    │                      │         │
│  JavaScript API     REST/WebSocket           SIP/TDM       │
│  (Grtc.Client,           ROAP                              │
│   Grtc.MediaSession)   Protocol                            │
└─────────────────────────────────────────────────────────────┘
```

### Our Open-Source Alternative:

```
┌─────────────────────────────────────────────────────────────┐
│                    Our Implementation                        │
│                                                             │
│  ┌──────────┐      ┌───────────────┐      ┌─────────────┐ │
│  │   WWE    │◄────►│  WebRTC GW    │◄────►│  Kamailio   │ │
│  │ (Browser)│      │ (Node.js+JsSIP)│◄────►│  Asterisk   │ │
│  └──────────┘      └───────────────┘      └─────────────┘ │
│       │                    │                      │         │
│  REST API           REST/SIP WebSocket        SIP/RTP      │
│  (Compatible with        JsSIP                             │
│   Genesys API)     (Handles Auth)                          │
└─────────────────────────────────────────────────────────────┘
```

## Genesys WebRTC Gateway API (Official)

The official Genesys WRTC 8.5.2 provides these key APIs:

### 1. Client Registration (Grtc.Client)

**JavaScript API in Browser:**
```javascript
// Official Genesys WRTC Client
var client = new Grtc.Client({
    serverUrl: 'https://webrtc-gateway:8080',
    username: 'agent123',
    dn: '5001',
    password: 'xxx'
});

client.on('ready', function() {
    console.log('Client registered');
});

client.connect();
```

**Under the hood, this calls:**
```
GET /api/webrtc/sign_in?id=agent123&dn=5001&password=xxx
```

### 2. Media Session (Grtc.MediaSession)

**JavaScript API in Browser:**
```javascript
// Official Genesys WRTC Media Session
var session = client.newMediaSession({
    destination: '1003',
    constraints: { audio: true, video: false }
});

session.on('offer', function(sdp) {
    // SDP offer generated
});

session.on('answer', function(sdp) {
    // SDP answer received
});

session.connect();
```

**Under the hood:**
1. Browser creates WebRTC `RTCPeerConnection`
2. Generates SDP offer via `createOffer()`
3. Sends to gateway:
   ```
   POST /api/webrtc/message?from=agent123&to=1003
   Content-Type: text/plain
   Body: <SDP offer>
   ```
4. Polls for answer:
   ```
   GET /api/webrtc/message?id=agent123
   → Returns SDP answer
   ```

### 3. ROAP Protocol

**ROAP (RTC Offer/Answer Protocol)** - The protocol used between browser and gateway:

```
Browser                    Gateway                    SIP Server
   │                          │                           │
   │── SDP Offer ────────────>│                           │
   │   POST /api/webrtc/      │── SIP INVITE ────────────>│
   │        message           │   (with SDP)              │
   │                          │                           │
   │<─ 200 OK ────────────────│                           │
   │                          │<─ 200 OK ─────────────────│
   │                          │   (with SDP answer)       │
   │                          │                           │
   │── Poll for Answer ──────>│                           │
   │   GET /api/webrtc/       │                           │
   │       message            │                           │
   │                          │                           │
   │<─ SDP Answer ────────────│                           │
   │                          │                           │
   │                     setRemoteDescription()           │
   │<──────────── RTP Audio Flow ───────────────────────>│
```

## API Endpoints Comparison

| Function | Genesys WRTC 8.5.2 | Our Implementation | Status |
|----------|-------------------|-------------------|--------|
| **Sign In** | `GET /api/webrtc/sign_in` | `GET /api/webrtc/sign_in` | ✅ |
| **Sign Out** | `GET /api/webrtc/sign_out` | `GET /api/webrtc/sign_out` | ✅ |
| **Send Offer** | `POST /api/webrtc/message` | `POST /api/webrtc/message` | ✅ |
| **Poll Answer** | `GET /api/webrtc/message` | `GET /api/webrtc/message` | ✅ |
| **Health Check** | `GET /api/health` | `GET /api/health` | ✅ |
| **DTMF** | Via SIP INFO | Via JsSIP | ✅ |
| **Call Hold** | Via SIP re-INVITE | Via JsSIP | 🔄 |
| **Transfer** | Via SIP REFER | Via JsSIP | 🔄 |

## Key Differences

### 1. Authentication
- **Genesys**: Proprietary authentication + SIP digest
- **Our Implementation**: SIP digest authentication via JsSIP

### 2. Transport
- **Genesys**: WebSocket (WSS) to proprietary gateway
- **Our Implementation**: WebSocket (WSS) to Kamailio → Asterisk

### 3. Backend
- **Genesys**: Genesys SIP Server + T-Server + Config Server
- **Our Implementation**: Asterisk + Kamailio (open-source)

### 4. Features
- **Genesys**: Full contact center features (routing, reporting, recording)
- **Our Implementation**: Core WebRTC calling (extensible)

## WWE Integration Methods

### Method 1: Genesys Interaction SDK (Official)

**From GWS 8.6.0 Deployment Guide:**

```javascript
// WWE Workspace SDK
var workspace = require('workspace-sdk');

workspace.init({
    apiUrl: 'https://gws-server:8080',
    token: 'xxx'
});

// Subscribe to call events
workspace.voice.on('CallStarted', function(call) {
    // Handle call
});

// Make call
workspace.voice.makeCall({
    destination: '1003'
});
```

**Integration Point:** WWE Workspace SDK triggers our WebRTC Gateway API calls

### Method 2: WWE Gadget (Recommended)

**Custom Gadget Embedded in WWE:**

```javascript
// wwe-webrtc-gadget.js
// This runs inside WWE's iframe

var webrtcGadget = (function() {
    var pc = null; // RTCPeerConnection
    var agentId = null;
    var dn = null;
    var gatewayUrl = 'http://192.168.210.54:8084'; // Our gateway

    return {
        init: function(config) {
            agentId = config.agentId;
            dn = config.dn;
            
            // Sign in to WebRTC Gateway
            return fetch(gatewayUrl + '/api/webrtc/sign_in?' + 
                'id=' + agentId + 
                '&dn=' + dn + 
                '&password=' + config.password
            );
        },

        placeCall: function(destination) {
            // Create WebRTC peer connection
            pc = new RTCPeerConnection();
            
            // Get microphone
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(function(stream) {
                    pc.addStream(stream);
                    return pc.createOffer();
                })
                .then(function(offer) {
                    pc.setLocalDescription(offer);
                    
                    // Send to our gateway
                    return fetch(gatewayUrl + '/api/webrtc/message?' +
                        'from=' + agentId + '&to=' + destination, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain' },
                        body: offer.sdp
                    });
                })
                .then(function() {
                    // Start polling for answer
                    pollForAnswer();
                });
        },

        pollForAnswer: function() {
            var pollInterval = setInterval(function() {
                fetch(gatewayUrl + '/api/webrtc/message?id=' + agentId)
                    .then(function(response) {
                        if (response.status === 200) {
                            return response.text();
                        }
                    })
                    .then(function(sdp) {
                        if (sdp) {
                            clearInterval(pollInterval);
                            
                            // Set remote description
                            pc.setRemoteDescription({
                                type: 'answer',
                                sdp: sdp
                            });
                        }
                    });
            }, 1000);
        },

        hangup: function() {
            if (pc) {
                pc.close();
                pc = null;
            }
        },

        signOut: function() {
            fetch(gatewayUrl + '/api/webrtc/sign_out?id=' + agentId);
        }
    };
})();

// Expose to WWE
window.webrtcGadget = webrtcGadget;
```

### Method 3: Browser Extension (Fallback)

If WWE doesn't support gadgets, create a browser extension that:
1. Detects WWE interface
2. Injects WebRTC controls
3. Intercepts call events
4. Calls our gateway API

## WWE to Gateway Call Flow

### Outbound Call Example

```
┌─────────┐          ┌──────────┐          ┌──────────┐          ┌─────────┐
│   WWE   │          │  Gadget  │          │ Gateway  │          │Asterisk │
└────┬────┘          └─────┬────┘          └─────┬────┘          └────┬────┘
     │                     │                      │                    │
     │ Agent clicks "Call" │                      │                    │
     ├────────────────────>│                      │                    │
     │                     │                      │                    │
     │                     │ getUserMedia()       │                    │
     │                     ├──────────────────>   │                    │
     │                     │ <Audio Stream>       │                    │
     │                     │                      │                    │
     │                     │ createOffer()        │                    │
     │                     │ (generates SDP)      │                    │
     │                     │                      │                    │
     │                     │ POST /api/webrtc/    │                    │
     │                     │      message         │                    │
     │                     ├─────────────────────>│                    │
     │                     │                      │ SIP INVITE         │
     │                     │                      │ (with SDP)         │
     │                     │                      ├───────────────────>│
     │                     │                      │                    │
     │                     │                      │ 100 Trying         │
     │                     │                      │<───────────────────│
     │                     │                      │ 180 Ringing        │
     │                     │                      │<───────────────────│
     │                     │                      │                    │
     │                     │ GET /api/webrtc/     │                    │
     │                     │     message (poll)   │                    │
     │                     ├─────────────────────>│ 200 OK             │
     │                     │ 204 No Content       │ (with SDP answer)  │
     │                     │<─────────────────────│<───────────────────│
     │                     │                      │                    │
     │                     │ GET /api/webrtc/     │ (answer stored)    │
     │                     │     message (poll)   │                    │
     │                     ├─────────────────────>│                    │
     │                     │ 200 OK               │                    │
     │                     │ <SDP answer>         │                    │
     │                     │<─────────────────────│                    │
     │                     │                      │                    │
     │                     │ setRemoteDescription │                    │
     │                     │                      │                    │
     │ Call connected      │<════════════════ RTP Audio ══════════════>│
     │ (show timer)        │                      │                    │
     │<────────────────────│                      │                    │
     │                     │                      │                    │
     │ Agent clicks        │                      │                    │
     │ "Hangup"            │                      │                    │
     ├────────────────────>│ pc.close()           │                    │
     │                     │                      │ SIP BYE            │
     │                     │                      ├───────────────────>│
     │                     │                      │ 200 OK             │
     │                     │                      │<───────────────────│
     │                     │                      │                    │
```

## Configuration

### Gateway Service (Our Implementation)

**docker-compose.yml:**
```yaml
services:
  signaling-server:
    build: ./signaling-server
    ports:
      - "8082:8082"  # Internal HTTP API
    environment:
      - HTTP_PORT=8082
      - SIP_SERVER=192.168.210.54
      - SIP_WS_SERVER=ws://192.168.210.54:8080
      - SIP_DOMAIN=192.168.210.54
```

### Nginx Proxy (External Access)

**nginx.conf:**
```nginx
location /api/webrtc/ {
    proxy_pass http://signaling-server:8082/api/webrtc/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

**Access:** `https://192.168.210.54:8084/api/webrtc/sign_in`

## Testing the Gateway

### 1. Health Check

```bash
curl http://192.168.210.54:8084/api/health
```

Expected:
```json
{
  "status": "ok",
  "service": "webrtc-gateway",
  "uptime": 3600,
  "registered_agents": 0,
  "active_calls": 0
}
```

### 2. Sign In

```bash
curl "http://192.168.210.54:8084/api/webrtc/sign_in?id=agent123&dn=5001&password=Genesys2024!WebRTC"
```

Expected: `OK`

### 3. Place Call (with test SDP)

```bash
curl -X POST "http://192.168.210.54:8084/api/webrtc/message?from=agent123&to=1003" \
  -H "Content-Type: text/plain" \
  --data-binary @- << 'EOF'
v=0
o=- 1234567890 1234567890 IN IP4 127.0.0.1
s=-
t=0 0
m=audio 9 UDP/TLS/RTP/SAVPF 0 8
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=sendrecv
EOF
```

Expected: `OK`

### 4. Poll for Answer

```bash
curl "http://192.168.210.54:8084/api/webrtc/message?id=agent123"
```

Expected: SDP answer (text/plain)

## Next Steps

### Phase 1: Gateway Testing ✅
- [x] Build REST API gateway
- [x] Implement sign_in, sign_out, message endpoints
- [x] Test with curl/Postman
- [ ] Deploy and test on server

### Phase 2: WWE Integration 🔄
- [ ] Identify WWE version and capabilities
- [ ] Choose integration method (Gadget vs SDK)
- [ ] Develop WWE gadget
- [ ] Test in WWE environment

### Phase 3: Production Readiness 🔜
- [ ] Add authentication/authorization
- [ ] Implement call state management
- [ ] Add error handling and retries
- [ ] Set up monitoring and logging
- [ ] Performance testing
- [ ] Security audit

## Resources

### Official Genesys Documentation
- **WRTC Developer Guide**: https://docs.genesys.com/Documentation/WRTC/8.5.2/Developer/Welcome
- **GWS Deployment Guide**: https://docs.genesys.com/Documentation/GWS/8.6.0/Dep/Architecture
- **Workspace SDK**: https://docs.genesys.com/Documentation/GWS/latest/SDK/WorkspaceSDK

### Our Documentation
- `WEBRTC_GATEWAY_API.md` - Complete API reference
- `signaling-server/test-wwe-client.js` - Test client
- `signaling-server/server.js` - Gateway implementation

## Summary

**What We've Built:**
- A Genesys WRTC 8.5.2-compatible REST API gateway
- Uses JsSIP for SIP authentication and signaling
- Connects WWE agents to Asterisk PBX
- Open-source alternative to Genesys WebRTC Gateway

**What's Next:**
1. Deploy and test the gateway on server
2. Integrate with WWE using gadget/SDK
3. Test end-to-end call flow
4. Add production features (auth, monitoring, etc.)

**Key Advantage:**
We're providing the same API interface that WWE expects (matching Genesys WRTC), but routing calls through our open-source stack (Asterisk + Kamailio) instead of proprietary Genesys components.

