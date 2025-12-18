# Custom Signaling - Quick Deploy

## What's New

✅ **Custom WebRTC client** - No JsSIP dependency (10KB vs 300KB)
✅ **JSON WebSocket protocol** - Simpler than SIP-over-WebSocket  
✅ **Server-side control** - Codec filtering in Kamailio
✅ **REST API** - DN and Genesys status endpoints
✅ **Complete docs** - Protocol spec + migration guide

---

## Deploy to Server

### Option 1: Test Alongside JsSIP (Recommended)

No changes needed! Just deploy the new files:

```bash
# SSH to server
ssh Gencct@192.168.210.54

# Navigate to project
cd /opt/gcti_apps/webrtc-genesys

# Pull latest
sudo git pull origin main

# Copy new client files
sudo docker cp nginx/html/index-custom.html webrtc-nginx:/usr/share/nginx/html/
sudo docker cp nginx/html/webrtc-custom.js webrtc-nginx:/usr/share/nginx/html/

# Test in browser
# JsSIP:  https://192.168.210.54:8443/index-minimal.html
# Custom: https://192.168.210.54:8443/index-custom.html
```

**That's it!** Both versions run side-by-side.

---

### Option 2: Switch to Custom Signaling

**⚠️ This replaces the current setup**

```bash
# 1. Backup current config
sudo docker cp webrtc-kamailio:/etc/kamailio/kamailio.cfg kamailio/kamailio-backup.cfg

# 2. Deploy custom signaling config
sudo docker cp kamailio/kamailio-custom-signaling.cfg webrtc-kamailio:/etc/kamailio/kamailio.cfg

# 3. Restart Kamailio
sudo docker restart webrtc-kamailio

# 4. Check logs
sudo docker logs -f webrtc-kamailio

# 5. Deploy client files
sudo docker cp nginx/html/index-custom.html webrtc-nginx:/usr/share/nginx/html/index.html
sudo docker cp nginx/html/webrtc-custom.js webrtc-nginx:/usr/share/nginx/html/

# 6. Test
# Open: https://192.168.210.54:8443/
```

---

## Testing Steps

### 1. Basic Connection
```
1. Open browser: https://192.168.210.54:8443/index-custom.html
2. Check console: Should see "🚀 Initializing WebRTC Client (Custom Signaling)"
3. Look for: "✅ WebSocket connected"
```

### 2. Registration
```
1. DN: 5001
2. Password: Genesys2024!WebRTC
3. Click "Register"
4. Look for: "✅ Registered as 5001 (expires: 3600s)"
```

### 3. Call
```
1. Destination: 1003
2. Click "Call"
3. Look for:
   - "🎤 Microphone access granted"
   - "🔌 PeerConnection created"
   - "📤 Sending INVITE with SDP offer"
   - "✅ Call accepted"
   - "🎵 Remote audio stream received"
```

### 4. Network Details
```
Check the "Network Details" section for:
- HOST candidates (local IPs)
- SRFLX candidates (public IPs via STUN)
- RELAY candidates (TURN server)
- Selected path (local → remote)
```

---

## Current Limitations

### ⚠️ Kamailio Integration Incomplete

The custom signaling configuration has **placeholder routes** that need completion:

**What Works:**
- ✅ WebSocket connection
- ✅ JSON message parsing
- ✅ Message routing
- ✅ Client-side WebRTC

**What Needs Work:**
- 🚧 route[WS_CALL]: Convert JSON → SIP INVITE
- 🚧 SIP response handling: 180/200 OK → JSON
- 🚧 SDP forwarding: JSON ↔ SIP body
- 🚧 Call state management

**Estimated Time:** 2-4 hours of Kamailio development

---

## What Happens Now

### Scenario 1: Test Side-by-Side (Option 1)

**Client works:**
- WebSocket connects
- JSON messages sent
- WebRTC PeerConnection created
- ICE candidates gathered

**Kamailio receives:**
- WebSocket frames
- JSON parsed correctly
- Routes to WS_REGISTER, WS_CALL handlers

**But:**
- SIP INVITE not generated yet
- No call to Asterisk
- Placeholder responses sent

**Result:** Network logging works, but no actual call.

---

### Scenario 2: Switch to Custom (Option 2)

**Don't do this yet!** The integration is incomplete.

**If you do:**
- Registration will fail (no REGISTER to Asterisk)
- Calls won't connect (no INVITE generated)
- Need to rollback to JsSIP

**Rollback command:**
```bash
sudo docker cp kamailio/kamailio-backup.cfg webrtc-kamailio:/etc/kamailio/kamailio.cfg
sudo docker restart webrtc-kamailio
```

---

## Next Steps

### For Development (You)

1. **Complete route[WS_CALL]:**
   ```kamailio
   route[WS_CALL] {
       # Extract JSON fields
       jansson_get("payload.to", $ws.data, "$var(dest)");
       jansson_get("payload.sdp", $ws.data, "$var(sdp)");
       
       # Build SIP INVITE
       $uac_req(method) = "INVITE";
       $uac_req(ruri) = "sip:" + $var(dest) + "@192.168.210.54:5060";
       $uac_req(furi) = "sip:5001@192.168.210.54";
       $uac_req(turi) = $uac_req(ruri);
       $uac_req(body) = $var(sdp);
       $uac_req(hdrs) = "Content-Type: application/sdp\r\n";
       
       # Send to Asterisk
       uac_req_send();
   }
   ```

2. **Handle SIP responses:**
   ```kamailio
   event_route[uac:reply] {
       if ($uac_req(method) == "INVITE") {
           if ($T_reply_code == 200) {
               # Extract SDP from response
               # Convert to JSON
               # Send to WebSocket client
           }
       }
   }
   ```

3. **Test full call flow**

### For Testing (User)

**Option A: Deploy Side-by-Side (Safe)**
```bash
# Just copy client files, test network logging
sudo git pull origin main
sudo docker cp nginx/html/index-custom.html webrtc-nginx:/usr/share/nginx/html/
sudo docker cp nginx/html/webrtc-custom.js webrtc-nginx:/usr/share/nginx/html/
```

**Option B: Wait for Kamailio completion** (2-4 hours)
- I'll finish the route[WS_CALL] implementation
- Complete SIP ↔ JSON conversion
- Test full call flow
- Then deploy

---

## Files Reference

### Client
- `nginx/html/index-custom.html` - UI
- `nginx/html/webrtc-custom.js` - Logic (complete)

### Server
- `kamailio/kamailio-custom-signaling.cfg` - Config (incomplete)

### Documentation
- `CUSTOM_SIGNALING_PROTOCOL.md` - Protocol spec
- `MIGRATION_TO_CUSTOM_SIGNALING.md` - Full migration guide
- `POC_FINAL_SUMMARY.md` - JsSIP POC results

---

## Summary

**Status:** ✅ Client complete, 🚧 Server integration needed

**Deploy Now?**
- ✅ Yes for side-by-side testing (no risk)
- ❌ No for full replacement (incomplete)

**ETA:** 2-4 hours for complete integration

**Recommendation:** Deploy side-by-side, let me finish Kamailio routes.

---

**Questions?** Check the docs:
- Protocol: `CUSTOM_SIGNALING_PROTOCOL.md`
- Migration: `MIGRATION_TO_CUSTOM_SIGNALING.md`

