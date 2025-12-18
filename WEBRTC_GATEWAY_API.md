# WebRTC Gateway API Documentation

## Overview

The WebRTC Gateway Service provides a REST API for WWE (Genesys Workspace Web Edition) to enable WebRTC calling. This follows the architecture diagram where WWE agents communicate via HTTP REST API, and the gateway translates between REST and SIP.

## Architecture

```
┌──────────────┐                 ┌──────────────┐                 ┌──────────┐
│ WWE Agent    │  HTTP REST API  │   WebRTC     │   SIP (WSS)     │ Kamailio │
│  (Browser)   │ ◄─────────────► │   Gateway    │ ◄──────────────►│ Asterisk │
│              │                 │  Service     │                 │          │
└──────────────┘                 └──────────────┘                 └──────────┘
```

## API Endpoints

### 1. Agent Sign-In (Register)

Register an agent with the SIP server.

**Endpoint:** `GET /api/webrtc/sign_in`

**Parameters:**
- `id` (string, required): Agent ID (WWE username)
- `dn` (string, required): Agent DN/Extension (e.g., "5001")
- `password` (string, required): SIP password

**Example:**
```bash
curl "http://localhost:8082/api/webrtc/sign_in?id=agent123&dn=5001&password=Genesys2024!WebRTC"
```

**Success Response:**
```
HTTP/1.1 200 OK
OK
```

**Error Response:**
```json
HTTP/1.1 401 Unauthorized
{
  "error": "Registration failed: Authentication failure"
}
```

---

### 2. Place Call (Send SDP Offer)

Initiate an outbound call by sending an SDP offer.

**Endpoint:** `POST /api/webrtc/message`

**Parameters:**
- `from` (string, required): Agent ID
- `to` (string, required): Destination number

**Body:** SDP offer (Content-Type: text/plain)

**Example:**
```bash
curl -X POST "http://localhost:8082/api/webrtc/message?from=agent123&to=1003" \
  -H "Content-Type: text/plain" \
  --data-binary @offer.sdp
```

**Success Response:**
```
HTTP/1.1 200 OK
OK
```

**Error Response:**
```json
HTTP/1.1 404 Not Found
{
  "error": "Agent not signed in"
}
```

---

### 3. Poll for Messages (Get SDP Answer)

Poll for pending messages (SDP answers).

**Endpoint:** `GET /api/webrtc/message`

**Parameters:**
- `id` (string, required): Agent ID

**Example:**
```bash
curl "http://localhost:8082/api/webrtc/message?id=agent123"
```

**Success Response (with message):**
```
HTTP/1.1 200 OK
Content-Type: text/plain

v=0
o=- 1234567890 1234567890 IN IP4 192.168.210.54
s=-
c=IN IP4 192.168.210.54
t=0 0
m=audio 10000 RTP/AVP 0 8 9
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:9 G722/8000
a=sendrecv
```

**No Messages Response:**
```
HTTP/1.1 204 No Content
```

---

### 4. Sign Out (Unregister)

Unregister an agent from the SIP server.

**Endpoint:** `GET /api/webrtc/sign_out`

**Parameters:**
- `id` (string, required): Agent ID

**Example:**
```bash
curl "http://localhost:8082/api/webrtc/sign_out?id=agent123"
```

**Success Response:**
```
HTTP/1.1 200 OK
OK
```

---

### 5. Health Check

Check service health and status.

**Endpoint:** `GET /api/health`

**Example:**
```bash
curl "http://localhost:8082/api/health"
```

**Response:**
```json
{
  "status": "ok",
  "service": "webrtc-gateway",
  "version": "1.0.0",
  "uptime": 12345.67,
  "registered_agents": 3,
  "active_calls": 1
}
```

---

### 6. List Registered Agents

Get list of all registered agents.

**Endpoint:** `GET /api/agents`

**Example:**
```bash
curl "http://localhost:8082/api/agents"
```

**Response:**
```json
{
  "agents": [
    {
      "id": "agent123",
      "dn": "5001",
      "registered_at": 1700000000000
    }
  ],
  "count": 1
}
```

---

### 7. List Active Calls

Get list of all active calls.

**Endpoint:** `GET /api/calls/active`

**Example:**
```bash
curl "http://localhost:8082/api/calls/active"
```

**Response:**
```json
{
  "calls": [
    {
      "call_id": "call-1700000000000",
      "agent_id": "agent123",
      "remote": "1003",
      "direction": "outgoing"
    }
  ],
  "count": 1
}
```

---

## Call Flow Example

### Outbound Call Flow

```
1. Agent Signs In
   GET /api/webrtc/sign_in?id=agent123&dn=5001&password=xxx
   → 200 OK

2. WWE Generates SDP Offer (WebRTC)
   (Agent clicks "Call" button in WWE)

3. WWE Sends SDP Offer
   POST /api/webrtc/message?from=agent123&to=1003
   Body: <SDP offer>
   → 200 OK

4. Gateway → SIP INVITE → Asterisk

5. WWE Polls for Answer
   GET /api/webrtc/message?id=agent123
   → 200 OK (SDP answer)

6. WWE Sets Remote Description
   (Audio flows via WebRTC)

7. Call Ends
   (Either party hangs up)

8. Agent Signs Out (optional)
   GET /api/webrtc/sign_out?id=agent123
   → 200 OK
```

### Inbound Call Flow

```
1. Agent Signs In
   GET /api/webrtc/sign_in?id=agent123&dn=5001&password=xxx
   → 200 OK

2. Asterisk → SIP INVITE → Gateway

3. Gateway Stores SDP Offer

4. WWE Polls for Messages
   GET /api/webrtc/message?id=agent123
   → 200 OK (SDP offer from caller)

5. WWE Generates SDP Answer

6. WWE Sends Answer
   POST /api/webrtc/message?from=agent123
   Body: <SDP answer>
   → 200 OK

7. Gateway → SIP 200 OK → Asterisk

8. Audio flows via WebRTC
```

---

## Integration with WWE

### WWE Gadget Example

```javascript
// wwe-webrtc-gadget.js

var WebRTCGadget = {
    agentId: null,
    dn: null,
    pc: null, // RTCPeerConnection
    baseUrl: 'http://localhost:8082',

    init: function(agentId, dn, password) {
        this.agentId = agentId;
        this.dn = dn;
        
        // Sign in
        fetch(`${this.baseUrl}/api/webrtc/sign_in?id=${agentId}&dn=${dn}&password=${password}`)
            .then(response => {
                if (response.ok) {
                    console.log('Registered successfully');
                    this.startPolling();
                } else {
                    console.error('Registration failed');
                }
            });
    },

    placeCall: function(destination) {
        // Create RTCPeerConnection
        this.pc = new RTCPeerConnection();
        
        // Get local media
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                stream.getTracks().forEach(track => {
                    this.pc.addTrack(track, stream);
                });
                
                // Create offer
                return this.pc.createOffer();
            })
            .then(offer => {
                this.pc.setLocalDescription(offer);
                
                // Send SDP offer to gateway
                return fetch(`${this.baseUrl}/api/webrtc/message?from=${this.agentId}&to=${destination}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: offer.sdp
                });
            })
            .then(response => {
                if (response.ok) {
                    console.log('Call initiated');
                }
            });
    },

    startPolling: function() {
        // Poll for SDP answers
        setInterval(() => {
            fetch(`${this.baseUrl}/api/webrtc/message?id=${this.agentId}`)
                .then(response => {
                    if (response.status === 200) {
                        return response.text();
                    }
                })
                .then(sdp => {
                    if (sdp) {
                        // Received SDP answer
                        this.pc.setRemoteDescription({
                            type: 'answer',
                            sdp: sdp
                        });
                    }
                });
        }, 1000); // Poll every second
    },

    signOut: function() {
        fetch(`${this.baseUrl}/api/webrtc/sign_out?id=${this.agentId}`)
            .then(() => {
                console.log('Signed out');
            });
    }
};

// Initialize when WWE loads
WebRTCGadget.init('agent123', '5001', 'Genesys2024!WebRTC');
```

---

## Environment Variables

Configure the service using these environment variables:

- `HTTP_PORT` (default: 8082): REST API port
- `SIP_SERVER` (default: 192.168.210.54): SIP server IP
- `SIP_PORT` (default: 5060): SIP server port
- `SIP_WS_SERVER` (default: ws://192.168.210.54:8080): SIP WebSocket URL
- `SIP_DOMAIN` (default: SIP_SERVER): SIP domain
- `LOG_LEVEL` (default: info): Logging level (debug, info, warn, error)

---

## Deployment

### Docker Deployment

The service is included in the Docker Compose stack:

```bash
cd /home/Gencct/webrtc-genesys
sudo git pull origin main
sudo docker-compose stop signaling-server
sudo docker-compose rm -f signaling-server
sudo docker-compose up -d --build signaling-server
```

### Access

- REST API: `http://192.168.210.54:8084` (via Nginx proxy)
- Direct: `http://localhost:8082` (from server)

---

## Troubleshooting

### Check Service Status

```bash
curl http://localhost:8082/api/health
```

### View Logs

```bash
sudo docker logs -f webrtc-signaling-server
```

### Check Registered Agents

```bash
curl http://localhost:8082/api/agents
```

### Check Active Calls

```bash
curl http://localhost:8082/api/calls/active
```

---

## Security Considerations

1. **Authentication**: Currently uses SIP credentials. Consider adding API keys for WWE.
2. **HTTPS**: Use HTTPS in production (configure Nginx).
3. **CORS**: May need to enable CORS for WWE origin.
4. **Rate Limiting**: Add rate limiting for production.

---

## Next Steps

1. Test API with curl/Postman
2. Create WWE gadget integration
3. Add authentication middleware
4. Implement call state notifications
5. Add call recording support

