# 📡 Complete API Documentation

**WebRTC Gateway - Genesys Integration**  
**Version:** 1.0  
**Release:** v1.0-browser-jssip-working  
**Base URL:** `https://192.168.210.54:8443`

---

## Table of Contents

1. [Dashboard APIs](#1-dashboard-apis)
2. [WebRTC Gateway APIs](#2-webrtc-gateway-apis)
3. [WebSocket Endpoints](#3-websocket-endpoints)
4. [Error Codes](#4-error-codes)
5. [Authentication](#5-authentication)
6. [Rate Limiting](#6-rate-limiting)

---

## 1. Dashboard APIs

**Base URL:** `https://192.168.210.54:8443/api/`  
**Service:** Dashboard (Python Flask)  
**Port:** 5000 (proxied via Nginx)

### 1.1 Health Check

Get dashboard service health status.

**Endpoint:** `GET /api/health`

**Request:**
```bash
curl -k https://192.168.210.54:8443/api/health
```

**Response:** `200 OK`
```json
{
  "status": "ok",
  "service": "webrtc-dashboard",
  "version": "1.0.0",
  "uptime_seconds": 3600,
  "timestamp": "2025-12-23T15:30:45Z"
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Service status: `ok` or `error` |
| `service` | string | Service name |
| `version` | string | API version |
| `uptime_seconds` | integer | Uptime in seconds |
| `timestamp` | string | Current server timestamp (ISO 8601) |

---

### 1.2 Get Registrations

Get all active SIP registrations from Asterisk.

**Endpoint:** `GET /api/registrations`

**Request:**
```bash
curl -k https://192.168.210.54:8443/api/registrations
```

**Response:** `200 OK`
```json
{
  "success": true,
  "registrations": [
    {
      "endpoint": "5001",
      "aor": "5001",
      "contact": "sip:5001@192.168.210.54:5060",
      "status": "Registered",
      "transport": "UDP",
      "expiry": 300,
      "user_agent": "JsSIP 3.10.0",
      "registered_at": "2025-12-23T15:25:10Z",
      "ip_address": "192.168.210.54",
      "port": 5060
    },
    {
      "endpoint": "5002",
      "aor": "5002",
      "contact": "sip:5002@192.168.1.100:52341",
      "status": "Registered",
      "transport": "WebSocket",
      "expiry": 600,
      "user_agent": "JsSIP 3.10.0",
      "registered_at": "2025-12-23T15:20:30Z",
      "ip_address": "192.168.1.100",
      "port": 52341
    }
  ],
  "total_count": 2,
  "timestamp": "2025-12-23T15:30:45Z"
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Request success status |
| `registrations` | array | Array of registration objects |
| `registrations[].endpoint` | string | SIP endpoint/DN |
| `registrations[].aor` | string | Address of Record |
| `registrations[].contact` | string | SIP contact URI |
| `registrations[].status` | string | Registration status |
| `registrations[].transport` | string | Transport protocol (UDP/TCP/WebSocket) |
| `registrations[].expiry` | integer | Registration expiry in seconds |
| `registrations[].user_agent` | string | SIP User-Agent header |
| `registrations[].registered_at` | string | Registration timestamp (ISO 8601) |
| `registrations[].ip_address` | string | Client IP address |
| `registrations[].port` | integer | Client port |
| `total_count` | integer | Total number of registrations |
| `timestamp` | string | Response timestamp (ISO 8601) |

**Error Response:** `500 Internal Server Error`
```json
{
  "success": false,
  "error": "Failed to connect to Asterisk AMI",
  "details": "Connection timeout after 5s",
  "timestamp": "2025-12-23T15:30:45Z"
}
```

---

### 1.3 Get Kamailio Status

Get Kamailio dispatcher status and backend health.

**Endpoint:** `GET /api/kamailio`

**Request:**
```bash
curl -k https://192.168.210.54:8443/api/kamailio
```

**Response:** `200 OK`
```json
{
  "success": true,
  "kamailio_running": true,
  "container_status": "Up 2 hours",
  "dispatchers": [
    {
      "setid": "1",
      "destination": "sip:192.168.210.54:5060",
      "ip": "192.168.210.54",
      "port": "5060",
      "flags": "0",
      "health": "Healthy",
      "last_check": "2025-12-23T15:30:40Z",
      "latency_ms": 2
    },
    {
      "setid": "2",
      "destination": "sip:192.168.210.81:5060",
      "ip": "192.168.210.81",
      "port": "5060",
      "flags": "0",
      "health": "Unavailable",
      "last_check": "2025-12-23T15:30:40Z",
      "latency_ms": null
    }
  ],
  "dispatcher_count": 2,
  "timestamp": "2025-12-23T15:30:45Z"
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Request success status |
| `kamailio_running` | boolean | Kamailio container running status |
| `container_status` | string | Docker container status |
| `dispatchers` | array | Array of dispatcher backends |
| `dispatchers[].setid` | string | Dispatcher set ID |
| `dispatchers[].destination` | string | SIP destination URI |
| `dispatchers[].ip` | string | Backend IP address |
| `dispatchers[].port` | string | Backend SIP port |
| `dispatchers[].flags` | string | Dispatcher flags |
| `dispatchers[].health` | string | Health status: `Healthy`, `Unavailable`, `Checking`, `Unknown` |
| `dispatchers[].last_check` | string | Last health check timestamp |
| `dispatchers[].latency_ms` | integer/null | Response latency in milliseconds |
| `dispatcher_count` | integer | Total number of dispatchers |
| `timestamp` | string | Response timestamp (ISO 8601) |

---

## 2. WebRTC Gateway APIs

**Base URL:** `http://192.168.210.54:8084/api/`  
**Service:** Signaling Server (Node.js)  
**Port:** 8084 (internal - not exposed externally)

> **Note:** These APIs are for internal use or direct server access. The browser-based client (`wwe-webrtc-gateway.html`) uses JsSIP directly via WebSocket and doesn't call these REST endpoints.

### 2.1 Sign In (Register Agent)

Register an agent with the SIP server.

**Endpoint:** `GET /api/webrtc/sign_in`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Agent ID (unique identifier) |
| `dn` | string | Yes | Directory Number / Extension (e.g., "5001") |
| `password` | string | Yes | SIP password |

**Request:**
```bash
curl 'http://192.168.210.54:8084/api/webrtc/sign_in?id=agent123&dn=5001&password=Genesys2024!WebRTC'
```

**Response:** `200 OK`
```
OK
```

**Error Response:** `401 Unauthorized`
```json
{
  "error": "Registration failed: Authentication Error",
  "details": "Invalid credentials for DN 5001",
  "timestamp": "2025-12-23T15:30:45Z"
}
```

**Error Response:** `400 Bad Request`
```json
{
  "error": "Missing required parameters",
  "required": ["id", "dn", "password"],
  "provided": ["id", "dn"],
  "timestamp": "2025-12-23T15:30:45Z"
}
```

---

### 2.2 Place Call (Send SDP Offer)

Initiate an outbound call by sending an SDP offer.

**Endpoint:** `POST /api/webrtc/message`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | string | Yes | Agent ID |
| `to` | string | Yes | Destination number |

**Headers:**
```
Content-Type: text/plain
```

**Request Body:** (SDP Offer)
```
v=0
o=- 1234567890 1234567890 IN IP4 192.168.1.100
s=-
c=IN IP4 192.168.1.100
t=0 0
m=audio 54321 UDP/TLS/RTP/SAVPF 0 8 9 101
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:9 G722/8000
a=rtpmap:101 telephone-event/8000
a=sendrecv
a=fingerprint:sha-256 AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78
a=setup:actpass
a=ice-ufrag:abcd1234
a=ice-pwd:abcdefghijklmnopqrstuvwxyz123456
```

**Request:**
```bash
curl -X POST 'http://192.168.210.54:8084/api/webrtc/message?from=agent123&to=1003' \
  -H 'Content-Type: text/plain' \
  --data-binary @offer.sdp
```

**Response:** `200 OK`
```
OK
```

**Error Response:** `404 Not Found`
```json
{
  "error": "Agent not signed in",
  "agent_id": "agent123",
  "message": "Agent must call /api/webrtc/sign_in first",
  "timestamp": "2025-12-23T15:30:45Z"
}
```

**Error Response:** `500 Internal Server Error`
```json
{
  "error": "Failed to initiate call",
  "details": "SIP INVITE timeout",
  "timestamp": "2025-12-23T15:30:45Z"
}
```

---

### 2.3 Poll for Messages (Get SDP Answer)

Poll for pending messages (SDP answers or incoming call offers).

**Endpoint:** `GET /api/webrtc/message`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Agent ID |

**Request:**
```bash
curl 'http://192.168.210.54:8084/api/webrtc/message?id=agent123'
```

**Response (with message):** `200 OK`
```
v=0
o=Asterisk 1234567890 1234567890 IN IP4 192.168.210.54
s=Asterisk
c=IN IP4 192.168.210.54
t=0 0
m=audio 19876 RTP/AVP 0 8 101
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-16
a=ptime:20
a=maxptime:140
a=sendrecv
```

**Response (no messages):** `204 No Content`

**Error Response:** `404 Not Found`
```json
{
  "error": "Agent not found",
  "agent_id": "agent123",
  "timestamp": "2025-12-23T15:30:45Z"
}
```

---

### 2.4 Sign Out (Unregister Agent)

Unregister an agent from the SIP server.

**Endpoint:** `GET /api/webrtc/sign_out`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Agent ID |

**Request:**
```bash
curl 'http://192.168.210.54:8084/api/webrtc/sign_out?id=agent123'
```

**Response:** `200 OK`
```
OK
```

**Error Response:** `404 Not Found`
```json
{
  "error": "Agent not found",
  "agent_id": "agent123",
  "timestamp": "2025-12-23T15:30:45Z"
}
```

---

### 2.5 Gateway Health Check

Check WebRTC Gateway service health.

**Endpoint:** `GET /api/health`

**Request:**
```bash
curl http://192.168.210.54:8084/api/health
```

**Response:** `200 OK`
```json
{
  "status": "ok",
  "service": "webrtc-gateway",
  "version": "1.0.0",
  "uptime": 12345.67,
  "registered_agents": 3,
  "active_calls": 1,
  "sip_connection": "connected",
  "sip_server": "192.168.210.54:5060",
  "timestamp": "2025-12-23T15:30:45Z"
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Service status: `ok` or `error` |
| `service` | string | Service name |
| `version` | string | Gateway version |
| `uptime` | number | Uptime in seconds |
| `registered_agents` | integer | Number of registered agents |
| `active_calls` | integer | Number of active calls |
| `sip_connection` | string | SIP connection status: `connected`, `disconnected`, `connecting` |
| `sip_server` | string | SIP server address |
| `timestamp` | string | Response timestamp (ISO 8601) |

---

### 2.6 List Registered Agents

Get list of all registered agents.

**Endpoint:** `GET /api/agents`

**Request:**
```bash
curl http://192.168.210.54:8084/api/agents
```

**Response:** `200 OK`
```json
{
  "agents": [
    {
      "id": "agent123",
      "dn": "5001",
      "registered_at": 1703347845000,
      "uptime": 600,
      "last_activity": "2025-12-23T15:30:45Z",
      "status": "available"
    },
    {
      "id": "agent456",
      "dn": "5002",
      "registered_at": 1703347900000,
      "uptime": 545,
      "last_activity": "2025-12-23T15:29:30Z",
      "status": "on_call"
    }
  ],
  "count": 2,
  "timestamp": "2025-12-23T15:30:45Z"
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `agents` | array | Array of agent objects |
| `agents[].id` | string | Agent ID |
| `agents[].dn` | string | Directory Number |
| `agents[].registered_at` | integer | Registration timestamp (Unix epoch ms) |
| `agents[].uptime` | integer | Session uptime in seconds |
| `agents[].last_activity` | string | Last activity timestamp (ISO 8601) |
| `agents[].status` | string | Agent status: `available`, `on_call`, `idle` |
| `count` | integer | Total number of registered agents |
| `timestamp` | string | Response timestamp (ISO 8601) |

---

### 2.7 List Active Calls

Get list of all active calls.

**Endpoint:** `GET /api/calls/active`

**Request:**
```bash
curl http://192.168.210.54:8084/api/calls/active
```

**Response:** `200 OK`
```json
{
  "calls": [
    {
      "call_id": "call-1703347845123",
      "agent_id": "agent123",
      "agent_dn": "5001",
      "remote_party": "1003",
      "direction": "outgoing",
      "status": "connected",
      "started_at": "2025-12-23T15:25:45Z",
      "duration": 300,
      "sip_call_id": "abc123def456@192.168.210.54",
      "local_sdp": "v=0\no=- ...",
      "remote_sdp": "v=0\no=Asterisk ..."
    },
    {
      "call_id": "call-1703347900456",
      "agent_id": "agent456",
      "agent_dn": "5002",
      "remote_party": "18005551234",
      "direction": "incoming",
      "status": "ringing",
      "started_at": "2025-12-23T15:30:00Z",
      "duration": 45,
      "sip_call_id": "xyz789ghi012@192.168.210.54",
      "local_sdp": null,
      "remote_sdp": "v=0\no=Genesys ..."
    }
  ],
  "count": 2,
  "timestamp": "2025-12-23T15:30:45Z"
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `calls` | array | Array of call objects |
| `calls[].call_id` | string | Internal call ID |
| `calls[].agent_id` | string | Agent ID |
| `calls[].agent_dn` | string | Agent Directory Number |
| `calls[].remote_party` | string | Remote party number |
| `calls[].direction` | string | Call direction: `outgoing` or `incoming` |
| `calls[].status` | string | Call status: `ringing`, `connected`, `on_hold` |
| `calls[].started_at` | string | Call start timestamp (ISO 8601) |
| `calls[].duration` | integer | Call duration in seconds |
| `calls[].sip_call_id` | string | SIP Call-ID header |
| `calls[].local_sdp` | string/null | Local SDP offer/answer |
| `calls[].remote_sdp` | string/null | Remote SDP offer/answer |
| `count` | integer | Total number of active calls |
| `timestamp` | string | Response timestamp (ISO 8601) |

---

## 3. WebSocket Endpoints

### 3.1 SIP over WebSocket (WSS)

**Endpoint:** `wss://192.168.210.54:8443/ws`  
**Protocol:** SIP over WebSocket (RFC 7118)  
**Target:** Kamailio (port 8080)  
**Client:** JsSIP 3.10.0

**Usage:**
```javascript
// JsSIP WebSocket connection
const socket = new JsSIP.WebSocketInterface('wss://192.168.210.54:8443/ws');
const configuration = {
    sockets: [socket],
    uri: 'sip:5001@192.168.210.54',
    password: 'Genesys2024!WebRTC'
};
const ua = new JsSIP.UA(configuration);
ua.start();
```

**Message Format:**
Standard SIP messages wrapped in WebSocket frames.

**Example - REGISTER Request:**
```
REGISTER sip:192.168.210.54 SIP/2.0
Via: SIP/2.0/WSS hak3pk6pkeaf.invalid;branch=z9hG4bK5687345
Max-Forwards: 69
To: <sip:5001@192.168.210.54>
From: "5001" <sip:5001@192.168.210.54>;tag=saghhs0rfi
Call-ID: b1dgqe8krc9g44a10tln
CSeq: 7499 REGISTER
Contact: <sip:5nblrf57@hak3pk6pkeaf.invalid;transport=ws;ob>
Expires: 600
Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY
Supported: ice,replaces,outbound
User-Agent: JsSIP 3.10.0
Content-Length: 0
```

**Example - REGISTER Response:**
```
SIP/2.0 200 OK
Via: SIP/2.0/WSS hak3pk6pkeaf.invalid;rport=5182;received=192.168.210.54;branch=z9hG4bK5687345
Call-ID: b1dgqe8krc9g44a10tln
From: "5001" <sip:5001@192.168.210.54>;tag=saghhs0rfi
To: <sip:5001@192.168.210.54>;tag=z9hG4bKddba.dbd043d16bb0c275d11f379b167d1255.0
CSeq: 7499 REGISTER
Contact: <sip:5nblrf57@hak3pk6pkeaf.invalid;transport=ws;ob>;expires=600
Server: Asterisk-Genesys-Gateway
Content-Length: 0
```

**Connection Flow:**
1. Browser opens WSS connection to Nginx (8443)
2. Nginx proxies to Kamailio WS (8080)
3. Kamailio converts WS to UDP SIP
4. Kamailio forwards to Asterisk (5060)
5. Responses follow reverse path

---

### 3.2 Custom Signaling WebSocket

**Endpoint:** `wss://192.168.210.54:8443/signaling`  
**Protocol:** Custom JSON over WebSocket  
**Target:** Custom Signaling Server (port 8083)  
**Status:** Available but not currently used

**Message Format:**
```json
{
  "type": "register|call|answer|hangup|status",
  "payload": { ... },
  "id": "msg-unique-id",
  "timestamp": "2025-12-23T15:30:45Z"
}
```

**Example - Register Message:**
```json
{
  "type": "register",
  "payload": {
    "dn": "5001",
    "password": "Genesys2024!WebRTC"
  },
  "id": "msg-123456",
  "timestamp": "2025-12-23T15:30:45Z"
}
```

**Example - Response:**
```json
{
  "type": "response",
  "status": "success",
  "original_id": "msg-123456",
  "data": {
    "registered": true,
    "dn": "5001"
  },
  "timestamp": "2025-12-23T15:30:46Z"
}
```

---

## 4. Error Codes

### HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| `200` | OK | Request successful |
| `204` | No Content | Request successful but no data to return |
| `400` | Bad Request | Invalid request parameters |
| `401` | Unauthorized | Authentication failed |
| `404` | Not Found | Resource not found (agent, call, etc.) |
| `500` | Internal Server Error | Server-side error |
| `503` | Service Unavailable | Service temporarily unavailable |

### Application Error Codes

**Authentication Errors:**
```json
{
  "error": "Authentication Error",
  "code": "AUTH_FAILED",
  "details": "Invalid credentials for DN 5001"
}
```

**Registration Errors:**
```json
{
  "error": "Registration Failed",
  "code": "REG_FAILED",
  "details": "SIP server unreachable"
}
```

**Call Errors:**
```json
{
  "error": "Call Failed",
  "code": "CALL_FAILED",
  "details": "Destination not found: 1003",
  "sip_code": 404,
  "sip_reason": "Not Found"
}
```

**Validation Errors:**
```json
{
  "error": "Validation Error",
  "code": "INVALID_PARAMS",
  "details": "Missing required parameter: dn",
  "required": ["id", "dn", "password"],
  "provided": ["id", "password"]
}
```

---

## 5. Authentication

**Current Status:** ⚠️ No API authentication implemented

**SIP Authentication:** ✅ Digest authentication for SIP REGISTER and INVITE

**Planned for Production:**
- API Key authentication
- JWT tokens
- OAuth 2.0 integration with Genesys

**Example Future Authentication Header:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 6. Rate Limiting

**Current Status:** ⚠️ No rate limiting implemented

**Planned Limits:**
- 100 requests per minute per IP
- 10 registration attempts per minute per DN
- 5 concurrent calls per agent

**Example Rate Limit Response:**
```json
{
  "error": "Rate Limit Exceeded",
  "code": "RATE_LIMIT",
  "limit": 100,
  "window": "60s",
  "retry_after": 30
}
```

---

## 7. Complete Call Flow Example

### Outbound Call - Step by Step

```bash
# Step 1: Sign In
curl 'http://192.168.210.54:8084/api/webrtc/sign_in?id=agent123&dn=5001&password=Genesys2024!WebRTC'
# Response: OK

# Step 2: Generate SDP Offer (in browser using WebRTC)
# peerConnection.createOffer()

# Step 3: Send SDP Offer
curl -X POST 'http://192.168.210.54:8084/api/webrtc/message?from=agent123&to=1003' \
  -H 'Content-Type: text/plain' \
  --data-binary @offer.sdp
# Response: OK

# Step 4: Poll for SDP Answer
curl 'http://192.168.210.54:8084/api/webrtc/message?id=agent123'
# Response: <SDP Answer>

# Step 5: Set Remote Description (in browser)
# peerConnection.setRemoteDescription(answer)

# Step 6: Audio flows via WebRTC

# Step 7: Sign Out (optional)
curl 'http://192.168.210.54:8084/api/webrtc/sign_out?id=agent123'
# Response: OK
```

---

## 8. Postman Collection

### Import these requests into Postman:

**Collection Name:** WebRTC Gateway API v1.0

**Variables:**
- `base_url`: `https://192.168.210.54:8443`
- `gateway_url`: `http://192.168.210.54:8084`
- `agent_id`: `agent123`
- `agent_dn`: `5001`
- `agent_password`: `Genesys2024!WebRTC`

**Requests:**
1. Dashboard - Health Check
2. Dashboard - Get Registrations
3. Dashboard - Get Kamailio Status
4. Gateway - Sign In
5. Gateway - Get Agents
6. Gateway - Get Active Calls
7. Gateway - Sign Out

---

## 9. Testing Examples

### Test Dashboard APIs

```bash
# Health check
curl -k https://192.168.210.54:8443/api/health

# Get registrations
curl -k https://192.168.210.54:8443/api/registrations | jq .

# Get Kamailio status
curl -k https://192.168.210.54:8443/api/kamailio | jq .
```

### Test Gateway APIs (from server)

```bash
# SSH to server
ssh Gencct@192.168.210.54

# Health check
curl http://localhost:8084/api/health | jq .

# Sign in
curl 'http://localhost:8084/api/webrtc/sign_in?id=test001&dn=5001&password=Genesys2024!WebRTC'

# Get agents
curl http://localhost:8084/api/agents | jq .

# Get active calls
curl http://localhost:8084/api/calls/active | jq .

# Sign out
curl 'http://localhost:8084/api/webrtc/sign_out?id=test001'
```

### Test with JQ filters

```bash
# Get only registered agent DNs
curl -k https://192.168.210.54:8443/api/registrations | jq '.registrations[].endpoint'

# Count registrations
curl -k https://192.168.210.54:8443/api/registrations | jq '.total_count'

# Filter healthy dispatchers
curl -k https://192.168.210.54:8443/api/kamailio | jq '.dispatchers[] | select(.health == "Healthy")'

# Get agent count
curl http://localhost:8084/api/agents | jq '.count'
```

---

## 10. Troubleshooting

### Common Issues

**1. Connection Refused**
```bash
# Check if services are running
sudo docker ps | grep -E "nginx|kamailio|asterisk|dashboard"

# Check service logs
sudo docker logs webrtc-nginx --tail 50
sudo docker logs webrtc-kamailio --tail 50
```

**2. SSL Certificate Error**
```bash
# Use -k flag for self-signed certificates
curl -k https://192.168.210.54:8443/api/health
```

**3. Empty Response**
```bash
# Check if Redis is running (used for session storage)
sudo docker logs webrtc-redis --tail 20
```

**4. 404 Not Found**
```bash
# Verify Nginx proxy configuration
sudo docker exec webrtc-nginx cat /etc/nginx/nginx.conf | grep location
```

---

## 11. Security Best Practices

### For Production Deployment:

1. **Enable HTTPS for all endpoints**
   - Use valid SSL certificates (Let's Encrypt)
   - Disable HTTP port 80

2. **Implement API Authentication**
   - Add API keys or JWT tokens
   - Integrate with Genesys authentication

3. **Add Rate Limiting**
   - Prevent brute force attacks
   - Limit concurrent calls per agent

4. **Enable CORS properly**
   - Whitelist WWE domain only
   - Restrict origins

5. **Encrypt sensitive data**
   - Don't log passwords
   - Encrypt SDP in transit

6. **Monitor and Alert**
   - Set up logging aggregation
   - Alert on failed auth attempts
   - Monitor call quality metrics

---

## 12. Changelog

### v1.0-browser-jssip-working (2025-12-23)
- ✅ Initial release
- ✅ Dashboard APIs for monitoring
- ✅ WebRTC Gateway APIs (internal)
- ✅ Browser-based JsSIP client
- ✅ WebSocket proxy via Nginx
- ✅ Kamailio SIP proxy integration
- ✅ Asterisk backend
- ✅ Genesys trunk routing

---

## 13. Support

**Repository:** https://github.com/abhi2varma/webrtc-genesys  
**Release:** v1.0-browser-jssip-working  
**Documentation:** See `PACKET_LOGGING_GUIDE.md` for call flow tracing

**Contact:**
- GitHub Issues: https://github.com/abhi2varma/webrtc-genesys/issues

---

**End of API Documentation**

