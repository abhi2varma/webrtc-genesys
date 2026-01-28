# Bridge vs No Bridge - When Do You Need It?

## Architecture Overview

```
[Genesys SIP] ←→ [Asterisk] ←→ [WebRTC Client HTML]
                                      ↓
                                [Bridge (Electron)]
                                      ↓
                                   [WWE]
```

---

## Scenario 1: Basic WebRTC Calling (No WWE)

### What You Have:
- `https://103.167.180.166:8443/wwe-webrtc-gateway.html` (served by nginx)
- This HTML page has **JsSIP built-in**
- It connects **directly to Asterisk via WebSocket**

### Do You Need Bridge? **NO!**

The HTML page can:
- ✅ Register to SIP server (DN 1002)
- ✅ Receive incoming calls
- ✅ Auto-answer calls
- ✅ Handle audio/video
- ✅ Make outgoing calls

**Everything works standalone!**

### Test Without Bridge:
```bash
# Just open the browser
https://103.167.180.166:8443/wwe-webrtc-gateway.html

# Make call: 1003 → 1002
# It should work!
```

---

## Scenario 2: With WWE Integration

### What WWE Needs:
- WWE runs in an **iframe**
- WWE needs to know the **CallUUID** from Genesys
- WWE needs to query: "What's the CallUUID for DN 1002?"

### Do You Need Bridge? **YES!**

The bridge provides:
- ✅ `/genesys-call-notify` - Receives CallUUID from NOTIFY monitor
- ✅ `/api/get-call-uuid?dn=1002` - WWE queries CallUUID
- ✅ Coordination between monitor → bridge → WWE

### Flow With Bridge:
```
1. Genesys sends NOTIFY with X-Genesys-CallUUID
2. Monitor captures it → POST to bridge
3. Bridge stores: DN 1002 = CallUUID: ABC123
4. WWE asks bridge: "CallUUID for 1002?"
5. Bridge responds: "ABC123"
6. WWE fetches call details from Genesys API
7. WWE displays call in UI
```

---

## What Each Component Does

### HTML File (`wwe-webrtc-gateway.html`)
**Served by:** nginx on port 8443  
**Purpose:** WebRTC SIP client  
**Dependencies:** None (self-contained)
- Has JsSIP library embedded
- Connects directly to Asterisk WebSocket (wss://192.168.210.54:8088/ws)
- Handles all SIP signaling
- Auto-answer logic built-in

### Bridge (`webrtc-gateway-bridge`)
**Runs:** Electron app on port 8000  
**Purpose:** API server for WWE integration  
**Dependencies:** Needs to be running for WWE
- Provides REST API endpoints
- Stores CallUUID per DN
- Allows WWE to query call information
- **Not needed for basic calling!**

### NOTIFY Monitor (`sip-notify-monitor`)
**Runs:** tcpdump + Python parser  
**Purpose:** Extract CallUUID from SIP NOTIFY  
**Dependencies:** Needs bridge to be running
- Captures NOTIFY messages from Genesys
- Extracts X-Genesys-CallUUID
- Sends to bridge API
- **Not needed for basic calling!**

---

## Testing Scenarios

### ✅ Test 1: Basic Call (No Bridge, No WWE)

**What You Need:**
- Asterisk running
- nginx serving HTML
- Browser open to `https://103.167.180.166:8443/wwe-webrtc-gateway.html`

**What Works:**
- DN 1002 registers
- Call from 1003 arrives
- Auto-answer works
- Audio works

**Bridge Needed?** ❌ NO

---

### ✅ Test 2: With CallUUID (Bridge + Monitor, No WWE)

**What You Need:**
- Everything from Test 1
- Bridge running (port 8000)
- NOTIFY monitor running

**What Works:**
- Everything from Test 1 PLUS:
- Monitor captures CallUUID
- Bridge receives CallUUID
- You can query: `curl https://localhost:8000/api/get-call-uuid?dn=1002`

**Bridge Needed?** ✅ YES (for CallUUID storage)

---

### ✅ Test 3: Full WWE Integration

**What You Need:**
- Everything from Test 2
- WWE loaded in iframe
- WWE configured to use bridge API

**What Works:**
- Call appears in WWE UI
- WWE can control call
- Full Genesys integration

**Bridge Needed?** ✅ YES (WWE depends on it)

---

## So What Should You Test First?

### Option A: Simplest Test (No Bridge)
```bash
# Just open browser
https://103.167.180.166:8443/wwe-webrtc-gateway.html

# Call 1003 → 1002
# Should auto-answer and work!
```

**Verifies:**
- WebRTC stack works
- SIP registration works
- Auto-answer works
- Audio works

### Option B: With Bridge (Full Flow)
```bash
# Terminal 1: Start bridge
cd webrtc-gateway-bridge
npm start

# Terminal 2: Deploy monitor
bash scripts/deploy-sip-monitor-simple.sh

# Browser: Open HTML
https://103.167.180.166:8443/wwe-webrtc-gateway.html

# Call 1003 → 1002
```

**Verifies:**
- Everything from Option A PLUS:
- NOTIFY capture works
- CallUUID extraction works
- Bridge API works

---

## Recommendation

**Start with Option A** (no bridge):
1. Test basic calling first
2. Verify auto-answer works
3. Verify audio works

**Then move to Option B** (with bridge):
1. Deploy monitor
2. Start bridge
3. Verify CallUUID capture

**Finally add WWE** (when ready):
1. Load WWE in iframe
2. Configure WWE to query bridge
3. Test full integration

---

## Summary

| Feature | Need Bridge? | Need Monitor? |
|---------|-------------|---------------|
| Basic WebRTC call | ❌ No | ❌ No |
| Auto-answer | ❌ No | ❌ No |
| Audio/Video | ❌ No | ❌ No |
| CallUUID extraction | ✅ Yes | ✅ Yes |
| WWE integration | ✅ Yes | ✅ Yes |

**TL;DR:** Bridge is only needed for **CallUUID storage** and **WWE integration**. For basic calling, the HTML file works standalone!
