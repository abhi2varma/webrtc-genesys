# 🎙️ RTP Port Usage - WebRTC Gateway Explained

**Scenario:** User opens `https://192.168.210.54:8443/wwe-demo.html` and makes a call

---

## 📊 Complete RTP Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                       YOUR BROWSER (Local PC)                       │
│  https://192.168.210.54:8443/wwe-demo.html                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ (1) SIP Signaling via WSS
                                  │     Port: 8443 (HTTPS/WSS)
                                  │     Protocol: WebSocket Secure
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           NGINX (SSL Proxy)                         │
│  Port: 8443 (HTTPS/WSS)                                            │
│  Role: SSL/TLS termination, WebSocket proxy                        │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ (2) Proxy to Kamailio
                                  │     Port: 8080 (WS - internal)
                                  │     Protocol: WebSocket (non-secure)
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       KAMAILIO (SIP Proxy)                          │
│  WebSocket Port: 8080 (from Nginx)                                 │
│  SIP UDP Port: 5070 (to Asterisk)                                  │
│  Role: WebSocket ↔ UDP SIP conversion                              │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ (3) Forward to Asterisk
                                  │     Port: 5060 (UDP SIP)
                                  │     Protocol: SIP/UDP
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ASTERISK PBX (Media Gateway)                     │
│  SIP Port: 5060 (UDP)                                              │
│  RTP Port Range: 10000-20000 (UDP) ◄── CONFIGURED IN rtp.conf     │
│  WebRTC Port: 8088 (WS), 8089 (WSS) - not used in current setup   │
│  STUN/TURN: 3478                                                   │
│  Role: WebRTC ↔ Traditional SIP/RTP conversion                    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ (4) Forward to Genesys
                                  │     Port: 5060 (UDP SIP)
                                  │     RTP: Dynamic ports
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      GENESYS SIP SERVER                             │
│  IP: 192.168.210.81                                                │
│  SIP Port: 5060                                                    │
│  RTP Port Range: (Genesys configured)                              │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ (5) Route to Agent
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        GENESYS AGENT (DN 1003)                      │
│  Device: Softphone / Desk Phone                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 **Answer: Which RTP Ports Are Used?**

### **Your Browser (Local PC):**

When you open `https://192.168.210.54:8443/wwe-demo.html`:

| Layer | Port(s) | Protocol | Direction | Description |
|-------|---------|----------|-----------|-------------|
| **HTTPS** | `8443` | TCP | Browser → Nginx | Load HTML/JS files |
| **WSS** | `8443` | TCP/WSS | Browser → Nginx → Kamailio | SIP signaling over secure WebSocket |
| **SRTP (Audio)** | **Random Ephemeral** | UDP | Browser ↔ Asterisk | **Encrypted audio (SRTP/DTLS)** |

**Browser RTP Ports:**
- Your browser picks **random high ports** (typically 49152-65535)
- These are **ephemeral ports** assigned by your OS
- Example: `192.168.1.100:52341` (from your logs)

**Example from your SDP logs:**
```
m=audio 13000 UDP/TLS/RTP/SAVPF ...
c=IN IP4 183.82.162.120
a=candidate:11 1 UDP 2121990399 192.168.18.109 49876 typ host
```

This shows:
- **Media Port:** `13000` (negotiated port)
- **ICE Candidates:** Various ports like `49876`, `49877`, etc.
- **Public IP:** `183.82.162.120:13000` (via STUN server)

---

### **Asterisk Server (192.168.210.54):**

From your `rtp.conf` configuration:

```ini
[general]
rtpstart=10000
rtpend=20000
```

**Asterisk RTP Ports:**
- **Port Range:** `10000-20000` (UDP)
- **Total Available:** 10,000 ports
- **Per Call:** Uses 2 ports (RTP + RTCP)
- **Example:** Call 1 uses `10000`, Call 2 uses `10002`, etc.

**From your call logs:**
```
🎤 ANSWER Media Endpoint: 192.168.210.54:19750
```

This shows Asterisk allocated port **19750** for that specific call's RTP stream.

---

## 🔄 **Complete RTP Flow for Your Call**

### **Step-by-Step:**

1. **Browser creates WebRTC stream:**
   - Browser: `192.168.18.109:49876` (local port)
   - Public IP: `183.82.162.120:13000` (via STUN)
   - Protocol: SRTP (encrypted RTP over UDP)

2. **Browser sends SDP Offer** via WSS:
   ```
   SIP INVITE → WSS:8443 → Kamailio:8080 → Asterisk:5060
   ```

3. **Asterisk allocates RTP port:**
   - Picks a port from range `10000-20000`
   - Example: `192.168.210.54:19750`
   - Sends SDP Answer back to browser

4. **RTP/SRTP flows directly:**
   ```
   Browser (183.82.162.120:13000) ◄──SRTP──► Asterisk (192.168.210.54:19750)
   ```
   - **Not through Nginx or Kamailio!**
   - Direct UDP connection between browser and Asterisk
   - Uses ICE/STUN for NAT traversal

5. **Asterisk converts and forwards:**
   ```
   Asterisk (192.168.210.54:random) ◄──RTP──► Genesys (192.168.210.81:random)
   ```
   - Asterisk picks another port from `10000-20000` range
   - Sends standard RTP (not encrypted) to Genesys
   - Genesys uses its own RTP port range

---

## 📝 **Current Configuration**

### **rtp.conf (Asterisk RTP Settings):**

```ini
[general]
rtpstart=10000          ◄── First RTP port
rtpend=20000            ◄── Last RTP port
icesupport=yes          ◄── Enable ICE for WebRTC
ice_host_candidates=yes ◄── Advertise local IP
stunaddr=192.168.210.54:3478  ◄── Local STUN server
turnaddr=192.168.210.54:3478  ◄── Local TURN server (if needed)
strictrtp=yes           ◄── Security: only accept RTP from known sources
rtptimeout=60           ◄── Hangup if no RTP for 60 seconds
```

---

## 🔍 **How to See Active RTP Ports**

### **Check from Asterisk:**

```bash
# SSH to server
ssh Gencct@192.168.210.54

# Show active RTP streams
sudo docker exec webrtc-asterisk asterisk -rx "rtp show stats"

# Show active channels with RTP info
sudo docker exec webrtc-asterisk asterisk -rx "core show channels verbose"
```

**Example Output:**
```
Channel              Context              Ext     Application   Data
PJSIP/5001-00000001  genesys-agent        1003    Dial          PJSIP/1003@genesys_sip_server
  RTP: Local: 192.168.210.54:19750, Remote: 183.82.162.120:13000
  Codec: ulaw (8kHz), 20ms ptime
```

---

### **Monitor RTP Traffic (tcpdump):**

```bash
# Capture RTP on Asterisk's port range
sudo tcpdump -i eth0 -n 'udp portrange 10000-20000'

# Capture specific call's RTP
sudo tcpdump -i eth0 -n 'udp port 19750'

# Show RTP packets with details
sudo tcpdump -i eth0 -n -v 'udp portrange 10000-20000'
```

---

### **Check Port Usage:**

```bash
# See what ports Asterisk is listening on
sudo docker exec webrtc-asterisk netstat -ulnp | grep asterisk

# Count active RTP sessions
sudo docker exec webrtc-asterisk netstat -ulnp | grep -c "10[0-9][0-9][0-9]"
```

---

## 🚨 **Firewall Rules Needed**

### **On Asterisk Server (192.168.210.54):**

```bash
# Allow RTP port range
sudo firewall-cmd --permanent --add-port=10000-20000/udp
sudo firewall-cmd --reload

# Or with iptables
sudo iptables -A INPUT -p udp --dport 10000:20000 -j ACCEPT
```

### **On Your Local Network/Router:**

If browser is on a **different network** than Asterisk:

1. **Forward RTP ports** on router: `10000-20000/UDP → 192.168.210.54`
2. **Or use TURN server** for NAT traversal

---

## 🎨 **Visual: Port Usage Timeline**

```
Time   Browser Port    Signaling          Asterisk RTP    Genesys Port
──────────────────────────────────────────────────────────────────────
10:09  (allocating)    WSS → 8443         (idle)          (idle)
       49876            Nginx → Kamailio   
                        Kamailio → 5060

10:10  49876 (SRTP) ◄──────────────────► 19750 (SRTP)    (allocating)
       183.82.162.120   ICE negotiation    192.168.210.54

10:11  49876 (SRTP) ◄──────────────────► 19750 ◄───────► 15432 (RTP)
       Audio flowing    WebRTC Gateway     Bridge          192.168.210.81
```

---

## 🔐 **Security Note**

### **Browser → Asterisk:**
- **Encrypted:** SRTP (Secure RTP)
- **Authentication:** DTLS-SRTP
- **Fingerprint:** SHA-256 in SDP

### **Asterisk → Genesys:**
- **Unencrypted:** Standard RTP
- **Internal Network:** 192.168.210.x (trusted)
- **No encryption needed** between Asterisk and Genesys

---

## 📊 **Capacity Planning**

With port range `10000-20000`:

- **Total Ports:** 10,000
- **Ports per Call:** 2 (RTP + RTCP)
- **Maximum Concurrent Calls:** ~5,000

**Recommendation:**
- For production: Monitor usage
- If > 1000 calls: Consider expanding range to `10000-30000`

---

## 🐛 **Troubleshooting RTP Issues**

### **Problem: No Audio (One-Way or Both Ways)**

```bash
# 1. Check if RTP is flowing
sudo tcpdump -i eth0 -n 'udp portrange 10000-20000' | head -20

# 2. Check Asterisk RTP stats
sudo docker exec webrtc-asterisk asterisk -rx "rtp show stats"

# 3. Check for NAT/firewall blocks
sudo docker exec webrtc-asterisk asterisk -rx "core show channel <CHANNEL_ID>"
```

### **Problem: "RTP timeout" errors**

Check `rtp.conf`:
```ini
rtptimeout=60          ◄── Increase if needed
strictrtp=yes          ◄── Change to 'no' for testing only
```

---

## 📋 **Quick Reference**

| Component | Port(s) | Protocol | Purpose |
|-----------|---------|----------|---------|
| **Browser HTTPS** | 8443 | TCP/HTTPS | Load web page |
| **Browser WSS** | 8443 | TCP/WSS | SIP signaling |
| **Browser RTP** | **Random (49152-65535)** | **UDP/SRTP** | **Encrypted audio to Asterisk** |
| **Nginx** | 8443 | TCP | SSL termination |
| **Kamailio** | 8080, 5070 | WS, UDP | SIP proxy |
| **Asterisk SIP** | 5060 | UDP | SIP signaling |
| **Asterisk RTP** | **10000-20000** | **UDP** | **Media gateway (WebRTC ↔ SIP)** |
| **Asterisk STUN** | 3478 | UDP | NAT traversal |
| **Genesys SIP** | 5060 | UDP | SIP signaling |
| **Genesys RTP** | Dynamic | UDP | Audio to agent |

---

## 🎯 **Summary - Your Question Answered:**

**Q: "When we open the URL locally, which port is used for RTP?"**

**A:**
1. **On your local PC (browser):**
   - **Random ephemeral port** (e.g., `49876`, `52341`)
   - Assigned by your operating system
   - Different for each call
   - Visible in browser console logs (ICE candidates)

2. **On Asterisk server (192.168.210.54):**
   - **Ports 10000-20000** (configured in `rtp.conf`)
   - Specific port allocated per call (e.g., `19750`)
   - Visible in Asterisk logs and SDP answer

3. **The RTP flows directly:**
   ```
   Your PC (random port) ◄── SRTP (encrypted) ──► Asterisk (10000-20000)
   ```

**Important:** RTP does **NOT** go through Nginx (8443) or Kamailio (8080/5070). Only SIP signaling uses those. RTP is a **direct UDP connection** between your browser and Asterisk.

---

**📁 Configuration Files:**
- RTP Config: `asterisk/etc/rtp.conf` (lines 7-8: `rtpstart=10000`, `rtpend=20000`)
- PJSIP Config: `asterisk/etc/pjsip.conf` (line 96: registration config)

