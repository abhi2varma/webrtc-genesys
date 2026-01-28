# Testing Basic WebRTC Calling (No WWE)

This guide tests if basic SIP/WebRTC calling works **without WWE**.

## Goal
- Call from **1003** (Genesys/SIP phone) → **1002** (WebRTC Gateway)
- Verify **auto-answer** works
- Verify **audio** flows
- **No WWE needed**

---

## Setup

### Step 1: Start the WebRTC Gateway Bridge
```bash
cd webrtc-gateway-bridge
npm start
```

**Expected:**
```
Bridge API running on https://localhost:8000
WebSocket server ready
```

### Step 2: Open WebRTC Client in Browser

Open: **https://103.167.180.166:8443/wwe-webrtc-gateway.html**

Or locally: **https://localhost:8443/wwe-webrtc-gateway.html**

### Step 3: Verify DN 1002 Registers

In the browser console (F12), you should see:
```
✅ SIP UA started
✅ Registering as DN: 1002
✅ Registered to SIP server
```

Check Asterisk CLI:
```bash
docker exec -it webrtc-asterisk asterisk -rvvv
pjsip show endpoints
```

**Should show:**
```
1002/1002    Online    1 of inf
```

---

## Test 1: Basic Call (No Auto-Answer)

### Make a call from 1003 → 1002

From Genesys or a SIP softphone, call **1002**.

### What Should Happen:

1. **Browser shows incoming call notification**
   - Browser console: `📞 Incoming call from: sip:1003@...`
   - Audio plays: Ringing sound

2. **Call appears in gateway UI** (if visible)

3. **Can answer manually** by clicking "Answer" or pressing button

4. **Audio should work** bidirectionally

---

## Test 2: Auto-Answer (Current Implementation)

The gateway has **auto-answer enabled** with 500ms delay.

### What Should Happen:

1. Call comes in from 1003 → 1002
2. **Gateway auto-answers after 500ms**
3. **Call connects immediately**
4. **Audio flows** (1003 can hear 1002, 1002 can hear 1003)

### Expected Browser Console:
```
📞 Incoming call from: sip:1003@192.168.210.81
⏱️  Auto-answering in 500ms...
✅ Call answered automatically
🔊 Call is now connected
```

### Expected Asterisk CLI:
```
<--- Received INVITE from 192.168.210.81 --->
-- Called PJSIP/1002
-- PJSIP/1002 is ringing
<--- Received 200 OK from WebRTC client --->
-- PJSIP/1002 answered
== Spawn extension exited
```

---

## Test 3: With NOTIFY Monitor (Extract CallUUID)

### Step 1: Deploy the monitor
```bash
cd /root/webrtc-genesys
bash scripts/deploy-sip-monitor-simple.sh
```

### Step 2: Watch monitor logs
```bash
tail -f /tmp/sip-notify-monitor.log
```

### Step 3: Make call from 1003 → 1002

### Expected Monitor Log:
```
[10:30:45] 📩 NOTIFY detected
[10:30:45]   DN: 1002
[10:30:45]   CallUUID: UIVB8J6JE91C53UIM3VI59VHQ400001T
[10:30:45] ✅ Bridge notified: DN=1002, CallUUID=UIVB8J6JE91C53UIM3VI59VHQ400001T
```

### Expected Bridge Log:
```
[Bridge] Received Genesys NOTIFY: DN=1002, CallUUID=UIVB8J6JE91C53UIM3VI59VHQ400001T
[Bridge] Storing CallUUID for DN 1002
```

### Expected Browser Console:
```
📞 Incoming call from: sip:1003@192.168.210.81
🎯 CallUUID available: UIVB8J6JE91C53UIM3VI59VHQ400001T
⏱️  Auto-answering in 500ms...
✅ Call answered automatically with CallUUID
```

---

## Troubleshooting

### Gateway not registering
```javascript
// Check browser console for errors
// Common issues:
// - WebSocket connection failed
// - SIP server unreachable
// - Wrong credentials
```

**Fix:** Check `wwe-webrtc-gateway.html` configuration:
- `sipUri`: Should be `sip:1002@192.168.210.54`
- `wsUri`: Should be `wss://192.168.210.54:8088/ws`
- Bridge API URL: Should be `https://localhost:8000` or bridge IP

### Call not arriving
```bash
# Check Asterisk routing
docker exec -it webrtc-asterisk asterisk -rvvv

# Check endpoint status
pjsip show endpoints

# Check if 1002 is reachable
pjsip qualify 1002
```

### Auto-answer not working
- Check browser console for JavaScript errors
- Verify `handleNewSession()` in `wwe-webrtc-gateway.html`
- Check that `autoAnswerDelay` is set (500ms)

### No audio
- Check WebRTC ICE candidates
- Verify STUN/TURN configuration
- Check firewall/NAT settings
- Verify RTP ports are open (10000-20000)

---

## Commands Reference

```bash
# Start bridge
cd webrtc-gateway-bridge && npm start

# Check Asterisk
docker exec -it webrtc-asterisk asterisk -rvvv

# View registrations
pjsip show endpoints

# View active calls
core show channels

# Deploy monitor
bash scripts/deploy-sip-monitor-simple.sh

# Watch monitor logs
tail -f /tmp/sip-notify-monitor.log

# Stop monitor
pkill -f sip-notify-parser.py
```

---

## Success Criteria

✅ **Basic Call Works:**
- 1002 registers via WebRTC
- Call from 1003 reaches 1002
- Can answer manually
- Audio works

✅ **Auto-Answer Works:**
- Call auto-answers after 500ms
- No timeout (30 seconds)
- Call connects immediately

✅ **NOTIFY Monitor Works:**
- Captures `X-Genesys-CallUUID`
- Sends to bridge
- Bridge stores CallUUID
- Gateway receives CallUUID

---

## Next: Add WWE Integration

Once the above works, WWE integration is straightforward:
1. WWE opens in iframe
2. WWE detects call via CallUUID
3. WWE shows call in UI
4. WWE can control call (hold, transfer, etc.)

But **test the basic call first** without WWE!
