# Electron App + WWE Voice Testing Guide

## Prerequisites

1. **Server Setup** (on CentOS/Linux server)
   - All Docker services running: `sudo docker-compose ps`
   - Kamailio Contact header fix deployed
   - Nginx properly configured

2. **Local Setup** (on Windows development machine)
   - Electron app ready to run
   - Network access to server IPs (103.167.180.166 or 192.168.210.54)
   - Port 8000 available for Electron bridge API

3. **Genesys Configuration**
   - DN 1002 configured as WebRTC device in Genesys
   - DN 1003 configured for testing
   - Both DNs assigned to test agents

## Step 1: Deploy Contact Header Fix to Server

**On the server:**

```bash
cd /opt/gcti_apps/webrtc-genesys
sudo bash scripts/deploy-contact-header-fix.sh
```

**Expected Output:**
```
========================================
Kamailio Contact Header Fix Deployment
========================================

📥 Pulling latest code from repository...
✅ Code pulled successfully

📝 Current Kamailio Contact header configuration:
        # Rewrite Contact header to Asterisk's address for Genesys
        # This ensures Genesys routes calls back to Asterisk, not the client's direct IP
        $var(asterisk_contact) = "sip:" + $var(dn) + "@192.168.210.54:5060";

🔄 Restarting Kamailio...
✅ Kamailio restarted successfully

🔍 Verifying Kamailio status...
✅ Kamailio is running

========================================
✅ Deployment Complete
========================================
```

**Verify Kamailio is running:**
```bash
sudo docker-compose ps kamailio
```

Should show: `Up` status

## Step 2: Start Electron App (DN 1002)

**On Windows development machine:**

```powershell
cd D:\Abhi\WebRTC\webrtc-genesys\webrtc-gateway-bridge
npm start
```

**Expected Output:**
```
> webrtc-gateway-bridge@1.0.0 start
> electron src/main.js

[2026-01-23 21:00:00] info: WebRTC Gateway Bridge starting...
[2026-01-23 21:00:01] info: WebRTC iframe window created
[2026-01-23 21:00:02] info: Bridge API server listening on https://127.0.0.1:8000
[2026-01-23 21:00:02] info: Dashboard available at https://127.0.0.1:8000/dashboard
[2026-01-23 21:00:03] info: WebRTC gateway loaded successfully
```

**What happens:**
- Electron window opens showing the WebRTC gateway
- HTTPS API server starts on `https://127.0.0.1:8000`
- System tray icon appears showing "Offline"

**Verify Electron API:**
```powershell
# In a new PowerShell window
curl -k https://127.0.0.1:8000/health
```

Expected response:
```json
{"status":"ok","registered":false,"dn":null,"callActive":false}
```

## Step 3: Login to WWE with DN 1002

**Open WWE in browser:**
- URL: `http://192.168.210.54:8090/ui` (or HTTPS version)
- Username: `test1` (or whatever agent user is assigned to DN 1002)
- Password: Your Genesys password

**What should happen:**

1. **WWE Login Process:**
   - WWE calls `/RegisterDn` on Electron app
   - Electron app logs: `RegisterDn called { addresses: [...], users: ['1002'] }`
   - Electron sends `sign_in` command to WebRTC gateway

2. **WebRTC Gateway Registration:**
   - Gateway connects to `wss://103.167.180.166:8443/ws`
   - Sends SIP REGISTER to Kamailio
   - Kamailio rewrites Contact header
   - Forwards REGISTER to Genesys SIP Server (192.168.210.81)
   - Genesys SIP Server sends 200 OK
   - Gateway logs: `✅ SIP registered successfully`

3. **T-Server Notification:**
   - T-Server sees DN 1002 as "Active"
   - WWE device status changes from "Out of Service" to "Active"
   - **IMPORTANT:** Wait 3-5 seconds for T-Server to process the registration

4. **WWE Agent State:**
   - WWE should now show DN 1002 as "Ready"
   - You should be able to change agent state (e.g., to "Ready")

**Verify Registration on Server:**

```bash
# On the server
sudo docker-compose exec asterisk asterisk -rx "pjsip show contacts"
```

Expected output:
```
Contact:  <Aor/ContactUri..............................>
==========================================================
Contact:  1002/sip:xxxxx@192.168.210.54:13986;transport  Avail
Objects found: 1
```

**Check Kamailio Logs:**
```bash
sudo docker-compose logs -f kamailio | grep -E "REGISTER|Contact"
```

Should show:
```
Sending REGISTER to Genesys for DN 1002
Contact: sip:1002@192.168.210.54:5060
```

## Step 4: Monitor Electron App for Incoming Calls

**Check Electron logs for polling:**

WWE should be calling `/GetIncomingCall` periodically. Watch the Electron console:

```
[2026-01-23 21:05:01] info: GetIncomingCall called
[2026-01-23 21:05:03] info: GetIncomingCall called
[2026-01-23 21:05:05] info: GetIncomingCall called
```

If you **don't see these logs**, it means WWE is **not polling** for incoming calls. This needs to be investigated.

**Verify manually:**
```powershell
# In PowerShell
curl -k https://127.0.0.1:8000/GetIncomingCall
```

Expected response (no incoming call):
```json
{"hasIncomingCall":false}
```

## Step 5: Test Incoming Call (1003 → 1002)

**Setup:**
- Agent 1002 is logged into WWE via Electron app (from Step 3)
- Agent 1003 can be another WWE session OR a regular Genesys softphone

**Make the call:**
1. From DN 1003, dial `1002`
2. Call should route: 1003 → T-Server → Genesys SIP → Asterisk → Electron app

**Expected Behavior:**

### On Electron App (DN 1002):

**Console logs:**
```
[2026-01-23 21:10:00] info: 📞 New RTC Session: remote
[2026-01-23 21:10:00] info: Incoming call from 1003
[2026-01-23 21:10:00] info: WebRTC event received: { event: 'incoming_call', data: { from: '1003', displayName: 'test3' } }
```

**System tray tooltip:**
```
WebRTC Gateway Bridge
Status: Online
DN: 1002
Call: Incoming from 1003
```

**Electron window:**
- Should show "Incoming: 1003" in the UI
- Call should be ringing

### On WWE (DN 1002):

**If WWE polling works:**
- WWE polls `/GetIncomingCall` and receives:
  ```json
  {
    "hasIncomingCall": true,
    "callerId": "1003",
    "timestamp": 1706043000000
  }
  ```
- WWE shows incoming call notification
- "Answer" button becomes active

**If WWE polling doesn't work:**
- No incoming call notification in WWE
- You'll need to manually test the `/AnswerCall` endpoint

## Step 6: Answer Call from WWE

**In WWE UI:**
- Click the "Answer" button

**What should happen:**

1. **WWE sends request:**
   ```
   POST https://127.0.0.1:8000/AnswerCall
   ```

2. **Electron logs:**
   ```
   [2026-01-23 21:10:05] info: AnswerCall called
   [2026-01-23 21:10:05] info: Sending WebRTC command: { command: 'answer_call', data: {} }
   ```

3. **WebRTC Gateway:**
   - Calls `session.answer()` on JsSIP session
   - Sends SIP 200 OK to Asterisk
   - Sets up audio streams

4. **Gateway logs:**
   ```
   ✅ Call accepted
   🟢 PHASE 10 - Call confirmed (DTLS handshake complete)
   ```

5. **Electron event:**
   ```
   [2026-01-23 21:10:06] info: WebRTC event received: { event: 'call_accepted', data: { direction: 'incoming', otherParty: '1003' } }
   ```

6. **Audio should connect:**
   - Both parties can hear each other
   - Audio flows: 1003 ↔ Asterisk ↔ WebRTC (via Electron)

**Verify audio:**
- Speak into microphone on DN 1003 side
- Should hear audio on DN 1002 Electron app
- Vice versa

## Step 7: Hangup Call

**In WWE UI:**
- Click "Hangup" button

**What should happen:**

1. **WWE sends request:**
   ```
   POST https://127.0.0.1:8000/HangUp
   ```

2. **Electron logs:**
   ```
   [2026-01-23 21:11:00] info: HangUp called
   [2026-01-23 21:11:00] info: Sending WebRTC command: { command: 'hangup', data: {} }
   ```

3. **WebRTC Gateway:**
   - Calls `session.terminate()` on JsSIP session
   - Sends SIP BYE to Asterisk

4. **Gateway logs:**
   ```
   📴 Call ended
   ```

5. **Electron event:**
   ```
   [2026-01-23 21:11:01] info: WebRTC event received: { event: 'call_ended', data: {} }
   ```

6. **WWE:**
   - Call state changes to "Ended"
   - Agent returns to "Ready" state

## Step 8: Test Outbound Call (1002 → 1003)

**In WWE UI (logged in as DN 1002):**
- Enter destination: `1003`
- Click "Make Call"

**What should happen:**

1. **WWE sends request:**
   ```
   POST https://127.0.0.1:8000/MakeCall
   Body: { "destination": "1003" }
   ```

2. **Electron logs:**
   ```
   [2026-01-23 21:12:00] info: MakeCall called { destination: '1003' }
   [2026-01-23 21:12:00] info: Sending WebRTC command: { command: 'make_call', data: { destination: '1003' } }
   ```

3. **WebRTC Gateway:**
   - Initiates SIP INVITE via JsSIP
   - Call flows: Electron → Asterisk → Genesys SIP → T-Server → DN 1003

4. **DN 1003:**
   - Receives incoming call notification
   - Answers call
   - Audio connects

## Troubleshooting

### Issue 1: WWE doesn't show "Active" after login

**Symptoms:**
- Electron app shows registered
- WWE shows "Out of Service"

**Possible Causes:**
1. Registration didn't reach T-Server
2. Contact header still wrong
3. Not waiting long enough for T-Server

**Solutions:**
```bash
# Check Asterisk contacts
sudo docker-compose exec asterisk asterisk -rx "pjsip show contacts"

# Check Kamailio logs for Contact rewriting
sudo docker-compose logs kamailio | grep -E "REGISTER|Contact"

# Check if DN is registered to Genesys
sudo docker-compose exec asterisk asterisk -rx "pjsip show registrations"
```

### Issue 2: Incoming call doesn't show in WWE

**Symptoms:**
- Electron app receives incoming call (logs show "Incoming call from...")
- WWE doesn't show notification

**Possible Causes:**
1. WWE is not polling `/GetIncomingCall`
2. T-Server didn't route the call properly

**Solutions:**
```powershell
# Manually check if incoming call state is set
curl -k https://127.0.0.1:8000/GetIncomingCall
```

If response shows `"hasIncomingCall": true`, then Electron is working correctly. The issue is with WWE not polling.

**WWE Configuration Check:**
- Verify WWE device configuration points to `https://127.0.0.1:8000`
- Check WWE browser console for errors
- Try manually calling `/AnswerCall`:
  ```powershell
  curl -k -X POST https://127.0.0.1:8000/AnswerCall
  ```

### Issue 3: Audio doesn't work after answering

**Symptoms:**
- Call connects (WWE shows "In Call")
- No audio in one or both directions

**Possible Causes:**
1. WebRTC media ports blocked
2. COTURN not working
3. Firewall blocking RTP

**Solutions:**
```bash
# Check COTURN logs
sudo docker-compose logs -f coturn

# Verify Asterisk RTP ports
sudo docker-compose exec asterisk asterisk -rx "rtp show settings"

# Check if media is flowing
sudo docker-compose exec asterisk asterisk -rx "core show channels"
```

### Issue 4: Registration works but calls fail immediately

**Symptoms:**
- DN shows "Active" in WWE
- Calls fail with "Not Found" or "Request Timeout"

**Possible Causes:**
1. Contact header still not rewritten correctly
2. Genesys routing configuration issue

**Solutions:**
```bash
# Capture full SIP trace
sudo docker-compose exec asterisk asterisk -rx "pjsip set logger on"

# Make a test call and check logs
sudo docker-compose logs -f asterisk | grep -A 20 "INVITE"
```

### Issue 5: Electron app crashes or freezes

**Symptoms:**
- Electron window becomes unresponsive
- API stops responding

**Solutions:**
1. Check for port 8000 conflicts:
   ```powershell
   netstat -ano | findstr :8000
   ```

2. Kill any orphaned processes:
   ```powershell
   # Find process ID
   Get-Process -Name electron
   # Kill it
   taskkill /F /PID <process_id>
   ```

3. Restart Electron app

## Success Criteria

✅ **Registration Test:**
- [ ] Electron app registers successfully (logs show "SIP registered")
- [ ] Asterisk shows contact for DN 1002 as "Avail"
- [ ] WWE shows DN 1002 as "Active" (not "Out of Service")
- [ ] Agent can change state to "Ready"

✅ **Incoming Call Test:**
- [ ] Electron app receives incoming call (logs show "Incoming call from...")
- [ ] WWE shows incoming call notification (if polling works)
- [ ] Manual `/GetIncomingCall` returns correct caller ID
- [ ] Click "Answer" in WWE triggers `/AnswerCall`
- [ ] Audio connects and works bidirectionally

✅ **Call Control Test:**
- [ ] Hangup button in WWE properly terminates call
- [ ] Electron app receives and executes hangup command
- [ ] Call state resets correctly

✅ **Outbound Call Test:**
- [ ] Make call from WWE triggers `/MakeCall` on Electron
- [ ] Call routes through T-Server to destination
- [ ] Audio works bidirectionally

## Next Steps After Testing

1. **If all tests pass:**
   - Document WWE configuration for device setup
   - Create user guide for agents
   - Test with multiple DNs simultaneously

2. **If WWE polling doesn't work:**
   - Investigate WWE device configuration
   - May need to implement WebSocket push notifications
   - Or configure WWE to use different call detection mechanism

3. **If Contact header still wrong:**
   - Re-verify Kamailio configuration
   - Check if correct Kamailio config file is being used
   - Ensure Docker mount is correct

4. **Performance testing:**
   - Test with multiple concurrent calls
   - Measure audio quality
   - Check for memory leaks in Electron app
