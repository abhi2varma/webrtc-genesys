# 🌉 WWE WebRTC Gateway Bridge

**Purpose:** Local Windows service that bridges Genesys WWE with our WebRTC gateway

**Architecture:** REST API → Electron App → iframe (JsSIP) → WebRTC Infrastructure

---

## 📊 Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────┐
│                      GENESYS WWE (Browser)                        │
│                   http://192.168.210.54:8090/                     │
└───────────────────────────────────────────────────────────────────┘
                                  │
                                  │ HTTPS REST API Calls
                                  │ https://127.0.0.1:8000
                                  │ - RegisterDn()
                                  │ - SetOptions()
                                  │ - GetIsEndpointActive()
                                  │ - SetSIPEndpointParameters()
                                  │ - Ping()
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│              WebRTC Gateway Bridge (Electron App)                 │
│                   Listens on https://127.0.0.1:8000               │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  REST API Server (Express.js)                           │    │
│  │  - /RegisterDn         → sign_in                        │    │
│  │  - /SetOptions         → configure                      │    │
│  │  - /GetIsEndpointActive → get status                    │    │
│  │  - /MakeCall           → make_call                      │    │
│  │  - /HangUp             → hangup                         │    │
│  │  - /Hold               → set_mute                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                  │                                │
│                                  │ postMessage                    │
│                                  ▼                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Hidden BrowserWindow (Electron)                        │    │
│  │  Loads: https://192.168.210.54:8443/wwe-webrtc-gateway │    │
│  │                                                         │    │
│  │  JsSIP Client (wwe-webrtc-gateway.html)                │    │
│  │  - Handles WebRTC signaling                            │    │
│  │  - Manages RTC PeerConnection                          │    │
│  │  - ICE/STUN/TURN                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
                                  │
                                  │ WSS (SIP Signaling)
                                  │ wss://192.168.210.54:8443/ws
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                      Your WebRTC Infrastructure                   │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Nginx   │ →  │ Kamailio │ →  │ Asterisk │ →  │ Genesys  │  │
│  │  :8443   │    │  :8080   │    │  :5060   │    │  :5060   │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
└───────────────────────────────────────────────────────────────────┘
                                  │
                                  │ RTP (Audio)
                                  │ UDP 10000-20000
                                  ▼
                          🎤 Agent's Microphone
```

---

## 🔄 Call Flow Example

### **1. WWE Agent Logs In**

```
WWE Browser
    │
    │ POST https://127.0.0.1:8000/RegisterDn
    │ {
    │   "addresses": ["192.168.210.81:5060"],
    │   "users": ["1003"]
    │ }
    ▼
Bridge Service
    │
    │ postMessage({
    │   command: "sign_in",
    │   agentId: "test1",
    │   dn: "1003",
    │   password: "...",
    │   sipServer: "wss://192.168.210.54:8443/ws"
    │ })
    ▼
Hidden WebRTC iframe
    │
    │ WSS REGISTER → Kamailio → Asterisk
    │
    │ SIP/2.0 200 OK (Registered)
    ▼
    │ postMessage({
    │   event: "registered",
    │   dn: "1003"
    │ })
    ▼
Bridge Service
    │
    │ HTTP 200 OK
    │ { "RegisterDnResult": true }
    ▼
WWE Browser
    │
    │ Updates UI: "Agent Online"
```

---

### **2. WWE Makes Call**

```
WWE Browser
    │
    │ POST https://127.0.0.1:8000/MakeCall
    │ { "destination": "5002" }
    ▼
Bridge Service
    │
    │ postMessage({
    │   command: "make_call",
    │   destination: "5002"
    │ })
    ▼
Hidden WebRTC iframe
    │
    │ WSS INVITE → Kamailio → Asterisk → Genesys
    │ SIP/2.0 180 Ringing
    │ SIP/2.0 200 OK
    │
    │ RTP Stream established
    ▼
    │ postMessage({
    │   event: "call_accepted"
    │ })
    ▼
Bridge Service
    │
    │ HTTP 200 OK
    ▼
WWE Browser
    │
    │ Updates UI: "Call Connected"
```

---

## 📋 API Mapping

### WWE SIP Endpoint API → WebRTC Gateway Bridge

| WWE API | Method | WebRTC Command | Description |
|---------|--------|----------------|-------------|
| `/RegisterDn` | POST | `sign_in` | Register agent DN with SIP/WebRTC |
| `/UnregisterDn` | POST | `sign_out` | Unregister agent |
| `/SetOptions` | POST | `configure` | Set WebRTC parameters |
| `/GetIsEndpointActive` | GET | `get_status` | Check registration status |
| `/GetSIPEndpointParameters` | GET | `get_params` | Get endpoint configuration |
| `/SetSIPEndpointParameters` | POST | `set_params` | Update configuration |
| `/MakeCall` | POST | `make_call` | Initiate outbound call |
| `/AnswerCall` | POST | `answer_call` | Answer incoming call |
| `/HangUp` | POST | `hangup` | End call |
| `/Hold` | POST | `set_mute(true)` | Hold call (mute) |
| `/Retrieve` | POST | `set_mute(false)` | Retrieve call (unmute) |
| `/SendDTMF` | POST | `send_dtmf` | Send DTMF tones |
| `/Ping` | GET | `ping` | Keep-alive check |
| `/SetPingPeriod` | POST | `set_ping` | Configure ping interval |

---

## 🏗️ Implementation Options

### **Option 1: Electron App (Recommended)**

**Pros:**
- Native Windows app with system tray
- HTTPS server built-in
- Can run in background
- Access to system APIs
- Self-signed cert management

**Cons:**
- Larger download size (~100MB)
- Requires installation

**Tech Stack:**
- Electron (Chromium + Node.js)
- Express.js (REST API server)
- HTTPS with self-signed certificate

---

### **Option 2: Windows Service + Browser Extension**

**Pros:**
- Smaller footprint
- Browser extension handles iframe

**Cons:**
- More complex architecture
- Requires both service + extension

---

### **Option 3: Node.js Windows Service**

**Pros:**
- Lightweight (~20MB)
- Simple deployment

**Cons:**
- No GUI
- Complex certificate trust setup

---

## 📦 Deliverables

I'll create:

1. ✅ **Electron App** (`webrtc-gateway-bridge/`)
   - Main process (API server)
   - Renderer process (hidden iframe)
   - System tray icon
   - Auto-start with Windows

2. ✅ **REST API Implementation**
   - All WWE-expected endpoints
   - Error handling
   - Logging

3. ✅ **Installer**
   - Windows MSI installer
   - Certificate installation
   - Auto-update capability

4. ✅ **Configuration UI**
   - Set WebRTC gateway URL
   - Configure credentials
   - View logs

---

## 🚀 Quick Start (When Implemented)

### **For Agent:**

1. Download `WebRTC-Gateway-Bridge-Setup.msi`
2. Install (administrator rights required)
3. Configure gateway URL: `https://192.168.210.54:8443`
4. Start service (auto-starts with Windows)
5. Open WWE, log in normally
6. WWE detects WebRTC endpoint automatically

---

### **For Administrator:**

1. Deploy MSI via Group Policy
2. Pre-configure settings via registry:
   ```
   HKLM\SOFTWARE\WebRTC Gateway Bridge\
     - GatewayURL: "https://192.168.210.54:8443"
     - SIPServer: "wss://192.168.210.54:8443/ws"
     - AutoStart: true
   ```

---

## 🔐 Security Considerations

### **1. HTTPS Certificate**

WWE expects HTTPS on `https://127.0.0.1:8000`. Options:

**A. Self-Signed Certificate (Simple)**
- Generate during installation
- Add to Windows Trusted Root store
- WWE will accept it

**B. mkcert (Better)**
- Use `mkcert` tool to create locally-trusted certificate
- Automatically trusted by browsers

---

### **2. Authentication**

**WWE → Bridge:**
- Basic Auth (optional)
- API key in headers
- Client certificate

**Bridge → WebRTC Gateway:**
- Agent credentials stored securely
- Windows Credential Manager
- Encrypted config file

---

### **3. CORS**

Allow WWE origin:
```javascript
app.use(cors({
  origin: 'http://192.168.210.54:8090',
  credentials: true
}));
```

---

## 📝 Configuration File

`%APPDATA%\WebRTC-Gateway-Bridge\config.json`

```json
{
  "bridge": {
    "host": "127.0.0.1",
    "port": 8000,
    "https": true,
    "certPath": "./certs/cert.pem",
    "keyPath": "./certs/key.pem"
  },
  "gateway": {
    "url": "https://192.168.210.54:8443",
    "iframeUrl": "https://192.168.210.54:8443/wwe-webrtc-gateway.html",
    "sipServer": "wss://192.168.210.54:8443/ws"
  },
  "wwe": {
    "allowedOrigins": [
      "http://192.168.210.54:8090",
      "https://192.168.210.54:8090"
    ]
  },
  "logging": {
    "level": "debug",
    "file": "%APPDATA%/WebRTC-Gateway-Bridge/logs/bridge.log",
    "maxSize": "10m",
    "maxFiles": 5
  },
  "autoStart": true,
  "minimizeToTray": true
}
```

---

## 🎨 System Tray Interface

```
┌─────────────────────────────┐
│  WebRTC Gateway Bridge      │
├─────────────────────────────┤
│  Status: Connected          │
│  DN: 1003                   │
│  Call: Connected (5002)     │
├─────────────────────────────┤
│  ► Open Dashboard           │
│  ► View Logs                │
│  ► Settings                 │
│  ────────────────────       │
│  ✓ Start with Windows       │
│  ✓ Minimize to tray         │
│  ────────────────────       │
│  ► Check for Updates        │
│  ► About                    │
│  ► Exit                     │
└─────────────────────────────┘
```

---

## 📊 Monitoring & Logs

### **Dashboard** (http://127.0.0.1:8000/dashboard)

```
╔═══════════════════════════════════════════════════════════╗
║           WebRTC Gateway Bridge Dashboard                 ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Status:      ● Online                                   ║
║  Registered:  Yes (DN: 1003)                             ║
║  Active Call: 5002 (01:23:45)                            ║
║  Gateway:     https://192.168.210.54:8443 ✓              ║
║  WWE Origin:  http://192.168.210.54:8090 ✓               ║
║                                                           ║
║  ┌─────────────────────────────────────────────────┐    ║
║  │  Recent Events                                   │    ║
║  ├─────────────────────────────────────────────────┤    ║
║  │  10:37:25  Registered DN 1003                   │    ║
║  │  10:37:30  Call initiated to 5002               │    ║
║  │  10:37:32  Call answered                         │    ║
║  │  10:37:45  RTP established (192.168.210.54:19750)│   ║
║  └─────────────────────────────────────────────────┘    ║
║                                                           ║
║  [View Full Logs]  [Test Connection]  [Restart Service] ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

---

## 🧪 Testing

### **Test 1: Endpoint Discovery**

WWE should detect the endpoint on startup:

```javascript
// WWE internal check
$.ajax({
  url: 'https://127.0.0.1:8000/GetIsEndpointActive',
  success: function(data) {
    if (data.get_IsEndpointActiveResult === true) {
      console.log('✅ WebRTC Endpoint detected');
    }
  }
});
```

---

### **Test 2: Registration**

```bash
# Manual test from command line
curl -k -X POST https://127.0.0.1:8000/RegisterDn \
  -H "Content-Type: application/json" \
  -d '{
    "addresses": ["192.168.210.81:5060"],
    "users": ["1003"]
  }'

# Expected response:
{
  "RegisterDnResult": true
}
```

---

### **Test 3: Call Flow**

```bash
# Make call
curl -k -X POST https://127.0.0.1:8000/MakeCall \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "5002"
  }'

# Check call status
curl -k https://127.0.0.1:8000/GetCallStatus

# Hangup
curl -k -X POST https://127.0.0.1:8000/HangUp
```

---

## 🔧 Development Roadmap

### **Phase 1: Core Bridge** (Week 1)
- [x] Electron app skeleton
- [ ] HTTPS server with self-signed cert
- [ ] Hidden BrowserWindow with iframe
- [ ] postMessage communication
- [ ] Basic API endpoints (RegisterDn, GetIsEndpointActive)

### **Phase 2: Full API** (Week 2)
- [ ] All WWE-expected endpoints
- [ ] Event handling (incoming calls, hangup, etc.)
- [ ] Error handling and retries
- [ ] Logging system

### **Phase 3: UI & UX** (Week 3)
- [ ] System tray integration
- [ ] Configuration UI
- [ ] Dashboard
- [ ] Auto-start with Windows

### **Phase 4: Deployment** (Week 4)
- [ ] MSI installer
- [ ] Certificate auto-install
- [ ] Group Policy templates
- [ ] Documentation

---

## 📚 References

- WWE API: Reverse-engineered from your logs
- JsSIP Documentation: https://jssip.net/documentation/
- Electron: https://www.electronjs.org/
- Express.js: https://expressjs.com/

---

**Status:** Ready to implement! 🚀

**Next Steps:**
1. Review architecture
2. Approve implementation approach
3. Start Phase 1 development

