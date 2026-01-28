# Server Deployment Steps

## Date: 2026-01-28 06:05 UTC
## Commit: 280b26d

## Changes Pushed to Git

### Critical Fixes
1. **Immediate Auto-Answer (500ms)** - Prevents call timeout
2. **Fixed DN Registration Bug** - Corrects `event.dn` → `event.data.dn`
3. **Fixed Cloning Error** - Simplified `call_failed` event data
4. **Workspace Client** - Added Genesys Workspace API integration

### Files Changed
- `nginx/html/wwe-webrtc-gateway.html` - Auto-answer implementation
- `webrtc-gateway-bridge/src/main.js` - DN registration fix
- `webrtc-gateway-bridge/src/workspace-client.js` - NEW file for Workspace API
- `webrtc-gateway-bridge/package.json` - Dependencies updated
- `AUTO_ANSWER_FIX_APPLIED.md` - Documentation

---

## Server Deployment Instructions

### 1. SSH to Server
```bash
ssh root@103.167.180.166
```

### 2. Navigate to Project Directory
```bash
cd /path/to/webrtc-genesys
```

### 3. Pull Latest Changes
```bash
git pull origin main
```

### 4. Check What Was Updated
```bash
git log -1 --stat
```

### 5. Update Dependencies (if needed)
```bash
cd webrtc-gateway-bridge
npm install
cd ..
```

### 6. Restart Services

#### Option A: Restart All Services
```bash
docker-compose down
docker-compose up -d
```

#### Option B: Restart Only Nginx (if WebRTC gateway HTML changed)
```bash
docker-compose restart nginx
```

#### Option C: Just the Bridge (if running separately)
```bash
# Stop bridge if running
pkill -f electron

# Start bridge
cd webrtc-gateway-bridge
npm start
```

### 7. Verify Deployment
```bash
# Check container status
docker-compose ps

# Check nginx logs
docker-compose logs -f nginx --tail=50

# Test bridge API
curl -k https://127.0.0.1:8000/GetDnSIP
```

---

## Key Changes to Verify After Deployment

### 1. WebRTC Gateway (Browser Console)
Open https://103.167.180.166/wwe in browser and check console (F12):

**Should see**:
```
📞 Incoming call from [DN]
📞 Auto-answering call immediately to prevent timeout...
🎯 Executing immediate auto-answer
```

### 2. Bridge Logs
**Should see**:
```
info: WebRTC event received: {"event":"incoming_call","data":{"from":"1003"}}
info: WebRTC event received: {"event":"auto_answered","data":{"trigger":"immediate"}}
```

### 3. Test Call Flow
1. Make call from DN 1003 → DN 1002
2. Call should auto-answer within 500ms
3. Call should NOT timeout after 30 seconds
4. No cloning errors in browser console

---

## Rollback Instructions (if needed)

### If Issues Occur
```bash
# Rollback to previous commit
git reset --hard 204fb9b
git push origin main --force

# Restart services
docker-compose restart
```

---

## Important Notes

### Auto-Answer Behavior
- **Immediate**: Triggers after 500ms (NEW)
- **NOTIFY Handler**: Still present as backup if T-Server sends NOTIFY

### Why 500ms Delay?
- Allows JsSIP session initialization
- Prevents WebRTC stack race conditions
- Fast enough to prevent timeouts
- Ensures reliable connection

### Server vs Local Development
- Server: Changes affect production WebRTC gateway
- Local: Electron bridge runs on Windows machine
- Both need to be updated for full functionality

---

## Testing Checklist After Deployment

- [ ] Services started successfully
- [ ] No errors in docker-compose logs
- [ ] WWE loads at https://103.167.180.166/wwe
- [ ] DN 1002 registers to Asterisk
- [ ] Test call from 1003 → 1002 connects
- [ ] Call auto-answers within 1 second
- [ ] No timeout after 30 seconds
- [ ] No cloning errors in console

---

## Contact

If any issues occur during deployment, check:
1. Bridge logs: `docker-compose logs bridge`
2. Nginx logs: `docker-compose logs nginx`
3. Asterisk logs: `docker-compose logs asterisk`
4. Browser console (F12) for WebRTC gateway logs
