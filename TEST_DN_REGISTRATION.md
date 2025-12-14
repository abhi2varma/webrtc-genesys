# Testing DN Registration on Genesys SIP Server

## Overview

This guide walks you through testing DN (Directory Number) registration from your WebRTC client through Asterisk to the Genesys SIP Server.

## Architecture Flow

```
┌──────────────┐    WebSocket/SIP    ┌──────────┐    SIP/UDP    ┌──────────────┐
│ WebRTC Client│ ◄─────────────────► │ Asterisk │ ◄───────────► │   Genesys    │
│  (Browser)   │   ws://localhost:   │ Gateway  │  192.168.210  │ SIP Server   │
│              │      8088/ws        │          │   .81:5060    │              │
└──────────────┘                     └──────────┘               └──────────────┘
   DN: 5001                             Proxy                    Registration
```

---

## Step 1: Verify Services Are Running

Before testing, ensure all Docker containers are running:

```powershell
docker-compose ps
```

**Expected Output:**
```
NAME              STATUS
webrtc-asterisk   Up (healthy)
webrtc-nginx      Up
webrtc-coturn     Up
```

---

## Step 2: Open WebRTC Client

1. Open browser and navigate to: **http://localhost/**
2. You should see the WebRTC client interface with:
   - **GWS (CTI) Settings** section (top)
   - **Connection Settings** section (middle)
   - **Call Controls** section (bottom)

---

## Step 3: Configure SIP Connection

In the **Connection Settings** section:

### Option A: Use Pre-configured Values (Recommended)

The form should already be filled with:
- **SIP Server**: `ws://localhost:8088/ws`
- **Agent DN**: `5001`
- **Password**: `GenesysAgent5001!`

### Option B: Try Different Agent DNs

Available DNs (configured in Asterisk):

| DN | Password |
|----|----------|
| 5001 | GenesysAgent5001! |
| 5002 | GenesysAgent5002! |
| 5003 | GenesysAgent5003! |
| ... | ... |
| 5020 | GenesysAgent5020! |

---

## Step 4: Register the DN

1. Click the **"Connect"** button
2. Watch the **Connection Status** indicator:
   - 🔴 **Disconnected** → Initial state
   - 🟡 **Connecting...** → Attempting registration
   - 🟢 **Connected** → Successfully registered

3. Check the **Debug Console** (bottom of page) for messages like:
   ```
   [14:23:45] Connecting to ws://localhost:8088/ws as 5001...
   [14:23:46] WebSocket connected
   [14:23:47] Registered successfully as 5001
   ```

---

## Step 5: Verify Registration in Asterisk

### Method 1: Check via Docker Logs

```powershell
docker logs webrtc-asterisk | Select-String "5001" | Select-Object -Last 10
```

**Expected Output:**
```
Added contact 'sip:xxx@xxx:xxxxx;transport=WS' to AOR '5001'
PJSIP/5001 is now Reachable
```

### Method 2: Check via Asterisk CLI

```powershell
docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints" | Select-String "5001"
```

**Expected Output:**
```
Endpoint:  5001                         Not in use    0 of inf
```

### Method 3: Show Detailed Registration

```powershell
docker exec webrtc-asterisk asterisk -rx "pjsip show endpoint 5001"
```

**Look for:**
- **Contact**: Shows the WebSocket connection
- **Status**: Should be "Reachable" or "Unknown"
- **Transport**: transport-wss or transport-ws

---

## Step 6: Verify Connection to Genesys

### Check if Asterisk is Connected to Genesys SIP Server

```powershell
docker exec webrtc-asterisk asterisk -rx "pjsip show endpoint genesys_sip_server"
```

**Look for:**
- **Contact**: `sip:192.168.210.81:5060`
- **Status**: Should show connection status to Genesys

### Check PJSIP Registrations (if using registration mode)

```powershell
docker exec webrtc-asterisk asterisk -rx "pjsip show registrations"
```

**Expected Output:**
```
<Registration/ServerURI..............................>  <State.......>
genesys_sip_server/sip:192.168.210.81                 Registered
```

---

## Step 7: Test Call Flow (Optional)

### Test Internal Call (Agent to Agent)

If you have two browser windows:

1. **Window 1**: Register as DN 5001
2. **Window 2**: Register as DN 5002
3. **Window 1**: Dial `5002` and click "Call"
4. **Window 2**: Should show incoming call notification

**Call Flow:**
```
5001 → Asterisk → Genesys SIP → Asterisk → 5002
```

### Test Outbound Call via Genesys

1. Register as DN 5001
2. Dial a test number (e.g., `600` for echo test)
3. Click "Call"
4. Call should be routed through Genesys

---

## Troubleshooting

### Issue 1: "Connecting..." Stuck

**Problem:** Status stays on "Connecting..." and never changes.

**Check:**
```powershell
# Verify Asterisk HTTP server
docker exec webrtc-asterisk asterisk -rx "http show status"
```

**Expected:**
```
HTTP Server Status:
Enabled
Port: 8088
```

**Fix:**
```powershell
# Restart Asterisk
docker-compose restart asterisk

# Check if port 8088 is accessible
Test-NetConnection localhost -Port 8088
```

---

### Issue 2: "Registration Failed" or 403 Forbidden

**Problem:** Authentication failed.

**Check:**
1. Verify the password is correct: `GenesysAgent5001!`
2. Check Asterisk logs:
   ```powershell
   docker logs webrtc-asterisk --tail 20 | Select-String "401\|403\|auth"
   ```

**Fix:**
- Verify DN configuration in `asterisk/etc/pjsip.conf`
- Ensure username/password match

---

### Issue 3: WebSocket Connection Refused

**Problem:** Cannot connect to ws://localhost:8088/ws

**Check:**
```powershell
# Verify port is mapped
docker ps | Select-String "8088"
```

**Expected:**
```
0.0.0.0:8088->8088/tcp
```

**Fix:**
```powershell
# Restart services
docker-compose restart
```

---

### Issue 4: Registered but No Connection to Genesys

**Problem:** WebRTC client connects to Asterisk, but Asterisk can't reach Genesys.

**Check:**
```powershell
docker exec webrtc-asterisk asterisk -rx "pjsip show endpoint genesys_sip_server"
```

**Look for errors:**
- "Unavailable" - Genesys not reachable
- "No such endpoint" - Configuration issue

**Fix:**
1. Verify Genesys SIP Server is accessible:
   ```powershell
   Test-NetConnection 192.168.210.81 -Port 5060
   ```

2. Check firewall allows UDP 5060

3. Verify `pjsip.conf` has correct Genesys IP

---

### Issue 5: "JsSIP is not defined" Error

**Problem:** JavaScript error in browser console.

**Check:**
- Press F12 in browser → Console tab
- Look for: `Uncaught ReferenceError: JsSIP is not defined`

**Fix:**
- Verify `jssip.min.js` exists:
  ```powershell
  Test-Path "D:\Abhi\WebRTC\webrtc-genesys\nginx\html\jssip.min.js"
  ```
- If missing, copy from desktop again

---

## Verification Checklist

Use this checklist to verify successful DN registration:

- [ ] ✅ WebRTC client loads without errors
- [ ] ✅ Click "Connect" button
- [ ] ✅ Status changes to "Connected" (green)
- [ ] ✅ Asterisk logs show: "Added contact... to AOR '5001'"
- [ ] ✅ `pjsip show endpoint 5001` shows "Not in use"
- [ ] ✅ `pjsip show endpoint genesys_sip_server` shows Genesys contact
- [ ] ✅ Debug console shows "Registered successfully"
- [ ] ✅ No JavaScript errors in browser console (F12)

---

## Success Indicators

### 1. In WebRTC Client (Browser)

```
✅ Connection Status: Connected
✅ Debug Console: "Registered successfully as 5001"
✅ Call button is enabled
```

### 2. In Asterisk (Docker)

```powershell
docker exec webrtc-asterisk asterisk -rx "pjsip show contacts"
```

**Expected:**
```
Contact:  5001/sip:xxx@xxx:xxxxx;transport=WS <Hash....> NonQual nan
```

### 3. Between Asterisk and Genesys

The registration flow:

1. **WebRTC → Asterisk**: DN 5001 registers via WebSocket
2. **Asterisk → Genesys**: Asterisk forwards calls via `outbound_proxy`
3. **Genesys**: Recognizes calls from Asterisk IP (192.168.210.54)

---

## Next Steps After Successful Registration

Once DN registration is working locally:

1. **Test call flow** - Make a test call
2. **Integrate with GWS** - Connect CometD for CTI events
3. **Deploy to CentOS** - Use same configuration on production server
4. **Configure Genesys** - Ensure Genesys recognizes DNs 5001-5020

---

## Quick Reference Commands

```powershell
# View all registered endpoints
docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints"

# View specific DN
docker exec webrtc-asterisk asterisk -rx "pjsip show endpoint 5001"

# View Genesys connection
docker exec webrtc-asterisk asterisk -rx "pjsip show endpoint genesys_sip_server"

# Enable SIP debugging
docker exec webrtc-asterisk asterisk -rx "pjsip set logger on"

# Watch Asterisk logs in real-time
docker logs -f webrtc-asterisk

# Restart services
docker-compose restart

# Stop all services
docker-compose down

# Start all services
docker-compose up -d
```

---

## Contact Flow Diagram

```
Registration:
┌──────────┐         ┌──────────┐         ┌──────────┐
│ WebRTC   │  REGISTER │ Asterisk │         │ Genesys  │
│ Client   │──────────►│          │         │ SIP      │
│ (5001)   │◄──────────│  Proxy   │         │ Server   │
│          │  200 OK   │          │         │          │
└──────────┘           └──────────┘         └──────────┘

Call Flow (Agent calls external number):
┌──────────┐         ┌──────────┐         ┌──────────┐
│ WebRTC   │  INVITE  │ Asterisk │  INVITE  │ Genesys  │
│ Client   │──────────►│          │──────────►│ SIP      │
│ (5001)   │          │  Proxy   │          │ Server   │
│          │  200 OK  │          │  200 OK  │          │
│          │◄──────────│          │◄──────────│          │
│          │          │          │          │          │
│          │◄────RTP───────────────────RTP──►│          │
└──────────┘           └──────────┘         └──────────┘
```

---

## Summary

**To test DN registration:**

1. Open http://localhost/
2. Verify form shows: `ws://localhost:8088/ws`, DN `5001`, Password `GenesysAgent5001!`
3. Click "Connect"
4. Wait for green "Connected" status
5. Verify in Asterisk: `docker exec webrtc-asterisk asterisk -rx "pjsip show endpoint 5001"`

**Success means:**
- WebRTC client shows "Connected"
- Asterisk shows contact for DN 5001
- You can make test calls

**The DN is registered to Asterisk, which proxies to Genesys SIP Server at 192.168.210.81:5060**

