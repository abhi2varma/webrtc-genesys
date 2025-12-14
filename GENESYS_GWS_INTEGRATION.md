# Genesys Workspace Web Edition (GWS) Integration Guide

## Overview

This guide explains how to integrate the WebRTC SIP client with Genesys Workspace Web Edition (GWS) to replace the traditional softphone.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Browser                             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Genesys Workspace Web Edition (GWS)                    │ │
│  │ http://192.168.210.54:8090/ui/ad/v1/index.html        │ │
│  │                                                         │ │
│  │  ┌───────────────────────────────────────────────────┐ │ │
│  │  │ Embedded WebRTC Client (iframe/widget)            │ │ │
│  │  │ http://192.168.210.54/                            │ │ │
│  │  │                                                    │ │ │
│  │  │  • JsSIP (WebRTC)                                 │ │ │
│  │  │  • CometD (CTI Events)                            │ │ │
│  │  │  • GWS REST API (Call Control)                    │ │ │
│  │  └───────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│         │                    │                   │           │
│         │ WSS/WS            │ HTTP/CometD       │ REST      │
│         │ (Media/SIP)       │ (Events)          │ (Control) │
└─────────┼────────────────────┼───────────────────┼───────────┘
          │                    │                   │
          ▼                    ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│              Server: 192.168.210.54                          │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Asterisk   │    │     GWS      │    │    Nginx     │  │
│  │  (Port 5060) │    │ (Port 8090)  │    │  (Port 80)   │  │
│  │  (Port 8088) │    │              │    │              │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────────┘  │
│         │                   │                               │
│         │ SIP (UDP)        │ Genesys API                   │
└─────────┼───────────────────┼───────────────────────────────┘
          │                   │
          ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│          Genesys SIP Server: 192.168.210.81:5060            │
│                                                              │
│  • T-Server (Call Control)                                  │
│  • SIP Server (Voice)                                       │
│  • Agent Management                                         │
│  • Routing Engine                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Components

### 1. **WebRTC Client** (Your Application)
- **URL**: `http://192.168.210.54/`
- **Purpose**: SIP/WebRTC softphone in browser
- **Features**:
  - Agent DN registration (5001-5020)
  - WebRTC audio/video calling
  - CometD event subscription
  - GWS REST API integration

### 2. **Genesys Workspace Web Edition (GWS)**
- **URL**: `http://192.168.210.54:8090/ui/ad/v1/index.html`
- **Purpose**: Agent desktop for call handling
- **APIs Used**:
  - **CometD**: Real-time CTI events (call state changes)
  - **REST API**: Call control (answer, hold, transfer, etc.)
  - **WWE Widgets API**: Embed custom widgets

### 3. **Asterisk Server**
- **IP**: `192.168.210.54`
- **SIP Port**: `5060` (UDP)
- **WebSocket Port**: `8088` (WS)
- **Purpose**: SIP/WebRTC gateway between browser and Genesys

### 4. **Genesys SIP Server**
- **IP**: `192.168.210.81`
- **Port**: `5060` (UDP)
- **Purpose**: Handles all call routing and CTI logic

---

## Integration Methods

### Option A: Embedded Widget (Recommended)

Embed the WebRTC client as a **WWE Widget** within GWS using the Widgets API.

#### Step 1: Create WWE Widget Configuration

Create a file `webrtc-widget.json`:

```json
{
  "id": "webrtc-softphone",
  "name": "WebRTC Softphone",
  "description": "WebRTC SIP client for Genesys agents",
  "version": "1.0.0",
  "url": "http://192.168.210.54/",
  "width": 400,
  "height": 600,
  "resizable": true,
  "position": "right-panel",
  "autoLoad": true,
  "dependencies": [],
  "settings": {
    "sipServer": "ws://192.168.210.54:8088/ws",
    "gwsUrl": "http://192.168.210.54:8090",
    "autoConnect": true
  }
}
```

#### Step 2: Register Widget with GWS

Using GWS Widgets API:

```javascript
// In GWS custom plugin
window.widgets.register({
  id: 'webrtc-softphone',
  name: 'WebRTC Softphone',
  url: 'http://192.168.210.54/',
  width: 400,
  height: 600,
  position: 'right'
});
```

#### Step 3: Agent Workflow

1. Agent opens GWS: `http://192.168.210.54:8090`
2. Agent logs in with Genesys credentials
3. WebRTC widget auto-loads in right panel
4. Widget auto-registers agent's DN (from GWS session)
5. Agent ready to handle calls

---

### Option B: Standalone Client with CometD Integration

Run WebRTC client as standalone app that subscribes to GWS CTI events.

#### Step 1: Agent Opens Both Applications

1. **GWS**: `http://192.168.210.54:8090` (main desktop)
2. **WebRTC**: `http://192.168.210.54/` (separate tab/window)

#### Step 2: Configure CometD Connection

In the WebRTC client UI:

```
GWS URL: http://192.168.210.54:8090
GWS Username: <agent username>
GWS Password: <agent password>
CometD Channel: /user/agent/events
☑️ Use GWS for dialing
```

#### Step 3: Connect to GWS

Click **"Connect GWS"** button to:
- Authenticate with GWS
- Subscribe to CometD channels for CTI events
- Enable GWS call control (REST API)

#### Step 4: Connect SIP

Click **"Connect"** button to register agent DN to Asterisk:

```
SIP Server: ws://192.168.210.54:8088/ws
Agent DN: 5001
Password: GenesysAgent5001!
```

---

## Call Flow Integration

### Scenario 1: Inbound Call (from Genesys)

```
1. Customer calls → Genesys SIP Server
2. Genesys routes to Agent DN 5001
3. GWS receives CTI event → Shows call notification
4. Genesys sends SIP INVITE → Asterisk (192.168.210.54:5060)
5. Asterisk forwards → WebRTC Client (WSS)
6. WebRTC Client rings → Agent hears ringtone
7. Agent clicks "Answer" in GWS OR WebRTC client
   ├─ If GWS: REST API call → Genesys → SIP 200 OK → Asterisk → WebRTC
   └─ If WebRTC: SIP 200 OK → Asterisk → Genesys → GWS CTI event
8. Call connected: Customer ↔ Genesys ↔ Asterisk ↔ WebRTC ↔ Agent
```

### Scenario 2: Outbound Call (Agent dials)

```
1. Agent enters number in GWS or WebRTC client
2. Option A: GWS Dial
   └─ REST API → Genesys → SIP INVITE to customer
   └─ Genesys sends SIP INVITE to Agent DN 5001
   └─ Asterisk → WebRTC → Agent answers
   └─ Call bridged by Genesys

3. Option B: Direct Dial (WebRTC)
   └─ WebRTC → SIP INVITE → Asterisk
   └─ Asterisk → SIP INVITE → Genesys (192.168.210.81:5060)
   └─ Genesys routes to destination
   └─ GWS receives CTI event (call state change)
```

### Scenario 3: Call Transfer

```
1. Agent clicks "Transfer" in GWS
2. GWS sends REST API call to Genesys
3. Genesys handles transfer (SIP REFER)
4. Asterisk receives SIP REFER
5. WebRTC client receives notification
6. Call transferred, WebRTC disconnects old call
```

---

## WebRTC Client Configuration

The client is pre-configured for your environment:

```javascript
// Default values in index.html
GWS URL: http://192.168.210.54:8090
SIP Server: ws://192.168.210.54:8088/ws
Agent DN: 5001
Password: GenesysAgent5001!
```

### Available Agent DNs

| DN | Password | Status |
|----|----------|--------|
| 5001 | GenesysAgent5001! | ✅ Configured |
| 5002 | GenesysAgent5002! | ✅ Configured |
| 5003 | GenesysAgent5003! | ✅ Configured |
| ... | ... | ... |
| 5020 | GenesysAgent5020! | ✅ Configured |

---

## GWS API Integration Details

### CometD Event Subscription

The WebRTC client subscribes to these channels:

```javascript
// Subscribe to agent events
client.cometd.subscribe('/user/agent/events', (message) => {
  if (message.data.event === 'Ringing') {
    // Show incoming call UI
  } else if (message.data.event === 'Established') {
    // Update call status to "Connected"
  } else if (message.data.event === 'Released') {
    // End call, cleanup
  }
});

// Subscribe to call state changes
client.cometd.subscribe('/call/state', (message) => {
  // Update UI based on call state
});
```

### REST API for Call Control

```javascript
// Answer call
fetch('http://192.168.210.54:8090/api/v2/me/calls/active/answer', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + gwsToken,
    'Content-Type': 'application/json'
  }
});

// Hold call
fetch('http://192.168.210.54:8090/api/v2/me/calls/active/hold', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + gwsToken,
    'Content-Type': 'application/json'
  }
});

// Hangup call
fetch('http://192.168.210.54:8090/api/v2/me/calls/active/hangup', {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer ' + gwsToken
  }
});
```

---

## Deployment Steps

### Step 1: Copy Updated Files to Server

From your Windows machine:

```powershell
cd D:\Abhi\WebRTC\webrtc-genesys
scp -P 69 asterisk/etc/pjsip.conf Gencct@192.168.210.54:/opt/gcti_apps/webrtc/asterisk/etc/
scp -P 69 nginx/html/index.html Gencct@192.168.210.54:/opt/gcti_apps/webrtc/nginx/html/
```

### Step 2: Restart Services

SSH to server:

```bash
ssh -p 69 Gencct@192.168.210.54
cd /opt/gcti_apps/webrtc
docker-compose restart asterisk nginx
```

### Step 3: Verify Asterisk Configuration

```bash
# Check PJSIP endpoint
docker exec webrtc-asterisk asterisk -rx "pjsip show endpoint genesys_sip_server"

# Check agent DNs
docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints"

# Check registration status
docker exec webrtc-asterisk asterisk -rx "pjsip show registrations"

# Enable SIP debug
docker exec webrtc-asterisk asterisk -rx "pjsip set logger on"
```

### Step 4: Test WebRTC Client

1. Open browser: `http://192.168.210.54/`
2. Verify pre-filled values:
   - GWS URL: `http://192.168.210.54:8090`
   - SIP Server: `ws://192.168.210.54:8088/ws`
   - Agent DN: `5001`
3. Click **"Connect"** to register SIP
4. Click **"Connect GWS"** to subscribe to CTI events
5. Check status indicators turn green

### Step 5: Test Call Flow

#### Test 1: Echo Test (Internal)
```
1. Register as Agent 5001
2. Dial any number
3. Should route through Genesys SIP Server
```

#### Test 2: Agent-to-Agent
```
1. Open two browser windows
2. Register as 5001 and 5002
3. Dial 5002 from 5001
4. Call should route: 5001 → Asterisk → Genesys → Asterisk → 5002
```

#### Test 3: Inbound Call (via Genesys)
```
1. Register agent in GWS
2. Place call to agent's DN via Genesys routing
3. WebRTC client should ring
4. Answer and verify audio
```

---

## Troubleshooting

### Issue 1: WebRTC Client Can't Connect to SIP

**Symptoms**: Status shows "Disconnected" or "Connecting..."

**Check**:
```bash
# Verify Asterisk is listening
docker exec webrtc-asterisk asterisk -rx "http show status"
# Should show: 0.0.0.0:8088 (WebSocket)

# Check WebSocket proxy
curl -v http://192.168.210.54:8088/ws
# Should return "HTTP/1.1 426 Upgrade Required"

# Check PJSIP transport
docker exec webrtc-asterisk asterisk -rx "pjsip show transports"
```

**Fix**:
- Ensure `transport-wss` is configured in `pjsip.conf`
- Verify nginx proxy is forwarding `/ws` to Asterisk
- Check browser console for WebSocket errors

---

### Issue 2: Can't Connect to GWS (CometD)

**Symptoms**: GWS status shows "Disconnected"

**Check**:
```bash
# Verify GWS is running
curl http://192.168.210.54:8090/ui/ad/v1/index.html
# Should return HTML

# Check CometD endpoint
curl http://192.168.210.54:8090/cometd
# Should return JSON
```

**Fix**:
- Verify GWS URL is correct
- Check if authentication is required
- Check browser console for CORS errors
- Ensure GWS allows WebSocket connections

---

### Issue 3: Calls Don't Route Through Genesys

**Symptoms**: Calls fail or don't show in GWS

**Check**:
```bash
# Test connectivity to Genesys SIP Server
ping 192.168.210.81

# Check PJSIP endpoint status
docker exec webrtc-asterisk asterisk -rx "pjsip show endpoint genesys_sip_server"

# Enable SIP debug and make test call
docker exec webrtc-asterisk asterisk -rx "pjsip set logger on"
docker logs -f webrtc-asterisk
```

**Fix**:
- Verify `outbound_proxy=sip:192.168.210.81:5060` in agent_dn template
- Check firewall allows UDP 5060 to 192.168.210.81
- Verify Genesys SIP Server allows connections from 192.168.210.54
- Check if agent DN is registered in Genesys

---

### Issue 4: No Audio in Calls

**Symptoms**: Call connects but no audio

**Check**:
```bash
# Check RTP ports are open
sudo firewall-cmd --list-ports
# Should include: 10000-20000/udp

# Check Asterisk RTP config
docker exec webrtc-asterisk asterisk -rx "rtp show settings"

# Check STUN/TURN server
docker logs webrtc-coturn
```

**Fix**:
- Verify STUN/TURN server is configured in JsSIP
- Check `external_media_address` in `pjsip.conf`
- Ensure firewall allows RTP ports 10000-20000 UDP
- Check ICE connectivity in browser console

---

## Security Considerations

### 1. **Use HTTPS/WSS in Production**

Currently using `ws://` (non-secure). For production:

```
Change: ws://192.168.210.54:8088/ws
To: wss://your-domain.com/ws
```

And generate SSL certificates.

### 2. **Secure GWS Communication**

```javascript
// Use HTTPS for GWS
gwsUrl: "https://192.168.210.54:8090"

// Use token-based auth instead of password
headers: {
  'Authorization': 'Bearer ' + gwsToken
}
```

### 3. **Agent DN Password Management**

Current passwords are simple (e.g., `GenesysAgent5001!`). In production:
- Use strong, randomly generated passwords
- Store in environment variables or secrets manager
- Rotate passwords regularly

---

## Next Steps

1. ✅ **Update configuration files** (DONE)
2. ⏳ **Deploy to CentOS server**
3. ⏳ **Test SIP registration**
4. ⏳ **Test call flow through Genesys**
5. ⏳ **Integrate with GWS (embedded or standalone)**
6. ⏳ **Configure agent DNs in Genesys**
7. ⏳ **Test end-to-end call scenarios**
8. ⏳ **Enable SSL/TLS for production**

---

## Reference Links

- **Genesys WWE Widgets API**: https://docs.genesys.com/Documentation/WWE
- **JsSIP Documentation**: https://jssip.net/documentation/
- **Asterisk PJSIP**: https://wiki.asterisk.org/wiki/display/AST/Configuring+res_pjsip
- **CometD Protocol**: https://docs.cometd.org/current/reference/

---

## Support

For issues or questions:
1. Check Asterisk logs: `docker logs webrtc-asterisk`
2. Check browser console for JavaScript errors
3. Review this integration guide
4. Test connectivity using troubleshooting steps above

