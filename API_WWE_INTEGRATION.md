# Custom Signaling REST API - WWE/Genesys Integration

## Overview

REST API endpoints for WebRTC custom signaling server with WWE (Workspace Web Edition) and Genesys integration.

**Base URL:** `https://192.168.210.54:8443/api`

---

## Authentication

Currently no authentication. For production, add:
- API keys
- JWT tokens
- OAuth 2.0

---

## Endpoints

### 1. Health Check

**GET** `/api/health`

Check if signaling server is running.

**Response:**
```json
{
  "status": "ok",
  "service": "kamailio-custom-signaling",
  "version": "1.0",
  "timestamp": "1734522035",
  "uptime": 3600
}
```

**cURL:**
```bash
curl -k https://192.168.210.54:8443/api/health
```

---

### 2. Get DN Information

**GET** `/api/dn/{dn}`

Get SIP endpoint details for a specific DN.

**Parameters:**
- `dn` - Directory Number (e.g., 5001)

**Response:**
```json
{
  "dn": "5001",
  "status": "available",
  "sip_uri": "sip:5001@192.168.210.54"
}
```

**cURL:**
```bash
curl -k https://192.168.210.54:8443/api/dn/5001
```

**Use Case:**
- WWE needs to know SIP endpoint for a DN
- Get DN availability status
- Validate DN before routing

---

### 3. List All DNs

**GET** `/api/dn/list`

Get all registered DNs with their SIP endpoints.

**Response:**
```json
{
  "dns": [
    {
      "dn": "5001",
      "sip_uri": "sip:5001@192.168.210.54",
      "status": "registered"
    },
    {
      "dn": "5002",
      "sip_uri": "sip:5002@192.168.210.54",
      "status": "registered"
    }
  ]
}
```

**cURL:**
```bash
curl -k https://192.168.210.54:8443/api/dn/list
```

**Use Case:**
- WWE dashboard showing all available agents
- Agent selection UI
- Capacity planning

---

### 4. Genesys/WWE Status

**GET** `/api/genesys/status`

Get Genesys WWE integration status.

**Response:**
```json
{
  "connected": true,
  "server": "192.168.210.81:5060",
  "service": "wwe",
  "status": "active"
}
```

**cURL:**
```bash
curl -k https://192.168.210.54:8443/api/genesys/status
```

**Use Case:**
- Monitor Genesys connectivity
- Health dashboard
- Alerting system

---

### 5. Active Calls

**GET** `/api/calls/active`

Get count of currently active calls.

**Response:**
```json
{
  "active_calls": 5,
  "timestamp": "1734522035"
}
```

**cURL:**
```bash
curl -k https://192.168.210.54:8443/api/calls/active
```

**Use Case:**
- Real-time call volume monitoring
- Load balancing decisions
- Capacity alerts

---

### 6. Calls by DN

**GET** `/api/calls/dn/{dn}`

Get active calls for a specific DN.

**Parameters:**
- `dn` - Directory Number

**Response:**
```json
{
  "dn": "5001",
  "active_calls": [
    {
      "call_id": "call-123",
      "from": "sip:5001@192.168.210.54",
      "to": "sip:1003@192.168.210.54",
      "state": "confirmed",
      "duration": 120
    }
  ],
  "count": 1
}
```

**cURL:**
```bash
curl -k https://192.168.210.54:8443/api/calls/dn/5001
```

**Use Case:**
- Agent dashboard showing their calls
- Supervisor monitoring agent activity
- Call detail reporting

---

### 7. Make Call (REST)

**POST** `/api/call/make`

Initiate a call via REST API (for WWE integration).

**Request Body:**
```json
{
  "from": "5001",
  "to": "1003"
}
```

**Response:**
```json
{
  "status": "initiated",
  "from": "5001",
  "to": "1003",
  "call_id": "call-789456"
}
```

**Status Codes:**
- `202 Accepted` - Call initiated
- `400 Bad Request` - Missing parameters
- `404 Not Found` - DN not found
- `503 Service Unavailable` - Asterisk unreachable

**cURL:**
```bash
curl -k -X POST https://192.168.210.54:8443/api/call/make \
  -H "Content-Type: application/json" \
  -d '{"from":"5001","to":"1003"}'
```

**Use Case:**
- WWE click-to-dial
- Automated outbound calling
- Call center campaigns
- Integration with CRM

---

### 8. Hangup Call (REST)

**POST** `/api/call/hangup`

Terminate an active call via REST API.

**Request Body:**
```json
{
  "call_id": "call-789456"
}
```

**Response:**
```json
{
  "status": "terminated",
  "call_id": "call-789456"
}
```

**Status Codes:**
- `200 OK` - Call terminated
- `400 Bad Request` - Missing call_id
- `404 Not Found` - Call not found

**cURL:**
```bash
curl -k -X POST https://192.168.210.54:8443/api/call/hangup \
  -H "Content-Type: application/json" \
  -d '{"call_id":"call-789456"}'
```

**Use Case:**
- Supervisor disconnect
- Forced call termination
- Emergency disconnect
- Call timeout enforcement

---

## WWE Integration Examples

### Example 1: Click-to-Dial from WWE

```javascript
// WWE JavaScript
async function clickToDial(agentDN, customerNumber) {
  const response = await fetch('https://192.168.210.54:8443/api/call/make', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: agentDN,
      to: customerNumber
    })
  });
  
  const result = await response.json();
  console.log('Call initiated:', result.call_id);
  return result.call_id;
}

// Usage
clickToDial('5001', '1003');
```

---

### Example 2: Monitor Agent Status

```javascript
// Check if agent DN is registered
async function checkAgentStatus(dn) {
  const response = await fetch(`https://192.168.210.54:8443/api/dn/${dn}`);
  const data = await response.json();
  return data.status; // 'available', 'busy', etc.
}

// Usage
const status = await checkAgentStatus('5001');
```

---

### Example 3: Get Agent's Active Calls

```javascript
// WWE dashboard
async function getAgentCalls(dn) {
  const response = await fetch(`https://192.168.210.54:8443/api/calls/dn/${dn}`);
  const data = await response.json();
  
  return data.active_calls.map(call => ({
    callId: call.call_id,
    with: call.to,
    duration: call.duration
  }));
}

// Usage
const calls = await getAgentCalls('5001');
console.log(`Agent has ${calls.length} active calls`);
```

---

### Example 4: Supervisor Disconnect

```javascript
// Supervisor force-disconnect a call
async function supervisorDisconnect(callId) {
  const response = await fetch('https://192.168.210.54:8443/api/call/hangup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ call_id: callId })
  });
  
  return response.ok;
}

// Usage
supervisorDisconnect('call-789456');
```

---

### Example 5: Real-Time Dashboard

```javascript
// WWE real-time monitoring
async function updateDashboard() {
  // Get all DNs
  const dnsResp = await fetch('https://192.168.210.54:8443/api/dn/list');
  const { dns } = await dnsResp.json();
  
  // Get active calls
  const callsResp = await fetch('https://192.168.210.54:8443/api/calls/active');
  const { active_calls } = await callsResp.json();
  
  // Update UI
  document.getElementById('total-agents').textContent = dns.length;
  document.getElementById('active-calls').textContent = active_calls;
}

// Refresh every 5 seconds
setInterval(updateDashboard, 5000);
```

---

## Genesys Integration

### Scenario 1: Genesys Routes Call to WebRTC Agent

```
1. Genesys receives inbound call
2. Genesys queries: GET /api/dn/5001
3. Response: {"dn":"5001","status":"available","sip_uri":"sip:5001@192.168.210.54"}
4. Genesys routes to: sip:5001@192.168.210.54
5. Kamailio forwards INVITE to browser via WebSocket
6. Agent answers in browser
```

### Scenario 2: WWE Makes Outbound Call

```
1. Agent clicks customer in WWE
2. WWE calls: POST /api/call/make {"from":"5001","to":"5551234567"}
3. Kamailio generates SIP INVITE
4. Call routed: Browser → Asterisk → Genesys → PSTN
5. WWE polls: GET /api/calls/dn/5001 for status
```

### Scenario 3: Call Transfer

```
1. Agent on call with customer
2. Agent initiates transfer in WWE
3. WWE calls: POST /api/call/make {"from":"5002","to":"5551234567"}
4. WWE monitors both calls
5. When 5002 answers, WWE hangs up 5001's call
6. WWE calls: POST /api/call/hangup {"call_id":"call-123"}
```

---

## Error Responses

All endpoints may return:

### 400 Bad Request
```json
{
  "error": "Missing required parameter: from"
}
```

### 404 Not Found
```json
{
  "error": "DN not found: 5001"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to connect to Asterisk"
}
```

### 503 Service Unavailable
```json
{
  "error": "Genesys server unreachable"
}
```

---

## Rate Limiting

Current: No rate limiting

Recommended for production:
- 100 requests/minute per IP
- 1000 requests/hour per API key

---

## CORS

Configure Nginx to allow WWE domain:

```nginx
add_header 'Access-Control-Allow-Origin' 'https://wwe.genesys.com';
add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization';
```

---

## Testing

### Test All Endpoints

```bash
#!/bin/bash

BASE_URL="https://192.168.210.54:8443/api"

echo "Testing REST API..."

# Health
curl -k "$BASE_URL/health"

# DN info
curl -k "$BASE_URL/dn/5001"

# DN list
curl -k "$BASE_URL/dn/list"

# Genesys status
curl -k "$BASE_URL/genesys/status"

# Active calls
curl -k "$BASE_URL/calls/active"

# Calls by DN
curl -k "$BASE_URL/calls/dn/5001"

# Make call
curl -k -X POST "$BASE_URL/call/make" \
  -H "Content-Type: application/json" \
  -d '{"from":"5001","to":"1003"}'

echo "Tests complete!"
```

---

## Next Steps

1. ✅ API endpoints defined
2. 🚧 Integrate with Asterisk for live data
3. 🚧 Add authentication
4. 🚧 Implement rate limiting
5. 🚧 Add webhook callbacks
6. 🚧 Create API client libraries

---

**Status:** API framework ready, needs integration with live Asterisk/Dialog data

**Documentation:** Complete

**Ready for:** WWE/Genesys integration testing

