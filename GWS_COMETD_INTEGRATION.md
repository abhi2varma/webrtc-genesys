# GWS CometD Integration Guide

## Overview

CometD is Genesys Web Services' real-time messaging system that delivers **CTI events** (Computer Telephony Integration) to agents' browsers for call state synchronization, screen pops, and customer data updates.

---

## 🔍 How CometD Works in GWS

### Architecture

```
Agent Browser
   │
   ├── GWS UI (Port 8090)
   │   └── /ui/ad/v1/index.html
   │
   └── CometD Connection
       ├── WebSocket (preferred)  ws://server:8090/genesys/cometd
       └── Long-Polling (fallback)  http://server:8090/genesys/cometd/handshake
           │
           └── Genesys Web Services (Jetty)
               ├── CME (Configuration)
               ├── T-Server (Voice CTI)
               ├── Interaction Server (Multimedia)
               └── Cassandra (Data Persistence)
```

---

## 📋 CometD Configuration in GWS

### From `application.yaml` (Lines 224-237)

```yaml
cometD:
  enabled: true
  path: /genesys/cometd
  transports:
    - websocket         # Primary transport (but NOT supported per docs)
    - long-polling      # Fallback transport (HTTP long-polling)

cometDSettings:
  cookieHttpOnly: true
  cookieSecure: false      # Set to true for HTTPS
  cookieSameSite: Lax
```

**Key Points:**
1. **Endpoint:** `http://192.168.210.54:8090/genesys/cometd`
2. **Transports:** WebSocket listed but NOT supported per [Genesys docs](https://docs.genesys.com/Documentation/HTCC/latest/Dep/CometD)
3. **Actually uses:** HTTP long-polling (Comet push pattern)

---

## 🔧 CometD Transport Mechanism

### What is Long-Polling?

```javascript
// Client initiates handshake
POST http://192.168.210.54:8090/genesys/cometd/handshake
{
  "channel": "/meta/handshake",
  "version": "1.0",
  "supportedConnectionTypes": ["callback-polling", "long-polling"]
}

// Server responds with clientId
{
  "channel": "/meta/handshake",
  "successful": true,
  "clientId": "xyz123abc",
  "supportedConnectionTypes": ["long-polling"],
  "advice": {
    "timeout": 60000,      // 60 seconds
    "interval": 0,
    "reconnect": "retry"
  }
}

// Client establishes long-polling connection
POST http://192.168.210.54:8090/genesys/cometd
{
  "channel": "/meta/connect",
  "clientId": "xyz123abc",
  "connectionType": "long-polling"
}

// Server HOLDS the connection open until:
// 1. An event occurs (call state change, chat message, etc.)
// 2. Timeout expires (60 seconds)
// 3. Connection error

// When event occurs, server responds:
[
  {
    "channel": "/v2/me/calls",
    "data": {
      "notificationType": "StateChange",
      "call": {
        "id": "abc123",
        "state": "Ringing",
        "from": "5001",
        "to": "5002"
      }
    }
  }
]

// Client immediately reconnects (long-poll again)
```

---

## 📡 CometD Channels (Subscriptions)

### Voice CTI Events

```javascript
// Subscribe to call events
{
  "channel": "/meta/subscribe",
  "subscription": "/v2/me/calls",
  "clientId": "xyz123abc"
}

// Events received on this channel:
// - CallRinging
// - CallEstablished
// - CallReleased
// - CallHeld
// - CallRetrieved
// - CallTransferred
```

### Agent State Events

```javascript
// Subscribe to agent state changes
{
  "channel": "/meta/subscribe",
  "subscription": "/v2/me/state",
  "clientId": "xyz123abc"
}

// Events:
// - Ready
// - NotReady
// - AfterCallWork
// - LoggedOut
```

### Multimedia Events

```javascript
// Subscribe to chat/email/workitem events
{
  "channel": "/meta/subscribe",
  "subscription": "/v2/me/interactions",
  "clientId": "xyz123abc"
}
```

---

## 🔐 Authentication Flow

### Step 1: Agent Logs into GWS

```
1. Agent opens http://192.168.210.54:8090/ui/ad/v1/index.html
2. Enters username/password
3. GWS authenticates against Genesys Configuration Server
4. Creates HTTP session with cookies
```

### Step 2: CometD Uses Same Session

```javascript
// CometD client automatically sends session cookies
Headers:
  Cookie: JSESSIONID=ABC123XYZ; Path=/; HttpOnly; SameSite=Lax
  
// GWS validates session
// Returns clientId bound to agent's DN
```

### Step 3: Subscription to Agent's DN

```
GWS internally:
1. Reads agent's DN from session (e.g., DN=5001)
2. Opens protocol connection to T-Server
3. Registers for DN events (RegisterAddress)
4. Maps T-Server events -> CometD messages
```

---

## 🚀 Integrating WebRTC Client with GWS CometD

### Option 1: Embedded in GWS (Recommended)

**Use GWS Widgets API to embed WebRTC client:**

```javascript
// In GWS Agent Desktop
window.genesys.wwe.service.registerWidget({
  id: 'webrtc-phone',
  title: 'WebRTC Phone',
  url: 'http://192.168.210.54/index.html',
  width: 300,
  height: 500
});

// WebRTC client can access CometD from parent window
const cometd = window.parent.genesys.wwe.cometd;

// Subscribe to call events
cometd.subscribe('/v2/me/calls', function(message) {
  console.log('Call event from Genesys:', message.data);
  
  // Synchronize WebRTC client state
  if (message.data.notificationType === 'StateChange') {
    const call = message.data.call;
    if (call.state === 'Ringing') {
      // Auto-answer in WebRTC client
      webrtcSession.answer();
    }
  }
});
```

### Option 2: Standalone Client with CometD Connection

**Connect directly to GWS CometD from standalone WebRTC client:**

```javascript
// In nginx/html/app.js
let cometd;

function connectGWS(gwsUrl, username, password) {
  // Load CometD library (already in index.html)
  cometd = new org.cometd.CometD();
  
  // Configure
  cometd.configure({
    url: gwsUrl + '/genesys/cometd',
    logLevel: 'info'
  });
  
  // Add authentication extension
  cometd.registerExtension('auth', {
    outgoing: function(message) {
      // Add session token or basic auth
      if (message.channel === '/meta/handshake') {
        message.ext = message.ext || {};
        message.ext.authentication = {
          username: username,
          password: password
        };
      }
      return message;
    }
  });
  
  // Handshake
  cometd.handshake(function(handshakeReply) {
    if (handshakeReply.successful) {
      console.log('CometD connected:', handshakeReply.clientId);
      subscribeToCallEvents();
    } else {
      console.error('CometD handshake failed:', handshakeReply);
    }
  });
}

function subscribeToCallEvents() {
  cometd.subscribe('/v2/me/calls', function(message) {
    console.log('Genesys call event:', message.data);
    
    // Sync with WebRTC SIP client
    const call = message.data.call;
    if (call.state === 'Ringing' && call.direction === 'Inbound') {
      // Show incoming call in WebRTC UI
      updateCallStatus(`Incoming: ${call.from}`);
    }
  });
  
  cometd.subscribe('/v2/me/state', function(message) {
    console.log('Agent state changed:', message.data);
  });
}
```

---

## 🔧 Required Configuration Changes

### 1. Enable CORS in GWS (Already Configured)

From `application.yaml` lines 129-141:

```yaml
crossOriginSettings:
  corsFilterCacheTimeToLive: 120
  allowedOrigins: http://*                    # Allows all HTTP origins
  allowedMethods: GET,POST,PUT,DELETE,OPTIONS
  allowedHeaders: "X-Requested-With,Content-Type,Accept,Origin,Cookie,authorization,ssid,surl,ContactCenterId,X-CSRF-TOKEN"
  allowCredentials: true                      # Required for CometD cookies
  exposedHeaders: "X-CSRF-HEADER,X-CSRF-TOKEN"
```

**For production, restrict origins:**
```yaml
allowedOrigins: http://192.168.210.54,http://192.168.210.54:8090
```

### 2. Disable CSRF for Testing (Already Configured)

From line 66:
```yaml
serverSettings:
  enableCsrfProtection: "false"              # Disabled for easier testing
```

**For production, enable and handle CSRF tokens:**
```yaml
enableCsrfProtection: "true"
```

### 3. Session Configuration

From lines 18, 22-24:
```yaml
jetty:
  sessionMaxInactiveInterval: 1800           # 30 minutes
  cookies:
    httpOnly: true
    secure: false                            # Set to true for HTTPS
    sameSite: Lax                            # Allows cross-site requests
```

---

## 📊 Call Flow with CometD

### Scenario: Inbound Call to Agent DN 5001

```
1. Customer calls DN 5001
   ↓
2. Genesys SIP Server routes to T-Server
   ↓
3. T-Server sends EventRinging to DN 5001
   ↓
4. GWS receives T-Server event
   ↓
5. GWS publishes CometD message:
   Channel: /v2/me/calls
   Data: { state: "Ringing", from: "+1234567890", to: "5001" }
   ↓
6. Agent's browser receives CometD message
   ↓
7. GWS UI shows call notification
   ↓
8. WebRTC client (if subscribed) also receives event
   ↓
9. WebRTC client auto-answers SIP call to Asterisk
   ↓
10. Asterisk bridges to Genesys SIP Server
    ↓
11. T-Server sends EventEstablished
    ↓
12. GWS publishes: { state: "Established" }
    ↓
13. Both GWS UI and WebRTC client show "Connected"
```

---

## 🐛 Troubleshooting

### Issue 1: 404 Not Found on `/cometd/handshake`

**Error:**
```
GET http://192.168.210.54:8090/cometd/handshake
404 Not Found
```

**Cause:** Wrong endpoint path

**Fix:** Use `/genesys/cometd` not `/cometd`:
```javascript
cometd.configure({
  url: 'http://192.168.210.54:8090/genesys/cometd'  // Correct
});
```

### Issue 2: WebSocket Connection Refused

**Error:**
```
NS_ERROR_WEBSOCKET_CONNECTION_REFUSED
ws://192.168.210.54:8090/genesys/cometd
```

**Cause:** GWS does NOT support WebSocket despite config

**Fix:** Force long-polling only:
```javascript
cometd.configure({
  url: 'http://192.168.210.54:8090/genesys/cometd',
  logLevel: 'info'
  // CometD will automatically use long-polling
});
```

### Issue 3: CORS Error

**Error:**
```
Access to fetch at 'http://192.168.210.54:8090/genesys/cometd' 
from origin 'http://192.168.210.54' has been blocked by CORS policy
```

**Cause:** CORS not configured or wrong origin

**Fix:** In GWS `application.yaml`:
```yaml
crossOriginSettings:
  allowedOrigins: http://192.168.210.54,http://192.168.210.54:8090
  allowCredentials: true
```

### Issue 4: Authentication Required

**Error:**
```
403 Forbidden
{ "error": "Not authenticated" }
```

**Cause:** CometD requires authenticated session

**Fix:** 
1. **Option A:** Login to GWS first, then CometD uses session cookie
2. **Option B:** Send auth in handshake message (see Option 2 above)

---

## 📚 CometD JavaScript Library

### Version Used by GWS

**CometD 3.1.12** (found in `gws/lib/cometd-java-server-3.1.12.jar`)

### Client Library Location

```
gws/BOOT-INF/classes/static/ui/ad/v1/lib/org/cometd.js
gws/BOOT-INF/classes/static/ui/ad/v1/lib/org/cometd-3.1.12.js
gws/BOOT-INF/classes/static/ui/ad/v1/lib/jquery/jquery.cometd.js
```

**Already added to WebRTC client:**
```html
<script src="https://cdn.jsdelivr.net/npm/cometd@7.0.11/cometd.js"></script>
```

**Note:** Using CometD 7.x (newer) should be backward compatible with 3.x server.

---

## 🎯 Next Steps for Integration

### 1. Verify GWS is Running

```bash
# From CentOS server
curl -I http://192.168.210.54:8090/ui/ad/v1/index.html
# Expected: 200 OK

curl -I http://192.168.210.54:8090/genesys/cometd
# Expected: 405 Method Not Allowed (GET not allowed, POST required)
```

### 2. Test CometD Handshake

```bash
curl -X POST http://192.168.210.54:8090/genesys/cometd/handshake \
  -H "Content-Type: application/json" \
  -d '[{"channel":"/meta/handshake","version":"1.0","supportedConnectionTypes":["long-polling"]}]'

# Expected:
# [{
#   "channel": "/meta/handshake",
#   "successful": true,
#   "clientId": "...",
#   "supportedConnectionTypes": ["long-polling"]
# }]
```

### 3. Update WebRTC Client

Modify `nginx/html/app.js` to:
1. Connect to GWS CometD on "Connect GWS" button
2. Subscribe to `/v2/me/calls` channel
3. Synchronize call state between Genesys and WebRTC SIP

### 4. Test End-to-End Flow

1. Agent logs into GWS (`http://192.168.210.54:8090/ui/ad/v1/index.html`)
2. Opens WebRTC client (`http://192.168.210.54`)
3. WebRTC registers to Asterisk (DN 5001)
4. WebRTC connects to GWS CometD
5. Make test call to DN 5001
6. Verify:
   - GWS shows call notification
   - WebRTC client receives CometD event
   - Call rings in WebRTC client
   - Answer synchronizes with Genesys

---

## 📖 References

- [Genesys CometD Documentation](https://docs.genesys.com/Documentation/HTCC/latest/Dep/CometD)
- [CometD.org](http://cometd.org/)
- [GWS Configuration Guide](https://docs.genesys.com/Documentation/HTCC/latest/Config/WebServices)

---

## Summary

**CometD in GWS provides:**
- ✅ Real-time CTI event push (call state, agent state, customer data)
- ✅ HTTP long-polling transport (NOT WebSocket)
- ✅ Endpoint: `http://192.168.210.54:8090/genesys/cometd`
- ✅ Subscription channels: `/v2/me/calls`, `/v2/me/state`, `/v2/me/interactions`
- ✅ CORS enabled for cross-origin access
- ✅ Session-based authentication

**For WebRTC integration:**
- Connect CometD client to GWS
- Subscribe to call events
- Synchronize call state with SIP client
- Enable screen pops and CTI features

