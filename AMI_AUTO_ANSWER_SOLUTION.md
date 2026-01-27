# Genesys Auto-Answer Solution for Asterisk WebRTC

## Problem Statement

When using Asterisk as a WebRTC gateway for Genesys, the native Genesys auto-answer mechanism doesn't work because:

1. **Genesys T-Server sends `NOTIFY Event: talk`** to trigger auto-answer
2. **Asterisk receives the NOTIFY** but doesn't forward it to the WebRTC client
3. **WebRTC client never knows to auto-answer** the call
4. **Call times out after 30 seconds**

## How Genesys Native WebRTC Works

```
Genesys T-Server → NOTIFY Event: talk → Genesys Media Layer → WebSocket → Browser
                                         ↓
                                   (Understands NOTIFY)
                                         ↓
                                   Sends 200 OK with SDP
                                         ↓
                                   ✅ Call Answered
```

## Our Solution: AMI-Based NOTIFY Handler

Since Asterisk doesn't forward NOTIFY messages, we created an external service that:

1. **Monitors Asterisk AMI** (Asterisk Manager Interface) for events
2. **Detects `NOTIFY Event: talk`** messages from Genesys
3. **Extracts the target DN** (e.g., 1002) from the NOTIFY
4. **Triggers the Bridge API** to answer the call: `POST /answer/{dn}`
5. **WebRTC client answers** immediately with pre-acquired media

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Genesys    │ NOTIFY  │   Asterisk   │   AMI   │ AMI Handler │
│  T-Server   │────────→│   (B2BUA)    │────────→│  (Python)   │
└─────────────┘         └──────────────┘         └──────┬──────┘
                                                         │ HTTP POST
                                                         ↓
                        ┌──────────────┐         ┌─────────────┐
                        │   WebRTC     │←────────│   Bridge    │
                        │   Client     │  Answer │     API     │
                        └──────────────┘         └─────────────┘
```

## Architecture Components

### 1. AMI Auto-Answer Handler (Python Service)
- **File**: `asterisk/ami-auto-answer-handler.py`
- **Purpose**: Monitors Asterisk AMI for NOTIFY events and triggers Bridge API
- **Technology**: Python 3.11, panoramisk (AMI client), aiohttp

### 2. Bridge API (Electron/Node.js)
- **Location**: Already exists in `webrtc-gateway-bridge/src/main.js`
- **Endpoint**: `POST /answer/{dn}`
- **Purpose**: Forwards answer command to WebRTC client

### 3. WebRTC Client (Browser)
- **Location**: `nginx/html/wwe-webrtc-gateway.html`
- **Features**:
  - Early media acquisition (microphone ready before call)
  - Fast signaling (iceGatheringTimeout: 0)
  - Immediate SIP 200 OK response

## Deployment

### Files Created

1. **`asterisk/ami-auto-answer-handler.py`** - Main handler service
2. **`asterisk/ami-handler-requirements.txt`** - Python dependencies
3. **`asterisk/Dockerfile.ami-handler`** - Docker container definition
4. **`docker-compose.yml`** - Added new service

### Docker Service Configuration

```yaml
ami-auto-answer-handler:
  build:
    context: ./asterisk
    dockerfile: Dockerfile.ami-handler
  container_name: webrtc-ami-auto-answer-handler
  network_mode: host
  environment:
    - ASTERISK_HOST=127.0.0.1
    - ASTERISK_AMI_PORT=5038
    - ASTERISK_AMI_USER=admin
    - ASTERISK_AMI_SECRET=admin123
    - BRIDGE_API_URL=http://192.168.210.54:8000
    - GENESYS_SIP_HOST=192.168.210.81
```

## Installation Steps

### On Server (103.167.180.166)

```bash
# 1. Navigate to project directory
cd /opt/gcti_apps/webrtc-genesys

# 2. Pull latest code
git pull

# 3. Build and start the AMI handler service
sudo docker-compose up -d --build ami-auto-answer-handler

# 4. Verify it's running
sudo docker ps | grep ami-auto-answer-handler

# 5. Check logs
sudo docker logs -f webrtc-ami-auto-answer-handler
```

### Expected Log Output

```
2026-01-28 10:30:00 | INFO     | ============================================================
2026-01-28 10:30:00 | INFO     |   Genesys Auto-Answer Handler for Asterisk
2026-01-28 10:30:00 | INFO     | ============================================================
2026-01-28 10:30:00 | INFO     | Connecting to Asterisk AMI at 127.0.0.1:5038
2026-01-28 10:30:01 | INFO     | ✅ Connected to Asterisk AMI successfully
2026-01-28 10:30:01 | INFO     | 👀 Monitoring for NOTIFY Event: talk messages...
2026-01-28 10:30:01 | INFO     | 🌐 Bridge API: http://192.168.210.54:8000
2026-01-28 10:30:01 | INFO     | 📍 Genesys SIP: 192.168.210.81
2026-01-28 10:30:01 | INFO     | Ready to handle auto-answer requests from Genesys!
```

### When a Call Arrives

```
2026-01-28 10:35:00 | INFO     | 📞 New call tracked: Channel=PJSIP/genesys_sip_server-0000001, DN=1002, From=1003
2026-01-28 10:35:01 | INFO     | 🔔 NOTIFY Event: talk received!
2026-01-28 10:35:01 | INFO     | 🎯 Auto-answer target DN: 1002
2026-01-28 10:35:01 | INFO     | 📡 Calling Bridge API: http://192.168.210.54:8000/answer/1002
2026-01-28 10:35:01 | INFO     | ✅ Auto-answer triggered successfully: {'success': True}
```

## Testing

### Test 1: Verify AMI Connection

```bash
# Check if handler is connected to Asterisk AMI
sudo docker exec webrtc-asterisk asterisk -rx 'manager show connected'
```

You should see the AMI handler connected.

### Test 2: Make a Test Call

1. **Agent 1003 calls Agent 1002**
2. **Check WWE:** Should see call arriving at 1002
3. **Check Handler logs:**
   ```bash
   sudo docker logs -f webrtc-ami-auto-answer-handler
   ```
4. **Expected:** Call should auto-answer within 1 second

### Test 3: Verify Bridge API

```bash
# Manually test the bridge API
curl -X POST http://192.168.210.54:8000/answer/1002
```

Expected response:
```json
{"success": true, "message": "Answer command sent"}
```

## Troubleshooting

### Issue: Handler not detecting NOTIFY

**Check AMI events:**
```bash
sudo docker exec webrtc-asterisk asterisk -rx 'manager show events'
```

**Enable SIP debugging:**
```bash
sudo docker exec webrtc-asterisk asterisk -rx 'pjsip set logger on'
```

**Check if NOTIFY is reaching Asterisk:**
```bash
sudo docker exec webrtc-asterisk asterisk -rvvv
```

### Issue: Bridge API not responding

**Check bridge is running:**
```bash
curl -k https://127.0.0.1:8000/
```

**Check Windows firewall** (on bridge machine)

**Check bridge logs** in Electron DevTools

### Issue: WebRTC client not answering

**Verify early media acquisition:**
```javascript
// Should see in browser console after registration:
🎤 Acquiring microphone access early for fast auto-answer...
✅ Microphone access granted and ready
```

**Check microphone permissions** in browser

**Hard refresh** the Electron app (Ctrl+Shift+R in DevTools)

## Alternative Detection Methods

The handler implements multiple detection strategies:

1. **Primary**: AMI SIPMessageReceived events
2. **Secondary**: RTCPReceived events (some Asterisk versions)
3. **Fallback**: Log file monitoring (/var/log/asterisk/full)

If the primary method doesn't work, the handler automatically tries alternatives.

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ASTERISK_HOST` | 127.0.0.1 | Asterisk AMI host |
| `ASTERISK_AMI_PORT` | 5038 | Asterisk AMI port |
| `ASTERISK_AMI_USER` | admin | AMI username |
| `ASTERISK_AMI_SECRET` | admin123 | AMI password |
| `BRIDGE_API_URL` | http://192.168.210.54:8000 | Bridge API endpoint |
| `GENESYS_SIP_HOST` | 192.168.210.81 | Genesys T-Server IP |

### Asterisk AMI Configuration

Ensure AMI is enabled in Asterisk:

**File**: `asterisk/etc/manager.conf`
```ini
[general]
enabled = yes
port = 5038
bindaddr = 0.0.0.0

[admin]
secret = admin123
deny=0.0.0.0/0.0.0.0
permit=127.0.0.1/255.255.255.0
permit=192.168.0.0/255.255.0.0
read = all
write = all
```

## Benefits

✅ **Genesys maintains control** - Auto-answer still triggered by Genesys NOTIFY
✅ **No Asterisk code changes** - External service, easy to maintain
✅ **Easy to debug** - Clear logging of NOTIFY detection and actions
✅ **Respects WWE configuration** - WWE's `voice.auto-answer` setting still applies
✅ **Fast response** - Answer within 1 second (with early media)
✅ **Production ready** - Docker containerized, auto-restart on failure

## Comparison with Native Genesys WebRTC

| Feature | Native Genesys | Our Solution |
|---------|----------------|--------------|
| Auto-answer mechanism | Built-in Media Layer | AMI Handler |
| NOTIFY handling | Native | External service |
| Response time | < 500ms | < 1000ms |
| T-Server integration | Full | Full (via NOTIFY) |
| Maintenance | Genesys team | Your team |
| Cost | License required | Open source |

## Future Enhancements

1. **Add Redis caching** for DN → Channel mapping (faster lookups)
2. **Implement health checks** (expose metrics endpoint)
3. **Add Prometheus metrics** for monitoring
4. **Support multiple Bridge instances** (load balancing)
5. **Implement call quality metrics** (answer time tracking)

## Support

For issues or questions:
1. Check docker logs: `sudo docker logs webrtc-ami-auto-answer-handler`
2. Enable debug logging: Add `LOG_LEVEL=DEBUG` to environment
3. Review this documentation
4. Check Asterisk AMI events: `manager show connected`
