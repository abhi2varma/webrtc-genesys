# QUICK DEPLOY: WWE Call Notification Fix

## Date: 2026-01-28

## What Was Fixed

Calls weren't appearing in WWE because Genesys CallUUID wasn't being forwarded from Asterisk to the WebRTC bridge.

## Solution Implemented

Created a **SIP NOTIFY Monitor** that:
1. Captures NOTIFY messages from Genesys on port 5061
2. Extracts `X-Genesys-CallUUID` from SIP headers
3. Forwards CallUUID to WebRTC bridge
4. Bridge stores CallUUID for WWE to query

## Files Changed

### New Files:
- `asterisk/sip-notify-parser.py` - Parses NOTIFY messages
- `asterisk/start-notify-monitor.sh` - Starts tcpdump + parser
- `asterisk/Dockerfile.notify-monitor` - Docker image for monitor
- `WWE_NOTIFY_SOLUTION.md` - Full documentation

### Modified Files:
- `asterisk/ami-notify-handler.py` - Updated to extract CallUUID
- `webrtc-gateway-bridge/src/main.js` - Added `/genesys-call-notify` endpoint
- `docker-compose.yml` - Added `sip-notify-monitor` service

## Deployment Steps (Server)

### 1. Update Files on Server

```bash
# Copy changed files to server
scp asterisk/sip-notify-parser.py root@103.167.180.166:/root/webrtc-genesys/asterisk/
scp asterisk/start-notify-monitor.sh root@103.167.180.166:/root/webrtc-genesys/asterisk/
scp asterisk/Dockerfile.notify-monitor root@103.167.180.166:/root/webrtc-genesys/asterisk/
scp docker-compose.yml root@103.167.180.166:/root/webrtc-genesys/
scp webrtc-gateway-bridge/src/main.js root@103.167.180.166:/root/webrtc-genesys/webrtc-gateway-bridge/src/
```

### 2. Build and Start SIP NOTIFY Monitor

```bash
ssh root@103.167.180.166

cd /root/webrtc-genesys

# Build the new monitor
docker-compose build sip-notify-monitor

# Start the monitor
docker-compose up -d sip-notify-monitor

# Check logs
docker-compose logs -f sip-notify-monitor
```

Expected output:
```
🔍 Starting SIP NOTIFY Monitor...
   Listening on port 5061 for Genesys NOTIFY messages

✅ Bridge is running

Starting tcpdump on port 5061...
SIP NOTIFY Parser started
Listening for NOTIFY messages on stdin (from tcpdump)...
```

### 3. Restart WebRTC Bridge (if needed)

```bash
# Copy updated main.js
scp webrtc-gateway-bridge/src/main.js root@103.167.180.166:/root/webrtc-genesys/webrtc-gateway-bridge/src/

# On local machine, restart bridge
cd webrtc-gateway-bridge
npm start
```

## Testing (Local Machine)

### 1. Start Bridge

```powershell
cd webrtc-gateway-bridge
npm start
```

### 2. Test Call Flow

1. Open WWE at `https://103.167.180.166:8443`
2. Login with Genesys credentials
3. Make call from DN 1003 to DN 1002

### 3. Check Logs

**Bridge logs should show:**
```
📞 GENESYS CALL NOTIFY: DN 1002
   CallUUID: UIVB8J6JE91C53UIM3VI59VHQ400001R
   Event: talk
✅ CallUUID stored for incoming call from 1003
🎯 Event: talk - Auto-answering call
```

**SIP NOTIFY Monitor logs (on server):**
```
📩 NOTIFY detected
  DN: 1002
  Call-ID: D6F9763C-E5D5-4C4B-97C3-C0725E0E2E17-82@192.168.210.81
  CallUUID: UIVB8J6JE91C53UIM3VI59VHQ400001R
  Event: talk
✅ Bridge notified: DN=1002, CallUUID=UIVB8J6JE91C53UIM3VI59VHQ400001R
```

**WWE should now:**
- ✅ Show incoming call from 1003
- ✅ Display call in call manager
- ✅ Have proper Genesys context (CallUUID)

## Troubleshooting

### Monitor Not Detecting NOTIFY

```bash
# Check if NOTIFY messages are arriving on port 5061
docker exec -it webrtc-asterisk tcpdump -i any -n -A port 5061 | grep -A 20 NOTIFY
```

### Bridge Not Receiving CallUUID

```bash
# Check bridge logs
cd webrtc-gateway-bridge
npm start
# Look for "GENESYS CALL NOTIFY" messages
```

### WWE Still Not Showing Calls

1. Check WWE is logged in (403 Forbidden on /api/v2/me means not logged in)
2. Verify bridge is running on port 8000
3. Check SIP NOTIFY monitor is running
4. Test with a call and check all logs

## Quick Commands

```bash
# On Server
docker-compose logs -f sip-notify-monitor   # Monitor logs
docker-compose restart sip-notify-monitor   # Restart monitor
docker-compose ps                            # Check all services

# On Local Machine
cd webrtc-gateway-bridge
npm start                                    # Start bridge with logs
```

## Success Criteria

✅ SIP NOTIFY monitor captures NOTIFY messages  
✅ Bridge receives CallUUID  
✅ WWE shows incoming calls  
✅ Calls can be answered from WWE  
✅ Call context preserved in WWE

