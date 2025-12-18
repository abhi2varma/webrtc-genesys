# WebRTC Architecture: ICE, STUN, TURN, SRTP, and DTLS

## Complete Technical Overview

This document explains how WebRTC components work together to establish secure, NAT-traversing real-time communication.

---

## 🏗️ **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WebRTC Call Flow                            │
└─────────────────────────────────────────────────────────────────────┘

Browser A (192.168.1.100)              Browser B (192.168.2.200)
Behind NAT Router A                    Behind NAT Router B
Public IP: 203.0.113.10                Public IP: 198.51.100.50
         │                                      │
         │   1. SDP Offer/Answer (SIP)         │
         │◄────────────────────────────────────►│
         │                                      │
         │   2. ICE Candidate Exchange          │
         │   (via Signaling Server)             │
         │◄────────────────────────────────────►│
         │                                      │
         │   3. STUN Requests                   │
         │──────────►┌──────────┐               │
         │           │  STUN    │               │
         │◄──────────│  Server  │◄──────────────│
         │           └──────────┘               │
         │                                      │
         │   4. TURN Relay (if needed)          │
         │──────────►┌──────────┐◄──────────────│
         │           │  TURN    │               │
         │◄─────────►│  Server  │◄─────────────►│
         │           └──────────┘               │
         │                                      │
         │   5. DTLS Handshake                  │
         │   (Key Exchange)                     │
         │◄────────────────────────────────────►│
         │                                      │
         │   6. SRTP Media (Encrypted)          │
         │◄════════════════════════════════════►│
         │                                      │
```

---

## 1. 🔌 **ICE (Interactive Connectivity Establishment)**

### Purpose
ICE finds the best network path between two peers, working around NAT and firewalls.

### How It Works

#### Step 1: Gather Candidates
Each peer discovers multiple ways to be reached:

```
1. Host Candidate (Local IP)
   Example: 192.168.1.100:54321
   - Direct connection within same network
   - Highest priority
   
2. Server Reflexive (SRFLX) - via STUN
   Example: 203.0.113.10:12345
   - Your public IP:port as seen by STUN server
   - Medium priority
   
3. Relay Candidate - via TURN
   Example: 198.51.100.1:49152
   - TURN server acts as relay
   - Lowest priority (backup)
```

#### Step 2: Exchange Candidates
Candidates are sent to the other peer via signaling (SIP, WebSocket, etc.)

```javascript
// ICE Candidate structure
{
  candidate: "candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host",
  sdpMLineIndex: 0,
  sdpMid: "audio"
}
```

#### Step 3: Connectivity Checks
All candidate pairs are tested simultaneously:

```
Browser A Host     ←→ Browser B Host      (Direct)
Browser A Host     ←→ Browser B SRFLX     (Direct to public IP)
Browser A SRFLX    ←→ Browser B Host      (Public to private)
Browser A SRFLX    ←→ Browser B SRFLX     (Public to public)
Browser A SRFLX    ←→ Browser B Relay     (Public to TURN)
Browser A Relay    ←→ Browser B Relay     (TURN to TURN)
```

#### Step 4: Select Best Path
ICE uses this priority order:
1. ✅ **Host-to-Host** (same LAN) - Fastest, no latency
2. ✅ **SRFLX-to-SRFLX** (direct via internet) - Fast, low latency
3. ⚠️ **SRFLX-to-Relay** (one peer via TURN) - Medium latency
4. ❌ **Relay-to-Relay** (both via TURN) - Highest latency, last resort

### ICE States

```
ICE Gathering States:
├─ new          → Initial state
├─ gathering    → Collecting candidates (STUN requests sent)
└─ complete     → All candidates gathered

ICE Connection States:
├─ new          → Initial state
├─ checking     → Testing candidate pairs
├─ connected    → At least one pair works
├─ completed    → Best pair selected
├─ failed       → No working path found
└─ disconnected → Connection lost
```

### Why 40 Seconds?
The browser waits for **all candidates** before sending INVITE:
- STUN timeout: ~30-40 seconds if server unreachable
- TURN timeout: ~10-20 seconds if server unreachable
- Browser then proceeds with whatever candidates it has

---

## 2. 🌐 **STUN (Session Traversal Utilities for NAT)**

### Purpose
STUN helps peers discover their **public IP address** and **port** as seen from outside their NAT.

### How It Works

#### The NAT Problem
```
Private Network               Internet
┌──────────────┐             ┌────────┐
│ Browser      │             │ Remote │
│ 192.168.1.100│   ???   →   │  Peer  │
└──────────────┘             └────────┘
       ↓
  NAT Router
  Public IP: 203.0.113.10
```

**Question:** What IP:port should the remote peer use to reach me?

#### STUN Solution

**Step 1: Browser sends STUN Binding Request**
```
Browser (192.168.1.100:54321)
    ↓
NAT Router (changes port)
    ↓ (now appears as 203.0.113.10:12345)
    ↓
STUN Server (stun.l.google.com:19302)
```

**Step 2: STUN Server responds with your public address**
```
STUN Response:
{
  "XOR-MAPPED-ADDRESS": "203.0.113.10:12345"
}
```

**Step 3: Browser now knows its public IP:port**
```
SRFLX Candidate: 203.0.113.10:12345
```

### STUN Limitations
- ❌ Doesn't work with **symmetric NAT** (changes port for each destination)
- ❌ Doesn't work with strict firewalls that block incoming connections
- ✅ Works great for **cone NAT** (most home routers)

### STUN Message Format
```
STUN Binding Request:
┌─────────────────┐
│ Message Type    │ 0x0001 (Binding Request)
│ Message Length  │ Variable
│ Magic Cookie    │ 0x2112A442
│ Transaction ID  │ 96-bit unique ID
│ Attributes      │ (optional)
└─────────────────┘

STUN Binding Response:
┌─────────────────┐
│ Message Type    │ 0x0101 (Binding Success)
│ XOR-MAPPED-ADDR │ Your public IP:port
└─────────────────┘
```

---

## 3. 🔄 **TURN (Traversal Using Relays around NAT)**

### Purpose
When direct connection fails (symmetric NAT, strict firewall), TURN relays all media traffic.

### How It Works

#### Step 1: Allocate Relay Address
```
Browser A → TURN Server: "Give me a relay address"
TURN Server → Browser A: "Use 198.51.100.1:49152"
```

#### Step 2: All Traffic Goes Through TURN
```
Browser A                TURN Server              Browser B
(192.168.1.100)         (198.51.100.1)         (192.168.2.200)
    │                        │                        │
    │──RTP Packet──────────→ │                        │
    │                        │──RTP Packet──────────→ │
    │                        │ ←─RTP Packet──────────│
    │ ←─RTP Packet──────────│                        │
```

### TURN Message Types

**1. Allocate Request** - Get relay address
```
Client → TURN: "I need a relay"
TURN → Client: "Use 198.51.100.1:49152"
```

**2. Create Permission** - Allow peer to send data
```
Client → TURN: "Allow traffic from 203.0.113.10"
TURN → Client: "Permission granted"
```

**3. Send Indication** - Send data to peer
```
Client → TURN: "Send this packet to peer"
TURN → Peer: (forwards packet)
```

**4. Data Indication** - Receive data from peer
```
Peer → TURN: (sends packet)
TURN → Client: "Data from peer: [packet]"
```

### TURN Authentication
Uses **long-term credentials**:

```
TURN Request:
├─ USERNAME: "webrtc"
├─ PASSWORD: "Genesys2024!SecureTurn"  (hashed)
└─ REALM: "webrtc.genesys.local"

TURN validates credentials before allocating relay.
```

### TURN Resource Usage
⚠️ **TURN is expensive:**
- All media goes through server
- 1 HD video call = ~2 Mbps × 2 directions = 4 Mbps
- 100 concurrent calls = 400 Mbps bandwidth!

**Best Practice:** Only use TURN as **last resort**

---

## 4. 🔐 **DTLS (Datagram Transport Layer Security)**

### Purpose
Establish encryption keys for SRTP **without a trusted certificate authority**.

### How It Works

#### DTLS Handshake (over UDP)
```
Browser A                                    Browser B
    │                                            │
    │──── ClientHello ──────────────────────────→│
    │         (Supported ciphers, random)        │
    │                                            │
    │ ←─── ServerHello + Certificate ───────────│
    │         (Selected cipher, cert, random)    │
    │                                            │
    │──── Certificate ──────────────────────────→│
    │         (Browser A's self-signed cert)     │
    │                                            │
    │──── ClientKeyExchange ────────────────────→│
    │         (Pre-master secret, encrypted)     │
    │                                            │
    │──── ChangeCipherSpec ─────────────────────→│
    │──── Finished (encrypted) ──────────────────→│
    │                                            │
    │ ←─── ChangeCipherSpec ────────────────────│
    │ ←─── Finished (encrypted) ────────────────│
    │                                            │
    │  [DTLS Handshake Complete]                 │
    │  [SRTP Keys Derived]                       │
```

#### Certificate Fingerprint Verification
**Problem:** Self-signed certificates aren't trusted

**Solution:** Exchange certificate fingerprints in SDP (via secure signaling)

```javascript
// In SDP Offer/Answer
a=fingerprint:sha-256 AB:CD:EF:12:34:56:78:90:...
```

**Verification:**
1. Browser A sends certificate in DTLS handshake
2. Browser B computes SHA-256 of received certificate
3. Browser B compares with fingerprint from SDP
4. ✅ If match → Trust established
5. ❌ If mismatch → Connection fails

### DTLS-SRTP Key Derivation

After DTLS handshake, both sides derive SRTP keys:

```
Master Secret (from DTLS)
    ↓ (Key Derivation Function)
    ├─→ SRTP Encryption Key (128-bit)
    ├─→ SRTP Authentication Key (160-bit)
    └─→ SRTP Salt (112-bit)
```

### DTLS Roles
```
┌────────────────────────────────────────────────┐
│  Browser A (dtls_setup=actpass)                │
│  ├─ Can be client OR server                    │
│  └─ Waits for Browser B to decide              │
└────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────┐
│  Browser B (dtls_setup=active)                 │
│  ├─ Acts as DTLS client                        │
│  └─ Initiates DTLS handshake                   │
└────────────────────────────────────────────────┘
```

**In Asterisk:**
```ini
dtls_setup=actpass  # Can be client or server
dtls_cert_file=/etc/certs/cert.pem
dtls_private_key=/etc/certs/key.pem
dtls_ca_file=/etc/certs/ca.pem
```

---

## 5. 🔒 **SRTP (Secure Real-time Transport Protocol)**

### Purpose
Encrypt and authenticate RTP media packets using keys from DTLS.

### RTP vs SRTP

**RTP (Unencrypted):**
```
┌─────────────────────────────────────────┐
│ RTP Header (12 bytes)                   │
├─────────────────────────────────────────┤
│ Payload (audio/video data)              │
│ READABLE BY ANYONE                      │
└─────────────────────────────────────────┘
```

**SRTP (Encrypted):**
```
┌─────────────────────────────────────────┐
│ RTP Header (12 bytes) - Partially auth  │
├─────────────────────────────────────────┤
│ Encrypted Payload                       │
│ AES-128 encrypted audio/video           │
├─────────────────────────────────────────┤
│ Authentication Tag (10 bytes)           │
│ HMAC-SHA1 of header + payload           │
└─────────────────────────────────────────┘
```

### SRTP Encryption Process

**Sending Audio:**
```
Audio Sample (PCM/Opus)
    ↓
RTP Packetization
    ↓
SRTP Encryption (AES-128)
    ├─ Encrypt payload with SRTP key
    ├─ Add authentication tag (HMAC-SHA1)
    └─ Increment sequence number
    ↓
Send over network
```

**Receiving Audio:**
```
Receive packet
    ↓
SRTP Decryption
    ├─ Verify authentication tag
    ├─ Check sequence number (replay protection)
    ├─ Decrypt payload
    └─ Verify SSRC (source)
    ↓
RTP Depacketization
    ↓
Audio Playback
```

### SRTP Components

**1. Encryption: AES-128 Counter Mode**
```
Packet Key = KDF(Master Key, SSRC, Packet Index)
Encrypted Payload = Plaintext XOR AES(Packet Key)
```

**2. Authentication: HMAC-SHA1**
```
Auth Tag = HMAC-SHA1(Auth Key, Header || Payload)
Verifies: Data hasn't been tampered with
```

**3. Replay Protection**
```
ROC (Rollover Counter) + Sequence Number = Packet Index
Receiver maintains "replay list" of seen indices
Duplicate packets are rejected
```

### SRTP Parameters (in SDP)

```
m=audio 10000 RTP/SAVP 0 8
a=crypto:1 AES_CM_128_HMAC_SHA1_80
    inline:WVNfX19zZW1jdGwgKCkgewkyMjA7fQp9CnVubGVz
    
Breakdown:
├─ AES_CM_128_HMAC_SHA1_80
│  ├─ AES_CM_128: AES-128 Counter Mode encryption
│  ├─ HMAC_SHA1: HMAC-SHA1 authentication
│  └─ 80: 80-bit (10-byte) authentication tag
│
└─ inline:...: Base64-encoded master key + salt
```

---

## 6. 📊 **Complete Call Flow**

### Phase 1: Signaling (SDP Exchange)

```
Browser A                     SIP Server                  Browser B
    │                              │                          │
    │──INVITE (SDP Offer)─────────→│                          │
    │  ICE candidates:             │                          │
    │  - host 192.168.1.100:54321  │                          │
    │  - srflx 203.0.113.10:12345  │                          │
    │  DTLS fingerprint: AB:CD...  │                          │
    │                              │──INVITE─────────────────→│
    │                              │                          │
    │                              │ ←─180 Ringing────────────│
    │ ←─180 Ringing────────────────│                          │
    │                              │                          │
    │                              │ ←─200 OK (SDP Answer)────│
    │                              │  ICE candidates:         │
    │                              │  - host 192.168.2.200:9876
    │ ←─200 OK (SDP Answer)────────│  - srflx 198.51.100.50:5555
    │                              │  DTLS fingerprint: 12:34...
    │──ACK────────────────────────→│                          │
    │                              │──ACK────────────────────→│
```

### Phase 2: ICE Connectivity Checks

```
Browser A                    STUN Server                 Browser B
    │                              │                          │
    │──STUN Binding Request───────→│                          │
    │ ←─STUN Response──────────────│                          │
    │   (Your public: 203.0.113.10:12345)                     │
    │                                                         │
    │─────────ICE Connectivity Check (STUN)─────────────────→│
    │   From: 192.168.1.100:54321                            │
    │   To: 192.168.2.200:9876                               │
    │                                                         │
    │ ←───────ICE Connectivity Check Response────────────────│
    │   ✅ Direct connection possible!                        │
    │                                                         │
    │   [Select best candidate pair]                          │
    │   Winner: Host-to-Host (lowest latency)                │
```

### Phase 3: DTLS Handshake

```
Browser A                                              Browser B
    │                                                      │
    │──DTLS ClientHello──────────────────────────────────→│
    │  Supported Ciphers, Random                          │
    │                                                      │
    │ ←─DTLS ServerHello + Certificate───────────────────│
    │   Selected Cipher, Certificate, Random              │
    │   Certificate contains public key                   │
    │                                                      │
    │  [Verify certificate fingerprint]                   │
    │  SHA-256(cert) == Fingerprint from SDP? ✅          │
    │                                                      │
    │──DTLS Certificate──────────────────────────────────→│
    │──DTLS ClientKeyExchange────────────────────────────→│
    │  (Pre-master secret encrypted with server's pubkey) │
    │                                                      │
    │──DTLS Finished (encrypted)─────────────────────────→│
    │                                                      │
    │ ←─DTLS Finished (encrypted)────────────────────────│
    │                                                      │
    │  [Both sides derive SRTP keys from master secret]   │
    │  Master Secret → SRTP Keys via KDF                  │
```

### Phase 4: Secure Media (SRTP)

```
Browser A                                              Browser B
    │                                                      │
    │──SRTP Audio Packet (encrypted)─────────────────────→│
    │  RTP Header (seq=1, timestamp=160)                  │
    │  Encrypted Payload (AES-128)                        │
    │  Auth Tag (HMAC-SHA1)                               │
    │                                                      │
    │  [Browser B verifies auth tag]                      │
    │  [Browser B decrypts payload]                       │
    │  [Browser B plays audio]                            │
    │                                                      │
    │ ←─SRTP Audio Packet (encrypted)────────────────────│
    │  RTP Header (seq=1, timestamp=160)                  │
    │  Encrypted Payload (AES-128)                        │
    │  Auth Tag (HMAC-SHA1)                               │
    │                                                      │
    │  [Browser A verifies auth tag]                      │
    │  [Browser A decrypts payload]                       │
    │  [Browser A plays audio]                            │
    │                                                      │
    │  ◄══════════ Encrypted bidirectional audio ═══════►│
```

---

## 7. 🔧 **Configuration Examples**

### Browser (JsSIP)

```javascript
const options = {
    pcConfig: {
        iceServers: [
            // STUN server for public IP discovery
            { urls: 'stun:stun.l.google.com:19302' },
            
            // TURN server for NAT traversal fallback
            { 
                urls: 'turn:192.168.210.54:3478',
                username: 'webrtc',
                credential: 'Genesys2024!SecureTurn'
            }
        ],
        // Only use TURN if direct connection fails
        iceTransportPolicy: 'all'  // 'relay' forces TURN
    },
    mediaConstraints: {
        audio: true,
        video: false
    }
};

const session = ua.call('sip:1003@192.168.210.54', options);
```

### Asterisk (pjsip.conf)

```ini
[agent_dn](!)
type=endpoint
transport=transport-ws

; Enable WebRTC
webrtc=yes

; ICE Support
ice_support=yes
force_rport=yes
rewrite_contact=yes

; DTLS Configuration
media_encryption=dtls
dtls_verify=fingerprint
dtls_setup=actpass
dtls_cert_file=/etc/certs/cert.pem
dtls_private_key=/etc/certs/key.pem
dtls_ca_file=/etc/certs/ca.pem

; SRTP (enabled via webrtc=yes)
use_avpf=yes
rtcp_mux=yes

; Codecs
disallow=all
allow=ulaw,alaw
```

### Asterisk (rtp.conf)

```ini
[general]
rtpstart=10000
rtpend=20000

; ICE Support
icesupport=yes
ice_host_candidates=yes

; STUN Server
stunaddr=stun.l.google.com:19302

; TURN Server
turnaddr=192.168.210.54:3478
turnusername=webrtc
turnpassword=Genesys2024!SecureTurn

; Security
strictrtp=yes
```

### Coturn (turnserver.conf)

```ini
# Listening ports
listening-port=3478
tls-listening-port=5349

# External IP
external-ip=203.0.113.10/192.168.210.54

# Relay address
relay-ip=192.168.210.54

# Auth
lt-cred-mech
user=webrtc:Genesys2024!SecureTurn
realm=webrtc.genesys.local

# Security
fingerprint
no-multicast-peers
no-loopback-peers

# Performance
max-bps=3000000
bps-capacity=0
```

---

## 8. 🚨 **Common Issues and Solutions**

### Issue 1: ICE Gathering Takes 40 Seconds

**Cause:** STUN server unreachable or slow

**Solutions:**
```
1. Use local STUN server: stun:192.168.210.54:3478
2. Use fast public STUN: stun:stun.cloudflare.com:3478
3. Disable ICE for local network (ice_support=no)
4. Check firewall allows UDP 3478
```

### Issue 2: No Audio After Connection

**Cause:** SRTP keys not matching or RTP ports blocked

**Solutions:**
```
1. Verify DTLS fingerprints match in SDP
2. Check firewall allows RTP ports (10000-20000)
3. Enable SRTP debug: pjsip set logger on
4. Check dtls_verify=fingerprint (not 'no')
```

### Issue 3: Connection Works Locally, Fails Remotely

**Cause:** Public IP not configured or TURN not working

**Solutions:**
```
1. Configure external-ip in Coturn
2. Verify TURN allocates relay address
3. Test TURN: turnutils_uclient -v -u webrtc -w pass TURN_IP
4. Check NAT forwards UDP 3478 to Coturn
```

### Issue 4: One-Way Audio

**Cause:** Asymmetric routing or strict RTP

**Solutions:**
```
1. Disable strict RTP temporarily: strictrtp=no
2. Check both directions have valid ICE candidates
3. Verify symmetric RTP: rtp_symmetric=yes
4. Check NAT allows incoming RTP
```

---

## 9. 📚 **Security Best Practices**

### DTLS Certificates
```
✅ Use proper certificates (not self-signed) for production
✅ Rotate certificates regularly
✅ Use strong key sizes (2048-bit RSA minimum)
✅ Verify fingerprints via secure signaling channel
❌ Never set dtls_verify=no in production
```

### SRTP Keys
```
✅ Keys derived from DTLS (automatic)
✅ Use AES-256 for sensitive applications
✅ Enable RTCP encryption (rtcp_mux=yes)
❌ Never share SRTP keys in plaintext
❌ Never reuse keys across sessions
```

### TURN Security
```
✅ Use long-term credentials
✅ Implement rate limiting
✅ Use TLS for TURN signaling (port 5349)
✅ Restrict TURN to authenticated users
❌ Don't allow anonymous TURN allocations
```

### Network Security
```
✅ Use TLS for signaling (WSS, HTTPS)
✅ Implement IP whitelisting where possible
✅ Enable firewall rules for RTP range
✅ Use VPN for internal users
❌ Don't expose RTP ports directly to internet
```

---

## 10. 🎯 **Performance Optimization**

### ICE Optimization
```
1. Use local STUN/TURN for internal users
2. Deploy TURN servers geographically close to users
3. Set aggressive ICE timers for faster gathering
4. Use Trickle ICE (send candidates as discovered)
5. Prioritize host candidates for same-network peers
```

### SRTP Optimization
```
1. Use hardware acceleration for AES (if available)
2. Reduce authentication tag size (80-bit vs 32-bit)
3. Use efficient codecs (Opus > G.711)
4. Enable FEC (Forward Error Correction) for lossy networks
```

### TURN Optimization
```
1. Only use TURN as last resort
2. Limit bandwidth per allocation
3. Set short allocation lifetime (5 minutes)
4. Use UDP over TCP when possible
5. Monitor TURN usage and scale accordingly
```

---

## 11. 📈 **Monitoring and Debugging**

### Browser Console
```javascript
// Monitor ICE gathering
pc.addEventListener('icegatheringstatechange', () => {
    console.log('ICE gathering:', pc.iceGatheringState);
});

// Monitor ICE connection
pc.addEventListener('iceconnectionstatechange', () => {
    console.log('ICE connection:', pc.iceConnectionState);
});

// Get connection stats
pc.getStats().then(stats => {
    stats.forEach(report => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            console.log('Selected pair:', report);
        }
    });
});
```

### Asterisk CLI
```bash
# Enable PJSIP debugging
pjsip set logger on

# Check endpoints
pjsip show endpoints

# Check SRTP status
rtp set debug on

# Check ICE candidates
core set verbose 5
```

### Coturn Logs
```bash
# Enable verbose logging
verbose

# Monitor allocations
docker logs webrtc-coturn | grep "allocation"

# Check authentication
docker logs webrtc-coturn | grep "401"
```

---

## 12. 🌍 **Real-World Scenarios**

### Scenario 1: Same Local Network
```
Browser A (192.168.210.100)
Browser B (192.168.210.200)

Result:
├─ ICE selects: Host-to-Host
├─ No STUN/TURN needed
├─ Direct connection: 192.168.210.100 ↔ 192.168.210.200
├─ Latency: <1ms
└─ Setup time: <1 second
```

### Scenario 2: Different Networks, Easy NAT
```
Browser A (192.168.1.100 → 203.0.113.10)
Browser B (192.168.2.200 → 198.51.100.50)

Result:
├─ ICE uses STUN to discover public IPs
├─ ICE selects: SRFLX-to-SRFLX
├─ Connection: 203.0.113.10 ↔ 198.51.100.50
├─ Latency: 10-50ms
└─ Setup time: 2-5 seconds
```

### Scenario 3: Symmetric NAT (Needs TURN)
```
Browser A (behind symmetric NAT)
Browser B (behind firewall)

Result:
├─ ICE detects symmetric NAT
├─ Direct connection fails
├─ ICE selects: Relay-to-Relay
├─ All traffic via TURN: A ↔ TURN ↔ B
├─ Latency: 50-100ms
└─ Setup time: 5-10 seconds
```

---

## 📖 **Summary**

### The Complete Flow:
```
1. Signaling (SIP)       → Exchange SDP offers with ICE candidates
2. ICE Discovery         → Find all possible network paths
3. STUN                  → Discover public IP addresses
4. TURN (if needed)      → Use relay as fallback
5. ICE Selection         → Choose best path based on tests
6. DTLS Handshake        → Exchange certificates, verify fingerprints
7. Key Derivation        → Generate SRTP keys from DTLS master secret
8. SRTP Media            → Encrypted audio/video transmission
```

### Key Principles:
- ✅ **ICE** finds the path
- ✅ **STUN** discovers public IPs
- ✅ **TURN** provides relay fallback
- ✅ **DTLS** establishes trust and keys
- ✅ **SRTP** encrypts the media

### For Your Setup (192.168.210.x):
```
Recommended Configuration:
├─ ICE: Enabled (ice_support=yes)
├─ STUN: Local server (192.168.210.54:3478)
├─ TURN: Local server (192.168.210.54:3478)
├─ DTLS: Enabled with proper certs
├─ SRTP: Enabled via webrtc=yes
└─ Expected setup time: 2-5 seconds
```

---

**This is how WebRTC should work in production!** 🚀

