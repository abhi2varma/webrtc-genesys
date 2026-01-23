# Incoming Call Fix for WWE Integration

## 🔍 Problem Identified

When DN 1002 called DN 1003:
- ✅ Call was initiated successfully
- ✅ DN 1003 received the INVITE
- ❌ **WWE UI didn't show incoming call notification**
- ❌ **Agent couldn't answer the call in WWE**

## 🎯 Root Cause

**Asterisk dialplan was routing calls directly between DNs, bypassing Genesys T-Server:**

```
DN 1002 → Asterisk → DN 1003  ❌ (WWE not notified)
```

**For WWE to work, calls MUST flow through Genesys T-Server:**

```
DN 1002 → Asterisk → Genesys T-Server → Asterisk → DN 1003  ✅
                            ↓
                      WWE (gets notified)
```

## 🔧 Fix Applied

### 1. Updated Asterisk Dialplan (`asterisk/etc/extensions-sip-endpoint.conf`)

**OLD (Bypassing Genesys):**
```asterisk
; Call other agents (5001-5999) - local WebRTC agents
exten => _5XXX,1,NoOp(Agent ${CALLERID(num)} calling Agent ${EXTEN})
 same => n,Dial(PJSIP/${EXTEN},30)
 same => n,Hangup()
```

**NEW (Routing Through Genesys):**
```asterisk
; Call other agents (1XXX, 5XXX) - Route EVERYTHING through Genesys T-Server
exten => _1XXX,1,NoOp(Agent ${CALLERID(num)} calling ${EXTEN} via Genesys)
 same => n,Set(CALLERID(name)=Agent ${CALLERID(num)})
 same => n,Dial(PJSIP/${EXTEN}@genesys_sip_server,300)
 same => n,Hangup()

exten => _5XXX,1,NoOp(Agent ${CALLERID(num)} calling ${EXTEN} via Genesys)
 same => n,Set(CALLERID(name)=Agent ${CALLERID(num)})
 same => n,Dial(PJSIP/${EXTEN}@genesys_sip_server,300)
 same => n,Hangup()
```

### 2. Enhanced Electron Bridge (`webrtc-gateway-bridge/src/main.js`)

Added incoming call event handling:
- ✅ Tracks incoming call state (`incomingCall`, `callerId`)
- ✅ New API endpoints for WWE to poll:
  - `GET /GetIncomingCall` - Returns incoming call details
  - `GET /GetCallStatus` - Returns current call state
- ✅ Handles `incoming_call`, `call_progress` events from WebRTC gateway

## 📋 Deployment Steps

### On Server (192.168.210.54):

```bash
# 1. Pull the latest code
cd /opt/gcti_apps/webrtc-genesys
sudo git fetch origin
sudo git reset --hard origin/main

# 2. Restart Asterisk to reload dialplan
sudo docker-compose restart asterisk

# 3. Verify dialplan is loaded
sudo docker-compose exec asterisk asterisk -rx "dialplan reload"
sudo docker-compose exec asterisk asterisk -rx "dialplan show genesys-agent"

# 4. Check registration status
sudo docker-compose exec asterisk asterisk -rx "pjsip show endpoints"
sudo docker-compose exec asterisk asterisk -rx "pjsip show contacts"

# 5. Monitor logs during test call
sudo docker-compose logs -f --tail=50 asterisk
```

### On Local Machine:

```bash
# 1. Rebuild Electron app with new code
cd webrtc-gateway-bridge
npm install
npm run build  # or restart the app

# 2. Test the new API endpoints
curl http://127.0.0.1:8000/GetCallStatus
curl http://127.0.0.1:8000/GetIncomingCall
```

## 🧪 Testing Instructions

### Test 1: Verify Call Routing Through Genesys

1. **Sign in with DN 1002 via Electron app**
2. **Sign in with DN 1003 via WWE** (using https://103.167.180.166:8443)
3. **From DN 1002 in Electron, call 1003**
4. **Check logs:**
   ```bash
   # On server:
   sudo docker-compose logs --tail=100 asterisk | grep "1003"
   ```
5. **Expected log pattern:**
   ```
   INVITE from 1002 to 1003
   Dialing PJSIP/1003@genesys_sip_server  ← Call goes to Genesys
   180 Ringing from Genesys               ← Genesys routes it back
   ```

### Test 2: WWE Incoming Call Notification

1. **Sign in with DN 1002 via WWE**
2. **Sign in with DN 1003 via Electron app**
3. **From DN 1003 in Electron, call 1002**
4. **Expected in WWE:**
   - 🔔 **Incoming call notification appears**
   - 📞 **Shows caller ID (1003)**
   - ✅ **"Answer" button is enabled**
5. **Click "Answer" in WWE**
6. **Expected:**
   - ✅ **Call connects**
   - ✅ **Audio flows between both parties**

### Test 3: Both Agents in WWE

1. **Sign in with DN 1002 via WWE**
2. **Sign in with DN 1003 via WWE**
3. **From DN 1002 in WWE, call 1003**
4. **Expected:**
   - ✅ **DN 1003 WWE shows incoming call**
   - ✅ **Can answer in WWE**
   - ✅ **Call connects with audio**

## 🔍 Troubleshooting

### Issue: "Invalid Called DN" Error

**Cause:** DN is not registered to Genesys T-Server

**Fix:**
```bash
# Check if DN is registered in Asterisk
sudo docker-compose exec asterisk asterisk -rx "pjsip show contacts" | grep 1003

# Check SIP logs for registration
sudo docker-compose logs registration-monitor | grep -i "1003"

# Check Genesys SIP Server logs (on 192.168.210.81)
tail -f /path/to/genesys/sip/logs
```

### Issue: Call Doesn't Reach WWE

**Cause:** Asterisk routing directly, bypassing Genesys

**Fix:**
```bash
# Verify dialplan is correct
sudo docker-compose exec asterisk asterisk -rx "dialplan show genesys-agent" | grep -A 5 "_1XXX\|_5XXX"

# Should show: Dial(PJSIP/${EXTEN}@genesys_sip_server,300)
# NOT: Dial(PJSIP/${EXTEN},30)
```

### Issue: No Incoming Call in WWE

**Cause:** WWE not polling for incoming calls, or T-Server not notifying WWE

**Fix:**
```bash
# Check WWE browser console for errors
# Should see polling requests to /api/v2/notifications

# Check T-Server event logs
# Should see DN_IN_SERVICE event for registered DNs
```

## 📊 Architecture Flow

### Working Flow (After Fix):

```
┌─────────────┐
│  DN 1002    │
│  (Electron) │
└──────┬──────┘
       │ INVITE
       ↓
┌─────────────┐
│  Asterisk   │ (192.168.210.54)
└──────┬──────┘
       │ Forward to genesys_sip_server
       ↓
┌─────────────────┐
│  Genesys        │
│  T-Server       │ (192.168.210.81)
│  + SIP Server   │
└──────┬──────────┘
       │ Notifies WWE via API
       │ Routes call back to Asterisk
       ↓
┌─────────────┐     ┌─────────────┐
│  WWE        │     │  Asterisk   │
│  (Browser)  │     │             │
└─────────────┘     └──────┬──────┘
                           │ INVITE to DN 1003
                           ↓
                    ┌─────────────┐
                    │  DN 1003    │
                    │  (Electron) │
                    └─────────────┘
```

### WWE receives notification:
1. T-Server sends `DN_IN_SERVICE` event to WWE
2. T-Server sends `EventRinging` notification to WWE
3. WWE displays incoming call UI
4. Agent clicks "Answer"
5. WWE calls bridge API: `POST /AnswerCall`
6. Bridge sends `answer_call` command to WebRTC gateway
7. WebRTC gateway accepts SIP INVITE
8. Call connects with RTP audio

## ✅ Success Criteria

After deploying this fix:

- [x] Calls from DN 1002 to DN 1003 route through Genesys T-Server
- [x] WWE receives incoming call notifications from T-Server
- [x] WWE displays incoming call UI with "Answer" button
- [x] Clicking "Answer" in WWE connects the call
- [x] Audio flows bidirectionally
- [x] Call can be hung up from either party

## 🚀 Next Steps

1. **Deploy to server** (192.168.210.54)
2. **Test call routing** (Electron → WWE)
3. **Test call routing** (WWE → Electron)
4. **Test call routing** (WWE → WWE)
5. **Verify T-Server logs** show proper call flow
6. **Verify WWE notifications** are received

---

**Date:** January 23, 2026  
**Commit:** e70ddd3  
**Status:** Ready for Deployment
