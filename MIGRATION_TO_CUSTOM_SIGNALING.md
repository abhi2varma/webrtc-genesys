# Custom WebRTC Signaling - Migration Guide

## Overview

Migrating from **JsSIP** to a **custom WebSocket signaling protocol** for better control and integration.

---

## Architecture Change

### Before (JsSIP)
```
Browser (JsSIP 3.10.0)
    ↓ WebSocket (SIP over WS)
Kamailio (SIP Proxy)
    ↓ SIP
Asterisk
    ↓ SIP
Genesys
```

**Issues:**
- 300KB JsSIP library
- 40-second ICE gathering delay
- Opus codec still offered (browser-side)
- Limited control over signaling

### After (Custom)
```
Browser (Custom Client)
    ↓ WebSocket (JSON messages)
Kamailio (Signaling Server)
    ↓ SIP
Asterisk
    ↓ SIP
Genesys
```

**Benefits:**
- ✅ Lightweight client (~10KB)
- ✅ Server-side codec control
- ✅ Custom business logic
- ✅ REST API for DN/Genesys info
- ✅ Easier monitoring and debugging

---

## Files Created

### 1. Protocol Specification
- `CUSTOM_SIGNALING_PROTOCOL.md` - Complete protocol documentation

### 2. Client Files
- `nginx/html/index-custom.html` - Custom client UI
- `nginx/html/webrtc-custom.js` - Custom WebRTC implementation

### 3. Server Configuration
- `kamailio/kamailio-custom-signaling.cfg` - Kamailio with JSON WebSocket handling

---

## Deployment Steps

### Option 1: Test Side-by-Side

Keep both versions running:

```bash
# JsSIP version (existing)
https://192.168.210.54:8443/index-minimal.html

# Custom version (new)
https://192.168.210.54:8443/index-custom.html
```

**No changes needed** - just access different URLs.

### Option 2: Switch to Custom Signaling

1. **Update Kamailio Configuration:**
   ```bash
   cd /opt/gcti_apps/webrtc-genesys
   sudo docker cp kamailio/kamailio-custom-signaling.cfg webrtc-kamailio:/etc/kamailio/kamailio.cfg
   sudo docker restart webrtc-kamailio
   ```

2. **Deploy Custom Client:**
   ```bash
   sudo docker cp nginx/html/index-custom.html webrtc-nginx:/usr/share/nginx/html/
   sudo docker cp nginx/html/webrtc-custom.js webrtc-nginx:/usr/share/nginx/html/
   ```

3. **Test:**
   ```bash
   # Open browser
   https://192.168.210.54:8443/index-custom.html
   
   # Register DN 5001
   # Call 1003
   # Check logs
   ```

---

## Protocol Messages

### Client → Server

#### Register
```json
{
  "type": "register",
  "payload": {
    "dn": "5001",
    "password": "Genesys2024!WebRTC",
    "displayName": "Agent 5001"
  },
  "id": "msg-1"
}
```

#### Call
```json
{
  "type": "call",
  "payload": {
    "to": "1003",
    "callId": "call-123",
    "sdp": "v=0\r\no=..."
  },
  "id": "msg-2"
}
```

#### Hangup
```json
{
  "type": "hangup",
  "payload": {
    "callId": "call-123",
    "reason": "user_hangup"
  },
  "id": "msg-3"
}
```

### Server → Client

#### Registered
```json
{
  "type": "registered",
  "payload": {
    "dn": "5001",
    "expires": 3600,
    "server": "192.168.210.54"
  },
  "id": "msg-1"
}
```

#### Call Accepted
```json
{
  "type": "callAccepted",
  "payload": {
    "callId": "call-123",
    "sdp": "v=0\r\no=..."
  },
  "id": "msg-2"
}
```

---

## Current Implementation Status

### ✅ Implemented

1. **Client-Side:**
   - WebSocket connection management
   - JSON message protocol
   - WebRTC PeerConnection handling
   - ICE candidate gathering and logging
   - UI for registration and calling
   - Network path visualization

2. **Server-Side (Partial):**
   - WebSocket handshake
   - JSON message parsing
   - Message type routing
   - Basic register/call/hangup handlers

### 🚧 To Be Completed

1. **Kamailio - SIP Conversion:**
   - Convert JSON `call` message → SIP INVITE
   - Convert SDP from JSON → SIP body
   - Handle SIP responses → JSON messages
   - Implement UAC (User Agent Client) module usage

2. **Call Flow:**
   - Full INVITE/200 OK/ACK sequence
   - SDP offer/answer exchange
   - ICE candidate forwarding (if needed)

3. **Features:**
   - Inbound call handling
   - Call transfer
   - Conference
   - DTMF via SIP INFO

---

## Next Steps

### Phase 1: Basic Call Flow (Today)

1. Complete `route[WS_CALL]` in Kamailio:
   - Use `uac` module to send INVITE
   - Convert JSON SDP to SIP body
   - Handle 180/200 responses

2. Test registration + outbound call

3. Verify audio path

### Phase 2: Full Feature Parity (This Week)

1. Implement all call control features
2. Add inbound call support
3. Error handling and edge cases
4. Load testing

### Phase 3: Production (Next Week)

1. Security hardening
2. Performance optimization
3. Monitoring and logging
4. Documentation
5. Deployment to production

---

## Migration Strategy

### Week 1: Parallel Testing
- JsSIP version at `/index-minimal.html`
- Custom version at `/index-custom.html`
- Test both side-by-side
- Verify feature parity

### Week 2: User Acceptance
- Select users test custom version
- Gather feedback
- Fix issues
- Performance testing

### Week 3: Cutover
- Default route → custom version
- JsSIP → `/legacy/index-minimal.html`
- Monitor for issues
- 24/7 support standby

### Week 4: Cleanup
- Remove JsSIP library
- Archive old code
- Update all documentation
- Training for support team

---

## Testing Checklist

### Basic Functionality
- [ ] WebSocket connection
- [ ] Registration (DN 5001)
- [ ] Outbound call (to 1003)
- [ ] Two-way audio
- [ ] Hangup
- [ ] Unregister

### Call Control
- [ ] Mute/Unmute
- [ ] Hold/Resume
- [ ] DTMF (0-9, *, #)

### Edge Cases
- [ ] Network disconnect/reconnect
- [ ] Call to busy number
- [ ] Call to invalid number
- [ ] Registration expiry
- [ ] Multiple calls

### Performance
- [ ] Call setup time
- [ ] Audio latency
- [ ] ICE gathering time
- [ ] Memory usage
- [ ] CPU usage

---

## Rollback Plan

If issues arise, rollback is simple:

```bash
# 1. Restore original Kamailio config
sudo docker cp kamailio/kamailio-proxy.cfg webrtc-kamailio:/etc/kamailio/kamailio.cfg
sudo docker restart webrtc-kamailio

# 2. Point users to JsSIP version
# Update nginx default route or just use:
https://192.168.210.54:8443/index-minimal.html

# No data loss, instant rollback
```

---

## Advantages Summary

### Technical
- **Lighter:** 10KB vs 300KB
- **Faster:** Direct WebRTC API
- **Control:** Server-side codec filtering
- **Flexible:** Easy to extend

### Business
- **Cost:** Lower bandwidth
- **Quality:** Better codec control
- **Integration:** REST API for Genesys
- **Support:** Easier troubleshooting

### Development
- **Debugging:** All signaling visible
- **Testing:** Simpler unit tests
- **Docs:** Complete protocol spec
- **Team:** No JsSIP learning curve

---

**Status:** Ready for Phase 1 Testing
**Next:** Complete Kamailio UAC integration
**Timeline:** Production-ready in 2-3 weeks

