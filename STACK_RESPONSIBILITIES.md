# WebRTC-Genesys Stack Responsibilities

## 🏗️ Architecture Overview

```
┌─────────────────────┐
│  WebRTC Client      │
│  (Browser/JsSIP)    │
└──────────┬──────────┘
           │ wss:// (WebSocket Secure)
           │ DTLS-SRTP (encrypted media)
           │ ICE candidates
           ↓
┌─────────────────────┐
│      Nginx          │ ← HTTP/WebSocket Proxy Only
│  (Reverse Proxy)    │   (No media handling)
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│     Asterisk        │←───→│      Coturn         │     │     Kamailio        │
│  (B2BUA/Gateway)    │     │   (STUN/TURN)       │     │ (Load Balancer)     │
│                     │     │                     │     │  Port 5070          │
│  ALL MEDIA & ICE    │     │                     │     │  (Not in use)       │
└──────────┬──────────┘     └─────────────────────┘     └─────────────────────┘
           │ sip:// (UDP)
           │ RTP (unencrypted media)
           ↓
┌─────────────────────┐
│   Genesys SIP       │
│  (192.168.210.81)   │
└─────────────────────┘
```

---

## 📋 Component Responsibilities

### **A) ICE TERMINATION**

#### **❄️ Who Does What:**

| Component | Responsibility | Details |
|-----------|---------------|---------|
| **Browser (JsSIP)** | ICE Agent (Initiator) | • Gathers local candidates (host, srflx, relay)<br>• Queries Coturn for STUN/TURN<br>• Sends candidates via SDP to Asterisk |
| **Coturn** | STUN/TURN Server | • Responds to STUN binding requests<br>• Provides server-reflexive candidates<br>• Provides relay candidates if TURN used<br>• **Does NOT terminate ICE** (just assists) |
| **Asterisk** | ICE Peer (Terminator) | • Receives ICE candidates from browser<br>• Performs connectivity checks (STUN bindings)<br>• Chooses working candidate pair<br>• **Terminates ICE session** |

#### **Configuration:**
```ini
# asterisk/etc/pjsip.conf
[agent_dn](!)
ice_support=yes           # ✅ Asterisk handles ICE
use_avpf=yes             # ✅ RTCP-based ICE checks
rtp_symmetric=yes        # ✅ Handle NAT traversal
force_rport=yes          # ✅ Use received port
```

#### **Flow:**
```
Browser → Coturn (STUN query)
        → Browser gets reflexive IP
        → Browser → Asterisk (SDP with candidates)
        → Asterisk ↔ Browser (STUN binding checks)
        → Asterisk selects best pair ✅
```

**✅ ICE Termination: ASTERISK**

---

### **B) TURN RELAY (if needed)**

#### **🔄 Who Does What:**

| Component | Responsibility | Details |
|-----------|---------------|---------|
| **Coturn** | TURN Relay Server | • Relays RTP/RTCP packets<br>• Used if direct path fails<br>• Listens on 192.168.210.54:3478<br>• Relay ports: 49152-65535 |
| **Browser** | TURN Client | • Uses TURN if behind symmetric NAT<br>• Sends media to Coturn<br>• Coturn forwards to Asterisk |
| **Asterisk** | TURN Peer | • Receives media from Coturn (if relayed)<br>• Or directly from Browser (if STUN works) |

#### **Configuration:**
```ini
# coturn/turnserver.conf
relay-ip=192.168.210.54
external-ip=192.168.210.54
user=webrtc:Genesys2024!SecureTurn
```

```javascript
// nginx/html/app.js
iceServers: [
    { urls: 'stun:192.168.210.54:3478' },
    { urls: 'turn:192.168.210.54:3478', username: 'webrtc', credential: '...' }
]
```

#### **Flow (if TURN is used):**
```
Browser → Coturn:3478 (TURN allocate)
        → Coturn allocates relay port
        → Browser → Coturn (DTLS-SRTP media)
        → Coturn → Asterisk (DTLS-SRTP media)
```

**✅ TURN Relay: COTURN (media flows Agent ↔ Coturn ↔ Asterisk)**

**Note:** TURN is **fallback only**. In most cases, STUN is sufficient and media flows directly Browser ↔ Asterisk.

---

### **C) DTLS TERMINATION**

#### **🔐 Who Does What:**

| Component | Responsibility | Details |
|-----------|---------------|---------|
| **Browser** | DTLS Client | • Initiates DTLS handshake<br>• Sends DTLS ClientHello<br>• Derives SRTP keys from handshake |
| **Asterisk** | DTLS Server | • **Terminates DTLS handshake**<br>• Sends DTLS ServerHello<br>• Uses certificates: `/etc/certs/cert.pem`<br>• Derives SRTP keys<br>• **Extracts SRTP master keys** |
| **Nginx** | Proxy Only | • Does NOT touch DTLS<br>• Proxies WebSocket (signaling only) |

#### **Configuration:**
```ini
# asterisk/etc/pjsip.conf
[agent_dn](!)
media_encryption=dtls        # ✅ DTLS for key exchange
dtls_verify=fingerprint      # ✅ Verify via SDP fingerprint
dtls_cert_file=/etc/certs/cert.pem
dtls_private_key=/etc/certs/key.pem
dtls_ca_file=/etc/certs/ca.pem
dtls_setup=actpass          # ✅ Can be client or server
```

#### **Flow:**
```
Browser → Asterisk (DTLS ClientHello over UDP/ICE)
        ← Asterisk (DTLS ServerHello)
        → Browser (DTLS Finished)
        ← Asterisk (DTLS Finished)
        → Both sides derive SRTP keys ✅
```

**✅ DTLS Termination: ASTERISK**

---

### **D) SRTP ↔ RTP CONVERSION**

#### **🔄 Who Does What:**

| Component | Responsibility | Details |
|-----------|---------------|---------|
| **Browser** | SRTP (WebRTC Side) | • Encrypts opus audio with SRTP<br>• Uses DTLS-derived keys<br>• Sends DTLS-SRTP to Asterisk |
| **Asterisk** | SRTP ↔ RTP Gateway | • **Decrypts SRTP** from browser (WebRTC side)<br>• **Transcodes**: opus → ulaw/alaw<br>• **Sends plain RTP** to Genesys (SIP side)<br>• **Receives plain RTP** from Genesys<br>• **Transcodes**: ulaw/alaw → opus<br>• **Encrypts to SRTP** for browser |
| **Genesys** | Plain RTP | • Receives/sends plain RTP (unencrypted)<br>• Uses ulaw/alaw codec<br>• No DTLS/SRTP support |

#### **Configuration:**
```ini
# asterisk/etc/pjsip.conf

# WebRTC Endpoint (DTLS-SRTP)
[agent_dn](!)
media_encryption=dtls        # ✅ SRTP with DTLS
allow=opus,ulaw,alaw         # ✅ Opus for WebRTC
direct_media=no              # ✅ Media MUST go through Asterisk

# Genesys Endpoint (Plain RTP)
[genesys_sip_server]
allow=ulaw,alaw,g722,opus    # ✅ ulaw/alaw for Genesys
direct_media=no              # ✅ Media MUST go through Asterisk
# No media_encryption         # ✅ Plain RTP
```

#### **Flow:**
```
┌──────────────────────────────────────────────────┐
│          ASTERISK (Media Gateway)                │
│                                                  │
│  WebRTC Side              SIP Side               │
│  ────────────             ─────────              │
│                                                  │
│  ┌─────────────┐         ┌──────────────┐       │
│  │ SRTP Decrypt│         │  RTP (plain) │       │
│  └──────┬──────┘         └──────▲───────┘       │
│         │                       │                │
│         ↓                       │                │
│  ┌─────────────┐         ┌──────┴───────┐       │
│  │  Opus Audio │ ──────→ │ Transcode to │       │
│  │  (WebRTC)   │         │  ulaw/alaw   │       │
│  └─────────────┘         └──────────────┘       │
│                                 │                │
│  ┌─────────────┐         ┌──────▼───────┐       │
│  │ SRTP Encrypt│         │  RTP (plain) │       │
│  └──────▲──────┘         └──────────────┘       │
│         │                       │                │
│         └───────────────────────┘                │
│              (Return path)                       │
└──────────────────────────────────────────────────┘

Browser                               Genesys
   ↕                                     ↕
DTLS-SRTP                             Plain RTP
(opus, encrypted)                     (ulaw, unencrypted)
```

**✅ SRTP ↔ RTP Conversion: ASTERISK**

---

## 🎯 Summary Table

| Function | Component | Role |
|----------|-----------|------|
| **A) ICE Termination** | **Asterisk** | ✅ Receives candidates, responds to STUN checks, chooses pair |
| **B) TURN Relay** | **Coturn** | ✅ Relays media if direct path fails (fallback only) |
| **C) DTLS Termination** | **Asterisk** | ✅ Completes handshake, extracts SRTP keys |
| **D) SRTP ↔ RTP Conversion** | **Asterisk** | ✅ Decrypts SRTP (WebRTC), sends plain RTP (Genesys) |
| **E) Codec Transcoding** | **Asterisk** | ✅ opus (WebRTC) ↔ ulaw/alaw (Genesys) |
| **F) B2BUA (Call Control)** | **Asterisk** | ✅ Independent call legs, dialplan routing |
| **G) STUN Server** | **Coturn** | ✅ Provides NAT reflexive addresses |
| **H) WebSocket Proxy** | **Nginx** | ✅ Proxies signaling only (no media) |
| **I) SIP Registration** | **Asterisk** | ✅ Registers DNs to Genesys (outbound) |
| **J) SIP Trunk** | **Asterisk** | ✅ Accepts calls from Genesys (inbound) |
| **K) Load Balancing** | **Kamailio** | ⚠️ Deployed but NOT in active call path (POC single Asterisk) |

---

## ⚠️ Kamailio Status (Deployed but Unused)

### **What Kamailio Is:**

Kamailio is a **SIP load balancer and proxy** designed for:
- ✅ Load balancing across multiple Asterisk instances
- ✅ SIP routing and dispatcher
- ✅ High availability (failover between Asterisk nodes)
- ✅ NAT traversal (nathelper module)

### **Current Configuration:**

```ini
# kamailio/kamailio.cfg
Purpose: SIP load balancer and registrar for Asterisk cluster
Listen: udp:192.168.210.54:5070
Dispatcher: /etc/kamailio/dispatcher.list (single Asterisk)
```

### **Why It's NOT in the Call Path:**

| Reason | Explanation |
|--------|-------------|
| **POC = Single Asterisk** | No need for load balancing with one instance |
| **Direct WebRTC** | Browser → Nginx → Asterisk (WebSocket), bypasses Kamailio |
| **Direct Genesys Trunk** | Genesys → Asterisk:5060 (UDP), bypasses Kamailio |
| **Host Mode** | All containers on `192.168.210.54`, no NAT to traverse |
| **Not Configured** | No Asterisk endpoints point to Kamailio:5070 |

### **Evidence from Logs:**

From the server logs you provided:
```
[2025-12-16 18:43:35] NOTICE: Request 'OPTIONS' from '<sip:kamailio@192.168.210.54>' 
failed for '192.168.210.54:5070' - No matching endpoint found
```

**Translation:** Kamailio is sending health checks (OPTIONS) to Asterisk, but Asterisk has no endpoint configured to accept them. Kamailio is running but **not in use**.

### **Current Call Flows (Without Kamailio):**

#### **WebRTC Client Call:**
```
Browser → Nginx:443 (WebSocket) → Asterisk:8089 (wss://) → Genesys:5060 (SIP)
        [Kamailio not involved ❌]
```

#### **Genesys Inbound Call:**
```
Genesys:5060 → Asterisk:5060 (UDP) → Asterisk:8089 → Nginx → Browser
              [Kamailio not involved ❌]
```

#### **Genesys Outbound Registration:**
```
Asterisk:5060 → Genesys:5060 (REGISTER)
              [Kamailio not involved ❌]
```

### **When Would You Use Kamailio?**

**Future Production Scenarios:**

1. **Multi-Asterisk Cluster:**
   ```
   Browser → Nginx → Kamailio:5070 → [Asterisk1, Asterisk2, Asterisk3]
                     (Load balancer)
   ```

2. **NAT Traversal (if needed):**
   ```
   Remote Site → Internet → Kamailio (NAT helper) → Asterisk
                            (rewrites Contact/Via)
   ```

3. **Advanced SIP Routing:**
   ```
   Kamailio: Route calls based on DN, time of day, load, etc.
   ```

4. **High Availability:**
   ```
   Kamailio monitors Asterisk health, fails over to backup
   ```

### **Should You Remove Kamailio?**

#### **Option 1: Keep It (Recommended for POC)**
✅ No harm - it's running but idle  
✅ Ready for future expansion  
✅ Useful for testing load balancing later  
✅ Minimal resource usage (just health checks)  

#### **Option 2: Remove It**
⚠️ Only if you're certain you'll never scale beyond one Asterisk  
⚠️ Requires updating `docker-compose.yml`  
⚠️ Removes future flexibility  

### **Recommendation:**

**Keep Kamailio deployed but document its status.** It's not interfering with the current setup, and having it ready provides:
- ✅ **Future scalability** (add more Asterisk instances easily)
- ✅ **Testing capability** (test load balancing without new deployment)
- ✅ **Minimal overhead** (just runs health checks every 10s)

---

## 🔑 Key Points

### **Asterisk is the STAR ⭐**

Asterisk handles **ALL media processing**:
- ✅ **ICE termination** - no ICE to Genesys
- ✅ **DTLS termination** - no DTLS to Genesys
- ✅ **SRTP decryption/encryption** - Genesys sees plain RTP
- ✅ **Codec transcoding** - opus ↔ ulaw/alaw
- ✅ **B2BUA** - two independent call legs
- ✅ **NAT traversal** - force_rport, rtp_symmetric

### **Coturn is the HELPER 🤝**

Coturn provides **NAT traversal assistance**:
- ✅ **STUN** - tells browser its public IP (most cases)
- ✅ **TURN** - relays media if STUN fails (rare, fallback)
- ⚠️ **NOT** a media gateway - just a relay
- ⚠️ **NOT** terminating ICE - Asterisk does that

### **Nginx is the DOORMAN 🚪**

Nginx only handles **HTTP/WebSocket**:
- ✅ **WebSocket proxy** - signaling (SIP over WebSocket)
- ✅ **HTTP server** - serves web client files
- ❌ **NOT** touching media (RTP/SRTP/DTLS)
- ❌ **NOT** involved in ICE/TURN/STUN

### **Kamailio is the STANDBY 🔄**

Kamailio is deployed but **not in the active call path**:
- ⚠️ **Running** - listening on port 5070
- ⚠️ **Unused** - no traffic routed through it
- ✅ **Future-ready** - for multi-Asterisk load balancing
- ✅ **No impact** - doesn't interfere with current calls

### **Genesys is LEGACY 📞**

Genesys sees Asterisk as a **traditional SIP gateway**:
- ✅ **Plain SIP** (UDP, no WebSocket)
- ✅ **Plain RTP** (no SRTP, no DTLS)
- ✅ **ulaw/alaw** (no opus, no WebRTC)
- ✅ **No ICE** (just standard RTP)
- ✅ **No knowledge** of WebRTC clients

---

## 🧪 Media Path Verification

### **For Outbound Call (Agent → Genesys):**

```
1. Browser captures mic → opus audio
2. Browser encrypts with SRTP (DTLS keys)
3. Browser → Asterisk (DTLS-SRTP over ICE)
4. Asterisk decrypts SRTP ✅
5. Asterisk transcodes opus → ulaw ✅
6. Asterisk → Genesys (plain RTP, ulaw)
7. Genesys forwards to destination agent
```

### **For Inbound Call (Genesys → Agent):**

```
1. Genesys → Asterisk (plain RTP, ulaw)
2. Asterisk receives plain RTP
3. Asterisk transcodes ulaw → opus ✅
4. Asterisk encrypts with SRTP (DTLS keys) ✅
5. Asterisk → Browser (DTLS-SRTP over ICE)
6. Browser decrypts SRTP
7. Browser plays audio to speaker
```

---

## 📝 Configuration Audit

### ✅ **Correct Configurations:**

```ini
# WebRTC Endpoint
[agent_dn](!)
webrtc=yes                    # ✅ Full WebRTC stack
ice_support=yes               # ✅ ICE termination
media_encryption=dtls         # ✅ DTLS-SRTP
direct_media=no               # ✅ Force media through Asterisk

# Genesys Endpoint
[genesys_sip_server]
direct_media=no               # ✅ Force media through Asterisk
allow=ulaw,alaw               # ✅ Traditional codecs
# No media_encryption         # ✅ Plain RTP
```

### ✅ **Coturn Configuration:**

```ini
# coturn/turnserver.conf
relay-ip=192.168.210.54       # ✅ Relay address
external-ip=192.168.210.54    # ✅ Advertised address
user=webrtc:Genesys2024!...   # ✅ TURN auth
```

### ✅ **Client Configuration:**

```javascript
// nginx/html/app.js
iceServers: [
    { urls: 'stun:192.168.210.54:3478' },  // ✅ Local STUN
    { urls: 'turn:192.168.210.54:3478' }   // ✅ Local TURN
]
```

---

## ✅ Conclusion

**Your stack correctly implements the DMZ WebRTC gateway pattern:**

```
┌───────────────────────────────────────────────────────────┐
│  INTERNET/PUBLIC NETWORK                                  │
│  ┌──────────┐                                             │
│  │ Browser  │ ← WebRTC Client                             │
│  └────┬─────┘                                             │
└───────┼───────────────────────────────────────────────────┘
        │ DTLS-SRTP (encrypted)
        │ ICE candidates via Coturn STUN/TURN
┌───────┼───────────────────────────────────────────────────┐
│  DMZ  │                                                   │
│  ┌────▼─────┐    ┌──────────┐    ┌────────────┐         │
│  │ Asterisk │◄──►│  Coturn  │    │  Kamailio  │         │
│  │ (Gateway)│    │(STUN/TURN)│    │:5070 (idle)│         │
│  │  :5060   │    │          │    │            │         │
│  └────┬─────┘    └──────────┘    └────────────┘         │
│       │                            (not in call path)    │
└───────┼───────────────────────────────────────────────────┘
        │ Plain RTP (unencrypted)
┌───────┼───────────────────────────────────────────────────┐
│  VPN  │                                                   │
│  ┌────▼────────┐                                          │
│  │   Genesys   │ ← Traditional SIP                        │
│  │ (SIP Server)│                                          │
│  │   :5060     │                                          │
│  └─────────────┘                                          │
└───────────────────────────────────────────────────────────┘
```

**✅ All A/B/C/D functions are correctly handled by Asterisk with Coturn assistance!**

