# Environment Configuration

## 🌐 Network Configuration

This document contains the actual IP addresses and network configuration for your GWS + WebRTC integration.

---

## 📍 IP Addresses

| Component | IP Address | Ports | Description |
|-----------|------------|-------|-------------|
| **Public IP (Internet)** | 103.167.180.159 | 443, 3478, 5349, 10000-20000 | Public-facing WebRTC access |
| **Genesys Platform** | 192.168.210.81 | Multiple | Genesys Engage servers |
| **WebRTC Infrastructure** | 192.168.210.54 | Multiple | CentOS host with Asterisk |
| **Agent Workstations** | Various | N/A | Agent browsers |

---

## 🔧 Genesys Platform (192.168.210.81)

### Configuration Server
- **IP:** 192.168.210.81
- **Port:** 5000
- **Protocol:** TCP
- **Purpose:** Agent configuration, DN management
- **Connection from:** GWS Application

### T-Server
- **IP:** 192.168.210.81
- **Port:** 5025
- **Protocol:** TCP
- **Purpose:** Call control, CTI events
- **Connection from:** GWS Application

### SIP Server
- **IP:** 192.168.210.81
- **Port:** 5060
- **Protocol:** SIP (UDP/TCP)
- **Purpose:** Agent DN registration, SIP trunk
- **Connection from:** Asterisk (192.168.210.54)

---

## 🖥️ WebRTC Infrastructure (192.168.210.54)

### Asterisk
- **IP:** 192.168.210.54
- **Ports:**
  - 5060 (SIP) - To Genesys
  - 8089 (WSS) - From browsers
  - 10000-20000 (RTP/SRTP) - Media
- **Purpose:** WebRTC ↔ SIP gateway
- **Connects to:** 192.168.210.81:5060 (Genesys SIP Server)

### Nginx
- **IP:** 192.168.210.54
- **Ports:**
  - 80 (HTTP) - Redirect to HTTPS
  - 443 (HTTPS/WSS) - WebRTC client, WebSocket
- **Purpose:** Web server, reverse proxy
- **Serves:** WebRTC SIP client interface

### COTURN
- **IP:** 192.168.210.54
- **Ports:**
  - 3478 (TURN/STUN)
  - 5349 (TURN over TLS)
- **Purpose:** NAT traversal for WebRTC

---

## 🔗 Connection Map

```
Agent Browser (Local or Remote)
    ↓
    ├─→ GWS Application (localhost:8080)
    │   ├─→ Config Server (192.168.210.81:5000)
    │   └─→ T-Server (192.168.210.81:5025)
    │
    └─→ WebRTC Client 
        LAN:      https://192.168.210.54
        Internet: https://103.167.180.159
        ├─→ Nginx (192.168.210.54:443)
        └─→ Asterisk (192.168.210.54:8089)
            └─→ Genesys SIP (192.168.210.81:5060)
```

---

## 📝 Configuration Files

### GWS Application (application.yml)

```yaml
contact-center:
  config-server:
    host: 192.168.210.81
    port: 5000
    app-name: workspace-web-edition
    
  t-server:
    primary:
      host: 192.168.210.81
      port: 5025
```

### Asterisk PJSIP Configuration

```ini
[genesys_sip_server]
type=endpoint
context=from-genesys
transport=transport-udp
aors=genesys_sip_server
outbound_auth=genesys_auth
disallow=all
allow=ulaw,alaw,opus
direct_media=no
rtp_symmetric=yes

[genesys_sip_server]
type=aor
contact=sip:192.168.210.81:5060

[genesys_auth]
type=auth
auth_type=userpass
username=asterisk-gateway
password=YOUR_PASSWORD
```

### WebRTC Client Configuration

```javascript
// In app-agent-dn.js
const sipServer = 'wss://192.168.210.54:443/ws';
const sipDomain = '192.168.210.54';
const stunServer = 'stun:192.168.210.54:3478';
```

---

## 🔥 Firewall Rules

### On CentOS Host (192.168.210.54)

```bash
# Allow from agents (adjust source as needed)
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-port=8089/tcp

# Allow SIP from/to Genesys
firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="192.168.210.81" port port="5060" protocol="udp" accept'
firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="192.168.210.81" port port="10000-20000" protocol="udp" accept'

# Allow STUN/TURN
firewall-cmd --permanent --add-port=3478/udp
firewall-cmd --permanent --add-port=5349/tcp

firewall-cmd --reload
```

### On Genesys Server (192.168.210.81)

```bash
# Allow from Asterisk
firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="192.168.210.54" port port="5060" protocol="udp" accept'
firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="192.168.210.54" port port="10000-20000" protocol="udp" accept'

# Allow from GWS Application (if running on different host)
firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="YOUR_GWS_HOST" port port="5000" protocol="tcp" accept'
firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="YOUR_GWS_HOST" port port="5025" protocol="tcp" accept'

firewall-cmd --reload
```

---

## 🧪 Testing Connectivity

### From GWS Application to Genesys

```bash
# Test Config Server
telnet 192.168.210.81 5000

# Test T-Server
telnet 192.168.210.81 5025
```

### From Asterisk to Genesys SIP Server

```bash
# SSH to CentOS host
ssh user@192.168.210.54

# Test SIP port
nc -zv 192.168.210.81 5060

# Test from Asterisk CLI
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoint genesys_sip_server"
```

### From Agent Browser to WebRTC Infrastructure

```bash
# In browser, open:
https://192.168.210.54

# Should see Nginx welcome or WebRTC client
# Check browser console for any connection errors
```

---

## 📊 Network Diagram

```
┌──────────────────────────────────────────────────┐
│ Agent Workstation (Any IP)                       │
│                                                   │
│ Browser                                           │
│ ├─ GWS UI: localhost:8080                        │
│ └─ WebRTC: https://192.168.210.54                │
└────────────┬──────────────────────┬───────────────┘
             │                      │
             │ REST/CometD          │ WSS/SRTP
             │                      │
┌────────────▼──────────────────────▼───────────────┐
│ 192.168.210.54 (CentOS Host)                      │
│                                                   │
│ ┌─────────────────────────────────────────┐     │
│ │ GWS Application:8080                    │     │
│ │ ├─→ 192.168.210.81:5000 (Config)        │     │
│ │ └─→ 192.168.210.81:5025 (T-Server)      │     │
│ └─────────────────────────────────────────┘     │
│                                                   │
│ ┌─────────────────────────────────────────┐     │
│ │ Nginx:443                               │     │
│ │ ├─ Serves WebRTC client                 │     │
│ │ └─ Proxy to Asterisk:8089               │     │
│ └─────────────────────────────────────────┘     │
│                                                   │
│ ┌─────────────────────────────────────────┐     │
│ │ Asterisk:5060,8089,10000-20000          │     │
│ │ └─→ 192.168.210.81:5060 (SIP trunk)     │     │
│ └─────────────────────────────────────────┘     │
└───────────────────────┬───────────────────────────┘
                        │ SIP/RTP
                        │
┌───────────────────────▼───────────────────────────┐
│ 192.168.210.81 (Genesys Platform)                 │
│                                                   │
│ ┌─────────────────────────────────────────┐     │
│ │ Configuration Server:5000               │     │
│ └─────────────────────────────────────────┘     │
│                                                   │
│ ┌─────────────────────────────────────────┐     │
│ │ T-Server:5025                           │     │
│ └─────────────────────────────────────────┘     │
│                                                   │
│ ┌─────────────────────────────────────────┐     │
│ │ SIP Server:5060                         │     │
│ │ ├─ Agent DNs (5001-5999)                │     │
│ │ └─ SIP trunk from 192.168.210.54        │     │
│ └─────────────────────────────────────────┘     │
└───────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Commands

### Start Infrastructure on 192.168.210.54

```bash
# SSH to CentOS host
ssh user@192.168.210.54

# Start Docker services
cd /path/to/WebRTC
docker-compose up -d

# Verify services
docker-compose ps
```

### Start GWS Application

```bash
# On Windows or where GWS is installed
cd h:\Abhishek\gws-main

# Edit application.yml with IPs above
# Then start
.\start-gws.ps1
```

### Access Points

- **GWS Agent Desktop:** http://localhost:8080/ui/ad/v1/
- **WebRTC Client:** https://192.168.210.54/index-agent-dn.html
- **Health Check:** http://localhost:8080/actuator/health

---

## 🔍 Verification Checklist

- [ ] Can ping 192.168.210.81 from 192.168.210.54
- [ ] Can ping 192.168.210.54 from agent workstation
- [ ] Telnet 192.168.210.81:5000 works (Config Server)
- [ ] Telnet 192.168.210.81:5025 works (T-Server)
- [ ] Telnet 192.168.210.81:5060 works (SIP Server)
- [ ] https://192.168.210.54 accessible from browser
- [ ] GWS can connect to Config Server
- [ ] GWS can connect to T-Server
- [ ] Asterisk registers to Genesys SIP Server
- [ ] WebRTC client can register DN
- [ ] Test call works end-to-end

---

## 📝 Notes

- **Network:** Both servers are on 192.168.210.0/24 subnet
- **Latency:** Low latency expected (same network segment)
- **Bandwidth:** Ensure adequate bandwidth for RTP streams
- **DNS:** Using IP addresses (no DNS resolution needed)
- **Security:** Consider VPN or network segmentation for production

---

## 🔄 Update History

| Date | Change | Updated By |
|------|--------|------------|
| 2025-01 | Initial configuration | System |
| | Genesys: 192.168.210.81 | |
| | CentOS: 192.168.210.54 | |

---

**For questions or issues, refer to:**
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [GWS_STARTUP_GUIDE.md](GWS_STARTUP_GUIDE.md) - Setup guide
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues



