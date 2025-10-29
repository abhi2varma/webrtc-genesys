# GWS + WebRTC Architecture Overview

Complete architectural documentation for the Genesys Workspace Web Edition (GWS) with WebRTC SIP endpoint integration.

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AGENT WORKSTATION (Browser)                           │
│                                                                           │
│  ┌────────────────────────────┐   ┌──────────────────────────────┐     │
│  │ GWS Agent Desktop          │   │ WebRTC SIP Client            │     │
│  │ (Call Control & UI)        │   │ (Audio Only)                 │     │
│  │                             │   │                               │     │
│  │ - Agent Login               │   │ - SIP Registration (DN)      │     │
│  │ - Call Controls             │   │ - Audio Interface            │     │
│  │ - Screen Pops               │   │ - Media Handling             │     │
│  │ - Agent States              │   │ - DTLS-SRTP Encryption       │     │
│  └────────────┬───────────────┘   └────────┬─────────────────────┘     │
│               │                              │                            │
│               │ REST API / CometD            │ WSS (SIP)                 │
│               │ HTTPS                        │ SRTP (Media)              │
└───────────────┼──────────────────────────────┼──────────────────────────┘
                │                              │
                │                              │
┌───────────────▼──────────────────────────────▼──────────────────────────┐
│                     APPLICATION LAYER                                    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │  GWS Application (localhost:8080)                       │            │
│  │  Spring Boot | Genesys PSDK | CometD                   │            │
│  │                                                          │            │
│  │  - REST API (call control, agent state)                │            │
│  │  - CometD Server (real-time push to browser)           │            │
│  │  - T-Server Client (call orchestration)                │            │
│  │  - Config Server Client (agent configuration)          │            │
│  │  - Session Management                                   │            │
│  └─────────────────────────────────────────────────────────┘            │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │  Nginx (Web Server & Proxy)                             │            │
│  │  Port 443                                               │            │
│  │                                                          │            │
│  │  - Serves WebRTC SIP client (HTML/CSS/JS)              │            │
│  │  - SSL/TLS termination                                  │            │
│  │  - WebSocket proxy to Asterisk                         │            │
│  └─────────────────────────────────────────────────────────┘            │
└───────────────────────────────────────────────────────────────────────────┘
                │                              │
                │                              │
┌───────────────▼──────────────────────────────▼──────────────────────────┐
│                   SIP/MEDIA GATEWAY LAYER                                 │
│                   192.168.210.54                                          │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │  Asterisk (WebRTC ↔ SIP Gateway ONLY)                  │            │
│  │  Ports: 5060 (SIP), 8089 (WSS), 10000-20000 (RTP)      │            │
│  │                                                          │            │
│  │  Role: Translation Gateway (No Call Logic)              │            │
│  │  ┌────────────────────────────────────────────────┐    │            │
│  │  │  PJSIP (SIP Stack)                              │    │            │
│  │  │  - WebSocket Transport (WSS)                    │    │            │
│  │  │  - Agent DN Endpoints (5001-5999)               │    │            │
│  │  │  - Genesys SIP Trunk                            │    │            │
│  │  └────────────────────────────────────────────────┘    │            │
│  │                                                          │            │
│  │  ┌────────────────────────────────────────────────┐    │            │
│  │  │  Dialplan (Minimal - Proxy Only)                │    │            │
│  │  │  - Forward all to Genesys SIP Server            │    │            │
│  │  │  - No routing logic                             │    │            │
│  │  │  - No IVR/features                              │    │            │
│  │  └────────────────────────────────────────────────┘    │            │
│  │                                                          │            │
│  │  ┌────────────────────────────────────────────────┐    │            │
│  │  │  Media Engine                                   │    │            │
│  │  │  - WebRTC ↔ RTP translation                     │    │            │
│  │  │  - SRTP ↔ RTP conversion                        │    │            │
│  │  │  - Codec transcoding (Opus ↔ G.711)            │    │            │
│  │  └────────────────────────────────────────────────┘    │            │
│  └─────────────────────────────────────────────────────────┘            │
│                        │                        │                         │
│                        │ SIP Trunk              │                         │
│                        ▼                        │                         │
│  ┌─────────────────────────────────────────┐   │                         │
│  │  Coturn (TURN/STUN Server)              │   │                         │
│  │  Ports: 3478, 5349                      │   │                         │
│  │  - NAT traversal for WebRTC             │   │                         │
│  │  - Media relay when needed              │   │                         │
│  └─────────────────────────────────────────┘   │                         │
│                                                  │                         │
└──────────────────────────────────────────────────┼─────────────────────────┘
                                                   │ SIP/RTP
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              GENESYS ENGAGE PLATFORM (Corporate Network)                 │
│              192.168.210.81                                              │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │  Configuration Server                                    │            │
│  │  192.168.210.81:5000                                     │            │
│  │  - Agent configuration                                   │            │
│  │  - DN management (Agent DNs 5001-5999)                  │            │
│  │  - Skills & routing rules                               │            │
│  │  - Switch objects                                        │            │
│  └────────────────────────┬────────────────────────────────┘            │
│                            │ Internal Genesys Protocol                   │
│                            ▼                                              │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │  T-Server (Telephony Control)                            │            │
│  │  192.168.210.81:5025                                     │            │
│  │  - Call orchestration & state management                │            │
│  │  - Agent state management (Ready/Not Ready)             │            │
│  │  - CTI events to GWS                                    │            │
│  │  - Call control commands from GWS                       │            │
│  └────────────────────────┬────────────────────────────────┘            │
│                            │ SIP Control                                  │
│                            ▼                                              │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │  Genesys SIP Server                                      │            │
│  │  192.168.210.81:5060                                     │            │
│  │  - Agent DN registration (5001-5999)                    │            │
│  │  - SIP trunk from Asterisk (192.168.210.54)             │            │
│  │  - Call signaling & media control                       │            │
│  └────────────────────────┬────────────────────────────────┘            │
│                            │                                              │
│  ┌────────────────────────┴────────────────────────────────┐            │
│  │  Universal Routing Server (URS)                          │            │
│  │  - Skills-based routing                                  │            │
│  │  - Queue management                                      │            │
│  │  - Business rules & strategies                           │            │
│  └──────────────────────────────────────────────────────────┘            │
│                            │                                              │
│                            ▼                                              │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │  PSTN Gateway / Carrier                                  │            │
│  │  - External call connectivity                            │            │
│  └─────────────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Component Details

### 1. **GWS Agent Desktop (Browser)**

**Location:** Runs in agent's browser  
**URL:** http://localhost:8080/ui/ad/v1/  
**Technology:** HTML5, JavaScript, CometD client  
**Port:** 8080 (HTTP) or 443 (HTTPS)

**Responsibilities:**
- Agent login and authentication
- Call control interface (answer, hold, transfer, release)
- Agent state management (Ready, Not Ready, ACW)
- Screen pops with customer data
- Real-time call notifications via CometD
- Disposition codes and wrap-up
- Interaction history

**Key Features:**
- Unified agent interface
- CTI screen pops
- Click-to-dial
- Call controls (all via T-Server)
- Agent statistics
- Queue status
- Customer data integration

---

### 2. **WebRTC SIP Client (Browser)**

**Location:** Runs in agent's browser (separate tab)  
**URL:** https://webrtc-server/index-agent-dn.html  
**Technology:** HTML5, JavaScript, JsSIP library  
**Port:** Accesses via HTTPS/WSS (443)

**Responsibilities:**
- SIP registration with Agent DN (5001-5999)
- Audio interface only (no call control)
- Media handling with WebRTC APIs
- ICE negotiation for NAT traversal
- DTLS-SRTP for encrypted media

**Key Features:**
- Microphone/speaker controls
- Volume control
- Mute button (local)
- Audio quality indicator
- SIP registration status
- **Note:** All call control done via GWS, not this client

---

### 3. **GWS Application Server**

**Location:** localhost or application server  
**Technology:** Spring Boot, Java 8, Genesys PSDK  
**Port:** 8080  
**Files:** h:\Abhishek\gws-main\

**Responsibilities:**
- REST API for agent actions
- CometD server for real-time push
- Connection to Genesys Config Server
- Connection to Genesys T-Server
- Session management
- Authentication/authorization
- Event transformation (T-Server → Browser)

**Key Integrations:**
- **Config Server (192.168.210.81:5000):** Agent configuration
- **T-Server (192.168.210.81:5025):** Call control & CTI events
- **CometD (WebSocket):** Real-time push to browser

**API Endpoints:**
- `POST /api/v2/auth/login` - Agent login
- `POST /api/v2/me/state` - Set agent state
- `POST /api/v2/me/calls` - Make call
- `PUT /api/v2/me/calls/{id}` - Answer/Hold/etc.
- `POST /api/v2/me/calls/{id}/transfer` - Transfer call

---

### 4. **Nginx (Web Server & Reverse Proxy)**

**Location:** Docker container on CentOS VM  
**IP Address:** 192.168.210.54  
**Ports:** 80 (HTTP), 443 (HTTPS)  
**Image:** `nginx:alpine`

**Responsibilities:**
- Serve static files (HTML/CSS/JS client)
- SSL/TLS termination
- Reverse proxy for WebSocket connections
- Load balancing (if multiple Asterisk instances)

**Configuration:**
```nginx
# WebSocket proxy to Asterisk
location /ws {
    proxy_pass http://127.0.0.1:8088;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

**Security:**
- SSL certificates (self-signed for testing)
- Security headers (HSTS, X-Frame-Options)
- Request filtering

---

### 5. **Asterisk (WebRTC ↔ SIP Gateway)**

**Location:** Docker container on CentOS VM  
**IP Address:** 192.168.210.54  
**Ports:**
- 5060 (SIP UDP/TCP)
- 8089 (WebSocket Secure)
- 10000-20000 (RTP/SRTP)  
**Image:** `andrius/asterisk:latest`

#### 3a. PJSIP (SIP Stack)

**Configuration File:** `asterisk/etc/pjsip.conf`

**Transports:**
```ini
[transport-udp]     # Traditional SIP
[transport-tcp]     # SIP over TCP
[transport-wss]     # WebSocket Secure for WebRTC
```

**Endpoints:**
- **Agent DNs (5001-5999):**
  - WebRTC-enabled (ICE, DTLS-SRTP)
  - Opus codec support
  - Browser-based registration
  - Each agent has unique DN matching Genesys

- **Genesys SIP Trunk:**
  - SIP connection to Genesys SIP Server
  - G.711 (ulaw/alaw) codecs
  - Forwards all calls to/from Genesys
  - No call routing logic in Asterisk

**Key Settings for WebRTC:**
```ini
webrtc=yes
ice_support=yes
media_encryption=dtls
use_avpf=yes
rtcp_mux=yes
```

**Key Settings for Genesys:**
```ini
direct_media=no
rtp_symmetric=yes
force_rport=yes
```

#### 5b. Dialplan (Minimal - Proxy Only)

**Configuration File:** `asterisk/etc/extensions-sip-endpoint.conf`

**Role:** Asterisk acts as a simple gateway with NO routing logic

**Contexts:**

1. **[genesys-agent]** - Agent DN context
   - All calls forwarded to Genesys SIP Server
   - No local routing decisions
   - Simple proxy behavior

2. **[from-genesys]** - Incoming from Genesys
   - Forward to registered agent DN
   - No IVR or queue logic
   - T-Server handles all routing

**Example Configuration:**
```ini
[genesys-agent]
; All outbound - forward to Genesys (192.168.210.81)
exten => _X.,1,NoOp(Forward to Genesys)
 same => n,Dial(PJSIP/${EXTEN}@genesys_sip_server)
 same => n,Hangup()

[from-genesys]
; All inbound - deliver to agent DN
exten => _X.,1,NoOp(From Genesys to DN ${EXTEN})
 same => n,Dial(PJSIP/${EXTEN})
 same => n,Hangup()

; genesys_sip_server endpoint points to 192.168.210.81:5060
```

**Call Flow - GWS Controlled:**
```
GWS makes call request
    ↓ REST API
T-Server orchestrates
    ↓ Dials agent DN + customer
Genesys SIP Server → Asterisk → Agent (DN 5001)
    ↓ SIP signaling
Audio path established
```

#### 5c. Media Engine

**Configuration File:** `asterisk/etc/rtp.conf`

**Responsibilities:**
- Audio/video media streaming
- Codec transcoding
- SRTP encryption/decryption
- Echo cancellation
- Jitter buffering

**Port Range:** 10000-20000 UDP

**Codecs Supported:**
- **Opus** - High quality, preferred for WebRTC
- **G.711** (ulaw/alaw) - Standard for telephony
- **G.722** - Wideband audio
- **G.729** - Low bandwidth (license required)

---

### 6. **Coturn (TURN Server)**

**Location:** Docker container on CentOS VM  
**Ports:** 3478 (TURN), 5349 (TURN/TLS)  
**Image:** `coturn/coturn:latest`

**Responsibilities:**
- NAT traversal when direct connection fails
- Media relay for restricted networks
- STUN functionality

**When Used:**
- Symmetric NAT environments
- Firewall restrictions
- Corporate proxy scenarios

**Protocol Flow:**
```
WebRTC Client
    ↓ ICE candidate gathering
STUN (direct connection attempt)
    ↓ If fails
TURN (relay through Coturn)
    ↓ Media relayed
Asterisk RTP
```

---

### 7. **Genesys Engage Platform**

**Location:** Corporate network  
**IP Address:** 192.168.210.81  
**Connection:** SIP trunk from Asterisk (192.168.210.54)

#### 7a. Genesys SIP Server

**IP Address:** 192.168.210.81  
**Port:** 5060 (UDP/TCP)

**Responsibilities:**
- SIP endpoint for Asterisk
- Call routing interface
- DN/Route Point management
- Trunk management

**Authentication Methods:**
1. **IP-based:** Asterisk IP whitelisted
2. **Username/Password:** SIP credentials
3. **Certificate-based:** TLS with certs

#### 5b. Genesys Components

**Configuration Server:**
- Central configuration database
- DN assignments
- Routing strategies
- Switch objects

**T-Server:**
- Telephony control
- Call state management
- CTI events
- Agent desktop integration

**Universal Routing Server (URS):**
- Intelligent routing
- Skills-based routing
- Priority queuing
- Business rules

**Stat Server:**
- Real-time statistics
- Agent status
- Queue metrics
- Reporting data

---

## 🔄 Call Flow Scenarios

### Scenario 1: Inbound Call with Screen Pop

```
1. PSTN Customer calls
   ↓ +15551234567 dials company number
   
2. Genesys Platform
   ↓ URS applies routing strategy
   ↓ Skills-based routing selects agent
   ↓ Agent DN 5001 selected (Ready state)
   
3. DUAL PATH:
   
   PATH A (CTI - Screen Pop):
   T-Server → GWS Application
       ↓ EventRinging with customer data
       ↓ CometD push to browser
   GWS UI → Screen pop appears
       ↓ Customer name, account, history
   
   PATH B (Audio):
   Genesys SIP Server → Asterisk
       ↓ SIP INVITE to DN 5001
       ↓ WSS to WebRTC client
   Browser → Rings
   
4. Agent answers in GWS
   ↓ Click "Answer" button
   ↓ REST API → GWS → T-Server
   ↓ T-Server confirms answer
   ↓ SIP 200 OK flows through
   
5. Media Path:
   PSTN ←→ Genesys ←RTP→ Asterisk ←SRTP→ Browser
   
6. Call control via GWS:
   - Hold, Transfer, Conference → all via T-Server
```

### Scenario 2: Outbound Call (Click-to-Dial from GWS)

```
1. Agent in GWS
   ↓ Clicks phone number in CRM
   ↓ REST API: POST /api/v2/me/calls
   
2. GWS Application
   ↓ PSDK RequestMakeCall to T-Server
   
3. T-Server orchestrates
   ↓ Two-party call initiation
   ↓ Call agent DN + dial customer
   
4. Agent leg:
   Genesys SIP Server → Asterisk → Agent DN 5001
   ↓ WebRTC client rings/auto-answers
   
5. Customer leg:
   T-Server → Genesys → PSTN → Customer
   ↓ Customer answers
   
6. Call connected
   ↓ GWS receives EventEstablished
   ↓ CometD push updates UI
   ↓ Call timer starts
   
7. Media Path:
   Agent Browser ←SRTP→ Asterisk ←RTP→ Genesys ←→ PSTN Customer
```

### Scenario 3: Call Transfer

```
1. Agent in active call
   ↓ Clicks "Transfer" in GWS
   ↓ Selects target: Agent DN 5002
   
2. GWS Application
   ↓ REST API: POST /api/v2/me/calls/{id}/transfer
   ↓ PSDK RequestTransfer to T-Server
   
3. T-Server handles transfer
   ↓ Blind or Consultative transfer
   ↓ No Asterisk dialplan involved
   ↓ All logic in Genesys
   
4. Target agent rings
   ↓ Genesys → Asterisk → DN 5002
   ↓ Target agent's GWS shows screen pop
   
5. Original agent released
   ↓ Call transferred successfully
   ↓ All via T-Server control
```

---

## 🔐 Security Architecture

### Transport Security

```
Layer 1: Network
├─ Firewall rules (CentOS firewalld)
└─ Network segmentation

Layer 2: Transport
├─ TLS 1.2+ for HTTPS (Nginx)
├─ WSS for SIP signaling
└─ SRTP for media encryption

Layer 3: Application
├─ SIP digest authentication
├─ Strong passwords
└─ IP-based restrictions

Layer 4: Data
├─ Encrypted call recordings
└─ Secure voicemail storage
```

### Authentication Flow

```
1. Browser → Nginx (HTTPS)
   ├─ SSL certificate validation
   └─ Secure connection

2. Browser → Asterisk (WSS)
   ├─ SIP REGISTER
   ├─ Digest challenge
   ├─ Credential verification
   └─ Registration success

3. Asterisk → Genesys (SIP)
   ├─ Trunk authentication
   ├─ IP whitelist check
   └─ Call authorization
```

---

## 📈 Scalability Considerations

### Current Setup (Single Server)

**Capacity:**
- ~50-100 concurrent WebRTC calls
- ~200 concurrent traditional SIP calls
- Depends on CPU, RAM, network

**Bottlenecks:**
- CPU for codec transcoding
- Network bandwidth for RTP
- Asterisk concurrent channel limit

### Scaling Options

#### Horizontal Scaling

```
              Load Balancer (Nginx)
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   Asterisk 1   Asterisk 2   Asterisk 3
        │            │            │
        └────────────┼────────────┘
                     │
              Genesys SIP Server
```

#### Vertical Scaling

- Increase VM resources (CPU, RAM)
- SSD for faster I/O
- Dedicated network interface

#### Database Externalization

```
Asterisk Cluster
      │
      ├─→ Shared CDR Database
      ├─→ Shared Voicemail Storage
      └─→ Shared Configuration
```

---

## 🔧 Configuration Files Summary

### Critical Files

| File | Purpose | Key Settings |
|------|---------|--------------|
| **GWS Application** | | |
| `application.yml` | GWS configuration | Genesys servers, ports, CometD settings |
| `start-gws.ps1` | Startup script | Java options, configuration path |
| **Asterisk** | | |
| `pjsip-sip-endpoint.conf` | Agent DNs & trunk | Agent DNs (5001-5999), Genesys trunk |
| `extensions-sip-endpoint.conf` | Minimal dialplan | Forward to Genesys (no logic) |
| `rtp.conf` | Media settings | Port range, STUN, codecs |
| `http.conf` | WebSocket server | WSS port, SSL certs |
| **Nginx** | | |
| `nginx.conf` | Web server & proxy | HTTPS, WebSocket proxy |
| **WebRTC Client** | | |
| `app-agent-dn.js` | Agent SIP client | DN registration, audio only |
| `index-agent-dn.html` | Agent UI | WebRTC interface |

---

## 📊 Monitoring Points

### Health Checks

1. **Nginx:** HTTP 200 on port 443
2. **Asterisk:** SIP OPTIONS ping
3. **Coturn:** STUN binding test
4. **Genesys:** SIP trunk status

### Metrics to Monitor

- Active calls (by type)
- Registration count
- CPU/Memory usage
- Network bandwidth
- Call quality (MOS, jitter, packet loss)
- Error rates

### Log Locations

```
Docker Logs:
- docker logs webrtc-asterisk
- docker logs webrtc-nginx
- docker logs webrtc-coturn

Asterisk Logs:
- /var/log/asterisk/full
- /var/log/asterisk/messages

Nginx Logs:
- /var/log/nginx/access.log
- /var/log/nginx/error.log
```

---

## 🎯 Network Ports Summary

| Component | Port | Protocol | Purpose |
|-----------|------|----------|---------|
| **Agent Workstation** | | | |
| GWS UI | 8080 | HTTP/HTTPS | Agent desktop interface |
| WebRTC Client | 443 | WSS | SIP signaling |
| **Application Layer** | | | |
| GWS Application | 8080 | HTTP | REST API & CometD |
| Nginx | 80 | TCP | HTTP (redirect) |
| Nginx | 443 | TCP | HTTPS / WSS |
| **Gateway Layer** | | | |
| Asterisk | 5060 | UDP/TCP | SIP trunk to Genesys |
| Asterisk | 8089 | TCP | WebSocket from browser |
| Asterisk | 10000-20000 | UDP | RTP/SRTP media |
| Coturn | 3478 | UDP/TCP | TURN/STUN |
| Coturn | 5349 | TCP | TURN over TLS |
| **Genesys Platform** | | | |
| Config Server | 5000 | TCP | Configuration (GWS → Genesys) |
| T-Server | 5025 | TCP | Call control (GWS → Genesys) |
| SIP Server | 5060 | UDP/TCP | SIP trunk (Asterisk → Genesys) |

---

## 🚀 Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Agent Desktop** | | |
| UI Framework | HTML5, JavaScript | - |
| SIP Stack | JsSIP | 3.10+ |
| Real-time | CometD (Bayeux) | 3.1.12 |
| **Application Layer** | | |
| Framework | Spring Boot | 1.5.22 |
| Language | Java | 8+ |
| Genesys SDK | Platform SDK (PSDK) | 9.0.7 |
| Real-time Server | CometD Server | 3.1.12 |
| **Gateway Layer** | | |
| OS | CentOS / Windows | 7/8/9 / 10/11 |
| Container | Docker | 20.10+ |
| PBX | Asterisk | 18+ |
| SIP Stack | PJSIP | 2.x |
| Web Server | Nginx | Alpine |
| TURN Server | Coturn | Latest |
| **Contact Center** | | |
| Platform | Genesys Engage | 8.5.2 |

---

## 📚 Further Reading

- **Asterisk Documentation:** https://wiki.asterisk.org
- **WebRTC Specification:** https://webrtc.org
- **JsSIP Documentation:** https://jssip.net
- **Genesys Documentation:** https://docs.genesys.com
- **PJSIP Guide:** https://wiki.asterisk.org/wiki/display/AST/PJSIP

---

## 🎯 Architecture Benefits

### Unified Agent Experience
- **Single Desktop:** GWS provides one interface for all interactions
- **CTI Integration:** Screen pops with customer data
- **Call Control:** All via GWS (no manual dialing in WebRTC client)
- **Agent State:** Synchronized across all systems

### Enterprise Features
- **Skills-Based Routing:** Powered by Genesys URS
- **Queue Management:** Advanced queue strategies
- **Reporting:** Full Genesys reporting capabilities
- **Recording:** Call recording via T-Server
- **Transfer/Conference:** Native Genesys features

### Scalability
- **GWS:** Can run multiple instances with load balancer
- **Asterisk:** Lightweight (just gateway, no logic)
- **Genesys:** Handles all intelligence and routing
- **WebRTC:** Browser-based, no phone required

### Cloud-Ready
- GWS can run in cloud or on-premise
- Asterisk can be deployed anywhere
- Agents work from anywhere (home, office, mobile)
- Only SIP trunk needed to Genesys

---

## 📚 Related Documentation

- **[GWS_SIP_ENDPOINT_INTEGRATION.md](GWS_SIP_ENDPOINT_INTEGRATION.md)** - Complete integration guide
- **[GWS_STARTUP_GUIDE.md](GWS_STARTUP_GUIDE.md)** - Setup instructions
- **[INTEGRATION_DIAGRAM.md](INTEGRATION_DIAGRAM.md)** - Visual diagrams
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Quick reference
- **[h:\Abhishek\gws-main\README.md](../../h:/Abhishek/gws-main/README.md)** - GWS application guide

---

*This architecture provides enterprise-grade contact center capabilities with WebRTC voice through Genesys Workspace Web Edition integration.*




