# Genesys Workspace Web Edition (GWS) & SIP Endpoint Integration

## 📋 Overview

This document explains how the Genesys Workspace Web Edition (GWS) application integrates with the WebRTC SIP endpoint infrastructure to enable agent desktop functionality with real-time call control.

---

## 🏗️ Architecture Components

### 1. **Genesys Workspace Web Edition (GWS)**
- **Location**: `h:\Abhishek\gws-main\`
- **Type**: Spring Boot Application (Version 8.5.2)
- **Main Class**: `com.genesyslab.cloud.application.CloudWebApplication`
- **Purpose**: Agent Desktop Interface

### 2. **WebRTC SIP Infrastructure**
- **Location**: `f:\Project\WebRTC\`
- **Components**: Asterisk, Nginx, COTURN
- **Purpose**: SIP/WebRTC Gateway for voice media

---

## 🔄 Integration Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  AGENT WORKSTATION (Browser)                                          │
│                                                                        │
│  ┌────────────────────────────┐   ┌──────────────────────────────┐  │
│  │ Genesys Workspace UI       │   │ WebRTC SIP Client            │  │
│  │ (http://localhost:8080/ui) │   │ (wss://webrtc-server:8089)   │  │
│  │                             │   │                               │  │
│  │ • Agent Login               │   │ • SIP Registration (DN)      │  │
│  │ • Call Controls             │   │ • Audio/Video Media          │  │
│  │ • Screen Pops               │   │ • DTMF                       │  │
│  │ • Agent States              │   │ • Mute/Hold/Transfer         │  │
│  │ • Interactions Panel        │   │                               │  │
│  └────────────┬───────────────┘   └────────┬─────────────────────┘  │
│               │                              │                         │
│               │ REST API / CometD            │ WSS (SIP Signaling)    │
│               │ (Call Commands)              │ SRTP (Media)            │
└───────────────┼──────────────────────────────┼─────────────────────────┘
                │                              │
                │                              │
┌───────────────▼──────────────────────────────▼─────────────────────────┐
│  GWS SERVER (localhost:8080)                                            │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────┐        │
│  │  Genesys Workspace Web Services (Spring Boot)              │        │
│  │                                                              │        │
│  │  • REST API Endpoints                                       │        │
│  │  • CometD (Real-time Push)                                  │        │
│  │  • Session Management                                       │        │
│  │  • Authentication/Authorization                             │        │
│  └────────────────────┬───────────────────────────────────────┘        │
│                       │ Platform SDK (PSDK) v9.0.7                     │
└───────────────────────┼─────────────────────────────────────────────────┘
                        │
                        │ TCP (Genesys Protocols)
                        │
┌───────────────────────▼─────────────────────────────────────────────────┐
│  GENESYS ENGAGE PLATFORM (Your Network)                                 │
│                                                                          │
│  ┌────────────────────┐  ┌────────────────────┐  ┌───────────────┐   │
│  │ Configuration      │  │ T-Server            │  │ SIP Server    │   │
│  │ Server             │  │ (Telephony Control) │  │               │   │
│  │                    │  │                     │  │               │   │
│  │ • Agent Objects    │  │ • Call Events       │◄─┤ SIP Trunk     │   │
│  │ • DN Configuration │  │ • State Management  │  │               │   │
│  │ • Skills           │  │ • CTI Events        │  │               │   │
│  └────────────────────┘  └────────────────────┘  └───────┬───────┘   │
│                                                            │            │
└────────────────────────────────────────────────────────────┼────────────┘
                                                             │ SIP
                                                             │
┌────────────────────────────────────────────────────────────▼────────────┐
│  WEBRTC SIP INFRASTRUCTURE (192.168.77.131)                             │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────┐        │
│  │  Asterisk (SIP/WebRTC Gateway)                             │        │
│  │                                                              │        │
│  │  • WebRTC ←→ SIP Translation                               │        │
│  │  • Agent DN Endpoints (5001-5999)                          │        │
│  │  • Media Proxy (SRTP ←→ RTP)                               │        │
│  │  • Codec Transcoding (Opus ←→ G.711)                       │        │
│  └────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Connection Flow

### Step 1: Agent Login to GWS

```
1. Agent opens browser → http://localhost:8080/ui/ad/v1/
2. Enters credentials (username/password)
3. GWS authenticates via Configuration Server
4. Agent properties loaded:
   - Assigned DN: 5001
   - Place: Agent_Place
   - Skills: CustomerService, Sales
5. GWS establishes connections:
   - T-Server (port 5025) → Call control
   - Configuration Server (port 5000) → Config data
   - CometD WebSocket → Real-time updates
```

### Step 2: SIP Endpoint Registration

```
1. Agent opens WebRTC client → https://webrtc-server/index-agent-dn.html
2. Enters Agent DN: 5001 (from GWS)
3. Enters SIP password
4. JavaScript SIP client (JsSIP) connects:
   - WebSocket: wss://webrtc-server:443/ws
   - SIP REGISTER with DN 5001
   - Asterisk forwards to Genesys SIP Server
   - Genesys validates DN and registers endpoint
5. Agent is now "registered" in both systems:
   - GWS: Agent logged in
   - SIP: DN 5001 registered
```

### Step 3: Agent Ready State

```
1. Agent clicks "Ready" in GWS interface
2. GWS sends SetAgentState to T-Server
3. T-Server updates agent state: Ready
4. Agent DN 5001 now available for routing
```

---

## 📞 Call Flow Integration

### Inbound Call Scenario

```
Step 1: Call Arrives
├─ PSTN → Genesys SIP Server
├─ T-Server receives call event
├─ URS applies routing strategy
└─ Agent 5001 selected

Step 2: GWS Notified (CTI Events)
├─ T-Server → GWS (via PSDK connection)
├─ EventRinging event pushed via CometD
├─ GWS UI updates:
│  ├─ Call notification
│  ├─ Screen pop with ANI/DNIS
│  └─ Attached data (customer info)

Step 3: SIP Endpoint Rings
├─ Genesys SIP Server → Asterisk (SIP INVITE to 5001)
├─ Asterisk → WebRTC Client (WSS INVITE)
├─ Browser plays ring tone
└─ WebRTC client shows incoming call

Step 4: Agent Answers
├─ Agent clicks "Answer" in GWS (NOT in WebRTC client)
├─ GWS sends AnswerCall to T-Server
├─ T-Server instructs SIP Server to connect
├─ SIP 200 OK flows back to WebRTC client
├─ Media established: PSTN ↔ Genesys ↔ Asterisk ↔ Browser
└─ GWS updates call state: Connected

Step 5: During Call
├─ All controls via GWS:
│  ├─ Hold → T-Server command → SIP re-INVITE with hold
│  ├─ Mute → Local in WebRTC client
│  ├─ Transfer → T-Server orchestrates
│  └─ Conference → T-Server manages
└─ Audio flows through WebRTC client

Step 6: Call End
├─ Agent clicks "Release" in GWS
├─ GWS sends ReleaseCall to T-Server
├─ T-Server instructs SIP Server to end call
├─ SIP BYE sent to Asterisk → WebRTC client
├─ Media streams stop
├─ GWS shows after-call work panel
└─ Agent enters disposition codes
```

### Outbound Call Scenario (Click-to-Dial)

```
Step 1: Initiate Call
├─ Agent enters number in GWS or clicks contact
├─ GWS sends MakeCall to T-Server
└─ T-Server initiates two-party call

Step 2: Agent Leg
├─ T-Server → Genesys SIP Server
├─ SIP INVITE to DN 5001 → Asterisk → WebRTC Client
├─ WebRTC client auto-answers (or agent answers)
└─ Agent connected to call

Step 3: Customer Leg
├─ T-Server simultaneously dials customer number
├─ Genesys → PSTN Gateway
└─ Customer phone rings

Step 4: Connection
├─ Customer answers
├─ T-Server bridges both legs
├─ Media path established
└─ Conversation begins
```

---

## 🔧 GWS Configuration

### Running GWS Application

The GWS application is packaged as an executable Spring Boot JAR:

```bash
# Navigate to GWS directory
cd h:\Abhishek\gws-main\gws-main

# Run with Java
java -jar gws-main-8.5.2.jar

# Or with custom configuration
java -jar gws-main-8.5.2.jar --spring.config.location=file:///path/to/application.yml
```

### Required Configuration (application.yml)

You need to create an `application.yml` file with Genesys connection details:

```yaml
# Genesys Configuration Server Connection
genesys:
  config-server:
    host: your-config-server-host
    port: 5000
    app-name: gws-app
    
  # T-Server Connection
  t-server:
    primary:
      host: your-tserver-host
      port: 5025
    backup:
      host: your-backup-tserver-host
      port: 5025
      
  # SIP Server (for DN validation)
  sip-server:
    host: your-sip-server-host
    port: 5060

# Application Settings
server:
  port: 8080
  servlet:
    context-path: /

# CometD Settings (Real-time push)
cometd:
  enabled: true
  timeout: 30000
  interval: 0
  maxInterval: 10000

# Session Settings
spring:
  session:
    timeout: 3600
    
# Security Settings
security:
  saml:
    enabled: false
  oauth2:
    enabled: false
```

### Environment Variables

Alternatively, use environment variables:

```bash
# Windows PowerShell
$env:GENESYS_CONFIG_SERVER_HOST = "192.168.1.100"
$env:GENESYS_CONFIG_SERVER_PORT = "5000"
$env:GENESYS_TSERVER_HOST = "192.168.1.101"
$env:GENESYS_TSERVER_PORT = "5025"

# Then run
java -jar gws-main-8.5.2.jar
```

---

## 📡 GWS API Integration

### REST API Endpoints

GWS exposes REST APIs that the UI uses:

```javascript
// Authentication
POST /api/v2/auth/login
{
  "username": "agent5001",
  "password": "password"
}

// Agent State
POST /api/v2/me/state
{
  "state": "Ready",
  "reason": null
}

// Make Call
POST /api/v2/me/calls
{
  "destination": "5551234567",
  "userData": {
    "key1": "value1"
  }
}

// Answer Call
PUT /api/v2/me/calls/{callId}
{
  "action": "answer"
}

// Hold Call
PUT /api/v2/me/calls/{callId}
{
  "action": "hold"
}

// Transfer Call
POST /api/v2/me/calls/{callId}/transfer
{
  "destination": "5002",
  "type": "blind"
}
```

### CometD (Real-time Events)

GWS uses CometD for pushing real-time events to the browser:

```javascript
// Subscribe to call events
cometd.subscribe('/v2/me/calls', function(message) {
  // message.data contains call event
  switch(message.data.state) {
    case 'Ringing':
      // Show incoming call notification
      break;
    case 'Established':
      // Update UI to show active call
      break;
    case 'Released':
      // Clear call from UI
      break;
  }
});

// Subscribe to agent state changes
cometd.subscribe('/v2/me/state', function(message) {
  // Update agent state indicator
});
```

---

## 🔍 Monitoring the Integration

### 1. GWS Application Logs

```bash
# Default log location (when running from jar)
tail -f ./logs/gws.log

# Or check Spring Boot console output
# Look for:
# - "Connected to Configuration Server"
# - "T-Server connection established"
# - "Agent logged in: agent5001"
```

### 2. Asterisk SIP Registration

```bash
# SSH to Asterisk server
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoints"

# Look for Agent DN endpoints:
# Endpoint:  5001                                           In use  0 of inf
#     Contact:  5001/sip:5001@192.168.1.100:54321           Avail
```

### 3. Genesys T-Server Events

Monitor T-Server for agent/call events:

```bash
# T-Server logs show:
# - Agent login events
# - DN registration
# - Call routing decisions
# - State changes
```

### 4. Browser Developer Tools

```javascript
// In browser console, monitor CometD messages
window.cometd.addListener('/meta/connect', function(message) {
  console.log('CometD Status:', message.successful);
});

// Check active subscriptions
console.log(window.cometd.getSubscriptions());

// Monitor SIP client (if using JsSIP)
window.genesysAgent.ua.on('newRTCSession', function(e) {
  console.log('SIP Session:', e.session);
});
```

---

## 🔧 WebRTC Client Configuration for GWS

The WebRTC client needs to be configured to work with GWS:

### Configuration: `nginx/html/app-agent-dn.js`

Key points:
1. **No call control logic** in WebRTC client
2. **Auto-answer** incoming calls (controlled by GWS)
3. **Audio only** - all UI interactions via GWS
4. **Display call info** from SIP headers

```javascript
// When call arrives via SIP
handleIncomingCall(session) {
  // Display notification
  this.addDebugMessage('Call from Genesys - answer in Workspace!');
  
  // Auto-answer after short delay (Workspace sends answer command)
  setTimeout(() => {
    session.answer(options);
  }, 1000);
}

// Don't allow manual answer/hangup
// All control from GWS interface
```

---

## 🎯 Integration Benefits

### Unified Agent Experience

| Feature | Without GWS | With GWS Integration |
|---------|-------------|---------------------|
| Call Control | Manual in SIP client | Centralized in Workspace |
| Screen Pops | No customer data | Automatic with CRM data |
| Agent State | SIP registration only | Full state management |
| Routing | Simple SIP routing | Skills-based routing |
| Transfers | Blind transfer only | Blind, Consult, Conference |
| Reporting | SIP CDRs | Full contact center reports |
| Disposition Codes | Not available | Integrated workflow |
| Queue Management | Basic | Advanced with priorities |

---

## 🚀 Deployment Scenarios

### Scenario 1: Local Development

```
GWS Server: localhost:8080
WebRTC Client: localhost (served by Nginx)
Genesys Servers: Your network (via VPN)
Asterisk: Local Docker or remote server
```

### Scenario 2: On-Premise Deployment

```
GWS Server: Internal web server (gws.company.com)
WebRTC Client: DMZ web server (webrtc.company.com)
Genesys Servers: Data center
Asterisk: DMZ (public IP for remote agents)
```

### Scenario 3: Cloud Hybrid

```
GWS Server: Cloud VM (AWS/Azure)
WebRTC Client: Cloud VM (public endpoint)
Genesys Servers: On-premise (VPN tunnel)
Asterisk: Cloud VM (scales independently)
```

---

## 🔒 Security Considerations

### 1. Authentication Flow

```
Agent → GWS (HTTPS, session cookie)
GWS → Genesys (PSDK encrypted connection)
Agent → WebRTC (WSS with SIP digest auth)
WebRTC → Asterisk → Genesys (SIP trunk)
```

### 2. Data Protection

- **Call Signaling**: Encrypted (TLS/WSS)
- **Media**: SRTP encryption
- **Customer Data**: HTTPS only
- **Session Management**: Secure cookies, CSRF protection

### 3. Access Control

- **GWS**: Role-based access (agent, supervisor, admin)
- **SIP**: DN-specific credentials
- **Genesys**: Permission groups in Config Server

---

## 🐛 Troubleshooting

### Issue 1: Agent Logs into GWS but Call Doesn't Ring

**Check:**
1. Is SIP endpoint registered? (`pjsip show endpoints`)
2. Does DN in GWS match DN in SIP registration?
3. Is agent state "Ready" in GWS?
4. Check T-Server logs for call routing

### Issue 2: Call Rings in WebRTC but No Screen Pop

**Check:**
1. Is CometD connected? (Browser console)
2. Is T-Server connection active in GWS?
3. Are subscriptions registered? (`cometd.getSubscriptions()`)
4. Check GWS logs for event delivery

### Issue 3: Can't Control Call from GWS

**Check:**
1. Is the call associated with the agent in T-Server?
2. Is the DN correctly linked to the agent?
3. Check SIP trunk status between Asterisk and Genesys
4. Verify call control permissions in Config Server

### Issue 4: One-Way Audio

**Check:**
1. NAT/Firewall settings
2. STUN/TURN server configuration
3. RTP ports open (10000-20000)
4. `direct_media=no` in Asterisk

---

## 📚 Key Files and Modules

### GWS Modules (in BOOT-INF/classes/static/ui/ad/v1/module/)

- **wwe-voice**: Voice interaction handling
- **wwe-webrtc**: WebRTC integration module
- **wwe-iw-sip-endpoint**: SIP endpoint integration
- **wwe-main**: Main application framework
- **wwe-login**: Authentication module

### WebRTC Project Files

- **app-agent-dn.js**: Agent DN registration client
- **index-agent-dn.html**: Agent desktop HTML
- **pjsip-sip-endpoint.conf**: Asterisk configuration for agent DNs
- **extensions-sip-endpoint.conf**: Minimal dialplan

---

## 🎓 Understanding the Data Flow

### Call Control Commands

```
User Action (GWS UI)
  ↓
JavaScript Event Handler
  ↓
REST API Call (e.g., /api/v2/me/calls/{id}/hold)
  ↓
GWS Spring Controller
  ↓
Genesys PSDK Service
  ↓
T-Server Request (RequestHoldCall)
  ↓
T-Server Processing
  ↓
Genesys SIP Server (SIP re-INVITE with hold)
  ↓
Asterisk (processes SIP message)
  ↓
WebRTC Client (media stream paused)
```

### Call Events (Real-time)

```
T-Server Event (EventRinging)
  ↓
GWS PSDK Event Handler
  ↓
Event Processor
  ↓
CometD Publisher
  ↓
Bayeux Protocol (Server Push)
  ↓
Browser CometD Client
  ↓
JavaScript Event Handler
  ↓
UI Update (show incoming call)
```

---

## ✅ Quick Start Checklist

- [ ] GWS application running (port 8080)
- [ ] Connected to Genesys Config Server
- [ ] Connected to Genesys T-Server
- [ ] Agent exists in Configuration Manager
- [ ] Agent has assigned DN (e.g., 5001)
- [ ] Asterisk configured with agent DN endpoints
- [ ] WebRTC client accessible via HTTPS
- [ ] Agent can login to GWS
- [ ] Agent can register SIP endpoint with DN
- [ ] Agent can set Ready state
- [ ] Test call can be placed to agent DN
- [ ] Screen pop appears in GWS
- [ ] Call rings in WebRTC client
- [ ] Agent can answer via GWS
- [ ] Two-way audio working
- [ ] Call controls functional (hold, transfer, etc.)

---

## 📞 Support Resources

- **Genesys Documentation**: https://docs.genesys.com
- **Platform SDK (PSDK)**: Reference for API calls
- **Workspace Desktop Edition**: User guide
- **SIP Server Documentation**: Configuration guide
- **T-Server Documentation**: CTI event reference

---

**🎉 With this integration, you have a full-featured contact center agent desktop with WebRTC endpoints!**



