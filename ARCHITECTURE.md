# WebRTC System Architecture Overview

Complete architectural documentation for the Asterisk WebRTC system with Genesys Engage integration.

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER (Browser)                          │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │  WebRTC Client (HTML5/JavaScript)                            │       │
│  │  - JsSIP Library                                              │       │
│  │  - SIP over WebSocket                                         │       │
│  │  - SRTP/DTLS Media Encryption                                 │       │
│  │  - ICE/STUN/TURN for NAT Traversal                           │       │
│  └──────────────────────────────────────────────────────────────┘       │
│                               │                                           │
│                               │ HTTPS/WSS                                 │
│                               ▼                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                │
┌─────────────────────────────────────────────────────────────────────────┐
│                     WEB/PROXY LAYER (Your CentOS VM)                     │
│                          192.168.77.131                                  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────┐             │
│  │  Nginx (Reverse Proxy & Web Server)                    │             │
│  │  Port 80/443                                            │             │
│  │  - Serves WebRTC client (HTML/CSS/JS)                  │             │
│  │  - SSL/TLS termination                                  │             │
│  │  - WebSocket proxy to Asterisk                         │             │
│  └────────────────────────────────────────────────────────┘             │
│                        │            │                                     │
│                        │ WSS Proxy  │ Static Files                       │
│                        ▼            ▼                                     │
└─────────────────────────────────────────────────────────────────────────┘
                        │
                        │
┌─────────────────────────────────────────────────────────────────────────┐
│                   SIP/MEDIA LAYER (Your CentOS VM)                       │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │  Asterisk PBX (SIP/WebRTC Server)                       │            │
│  │  Ports: 5060 (SIP), 8089 (WSS), 10000-20000 (RTP)      │            │
│  │                                                          │            │
│  │  Components:                                             │            │
│  │  ┌────────────────────────────────────────────────┐    │            │
│  │  │  PJSIP (SIP Stack)                              │    │            │
│  │  │  - WebSocket Transport (WSS)                    │    │            │
│  │  │  - UDP/TCP Transport (SIP)                      │    │            │
│  │  │  - WebRTC Endpoints (1000-1999)                 │    │            │
│  │  │  - Genesys Trunk Configuration                  │    │            │
│  │  └────────────────────────────────────────────────┘    │            │
│  │                                                          │            │
│  │  ┌────────────────────────────────────────────────┐    │            │
│  │  │  Dialplan (extensions.conf)                     │    │            │
│  │  │  - Call routing logic                           │    │            │
│  │  │  - IVR menus                                    │    │            │
│  │  │  - Feature codes (600, 601, 700, etc.)         │    │            │
│  │  │  - Genesys integration routing                  │    │            │
│  │  └────────────────────────────────────────────────┘    │            │
│  │                                                          │            │
│  │  ┌────────────────────────────────────────────────┐    │            │
│  │  │  RTP Engine                                     │    │            │
│  │  │  - Audio/Video streaming                        │    │            │
│  │  │  - SRTP encryption for WebRTC                   │    │            │
│  │  │  - Codec transcoding (Opus, G.711, G.729)      │    │            │
│  │  └────────────────────────────────────────────────┘    │            │
│  │                                                          │            │
│  │  ┌────────────────────────────────────────────────┐    │            │
│  │  │  Applications                                   │    │            │
│  │  │  - Voicemail                                    │    │            │
│  │  │  - Conference Bridge                            │    │            │
│  │  │  - Call Recording                               │    │            │
│  │  │  - Echo Test                                    │    │            │
│  │  └────────────────────────────────────────────────┘    │            │
│  └─────────────────────────────────────────────────────────┘            │
│                        │                        │                         │
│                        │ SIP                    │                         │
│                        ▼                        │                         │
│  ┌─────────────────────────────────────────┐   │                         │
│  │  Coturn (TURN Server)                   │   │                         │
│  │  Ports: 3478, 5349                      │   │                         │
│  │  - NAT traversal                        │   │                         │
│  │  - Relay media when direct fails        │   │                         │
│  └─────────────────────────────────────────┘   │                         │
│                                                  │                         │
└──────────────────────────────────────────────────┼─────────────────────────┘
                                                   │ SIP/RTP
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              GENESYS ENGAGE LAYER (Your Network)                         │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │  Genesys SIP Server                                      │            │
│  │  Port: 5060                                              │            │
│  │  - SIP trunk endpoint                                    │            │
│  │  - Route Points / DNs                                    │            │
│  │  - Inbound/Outbound call routing                        │            │
│  └─────────────────────────────────────────────────────────┘            │
│                        │                                                  │
│                        │                                                  │
│                        ▼                                                  │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │  Genesys Platform                                        │            │
│  │  - Configuration Server                                  │            │
│  │  - T-Server (Telephony)                                  │            │
│  │  - Stat Server                                           │            │
│  │  - Universal Routing Server                              │            │
│  └─────────────────────────────────────────────────────────┘            │
│                        │                                                  │
│                        │                                                  │
│                        ▼                                                  │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │  PSTN Gateway / Carrier                                  │            │
│  │  - External call connectivity                            │            │
│  └─────────────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Component Details

### 1. **WebRTC Client (Browser)**

**Location:** Runs in user's browser  
**Technology:** HTML5, JavaScript, JsSIP library  
**Port:** Accesses via HTTPS (443)

**Responsibilities:**
- User interface for making/receiving calls
- SIP signaling over WebSocket Secure (WSS)
- Media handling with WebRTC APIs
- ICE negotiation for NAT traversal
- DTLS-SRTP for encrypted media

**Key Features:**
- Dial pad for DTMF
- Call controls (mute, hold, transfer)
- Audio volume control
- Call logging
- Real-time status display

---

### 2. **Nginx (Web Server & Reverse Proxy)**

**Location:** Docker container on CentOS VM  
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

### 3. **Asterisk PBX**

**Location:** Docker container on CentOS VM  
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
- **WebRTC Users (1000-1999):**
  - WebRTC-enabled (ICE, DTLS-SRTP)
  - Opus codec support
  - Browser-based clients

- **Genesys Trunk:**
  - SIP connection to Genesys SIP Server
  - G.711 (ulaw/alaw) codecs
  - Authentication (username/password or IP-based)

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

#### 3b. Dialplan (Call Routing)

**Configuration File:** `asterisk/etc/extensions.conf`

**Contexts:**

1. **[from-internal]** - WebRTC users
   - Internal extensions (1000-1999)
   - Feature codes (600, 601, 700)
   - Outbound to Genesys (9 + number)

2. **[from-genesys-engage]** - Incoming from Genesys
   - Route by DNIS (Dialed Number)
   - Direct to extensions
   - IVR menus
   - Queue routing

3. **[ivr]** - Interactive Voice Response
   - Menu prompts
   - Digit collection
   - Routing logic

**Call Flow Example - Outbound:**
```
WebRTC User (1000)
    ↓ Dial: 95551234567
Asterisk Dialplan
    ↓ Strip 9, dial via Genesys trunk
Genesys SIP Server
    ↓ Route through platform
PSTN
```

**Call Flow Example - Inbound:**
```
PSTN
    ↓ DID: +15551234567
Genesys Platform
    ↓ Route Point: 5000
Asterisk (DNIS=5000)
    ↓ Dialplan routing
WebRTC User (1000) or IVR
```

#### 3c. RTP Engine

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

#### 3d. Applications

**Voicemail:**
- Mailbox per user
- Email notifications
- Web access

**Conference Bridge:**
- Multi-party conferences
- Admin controls
- Recording capability

**Call Recording:**
- MixMonitor application
- WAV format
- Storage management

---

### 4. **Coturn (TURN Server)**

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

### 5. **Genesys Engage Platform**

**Location:** Your corporate network  
**Connection:** SIP trunk from Asterisk

#### 5a. Genesys SIP Server

**Port:** 5060 (UDP/TCP) or 5061 (TLS)

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

### Scenario 1: WebRTC to External Number

```
1. Browser (192.168.1.100)
   ↓ User dials: 95551234567
   ↓ SIP INVITE over WSS
   
2. Nginx (192.168.77.131:443)
   ↓ Proxy WebSocket
   
3. Asterisk (192.168.77.131:8089)
   ↓ Receive WSS connection
   ↓ Authenticate user 1000
   ↓ Dialplan: Strip 9, route to Genesys
   ↓ SIP INVITE to Genesys
   
4. Genesys SIP Server (10.x.x.x:5060)
   ↓ Accept call
   ↓ Route through platform
   
5. PSTN Gateway
   ↓ Connect to +15551234567
   
6. Media Path:
   Browser ←SRTP→ Asterisk ←RTP→ Genesys ←→ PSTN
```

### Scenario 2: Inbound from PSTN to WebRTC

```
1. PSTN
   ↓ Incoming call to +15551234000
   
2. PSTN Gateway
   ↓ Forward to Genesys
   
3. Genesys Platform
   ↓ Routing strategy
   ↓ Route Point: 5000
   ↓ SIP INVITE to Asterisk
   
4. Asterisk
   ↓ Receive on trunk
   ↓ Context: from-genesys-engage
   ↓ DNIS = 5000
   ↓ Dialplan: Route to extension 1000
   ↓ SIP INVITE over WSS
   
5. Nginx
   ↓ Proxy WebSocket
   
6. Browser
   ↓ Incoming call alert
   ↓ User answers
   
7. Media Path:
   PSTN ←→ Genesys ←RTP→ Asterisk ←SRTP→ Browser
```

### Scenario 3: WebRTC to WebRTC (Internal)

```
1. User 1000 (Browser A)
   ↓ Dial: 1001
   ↓ WSS to Asterisk
   
2. Asterisk
   ↓ Dialplan: Internal extension
   ↓ Lookup AOR for 1001
   ↓ WSS to User 1001
   
3. User 1001 (Browser B)
   ↓ Incoming call
   ↓ Answer
   
4. Media Path:
   Browser A ←SRTP→ Asterisk ←SRTP→ Browser B
   (Asterisk in media path for recording/monitoring)
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
| `pjsip.conf` | SIP endpoints & transports | WebRTC users, Genesys trunk |
| `extensions.conf` | Call routing logic | Dialplan, IVR, features |
| `rtp.conf` | Media settings | Port range, STUN, codecs |
| `http.conf` | WebSocket server | WSS port, SSL certs |
| `nginx.conf` | Web server & proxy | HTTPS, WebSocket proxy |
| `.env` | Environment variables | IPs, domains, credentials |

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
| Nginx | 80 | TCP | HTTP (redirect to HTTPS) |
| Nginx | 443 | TCP | HTTPS / WSS |
| Asterisk | 5060 | UDP/TCP | SIP signaling |
| Asterisk | 8089 | TCP | WebSocket Secure |
| Asterisk | 10000-20000 | UDP | RTP/SRTP media |
| Coturn | 3478 | UDP/TCP | TURN |
| Coturn | 5349 | TCP | TURN over TLS |
| Genesys | 5060 | UDP/TCP | SIP trunk |

---

## 🚀 Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| OS | CentOS | 7/8/9 |
| Container | Docker | 20.10+ |
| Orchestration | Docker Compose | 2.x |
| PBX | Asterisk | 18+ |
| Web Server | Nginx | Alpine |
| TURN Server | Coturn | Latest |
| SIP Library | PJSIP | 2.x |
| WebRTC Library | JsSIP | 3.10+ |
| Contact Center | Genesys Engage | 8.5/9.0 |

---

## 📚 Further Reading

- **Asterisk Documentation:** https://wiki.asterisk.org
- **WebRTC Specification:** https://webrtc.org
- **JsSIP Documentation:** https://jssip.net
- **Genesys Documentation:** https://docs.genesys.com
- **PJSIP Guide:** https://wiki.asterisk.org/wiki/display/AST/PJSIP

---

*This architecture supports enterprise-grade WebRTC calling with seamless Genesys Engage integration for contact center operations.*




