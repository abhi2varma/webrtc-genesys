# Kamailio SIP Proxy - Deployment Instructions

## What's Been Configured

### ✅ Kamailio as Full SIP Proxy

Kamailio now handles:
1. **SIP over WebSocket (WSS)** - WebSocket protocol handling
2. **REGISTER/INVITE/BYE** - All SIP methods
3. **Authentication** - Digest authentication via Redis
4. **NAT Detection** - Advanced NAT traversal using SIP headers
5. **Routing Decisions** - Load balancing and intelligent routing to Asterisk

### Architecture Change

**OLD (Direct):**
```
WebRTC Client → Nginx → Asterisk:8088 (WebSocket) → Genesys
```

**NEW (With Kamailio):**
```
WebRTC Client → Nginx:80 → Kamailio:8080 (WS) → Asterisk:5060 (SIP/UDP) → Genesys
               (WSS)       (SIP Proxy)             (Media Gateway)
```

### Files Created/Modified

**New Files:**
- `kamailio/kamailio-proxy.cfg` - Full SIP proxy configuration
- `kamailio/tls.cfg` - TLS settings for WSS
- `kamailio/dispatcher.list` - Asterisk backend list
- `scripts/setup-kamailio-auth.sh` - Authentication setup script
- `KAMAILIO_PROXY_GUIDE.md` - Complete guide
- `KAMAILIO_DEPLOYMENT.md` - This file

**Modified Files:**
- `docker-compose.yml` - Updated Kamailio volumes and environment
- `nginx/nginx.conf` - Changed `/ws` proxy from Asterisk:8088 to Kamailio:8080

## Deployment Steps

### Step 1: Transfer Files to Server

From your Windows dev machine:

```powershell
# Navigate to project directory
cd D:\Abhi\WebRTC\webrtc-genesys

# SCP files to server (using Git Bash or WSL)
scp -P 69 kamailio/kamailio-proxy.cfg Gencct@192.168.210.54:/home/Gencct/webrtc-genesys/kamailio/
scp -P 69 kamailio/tls.cfg Gencct@192.168.210.54:/home/Gencct/webrtc-genesys/kamailio/
scp -P 69 kamailio/dispatcher.list Gencct@192.168.210.54:/home/Gencct/webrtc-genesys/kamailio/
scp -P 69 nginx/nginx.conf Gencct@192.168.210.54:/home/Gencct/webrtc-genesys/nginx/
scp -P 69 docker-compose.yml Gencct@192.168.210.54:/home/Gencct/webrtc-genesys/
scp -P 69 scripts/setup-kamailio-auth.sh Gencct@192.168.210.54:/home/Gencct/webrtc-genesys/scripts/
```

Or use Git (if server has Git access):

```bash
# On server
cd /home/Gencct/webrtc-genesys
git pull origin main
```

### Step 2: Backup Current Configuration

On server (`192.168.210.54`):

```bash
cd /home/Gencct/webrtc-genesys

# Create backup
sudo docker-compose down
cp kamailio/kamailio.cfg kamailio/kamailio.cfg.backup
cp nginx/nginx.conf nginx/nginx.conf.backup

# Git tag for easy rollback
git add -A
git commit -m "backup: Pre-Kamailio-proxy deployment"
git tag "v1.0-pre-kamailio-proxy"
```

### Step 3: Setup Authentication Database

```bash
cd /home/Gencct/webrtc-genesys

# Make script executable
chmod +x scripts/setup-kamailio-auth.sh

# Start Redis if not running
sudo docker-compose up -d redis

# Run authentication setup
sudo ./scripts/setup-kamailio-auth.sh
```

**Expected Output:**
```
========================================
Kamailio Authentication Setup
========================================

✅ Redis container found

Creating subscribers in Redis (database 2)...

Creating subscriber: 5001
  Domain: 192.168.210.54
  Password: password5001
  HA1: a1b2c3d4...
  ✅ Created

[... 5002-5020 ...]

✅ Setup complete!
```

### Step 4: Rebuild and Restart Services

```bash
cd /home/Gencct/webrtc-genesys

# Stop all services
sudo docker-compose down

# Rebuild Kamailio with new config
sudo docker-compose build kamailio

# Start all services
sudo docker-compose up -d

# Verify all containers are running
sudo docker ps
```

**Expected Output:**
```
CONTAINER ID   IMAGE                  STATUS         PORTS
xxxxx          webrtc-nginx           Up X seconds
xxxxx          webrtc-kamailio        Up X seconds   (NEW CONFIG)
xxxxx          webrtc-asterisk        Up X seconds
xxxxx          webrtc-coturn          Up X seconds
xxxxx          webrtc-redis           Up X seconds
xxxxx          webrtc-dashboard-api   Up X seconds
xxxxx          webrtc-registration-monitor Up X seconds
```

### Step 5: Verify Kamailio Configuration

```bash
# Check Kamailio logs
sudo docker logs webrtc-kamailio --tail 50
```

**Look for:**
- ✅ `Listening on ws:192.168.210.54:8080`
- ✅ `Listening on wss:192.168.210.54:8443`
- ✅ `Dispatcher loaded 1 destination`
- ✅ `Loaded module: websocket`
- ✅ `Loaded module: auth_db`
- ✅ `Loaded module: nathelper`

```bash
# Check dispatcher status
sudo docker exec webrtc-kamailio kamcmd dispatcher.list
```

**Expected:**
```
SET_ID: 1
URI: sip:127.0.0.1:5060
FLAGS: AP  (Active, Probing)
PRIORITY: 0
```

```bash
# Test WebSocket endpoint
curl -i http://127.0.0.1:8080/ws
```

**Expected:**
```
HTTP/1.1 200 OK
<html><body><h1>Kamailio WebRTC Proxy</h1>...
```

### Step 6: Test WebRTC Client Registration

1. **Open browser:** `http://192.168.210.54/`

2. **Enter credentials:**
   - Username: `5001`
   - Password: `password5001`
   - SIP Server: `ws://192.168.210.54/ws`

3. **Click Register**

4. **Monitor logs:**

```bash
# Terminal 1: Kamailio logs
sudo docker logs -f webrtc-kamailio

# Terminal 2: Asterisk logs
sudo docker logs -f webrtc-asterisk

# Terminal 3: Nginx access logs
sudo docker exec webrtc-nginx tail -f /var/log/nginx/access.log
```

**Expected Flow:**
```
[Nginx] WebSocket upgrade request from client
[Kamailio] WebSocket handshake successful
[Kamailio] REGISTER from sip:5001@192.168.210.54
[Kamailio] Auth challenge sent (401 Unauthorized)
[Kamailio] REGISTER with credentials
[Kamailio] Auth successful, forwarding to Asterisk
[Asterisk] Endpoint 5001 is now Reachable
```

### Step 7: Verify Registration

```bash
# Check Asterisk endpoints
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints"
```

**Expected:**
```
Endpoint: 5001/5001  Avail  1 of inf
```

```bash
# Check Asterisk contacts
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show contacts"
```

**Contact should show external IP, not 127.0.0.1:**
```
Contact: 5001/sip:5001@192.168.210.54:xxxxx  Avail
```

## Testing Call Flow

### Test 1: WebRTC to Genesys

1. Register WebRTC client (5001)
2. In browser, enter Genesys DN (e.g., 6001) and click Call
3. Monitor logs:

```bash
# Kamailio should show:
# - INVITE from 5001 to 6001
# - NAT detection
# - Routing to Asterisk

# Asterisk should show:
# - INVITE received from 5001
# - Routing to Genesys via genesys-agent context
# - INVITE sent to Genesys SIP server
```

### Test 2: Genesys to WebRTC (Inbound)

1. From Genesys, call DN 5001
2. Monitor logs:

```bash
# Asterisk should show:
# - INVITE from Genesys (192.168.210.81)
# - Looking up endpoint 5001
# - Sending INVITE to 5001

# Kamailio should show:
# - INVITE to 5001
# - Contact alias resolution
# - Routing via WebSocket connection
```

## Troubleshooting

### Issue: WebSocket Connection Failed

```bash
# Check Nginx is proxying correctly
sudo docker exec webrtc-nginx cat /etc/nginx/nginx.conf | grep -A 10 "location /ws"

# Should show: proxy_pass http://127.0.0.1:8080;

# Check Kamailio is listening
sudo docker exec webrtc-kamailio netstat -tuln | grep 8080

# Should show: tcp  0.0.0.0:8080  LISTEN
```

### Issue: Authentication Failed

```bash
# Verify Redis has subscriber
sudo docker exec -it webrtc-redis redis-cli
SELECT 2
HGETALL subscriber:5001

# Should show:
# username: 5001
# domain: 192.168.210.54
# password: password5001
# ha1: <hash>
```

### Issue: Kamailio Not Forwarding to Asterisk

```bash
# Check dispatcher
sudo docker exec webrtc-kamailio kamcmd dispatcher.list

# If FLAGS shows "IP" (Inactive):
sudo docker exec webrtc-kamailio kamcmd dispatcher.reload

# Check Asterisk is listening on 5060
sudo docker exec webrtc-asterisk netstat -uln | grep 5060
```

### Issue: NAT Problems - Wrong Contact IP

```bash
# Check Kamailio NAT detection logs
sudo docker logs webrtc-kamailio | grep -i "NAT detected"

# Should show:
# NAT detected: <client-ip>:xxxxx

# Verify Asterisk contact
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show contacts"

# Contact should NOT be 127.0.0.1
```

## Rollback Procedure

If any issues occur:

```bash
cd /home/Gencct/webrtc-genesys

# Stop services
sudo docker-compose down

# Restore backup
cp kamailio/kamailio.cfg.backup kamailio/kamailio.cfg
cp nginx/nginx.conf.backup nginx/nginx.conf

# Or use Git
git checkout v1.0-pre-kamailio-proxy

# Restart
sudo docker-compose up -d

# Verify
sudo docker ps
sudo docker logs webrtc-asterisk --tail 20
```

## Configuration Summary

### Kamailio Ports
- `5060` UDP/TCP - SIP (standard)
- `5061` TLS - Secure SIP
- `8080` WS - WebSocket (Nginx proxy target)
- `8443` WSS - WebSocket Secure (future use)

### Kamailio Features Enabled
- ✅ WebSocket/WSS handling
- ✅ SIP transaction management
- ✅ Digest authentication (Redis backend)
- ✅ NAT detection (19-flag test)
- ✅ Contact rewriting for WebSocket
- ✅ Dispatcher load balancing
- ✅ Health monitoring (OPTIONS ping)
- ✅ Record-Route for in-dialog requests

### Asterisk Changes
- ❌ **No changes** - Asterisk continues to handle:
  - Media gateway (DTLS-SRTP ↔ RTP)
  - Codec transcoding
  - SIP B2BUA
  - Registration to Genesys (outbound)
  - Dialplan routing

### Nginx Changes
- Changed `/ws` proxy target from `Asterisk:8088` to `Kamailio:8080`
- WebRTC clients now connect to Kamailio for SIP signaling
- Media still goes directly to Asterisk (via ICE/STUN/TURN)

## Benefits of This Architecture

1. **Scalability:** Kamailio can load balance across multiple Asterisk instances
2. **Performance:** Kamailio optimized for SIP proxy (lightweight)
3. **Flexibility:** Centralized routing logic in Kamailio
4. **Security:** Centralized authentication in Redis
5. **NAT Handling:** Advanced NAT traversal in Kamailio
6. **Monitoring:** Kamailio provides detailed SIP statistics
7. **Separation of Concerns:**
   - Kamailio = SIP signaling
   - Asterisk = Media processing
   - Clean separation of responsibilities

## Next Steps

1. ✅ Deploy Kamailio proxy configuration
2. ⏳ Test complete call flow (WebRTC ↔ Genesys)
3. ⏳ Add monitoring for Kamailio stats to dashboard
4. ⏳ Implement WSS (WebSocket Secure) for production
5. ⏳ Add multiple Asterisk backends for load balancing
6. ⏳ Implement rate limiting and DOS protection
7. ⏳ Set up call detail records (CDR) in Kamailio

## Support Commands

```bash
# Kamailio status
sudo docker exec webrtc-kamailio kamcmd core.info

# Active calls
sudo docker exec webrtc-kamailio kamcmd stats.get_statistics active_dialogs

# WebSocket connections
sudo docker exec webrtc-kamailio kamcmd stats.get_statistics ws.ws_current_connections

# Authentication stats
sudo docker exec webrtc-kamailio kamcmd stats.get_statistics auth

# Reload dispatcher without restart
sudo docker exec webrtc-kamailio kamcmd dispatcher.reload

# Reload Kamailio config (some modules)
sudo docker exec webrtc-kamailio kamcmd cfg.reload

# Full restart
sudo docker-compose restart kamailio
```

## Important Notes

- 📝 Asterisk no longer handles WebSocket connections directly
- 📝 All WebRTC client SIP traffic routes through Kamailio
- 📝 Media (RTP/SRTP) still flows directly to Asterisk (no change)
- 📝 Genesys SIP trunk still terminates on Asterisk (no change)
- 📝 Authentication now in Redis (not Asterisk)
- 📝 Can add multiple Asterisk instances without changing client config

## Credentials Reference

**WebRTC Client Login:**
- Username: `5001` - `5020`
- Password: `password5001` - `password5020`
- SIP Server: `ws://192.168.210.54/ws`

**Genesys SIP Server:**
- IP: `192.168.210.81:5060`
- Username: `asterisk`
- Password: `Genesys2024!`

**Redis Authentication DB:**
- Database: `2`
- Key format: `subscriber:<username>`
- Fields: `username`, `domain`, `password`, `ha1`

