# Quick Deployment Guide - AMI Auto-Answer Handler

## On Server (SSH to 103.167.180.166)

### Option 1: Automated Deployment

```bash
cd /opt/gcti_apps/webrtc-genesys
git pull
sudo bash scripts/deploy-ami-handler.sh
```

### Option 2: Manual Step-by-Step

```bash
# 1. Navigate and pull code
cd /opt/gcti_apps/webrtc-genesys
git pull

# 2. Build the service
sudo docker-compose build ami-auto-answer-handler

# 3. Start the service
sudo docker-compose up -d ami-auto-answer-handler

# 4. Check status
sudo docker ps | grep ami-auto-answer-handler

# 5. View logs
sudo docker logs -f webrtc-ami-auto-answer-handler
```

## Verification Steps

### 1. Check Service is Running

```bash
sudo docker ps | grep ami-auto-answer-handler
```

Expected output:
```
webrtc-ami-auto-answer-handler   Up 10 seconds
```

### 2. Check Logs

```bash
sudo docker logs webrtc-ami-auto-answer-handler
```

Expected output:
```
2026-01-28 10:30:00 | INFO     | ============================================================
2026-01-28 10:30:00 | INFO     |   Genesys Auto-Answer Handler for Asterisk
2026-01-28 10:30:00 | INFO     | ============================================================
2026-01-28 10:30:01 | INFO     | ✅ Connected to Asterisk AMI successfully
2026-01-28 10:30:01 | INFO     | Ready to handle auto-answer requests from Genesys!
```

### 3. Verify AMI Connection

```bash
sudo docker exec webrtc-asterisk asterisk -rx 'manager show connected'
```

Should show the AMI handler connected.

### 4. Test Bridge API Connectivity

```bash
curl -X POST http://192.168.210.54:8000/answer/1002
```

Expected response:
```json
{"success":true,"message":"Answer command sent"}
```

## Make a Test Call

1. **Log in as Agent 1002** in WWE
2. **Have Agent 1003 call 1002** (or route a test call)
3. **Watch handler logs:**
   ```bash
   sudo docker logs -f webrtc-ami-auto-answer-handler
   ```
4. **Expected output:**
   ```
   📞 New call tracked: Channel=..., DN=1002, From=1003
   🔔 NOTIFY Event: talk received!
   🎯 Auto-answer target DN: 1002
   📡 Calling Bridge API: http://192.168.210.54:8000/answer/1002
   ✅ Auto-answer triggered successfully
   ```
5. **Call should auto-answer within 1 second**

## Troubleshooting

### Service Won't Start

```bash
# Check for errors in logs
sudo docker logs webrtc-ami-auto-answer-handler

# Check if AMI port is accessible
sudo docker exec webrtc-asterisk netstat -tlnp | grep 5038

# Verify Asterisk AMI is enabled
sudo docker exec webrtc-asterisk cat /etc/asterisk/manager.conf
```

### Not Detecting NOTIFY

```bash
# Enable SIP debugging on Asterisk
sudo docker exec webrtc-asterisk asterisk -rx 'pjsip set logger on'

# Make a test call and watch full Asterisk logs
sudo docker exec webrtc-asterisk asterisk -rvvv
```

### Bridge API Not Responding

```bash
# Test from server
curl -k https://127.0.0.1:8000/

# If using Windows bridge, check if it's running
# (On Windows machine)

# Check firewall allows port 8000
```

## Restart Services

```bash
# Restart just the AMI handler
sudo docker-compose restart ami-auto-answer-handler

# Restart all services
sudo docker-compose restart

# Restart specific services
sudo docker-compose restart asterisk ami-auto-answer-handler
```

## Stop/Remove Service

```bash
# Stop the service
sudo docker-compose stop ami-auto-answer-handler

# Remove the service
sudo docker-compose rm -f ami-auto-answer-handler

# Stop and remove
sudo docker-compose down ami-auto-answer-handler
```

## View Real-Time Logs

```bash
# Follow logs (Ctrl+C to exit)
sudo docker logs -f webrtc-ami-auto-answer-handler

# Last 50 lines
sudo docker logs --tail 50 webrtc-ami-auto-answer-handler

# With timestamps
sudo docker logs -f -t webrtc-ami-auto-answer-handler
```

## Configuration Changes

If you need to change configuration:

```bash
# Edit docker-compose.yml
sudo nano /opt/gcti_apps/webrtc-genesys/docker-compose.yml

# Find ami-auto-answer-handler section
# Modify environment variables:
#   - ASTERISK_HOST=...
#   - BRIDGE_API_URL=...
#   etc.

# Restart to apply changes
sudo docker-compose up -d ami-auto-answer-handler
```

## Health Check

```bash
# Check if all required services are running
sudo docker-compose ps

# Should see:
# - webrtc-asterisk (Up)
# - webrtc-nginx (Up)
# - webrtc-ami-auto-answer-handler (Up)
```

## Common Issues

### ❌ "Connection refused" to AMI

**Fix:** Check Asterisk manager.conf is configured correctly

```bash
sudo docker exec webrtc-asterisk cat /etc/asterisk/manager.conf
```

### ❌ "Bridge API timeout"

**Fix:** 
1. Verify bridge is running on Windows machine
2. Check IP address is correct (192.168.210.54)
3. Test connectivity: `curl http://192.168.210.54:8000`

### ❌ "No NOTIFY detected"

**Fix:** 
1. Verify Genesys is sending NOTIFY (check Asterisk logs)
2. Enable AMI logging on handler (add LOG_LEVEL=DEBUG)
3. Check AMI events: `manager show events`

## Success Indicators

✅ Service shows "Up" in `docker ps`
✅ Logs show "Connected to Asterisk AMI successfully"
✅ Logs show "Ready to handle auto-answer requests"
✅ Test call auto-answers within 1 second
✅ Handler logs show "Auto-answer triggered successfully"

## Next Steps After Deployment

1. ✅ Monitor first few calls to verify auto-answer works
2. ✅ Check handler logs for any errors
3. ✅ Verify WWE shows calls as "Established" (not just ringing)
4. ✅ Test with different scenarios (internal/external calls)
5. ✅ Consider adding monitoring/alerting for the service
