# WebRTC Gateway Architecture - WWE Integration

## 🎯 Use Case

**Goal:** Provide WebRTC calling capability to Genesys agents via WWE (Workspace Web Edition) using a centralized WebRTC gateway.

---

## 🏗️ Architecture Overview

### Components

```
1. Agent Browser (Anywhere with Internet)
   ↓
2. GWS/WWE (192.168.210.54:8090)
   - Agent Desktop UI
   - Embedded WebRTC Client Widget
   - CometD for CTI events
   ↓
3. WebRTC Gateway - Asterisk (192.168.210.54)
   - WebSocket Server (port 8088)
   - SIP/RTP Proxy
   - WebRTC ↔ SIP Transcoding
   - DN Registration Manager
   ↓
4. Genesys SIP Server (192.168.210.81)
   - SIP Registrar
   - Call Routing
   - T-Server Integration
```

---

## 🔄 Registration Flow

### Step 1: Agent Opens WWE

```
1. Agent navigates to: http://192.168.210.54:8090/ui/ad/v1/index.html
2. Logs in with Genesys credentials
3. WWE loads Agent Desktop
4. WWE loads embedded WebRTC widget
```

### Step 2: WebRTC Client Registers to Asterisk

```
WebRTC Client (in WWE)
   ↓ WebSocket REGISTER
   ws://192.168.210.54:8088/ws
   ↓
REGISTER sip:5001@192.168.210.54 SIP/2.0
   ↓
Asterisk: "DN 5001 registered via WebSocket from agent browser"
   ↓
Stores: DN 5001 → WebSocket connection ID
```

### Step 3: Asterisk Registers DN to Genesys

```
Asterisk
   ↓ SIP REGISTER (UDP)
   sip:192.168.210.81:5060
   ↓
REGISTER sip:192.168.210.81:5060 SIP/2.0
From: <sip:5001@192.168.210.81>
To: <sip:5001@192.168.210.81>
Contact: <sip:5001@192.168.210.54:5060>
User-Agent: Asterisk PBX
Expires: 300
   ↓
Genesys SIP Server: "DN 5001 is at 192.168.210.54:5060"
   ↓
200 OK
```

### Result

```
Genesys knows:
  DN 5001 location: sip:5001@192.168.210.54:5060
  
Asterisk knows:
  DN 5001 is registered via WebSocket from agent browser
  
Call path established:
  Genesys ↔ Asterisk ↔ WebRTC Client (in WWE)
```

---

## 📞 Call Flow Examples

### Scenario 1: Inbound Call to Agent (DN 5001)

```
1. Customer calls contact center
   ↓
2. Genesys routing sends call to Agent DN 5001
   ↓
3. T-Server → SIP Server: "Call DN 5001"
   ↓
4. SIP Server looks up: "DN 5001 is at 192.168.210.54"
   ↓
5. SIP Server sends:
   INVITE sip:5001@192.168.210.54:5060 SIP/2.0
   Via: SIP/2.0/UDP 192.168.210.81:5060
   ↓
6. Asterisk receives INVITE
   ↓
7. Asterisk looks up: "5001 is at WebSocket XYZ"
   ↓
8. Asterisk sends NEW INVITE via WebSocket:
   INVITE sip:5001@192.168.210.54:8088/ws
   ↓
9. WebRTC Client (in WWE) receives INVITE
   ↓
10. WWE shows: "Incoming call from <caller>"
    CometD also publishes call event
   ↓
11. Agent clicks "Answer" in WebRTC widget
   ↓
12. WebRTC sends: 200 OK
   ↓
13. Asterisk bridges:
    Genesys (SIP/UDP) ↔ Asterisk ↔ WebRTC Client (WebSocket)
   ↓
14. RTP audio flows:
    Customer ← Asterisk (transcoding) → Agent Browser (WebRTC)
   ↓
15. Call established! ✅
```

### Scenario 2: Outbound Call from Agent (DN 5001)

```
1. Agent in WWE types destination: 5002
   ↓
2. Agent clicks "Call" in WebRTC widget
   ↓
3. WebRTC Client sends:
   INVITE sip:5002@192.168.210.54 SIP/2.0
   Via: WebSocket
   ↓
4. Asterisk receives INVITE from WebSocket
   ↓
5. Asterisk dialplan matches:
   exten => _X.,1,Dial(PJSIP/${EXTEN}@genesys_sip_server)
   ↓
6. Asterisk sends NEW INVITE to Genesys:
   INVITE sip:5002@192.168.210.81:5060 SIP/2.0
   From: <sip:5001@192.168.210.54>
   ↓
7. Genesys SIP Server routes to DN 5002
   ↓
8. DN 5002 rings (another agent or phone)
   ↓
9. DN 5002 answers: 200 OK
   ↓
10. Asterisk bridges call
   ↓
11. Call established! ✅
```

---

## 🔧 Configuration Requirements

### 1. Asterisk Configuration

**Must have in `pjsip.conf`:**

#### A. WebRTC Client Endpoint Template
```ini
[webrtc_client](!)
type=endpoint
transport=transport-ws,transport-wss
context=from-webrtc
aors=webrtc_client
auth=webrtc_client
use_avpf=yes
media_encryption=no
dtls_auto_generate_cert=yes
webrtc=yes
allow=!all,ulaw,alaw,opus
```

#### B. Genesys SIP Server Endpoint
```ini
[genesys_sip_server]
type=endpoint
transport=transport-udp
context=from-genesys
aors=genesys_sip_server
outbound_auth=genesys_auth
allow=!all,ulaw,alaw
direct_media=no
```

#### C. Genesys Registration (Per DN)
```ini
[genesys_registration_5001]
type=registration
transport=transport-udp
outbound_auth=genesys_auth
server_uri=sip:192.168.210.81:5060
client_uri=sip:5001@192.168.210.81:5060
contact_user=5001
retry_interval=60
expiration=300

[genesys_registration_5002]
type=registration
transport=transport-udp
outbound_auth=genesys_auth
server_uri=sip:192.168.210.81:5060
client_uri=sip:5002@192.168.210.81:5060
contact_user=5002
retry_interval=60
expiration=300

; Repeat for all DNs 5001-5020
```

#### D. Authentication for Genesys (if required)
```ini
[genesys_auth]
type=auth
username=asterisk_gateway
password=<genesys_password>  ; If Genesys requires auth
```

---

### 2. WWE Configuration

**Embed WebRTC Client in WWE:**

#### Option A: WWE Widget (Recommended)

Create custom widget in `index.html`:

```html
<!-- In WWE custom widget -->
<div id="webrtc-widget">
    <iframe 
        src="http://192.168.210.54/index.html" 
        width="300" 
        height="500"
        frameborder="0">
    </iframe>
</div>
```

#### Option B: WWE Extension API

```javascript
// In WWE extension
window.genesys.wwe.service.registerWidget({
    id: 'webrtc-phone',
    title: 'WebRTC Phone',
    url: 'http://192.168.210.54/index.html',
    width: 300,
    height: 500,
    position: 'right'
});
```

---

### 3. Genesys SIP Server Configuration

**Must allow registrations from Asterisk:**

#### Option A: Allow IP-based Registration
```ini
# In SIP Server config
accept-registrations: yes
allowed-registration-ips: 192.168.210.54
registration-expiration: 300
```

#### Option B: Trunk Configuration (Already Done)
```
Trunk: Asterisk_WebRTC_Gateway
Contact: sip:192.168.210.54:5060;transport=udp
Accept-Register: yes
```

---

## 🌐 Network Requirements

### Firewall Rules Required

#### On Asterisk Server (192.168.210.54):

**Inbound:**
```
Allow TCP 80       (HTTP - WebRTC client)
Allow TCP 443      (HTTPS - WebRTC client, if SSL enabled)
Allow TCP 8088     (WebSocket - WebRTC SIP signaling)
Allow UDP 5060     (SIP - from Genesys)
Allow UDP 10000-10100  (RTP - media from Genesys)
```

**Outbound:**
```
Allow UDP 5060     (SIP - to Genesys 192.168.210.81)
Allow UDP 10000-20000  (RTP - to Genesys)
```

#### On Genesys SIP Server (192.168.210.81):

**Inbound:**
```
Allow UDP 5060     (SIP - from Asterisk 192.168.210.54)
Allow UDP 10000-20000  (RTP - from Asterisk)
```

#### For Remote Agents:

```
Agent Browser → Internet → Firewall → 192.168.210.54
  Allow: TCP 80, 443, 8088
  Allow: UDP 10000-10100 (for STUN/TURN if needed)
```

---

## 🔐 Security Considerations

### 1. WebSocket Authentication
```
WebRTC Client must authenticate to Asterisk:
  Username: 5001
  Password: configured in pjsip.conf
```

### 2. HTTPS/WSS (Production)
```
Use SSL/TLS for production:
  https://192.168.210.54:443
  wss://192.168.210.54:8089/ws
```

### 3. Asterisk ↔ Genesys Authentication
```
If Genesys requires:
  [genesys_auth]
  username=asterisk_gw
  password=<secure_password>
```

### 4. WWE Authentication
```
Agent must login to WWE first
WebRTC widget inherits session
```

---

## 📊 Scalability

### Concurrent Calls Capacity

**Asterisk (Single Instance):**
```
Capacity: 480 (configured)
Realistic: ~200-300 concurrent calls
Depends on: CPU, bandwidth, transcoding
```

**To Scale Beyond:**
```
Option 1: Multiple Asterisk Instances
  - Load balancer (HAProxy, Kamailio)
  - Distribute DNs across instances
  
Option 2: Kubernetes Deployment
  - Scale Asterisk pods
  - Shared media server (Freeswitch)
```

---

## 🧪 Testing Checklist

### Phase 1: Basic Registration

- [ ] WebRTC client loads in browser
- [ ] WebRTC connects to Asterisk WebSocket
- [ ] DN 5001 registers to Asterisk
- [ ] Asterisk registers DN 5001 to Genesys
- [ ] Genesys logs show: 200 OK for REGISTER

### Phase 2: Inbound Call

- [ ] Call DN 5001 from another Genesys phone
- [ ] WebRTC client rings
- [ ] Agent can answer
- [ ] Two-way audio works
- [ ] Call can be hung up

### Phase 3: Outbound Call

- [ ] Agent dials another DN from WebRTC
- [ ] Call routes through Asterisk to Genesys
- [ ] Destination rings
- [ ] Two-way audio works

### Phase 4: WWE Integration

- [ ] WebRTC widget loads in WWE
- [ ] CometD events sync with WebRTC
- [ ] Call state updates in WWE
- [ ] Screen pop works
- [ ] CTI controls work (hold, transfer)

### Phase 5: Load Testing

- [ ] 10 simultaneous agents
- [ ] 50 simultaneous agents
- [ ] 100+ simultaneous agents
- [ ] Monitor: CPU, memory, network

---

## 🐛 Troubleshooting Guide

### Issue 1: WebRTC Won't Register to Asterisk

**Symptoms:**
```
WebRTC client shows: "Connecting..." forever
Console error: WebSocket connection failed
```

**Check:**
```bash
# Verify Asterisk WebSocket is listening
docker exec webrtc-asterisk netstat -tlnp | grep 8088

# Check Asterisk HTTP server
docker exec webrtc-asterisk asterisk -rx "http show status"

# Watch for connections
docker logs -f webrtc-asterisk | grep -i websocket
```

**Common Fixes:**
```
- Enable WebSocket in http.conf
- Check firewall allows port 8088
- Verify WebRTC client uses correct URL: ws://192.168.210.54:8088/ws
```

---

### Issue 2: Asterisk Won't Register to Genesys

**Symptoms:**
```
Asterisk logs: "Registration failed for genesys_registration_5001"
Genesys logs: 403 Forbidden or 404 Not Found
```

**Check:**
```bash
# Check registration status
docker exec webrtc-asterisk asterisk -rx "pjsip show registrations"

# Watch registration attempts
docker logs -f webrtc-asterisk | grep -i register

# Enable SIP debug
docker exec -it webrtc-asterisk asterisk -rvvv
> pjsip set logger on
```

**Common Fixes:**
```
- Genesys must accept registrations from 192.168.210.54
- Check trunk configuration allows registrations
- Verify no authentication required (or add credentials)
- Check network connectivity: ping 192.168.210.81
```

---

### Issue 3: No Audio in Calls

**Symptoms:**
```
Call connects but no audio
One-way audio only
```

**Check:**
```bash
# Check RTP ports open
netstat -un | grep "10000-10100"

# Check Asterisk RTP config
docker exec webrtc-asterisk asterisk -rx "rtp show settings"

# Watch RTP packets
docker exec webrtc-asterisk asterisk -rx "rtp set debug on"
```

**Common Fixes:**
```
- Open UDP 10000-10100 on firewall
- Configure external_media_address in pjsip.conf
- Check STUN/TURN server for WebRTC
- Verify codec compatibility (ulaw/alaw)
```

---

### Issue 4: WWE Can't Reach WebRTC Client

**Symptoms:**
```
WWE loads but WebRTC widget shows 404
iframe blank or error
```

**Check:**
```
- Nginx serving WebRTC client on port 80
- Browser can access: http://192.168.210.54
- CORS headers allow WWE origin
- Check browser console for errors
```

---

## 📈 Monitoring & Metrics

### Key Metrics to Track

```
1. Active Registrations:
   docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints" | grep Avail

2. Active Calls:
   docker exec webrtc-asterisk asterisk -rx "core show channels"

3. Registration Success Rate:
   grep "200 OK" asterisk-logs | wc -l

4. Call Success Rate:
   (completed calls / total attempts)

5. Audio Quality:
   RTP packet loss, jitter, latency
```

---

## 🎯 Deployment Steps Summary

### 1. Prerequisites
- [ ] Asterisk deployed (192.168.210.54)
- [ ] GWS/WWE accessible (192.168.210.54:8090)
- [ ] Genesys SIP Server reachable (192.168.210.81)
- [ ] Network/firewall configured

### 2. Configure Asterisk
- [ ] Add WebRTC endpoint templates
- [ ] Configure Genesys trunk
- [ ] Add DN registrations (5001-5020)
- [ ] Test registration to Genesys

### 3. Deploy WebRTC Client
- [ ] Build/update client UI
- [ ] Deploy to Nginx
- [ ] Test standalone access

### 4. Integrate with WWE
- [ ] Create WWE widget/extension
- [ ] Embed WebRTC client
- [ ] Test CometD integration

### 5. Test End-to-End
- [ ] Agent registration
- [ ] Inbound calls
- [ ] Outbound calls
- [ ] Audio quality
- [ ] CTI synchronization

### 6. Production Readiness
- [ ] Enable SSL/TLS
- [ ] Configure monitoring
- [ ] Document runbooks
- [ ] Train support staff

---

## 📚 Related Documentation

- `ASTERISK_GENESYS_CONNECTION.md` - Asterisk-Genesys SIP integration
- `GWS_COMETD_INTEGRATION.md` - CometD CTI events
- `DEPLOYMENT_VERIFICATION.md` - Testing procedures
- `pjsip.conf` - Asterisk SIP configuration

---

**Architecture Status:** ✅ Defined and Documented
**Next Step:** Configure Asterisk DN registrations to Genesys

