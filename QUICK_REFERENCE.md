# GWS + WebRTC Integration - Quick Reference Card

## 🚀 System URLs

| Component | URL | Port |
|-----------|-----|------|
| **GWS Agent Desktop** | http://localhost:8080/ui/ad/v1/ | 8080 |
| **WebRTC SIP Client (LAN)** | https://192.168.210.54/index-agent-dn.html | 443 |
| **WebRTC SIP Client (Internet)** | https://103.167.180.159/index-agent-dn.html | 443 |
| **GWS Health Check** | http://localhost:8080/actuator/health | 8080 |
| **GWS Metrics** | http://localhost:8080/actuator/metrics | 8080 |

---

## 📁 File Locations

```
GWS Application:        h:\Abhishek\gws-main\
Startup Script:         h:\Abhishek\gws-main\start-gws.ps1
Configuration:          h:\Abhishek\gws-main\application.yml
Logs:                   h:\Abhishek\gws-main\logs\gws.log

WebRTC Project:         f:\Project\WebRTC\
Documentation:          f:\Project\WebRTC\*.md
Asterisk Config:        f:\Project\WebRTC\asterisk\etc\
WebRTC Client:          f:\Project\WebRTC\nginx\html\
```

---

## ⚡ Quick Start Commands

### Start GWS Application
```powershell
cd h:\Abhishek\gws-main
.\start-gws.ps1
```

### Check if GWS is Running
```powershell
# Windows
netstat -an | findstr 8080

# Check health
curl http://localhost:8080/actuator/health
```

### View GWS Logs (Real-time)
```powershell
Get-Content h:\Abhishek\gws-main\logs\gws.log -Wait -Tail 50
```

### Check Asterisk SIP Endpoints
```bash
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoints"
```

---

## 🔌 Connection Ports

| From | To | Port | Protocol | Purpose |
|------|-----|------|----------|---------|
| Browser | GWS | 8080 | HTTP | Web UI & API |
| GWS | Config Server | 5000 | TCP | Configuration |
| GWS | T-Server | 5025 | TCP | Call Control |
| Browser | WebRTC | 443 | WSS | SIP Signaling |
| Browser | Asterisk | 10000-20000 | SRTP | Media (Audio) |
| Asterisk | Genesys SIP | 5060 | SIP | SIP Trunk |

### 🌐 Internet/Remote Access Ports

**For remote agents, expose these ports on 192.168.210.54:**

| Port | Protocol | Required | Purpose |
|------|----------|----------|---------|
| **443** | TCP | ✅ YES | HTTPS/WSS (WebRTC client) |
| **10000-20000** | UDP | ✅ YES | RTP/SRTP (audio media) |
| **3478** | UDP/TCP | ⭐ Recommended | STUN/TURN (NAT traversal) |
| **5349** | TCP | ⭐ Recommended | TURN/TLS (secure NAT) |

**⚠️ DO NOT expose to internet:**
- 8080 (GWS) - Use VPN or localhost
- 5000, 5025, 5060 (Genesys) - Internal only

**See:** [INTERNET_PORTS_GUIDE.md](INTERNET_PORTS_GUIDE.md) for details

---

## 👤 Agent Workflow

```
┌─────────────────────────────────────────────────┐
│ 1. Login to GWS                                 │
│    http://localhost:8080/ui/ad/v1/              │
│    Username: agent5001                          │
│    Password: your_password                      │
│                                                  │
│ 2. Register SIP Endpoint                        │
│    https://webrtc-server/index-agent-dn.html    │
│    Agent DN: 5001 (from GWS)                    │
│    SIP Password: your_sip_password              │
│                                                  │
│ 3. Set Ready in GWS                             │
│    Click "Ready" button                         │
│    Status shows: ● Ready                        │
│                                                  │
│ 4. Handle Calls                                 │
│    • Call control: GWS interface                │
│    • Audio: WebRTC client                       │
│    • Screen pops: GWS interface                 │
│                                                  │
│ 5. End of Shift                                 │
│    • Set "Not Ready"                            │
│    • Complete any wrap-up work                  │
│    • Logout from GWS                            │
│    • Close WebRTC client                        │
└─────────────────────────────────────────────────┘
```

---

## 🐛 Troubleshooting Checklist

### GWS Won't Start
- [ ] Java installed? Check: `java -version`
- [ ] Port 8080 available? Check: `netstat -an | findstr 8080`
- [ ] Configuration correct? Check: `application.yml`
- [ ] Config Server reachable? Test: `ping CONFIG_SERVER_IP`

### Agent Can't Login
- [ ] Agent exists in Config Manager?
- [ ] Agent enabled (Is Active = Yes)?
- [ ] Correct username/password?
- [ ] Check GWS logs: `logs\gws.log`

### SIP Endpoint Won't Register
- [ ] DN exists in Config Manager?
- [ ] DN number matches (5001)?
- [ ] SIP password correct in Asterisk?
- [ ] Asterisk running? Check: `docker ps`

### Call Rings but No Screen Pop
- [ ] T-Server connected? Check GWS logs
- [ ] CometD connected? Check browser console
- [ ] Agent DN linked to agent person?
- [ ] Browser allows pop-ups?

### No Audio on Call
- [ ] Microphone permissions granted?
- [ ] STUN/TURN configured?
- [ ] Firewall allows RTP (10000-20000)?
- [ ] Check codec compatibility

---

## 📊 Health Check Commands

```powershell
# GWS Health
curl http://localhost:8080/actuator/health
# Expected: {"status":"UP"}

# GWS Active Sessions
curl http://localhost:8080/actuator/metrics/http.server.requests

# Asterisk SIP Status (from CentOS host)
ssh user@192.168.210.54
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoints"

# Asterisk Channels
docker exec -it webrtc-asterisk asterisk -rx "core show channels"

# Docker Services Status
docker-compose ps

# Test Genesys Config Server
telnet 192.168.210.81 5000

# Test Genesys T-Server
telnet 192.168.210.81 5025

# Test Genesys SIP Server
telnet 192.168.210.81 5060
```

---

## 🔧 Common Configuration Values

### application.yml (Minimum)
```yaml
server:
  port: 8080

contact-center:
  config-server:
    host: 192.168.1.100  # Your Config Server
    port: 5000
  t-server:
    primary:
      host: 192.168.1.101  # Your T-Server
      port: 5025

logging:
  level:
    com.genesyslab.cloud: INFO
```

### Agent DN in Asterisk (pjsip.conf)
```ini
[5001]
type=endpoint
transport=transport-wss
context=genesys-agent
auth=5001
aors=5001
webrtc=yes
ice_support=yes

[5001]
type=auth
auth_type=userpass
password=agent5001pass
username=5001

[5001]
type=aor
max_contacts=1
```

---

## 🎯 Key Integration Points

| Integration Point | How It Works |
|-------------------|--------------|
| **Call Control** | GWS → T-Server (PSDK commands) |
| **Call Routing** | T-Server → URS → Agent selection |
| **SIP Registration** | WebRTC → Asterisk → Genesys SIP Server |
| **Media Audio** | Browser SRTP ↔ Asterisk RTP ↔ Genesys |
| **Screen Pops** | T-Server events → GWS → CometD → Browser |
| **Agent State** | GWS → T-Server → DN availability |

---

## 📞 Call Flow Summary

### Inbound
```
PSTN → Genesys → Route to DN 5001 → Asterisk → WebRTC Client (rings)
                                   ↓
                           T-Server → GWS → Browser (screen pop)
```

### Outbound
```
GWS → T-Server → Genesys → Call agent DN + customer number
                          ↓
                  Asterisk → WebRTC Client (auto-answer)
                          ↓
                        PSTN → Customer (rings)
```

---

## 🔒 Security Checklist

- [ ] Change default passwords
- [ ] Enable HTTPS for GWS (not HTTP)
- [ ] Use WSS for WebRTC (not WS)
- [ ] Configure firewall rules
- [ ] Enable session timeout
- [ ] Use SRTP for media encryption
- [ ] Restrict CORS origins
- [ ] Enable audit logging

---

## 📚 Documentation Files

| File | Contents |
|------|----------|
| `GWS_SIP_ENDPOINT_INTEGRATION.md` | Complete integration guide |
| `GWS_STARTUP_GUIDE.md` | Step-by-step startup instructions |
| `INTEGRATION_DIAGRAM.md` | Visual diagrams and flows |
| `ARCHITECTURE.md` | System architecture overview |
| `GENESYS_ENGAGE_SETUP.md` | Genesys configuration guide |
| `TROUBLESHOOTING.md` | Detailed troubleshooting |
| `h:\Abhishek\gws-main\README.md` | GWS application guide |

---

## 💡 Quick Tips

1. **Always start GWS before logging in agents**
2. **Match Agent DN in GWS with SIP registration**
3. **Use browser dev tools to debug CometD issues**
4. **Check T-Server logs for call routing problems**
5. **Monitor Asterisk channels for SIP issues**
6. **Keep logs for troubleshooting** (GWS, Asterisk, Genesys)
7. **Test with one agent first** before rolling out

---

## 📱 Emergency Contacts

```
Genesys Admin:      _________________
Network Team:       _________________
Asterisk Admin:     _________________
IT Support:         _________________
```

---

## 🎓 Learning Path

1. ✅ Read: `GWS_STARTUP_GUIDE.md`
2. ✅ Setup: GWS application
3. ✅ Test: Agent login and SIP registration
4. ✅ Make: Test call
5. ✅ Review: `INTEGRATION_DIAGRAM.md` for understanding
6. ✅ Practice: Call controls (hold, transfer, etc.)
7. ✅ Monitor: Logs and metrics
8. ✅ Optimize: Performance tuning

---

## 🚨 When Things Go Wrong

```
SYMPTOM                          CHECK
───────                          ─────
GWS won't start              →   Java version, Port 8080
Can't login                  →   Agent config, Credentials
SIP won't register           →   DN config, Asterisk status
Call rings but no screen pop →   T-Server connection, CometD
No audio                     →   Firewall, RTP ports, Codecs
CometD disconnects           →   Network, Timeout settings
```

---

**Keep this reference handy!** 📌

For detailed information, see the full documentation in `f:\Project\WebRTC\`

