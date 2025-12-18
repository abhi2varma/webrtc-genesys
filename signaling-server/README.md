# Custom WebRTC Signaling Server

Node.js-based signaling server that bridges between custom JSON WebSocket protocol and SIP.

## Architecture

```
Browser (Custom JSON) ←WebSocket→ Node.js Server ←SIP→ Asterisk ←→ Genesys
                                        ↓
                                  REST APIs (WWE)
```

## Features

- **Custom JSON Protocol**: Simple JSON messages over WebSocket
- **SIP Integration**: Uses JsSIP to communicate with Asterisk via SIP-over-WebSocket  
- **REST API**: WWE integration endpoints for DN management and call control
- **Full WebRTC**: Handles registration, calls, DTMF, and call control

## Protocol

### WebSocket Messages (JSON)

**Register:**
```json
{
  "type": "register",
  "payload": {
    "dn": "5001",
    "password": "Genesys2024!WebRTC",
    "displayName": "Agent 5001"
  },
  "id": "msg-123"
}
```

**Call:**
```json
{
  "type": "call",
  "payload": {
    "to": "1003",
    "callId": "call-456",
    "sdp": "v=0..."
  },
  "id": "msg-124"
}
```

**Hangup:**
```json
{
  "type": "hangup",
  "payload": {
    "callId": "call-456",
    "reason": "user_hangup"
  },
  "id": "msg-125"
}
```

**DTMF:**
```json
{
  "type": "dtmf",
  "payload": {
    "callId": "call-456",
    "digit": "1"
  },
  "id": "msg-126"
}
```

### REST API Endpoints

- `GET /api/health` - Server health check
- `GET /api/dn/:dn` - Get DN registration status
- `GET /api/dn/list` - List all registered DNs
- `GET /api/calls/active` - Get active calls
- `GET /api/genesys/status` - Genesys connection status

## Configuration

Copy `env.example` to `.env` and configure:

```bash
WS_PORT=8081              # WebSocket port for browsers
HTTP_PORT=8082            # HTTP API port
SIP_SERVER=192.168.210.54
SIP_PORT=5060
SIP_WS_SERVER=ws://192.168.210.54:8080  # Kamailio WebSocket
SIP_DOMAIN=192.168.210.54
```

## Installation

### Docker (Recommended)

```bash
# Build and run
cd /opt/gcti_apps/webrtc-genesys
docker-compose up -d signaling-server

# View logs
docker logs -f webrtc-signaling-server

# Check health
curl http://localhost:8082/api/health
```

### Local Development

```bash
cd signaling-server
npm install
node server.js
```

## Testing

```bash
# Health check
curl http://localhost:8082/api/health

# List registered DNs
curl http://localhost:8082/api/dn/list

# Active calls
curl http://localhost:8082/api/calls/active
```

## Client Integration

Update `nginx/html/webrtc-custom.js`:

```javascript
const wsUrl = `ws://${window.location.hostname}:8081`;
```

Access client at: `https://192.168.210.54:8443/index-custom.html`

## Ports

- **8081**: WebSocket (Browser connections)
- **8082**: HTTP REST API
- **8080**: Kamailio SIP-over-WebSocket (backend)

## Troubleshooting

**Server won't start:**
```bash
# Check logs
docker logs webrtc-signaling-server

# Check ports
netstat -tulpn | grep -E "8081|8082"
```

**Registration fails:**
```bash
# Check Kamailio WebSocket
curl -v ws://192.168.210.54:8080

# Check SIP credentials in Asterisk
docker exec webrtc-asterisk asterisk -rx "pjsip show endpoint 5001"
```

**Calls don't connect:**
- Verify STUN/TURN configuration
- Check ICE candidates in browser console
- Verify SIP routing to Genesys

## Benefits vs JsSIP

- ✅ **Simpler protocol**: JSON messages instead of full SIP
- ✅ **Custom control**: Full control over signaling logic
- ✅ **WWE Integration**: Built-in REST API for Genesys
- ✅ **Easier debugging**: Readable JSON logs
- ✅ **Flexible**: Easy to add custom features

## Migration from JsSIP

1. Keep existing JsSIP setup running
2. Deploy signaling server: `docker-compose up -d signaling-server`
3. Test with `/index-custom.html`
4. Switch clients gradually
5. Monitor both systems during transition

