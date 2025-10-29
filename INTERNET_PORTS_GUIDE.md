# Internet/Remote Access - Port Requirements

## 🌐 Overview

This guide covers the ports needed for **remote agents** to access the GWS + WebRTC system over the internet.

---

## 🎯 Deployment Scenarios

### Scenario 1: Remote Agents (Recommended)
Agents work from home/remote locations and need internet access to the system.

### Scenario 2: Office Agents
Agents work in the office on the same network (192.168.210.x) - fewer ports needed.

---

## 🔓 Ports for Remote/Internet Access

### **On CentOS Host (192.168.210.54)** - Public-Facing

These ports need to be accessible from the internet:

| Port | Protocol | Service | Required? | Purpose |
|------|----------|---------|-----------|---------|
| **443** | TCP | HTTPS/WSS | ✅ **REQUIRED** | WebRTC client UI, SIP signaling (WebSocket) |
| **10000-20000** | UDP | RTP/SRTP | ✅ **REQUIRED** | Audio media streams |
| **3478** | UDP/TCP | STUN/TURN | ⭐ **HIGHLY RECOMMENDED** | NAT traversal |
| **5349** | TCP | TURN/TLS | ⭐ **HIGHLY RECOMMENDED** | Secure NAT traversal |
| 80 | TCP | HTTP | ⚠️ Optional | Redirect to HTTPS (can be blocked if not needed) |

### **GWS Application** - Can Be Local or Remote

| Port | Protocol | Service | Required? | Access |
|------|----------|---------|-----------|--------|
| **8080** | TCP | GWS HTTP | ✅ **REQUIRED** | Agent desktop UI, REST API, CometD |
| 443 | TCP | GWS HTTPS | ⭐ **RECOMMENDED** | Secure GWS access (if using SSL) |

**Deployment Options:**
- **Option A:** GWS runs on agent's local machine (localhost:8080) - NO internet ports needed
- **Option B:** GWS runs on a server - Port 8080 or 443 needs to be accessible

### **Genesys Platform (192.168.210.81)** - Internal Only

These ports should **NOT** be exposed to the internet:

| Port | Protocol | Service | Access |
|------|----------|---------|--------|
| 5000 | TCP | Config Server | Internal only (GWS → Genesys) |
| 5025 | TCP | T-Server | Internal only (GWS → Genesys) |
| 5060 | UDP/TCP | SIP Server | Internal only (Asterisk → Genesys) |

---

## 🏗️ Recommended Architecture for Remote Access

```
┌────────────────────────────────────────────────────────┐
│ REMOTE AGENT (Home/Mobile)                             │
│                                                         │
│ ┌───────────────────┐    ┌──────────────────────────┐   │
│ │ GWS (localhost)   │    │ Browser                  │   │
│ │ localhost:8080    │    │ https://103.167.180.159  │   │
│ └───────────────────┘    └──────────────────────────┘   │
│         │                          │                   │
│         │ VPN or Direct            │ Internet          │
└─────────┼──────────────────────────┼───────────────────┘
          │                          │
          │ VPN Tunnel               │ Public Internet
          │                          │
┌─────────▼──────────────────────────▼───────────────────┐
│ FIREWALL / ROUTER                                       │
│                                                         │
│ Port Forwarding:                                        │
│ - 443 → 192.168.210.54:443                             │
│ - 10000-20000 → 192.168.210.54:10000-20000             │
│ - 3478, 5349 → 192.168.210.54:3478, 5349              │
│                                                         │
│ VPN Access (for GWS):                                   │
│ - Allow VPN clients to reach 192.168.210.81            │
└─────────────────────────────────────────────────────────┘
          │
          │ Internal Network (192.168.210.0/24)
          │
┌─────────▼──────────────────────────────────────────────┐
│ 192.168.210.54 (CentOS - Public-Facing)                │
│ - Nginx:443 (WebRTC client)                            │
│ - Asterisk:10000-20000 (Media)                         │
│ - COTURN:3478,5349 (NAT traversal)                     │
└─────────────────────┬──────────────────────────────────┘
                      │
                      │ Internal
                      │
┌─────────────────────▼──────────────────────────────────┐
│ 192.168.210.81 (Genesys - Internal Only)               │
│ - Config Server:5000                                   │
│ - T-Server:5025                                        │
│ - SIP Server:5060                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 🔒 Security Recommendations

### 1. Use VPN for GWS Access
**Best Practice:** Run GWS on agent's local machine or via VPN

```
Remote Agent
  ├─ GWS: localhost:8080 (local install)
  │   └─ Connects to Genesys via VPN (192.168.210.81)
  │
  └─ WebRTC: https://public-ip (internet)
      └─ Media through firewall (443, 10000-20000, 3478)
```

**Why?**
- GWS credentials not exposed to internet
- Genesys platform stays internal
- Only media traffic on public internet

### 2. Minimal Port Exposure

**ONLY expose these ports to the internet:**
```
443      - HTTPS/WSS (WebRTC client & signaling)
10000-20000 - RTP/SRTP (media)
3478     - STUN/TURN
5349     - TURN/TLS
```

**DO NOT expose:**
- Port 8080 (GWS) - Use VPN or localhost
- Port 5000 (Config Server)
- Port 5025 (T-Server)
- Port 5060 (SIP Server)

### 3. Use SSL/TLS Certificates

```
- Nginx (443): Valid SSL certificate
- COTURN (5349): Valid SSL certificate
- GWS (if exposed): Valid SSL certificate
```

Get certificates from:
- Let's Encrypt (free)
- Commercial CA
- Internal CA (for VPN-only access)

---

## 🔥 Firewall Configuration

### On CentOS Host (192.168.210.54)

#### Option A: Internet Exposed (DMZ)

```bash
# Allow HTTPS/WSS for WebRTC client
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-port=443/tcp

# Allow RTP/SRTP for media
firewall-cmd --permanent --add-port=10000-20000/udp

# Allow STUN/TURN
firewall-cmd --permanent --add-port=3478/udp
firewall-cmd --permanent --add-port=3478/tcp
firewall-cmd --permanent --add-port=5349/tcp

# Optional: HTTP redirect
firewall-cmd --permanent --add-port=80/tcp

# Apply changes
firewall-cmd --reload
```

#### Option B: Behind Router/NAT

Configure **port forwarding** on your router:

```
External Port → Internal IP:Port
─────────────────────────────────
443           → 192.168.210.54:443
10000-20000   → 192.168.210.54:10000-20000
3478          → 192.168.210.54:3478
5349          → 192.168.210.54:5349
```

### On Router/Firewall

#### Port Forwarding Rules

```
Rule 1: HTTPS/WSS
  External: 443 (TCP)
  Internal: 192.168.210.54:443

Rule 2: RTP Media
  External: 10000-20000 (UDP)
  Internal: 192.168.210.54:10000-20000

Rule 3: STUN/TURN
  External: 3478 (UDP & TCP)
  Internal: 192.168.210.54:3478

Rule 4: TURN/TLS
  External: 5349 (TCP)
  Internal: 192.168.210.54:5349
```

#### Source IP Restrictions (Optional)

For extra security, restrict to known agent IP ranges:

```
Only allow:
  - Company VPN IP range: 10.x.x.x/8
  - Known ISP ranges
  - Specific countries (via GeoIP)
```

---

## 🌍 DNS Configuration

### For Internet Access

Create DNS records:

```
webrtc.yourcompany.com    → PUBLIC_IP_ADDRESS
workspace.yourcompany.com → GWS_PUBLIC_IP (if exposed)
```

Agents would access:
- **WebRTC Client:** https://webrtc.yourcompany.com
- **GWS Desktop:** http://localhost:8080 (local) or https://workspace.yourcompany.com

### SSL Certificate

```bash
# On CentOS host, get Let's Encrypt certificate
certbot certonly --standalone -d webrtc.yourcompany.com

# Or use existing certificate
# Update nginx.conf with certificate paths
```

---

## 🧪 Testing Remote Access

### Test from Outside Your Network

#### 1. Test HTTPS/WSS (Port 443)

```bash
# From remote location
curl https://YOUR_PUBLIC_IP

# Or
curl https://webrtc.yourcompany.com

# Should return Nginx page or WebRTC client
```

#### 2. Test STUN (Port 3478)

```bash
# Install stun tools
sudo apt-get install stun-client

# Test STUN server
stun YOUR_PUBLIC_IP -p 3478

# Should return your public IP address
```

#### 3. Test WebRTC Connection

From remote browser:
1. Open: https://webrtc.yourcompany.com
2. Open browser console (F12)
3. Register SIP endpoint
4. Check console for WebSocket connection
5. Check for ICE candidates gathering

Expected in console:
```
WebSocket connected to wss://webrtc.yourcompany.com/ws
ICE candidate gathered: type=srflx (Server Reflexive)
ICE candidate gathered: type=relay (TURN Relay)
SIP Registration: 200 OK
```

#### 4. Test Media Path

Make a test call:
- Should establish audio
- Check for two-way audio
- Verify no dropouts or latency issues

---

## 📊 Bandwidth Requirements

### Per Agent

| Type | Bandwidth | Port Range |
|------|-----------|------------|
| **SIP Signaling** | ~5-10 Kbps | 443 (WSS) |
| **Audio (G.711)** | ~80-100 Kbps | 10000-20000 (RTP) |
| **Audio (Opus)** | ~20-60 Kbps | 10000-20000 (RTP) |
| **STUN/TURN** | ~5-10 Kbps | 3478, 5349 |

### Total

- **Minimum per agent:** 100 Kbps (upload + download)
- **Recommended per agent:** 200 Kbps
- **For 10 agents:** 2 Mbps
- **For 50 agents:** 10 Mbps
- **For 100 agents:** 20 Mbps

**Upload bandwidth is critical for voice quality!**

---

## 🚨 Common Issues & Solutions

### Issue 1: One-Way Audio

**Cause:** RTP ports (10000-20000) not forwarded

**Solution:**
```bash
# Verify ports are open
nmap -sU -p 10000-10010 YOUR_PUBLIC_IP

# Should show "open" or "open|filtered"
```

### Issue 2: Connection Fails Behind Corporate Firewall

**Cause:** Corporate firewall blocks WebRTC ports

**Solution:**
- Use TURN/TLS on port 5349 (often allowed)
- Configure COTURN to use TCP mode
- Use VPN to bypass corporate firewall

### Issue 3: High Latency/Jitter

**Cause:** Internet connection or insufficient bandwidth

**Solution:**
- Check agent's internet speed
- Use QoS on router
- Prioritize UDP ports 10000-20000
- Consider using Opus codec (lower bandwidth)

### Issue 4: Cannot Register SIP Endpoint

**Cause:** Port 443 (WSS) blocked or SSL certificate issue

**Solution:**
```bash
# Test WebSocket
curl -I https://YOUR_PUBLIC_IP/ws

# Should return "101 Switching Protocols"

# Check SSL certificate
openssl s_client -connect YOUR_PUBLIC_IP:443
```

---

## 🔐 Advanced Security

### 1. Rate Limiting (DDoS Protection)

In Nginx configuration:

```nginx
# Limit requests per IP
limit_req_zone $binary_remote_addr zone=webrtc:10m rate=10r/s;

location / {
    limit_req zone=webrtc burst=20;
}
```

### 2. Fail2Ban

Protect against brute force:

```bash
# Install fail2ban
apt-get install fail2ban

# Create Nginx jail
[nginx-webrtc]
enabled = true
port = 443
filter = nginx-webrtc
logpath = /var/log/nginx/error.log
maxretry = 5
bantime = 3600
```

### 3. IP Whitelist

Only allow known IPs:

```nginx
# In nginx.conf
location / {
    allow 1.2.3.4;        # Agent home IP
    allow 5.6.7.0/24;     # Office network
    deny all;
}
```

### 4. VPN-Only Access for GWS

```
Remote Agent
  │
  ├─ VPN Connection → Internal Network
  │   └─ Access GWS (192.168.210.81 or internal server)
  │
  └─ Direct Internet → WebRTC (PUBLIC_IP)
      └─ Only media traffic on internet
```

---

## 📝 Deployment Checklist

### Pre-Deployment

- [ ] Obtain public static IP or dynamic DNS
- [ ] Get SSL certificate for your domain
- [ ] Configure DNS records
- [ ] Test from internal network first

### Firewall Configuration

- [ ] Open port 443 (HTTPS/WSS)
- [ ] Open ports 10000-20000 (RTP/SRTP)
- [ ] Open port 3478 (STUN/TURN)
- [ ] Open port 5349 (TURN/TLS)
- [ ] Configure port forwarding on router
- [ ] Test from external network

### Security

- [ ] Valid SSL certificates installed
- [ ] Rate limiting configured
- [ ] Fail2ban installed and configured
- [ ] Monitor logs for suspicious activity
- [ ] Regular security updates applied

### Testing

- [ ] Test WebRTC client access from internet
- [ ] Test SIP registration from remote location
- [ ] Test audio quality on call
- [ ] Test with multiple simultaneous agents
- [ ] Verify STUN/TURN working
- [ ] Check for NAT traversal issues

### Monitoring

- [ ] Set up bandwidth monitoring
- [ ] Monitor active connections
- [ ] Track SIP registration failures
- [ ] Monitor audio quality (MOS scores)
- [ ] Alert on high port usage

---

## 🎯 Quick Summary

### ✅ Minimum Required Ports (Internet-Facing)

```
443           - HTTPS/WSS (WebRTC client)
10000-20000   - RTP/SRTP (audio media)
3478          - STUN/TURN (NAT traversal)
5349          - TURN/TLS (secure NAT traversal)
```

### ⚠️ Keep Internal (Behind VPN)

```
8080          - GWS Application (if not localhost)
5000          - Genesys Config Server
5025          - Genesys T-Server
5060          - Genesys SIP Server
```

### 📋 Recommended Setup

**Option 1: Maximum Security (Recommended)**
```
Agents:
  - GWS: localhost:8080 (local install)
  - Connects to Genesys via VPN
  - WebRTC via internet (443, 10000-20000, 3478, 5349)
```

**Option 2: Cloud-Based GWS**
```
Agents:
  - GWS: cloud server via HTTPS (443)
  - WebRTC via internet (443, 10000-20000, 3478, 5349)
  - GWS connects to Genesys via VPN or dedicated link
```

---

## 📞 Support

For additional security guidance:
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [ENVIRONMENT_CONFIG.md](ENVIRONMENT_CONFIG.md) - Network configuration
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues

---

**⚠️ Security Warning:** Always use SSL/TLS for internet-facing services and consider using VPN for sensitive connections.


