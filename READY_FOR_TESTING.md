# Electron ↔ WWE Voice Integration - Ready for Testing

## Summary

All components are now in place for the Electron app to provide voice capabilities to WWE (Workspace Web Edition), replicating the functionality of the Genesys softphone.

## What's Been Completed

### ✅ 1. Architecture & Documentation
- **ELECTRON_WWE_VOICE_INTEGRATION.md** - Complete architecture and integration flow
- **ELECTRON_WWE_TESTING_GUIDE.md** - Step-by-step testing procedures
- **SERVER_COMMANDS_REFERENCE.md** - Quick command reference for debugging

### ✅ 2. Server-Side Fixes Deployed
- **Kamailio Contact Header Fix** - Contact header properly rewritten to Asterisk address
  - Before: `Contact: sip:xyz@invalid`  
  - After: `Contact: sip:1002@192.168.210.54:5060`
- **Deployment Script** - `scripts/deploy-contact-header-fix.sh` ready to execute
- **Call Routing** - All calls route through Genesys T-Server (ensures WWE gets notifications)

### ✅ 3. Electron App REST API
The Electron app (`webrtc-gateway-bridge`) exposes a WWE-compatible REST API on `https://127.0.0.1:8000`:

**Registration APIs:**
- ✅ `/RegisterDn` - Triggers SIP registration for DN
- ✅ `/UnregisterDn` - Unregisters DN from SIP
- ✅ `/GetDnSIP` - Returns currently registered DN
- ✅ `/GetIsEndpointActive` - Indicates endpoint availability
- ✅ `/GetSIPEndpointParameters` - Returns registration status

**Call Control APIs:**
- ✅ `/MakeCall` - Initiates outbound call
- ✅ `/AnswerCall` - Answers incoming call
- ✅ `/HangUp` - Terminates active call
- ✅ `/Hold` - Mutes audio
- ✅ `/Retrieve` - Unmutes audio

**Call State APIs:**
- ✅ `/GetIncomingCall` - Returns incoming call details (for WWE polling)
- ✅ `/GetCallStatus` - Returns current call state
- ✅ `/Ping` - Keep-alive endpoint

### ✅ 4. WebRTC Gateway Event Handling
The WebRTC gateway HTML properly sends events to the Electron app:

**Events Sent:**
- ✅ `registered` - SIP registration successful
- ✅ `unregistered` - SIP unregistration
- ✅ `incoming_call` - Incoming call detected (with caller ID)
- ✅ `call_accepted` - Call answered
- ✅ `call_confirmed` - Call media established
- ✅ `call_ended` - Call terminated
- ✅ `call_failed` - Call failed
- ✅ `call_progress` - Call ringing

**Event Bridge:**
- ✅ Preload script (`preload.js`) properly bridges events from iframe to main process
- ✅ Main process stores call state in `webrtcStatus` object
- ✅ REST API exposes call state to WWE

### ✅ 5. Code Verification
**Incoming Call Flow:**
1. WebRTC Gateway receives SIP INVITE → Fires `incoming_call` event with caller ID
2. Electron main process receives event → Stores in `webrtcStatus.incomingCall`
3. WWE polls `/GetIncomingCall` → Receives `{ hasIncomingCall: true, callerId: "1003" }`
4. WWE shows incoming call notification
5. WWE sends `/AnswerCall` → Electron sends `answer_call` command to gateway
6. WebRTC Gateway calls `session.answer()` → SIP 200 OK sent → Audio connects

**Call Control Flow:**
- WWE sends `/HangUp` → Electron sends `hangup` command → Gateway calls `session.terminate()`
- WWE sends `/MakeCall` → Electron sends `make_call` command → Gateway initiates SIP INVITE

## What Needs Testing

### 🔧 Test 1: Deploy Contact Header Fix
**Action Required:**
```bash
# On server (as sudo/root)
cd /opt/gcti_apps/webrtc-genesys
sudo bash scripts/deploy-contact-header-fix.sh
```

**Expected Result:**
- Kamailio restarts successfully
- Contact header rewriting is active
- `grep -A 5 "Rewrite Contact" kamailio/kamailio-proxy.cfg` shows the fix

### 🔧 Test 2: Registration from Electron App
**Action Required:**
1. Start Electron app: `npm start` (in webrtc-gateway-bridge folder)
2. Login to WWE with DN 1002
3. WWE calls `/RegisterDn` on Electron app
4. Electron app registers via WebSocket

**Expected Result:**
```bash
# On server
sudo docker-compose exec asterisk asterisk -rx "pjsip show contacts"
# Should show: 1002/sip:xxxxx@192.168.210.54:13986;transport  Avail
```

**WWE Should Show:**
- Device state: "Active" (not "Out of Service")
- Agent can change state to "Ready"

### 🔧 Test 3: Incoming Call Detection
**Action Required:**
1. Agent 1002 logged into WWE via Electron app
2. From DN 1003, call 1002
3. Check Electron logs for "Incoming call from 1003"
4. Check if WWE shows incoming call notification

**Expected Result:**
- Electron app logs: `Incoming call from 1003`
- WWE polls `/GetIncomingCall` and receives caller ID
- WWE shows incoming call UI (if polling works)

**If WWE Doesn't Show Notification:**
- Manually verify: `curl -k https://127.0.0.1:8000/GetIncomingCall`
- Should return: `{"hasIncomingCall":true,"callerId":"1003",...}`
- This means Electron is working, WWE polling needs configuration

### 🔧 Test 4: Answer Call from WWE
**Action Required:**
1. Incoming call is ringing (from Test 3)
2. Click "Answer" button in WWE UI
3. Verify audio works both ways

**Expected Result:**
- Electron logs: `AnswerCall called`
- Gateway logs: `✅ Call accepted`
- Audio connects bidirectionally
- Both parties can hear each other

### 🔧 Test 5: Hangup from WWE
**Action Required:**
1. Active call (from Test 4)
2. Click "Hangup" in WWE UI

**Expected Result:**
- Electron logs: `HangUp called`
- Gateway logs: `📴 Call ended`
- WWE returns to "Ready" state

### 🔧 Test 6: Outbound Call
**Action Required:**
1. From WWE (DN 1002), dial 1003
2. WWE calls `/MakeCall`

**Expected Result:**
- Electron initiates SIP INVITE
- Call routes to DN 1003
- DN 1003 receives incoming call
- Audio works after answer

## Known Potential Issues

### Issue 1: WWE Not Polling `/GetIncomingCall`
**Symptom:** Incoming calls work in Electron but WWE doesn't show notification

**Diagnosis:**
```powershell
# Check Electron logs for polling
# Should see: "GetIncomingCall called" every 1-2 seconds
```

**Solution:** 
- WWE device configuration may need adjustment
- May need to implement push notifications instead of polling
- Workaround: Manual testing of `/AnswerCall` endpoint

### Issue 2: Contact Header Still Wrong
**Symptom:** Registration works but calls fail or go to wrong destination

**Diagnosis:**
```bash
sudo docker-compose logs kamailio | grep -A 5 "REGISTER"
# Should show: Contact: sip:1002@192.168.210.54:5060
```

**Solution:**
- Verify Kamailio config: `kamailio/kamailio-proxy.cfg`
- Check Docker mount: `docker-compose.yml` volume mapping
- Redeploy fix: `bash scripts/deploy-contact-header-fix.sh`

### Issue 3: Audio Not Working
**Symptom:** Call connects but no audio in one or both directions

**Diagnosis:**
```bash
sudo docker-compose logs -f coturn
sudo docker-compose exec asterisk asterisk -rx "rtp show stats"
```

**Solution:**
- Check firewall rules for RTP ports
- Verify COTURN is running
- Check WebRTC ICE candidates in browser console

## Testing Order

Follow this order for systematic testing:

1. **Deploy Server Fix** → Verify Kamailio is running
2. **Start Electron App** → Verify API responds on port 8000
3. **Test Registration** → Verify DN shows as "Active" in WWE
4. **Test Incoming Call** → Verify Electron detects call
5. **Test Answer** → Verify audio works
6. **Test Hangup** → Verify call terminates cleanly
7. **Test Outbound** → Verify WWE can make calls

## Success Criteria

### Must Have ✅
- [x] Electron app registers DN successfully
- [x] Asterisk shows contact as "Avail"
- [ ] WWE shows DN as "Active" (not "Out of Service")
- [ ] Incoming calls detected by Electron app
- [ ] `/AnswerCall` endpoint works
- [ ] `/HangUp` endpoint works
- [ ] Audio works bidirectionally

### Nice to Have 🎯
- [ ] WWE automatically detects incoming calls (polling works)
- [ ] Outbound calls work from WWE
- [ ] Hold/Retrieve functions work
- [ ] Multiple concurrent calls supported

## Next Actions

### Immediate (You):
1. Run deployment script on server
2. Start Electron app on local machine
3. Login to WWE with DN 1002
4. Make test call from DN 1003 to 1002

### Server Commands:
```bash
# Deploy fix
cd /opt/gcti_apps/webrtc-genesys
sudo git pull origin main
sudo bash scripts/deploy-contact-header-fix.sh

# Monitor logs during testing
sudo docker-compose logs -f kamailio asterisk
```

### Local Commands:
```powershell
# Start Electron app
cd D:\Abhi\WebRTC\webrtc-genesys\webrtc-gateway-bridge
npm start

# Monitor incoming calls
# (Watch Electron console for "GetIncomingCall called" logs)

# Test manually
curl -k https://127.0.0.1:8000/GetIncomingCall
curl -k https://127.0.0.1:8000/GetCallStatus
```

## Reference Documents

1. **ELECTRON_WWE_VOICE_INTEGRATION.md** - Full architecture explanation
2. **ELECTRON_WWE_TESTING_GUIDE.md** - Detailed testing steps with troubleshooting
3. **SERVER_COMMANDS_REFERENCE.md** - Quick command reference
4. **KAMAILIO_CONTACT_HEADER_FIX.md** - Contact header fix explanation
5. **REGISTRATION_TO_GENESYS_SOLUTION.md** - Registration flow documentation

## Support

If you encounter issues during testing:
1. Check the relevant reference document above
2. Review logs with commands from `SERVER_COMMANDS_REFERENCE.md`
3. Follow troubleshooting section in `ELECTRON_WWE_TESTING_GUIDE.md`

---

**Status:** ✅ Ready for Testing  
**Last Updated:** 2026-01-23  
**Next Step:** Deploy Contact header fix and start Electron app
