# How to Capture Detailed Call Logs

## Method 1: Automated Script (Recommended)

```bash
# Navigate to project directory
cd /home/Gencct/webrtc-genesys

# Make script executable
chmod +x scripts/capture-call-logs.sh

# Run the script
./scripts/capture-call-logs.sh

# The script will:
# 1. Enable all debugging
# 2. Start capturing logs
# 3. Wait for you to make a test call
# 4. Press Ctrl+C when done
# 5. Save logs to asterisk/logs/testcall1_TIMESTAMP.log
```

## Method 2: Manual Step-by-Step

### Step 1: Create logs directory
```bash
cd /home/Gencct/webrtc-genesys
mkdir -p asterisk/logs
```

### Step 2: Start log capture in one terminal
```bash
# Start following Asterisk logs
sudo docker logs -f webrtc-asterisk 2>&1 | tee asterisk/logs/testcall1_$(date +%Y%m%d_%H%M%S).log
```

### Step 3: Enable debugging in another terminal
```bash
# Open a second terminal and run these:
sudo docker exec webrtc-asterisk asterisk -rx "core set verbose 10"
sudo docker exec webrtc-asterisk asterisk -rx "core set debug 5"
sudo docker exec webrtc-asterisk asterisk -rx "pjsip set logger on"
sudo docker exec webrtc-asterisk asterisk -rx "rtp set debug on"
```

### Step 4: Make your test call
- Go to browser
- Register as 5001
- Call 1003 (or any other number)
- Let the call complete

### Step 5: Stop capture
- Press `Ctrl+C` in the log capture terminal
- Disable debugging:
```bash
sudo docker exec webrtc-asterisk asterisk -rx "pjsip set logger off"
sudo docker exec webrtc-asterisk asterisk -rx "rtp set debug off"
sudo docker exec webrtc-asterisk asterisk -rx "core set verbose 3"
sudo docker exec webrtc-asterisk asterisk -rx "core set debug 0"
```

## Method 3: Interactive CLI (For Real-Time Monitoring)

```bash
# Enter Asterisk CLI with maximum verbosity
sudo docker exec -it webrtc-asterisk asterisk -rvvvvv

# Once inside, enable full debugging:
core set verbose 10
core set debug 5
pjsip set logger on
rtp set debug on

# Now make your test call from browser
# Watch the output in real-time

# When done, turn off debugging:
pjsip set logger off
rtp set debug off
core set verbose 3
core set debug 0

# Exit CLI:
exit
```

## Method 4: Capture Specific Call Only

```bash
# Start with debugging enabled
sudo docker exec webrtc-asterisk asterisk -rx "core set verbose 10"
sudo docker exec webrtc-asterisk asterisk -rx "pjsip set logger on"
sudo docker exec webrtc-asterisk asterisk -rx "rtp set debug on"

# Make your test call now

# Immediately after call ends, extract logs:
sudo docker logs webrtc-asterisk --tail 500 > asterisk/logs/testcall1_$(date +%Y%m%d_%H%M%S).log

# Disable debugging
sudo docker exec webrtc-asterisk asterisk -rx "pjsip set logger off"
sudo docker exec webrtc-asterisk asterisk -rx "rtp set debug off"
sudo docker exec webrtc-asterisk asterisk -rx "core set verbose 3"
```

## What to Look For in Logs

### Call Initiation
```
INVITE sip:1003@192.168.210.54 SIP/2.0
From: "5001" <sip:5001@192.168.210.54>
```

### Authentication
```
401 Unauthorized
Authorization: Digest algorithm=MD5, username="5001"
```

### Dialplan Execution
```
Executing [1003@genesys-agent:1] NoOp("PJSIP/5001-XXXXXXXX", "Agent 5001 calling 1003")
Executing [1003@genesys-agent:3] Dial("PJSIP/5001-XXXXXXXX", "PJSIP/1003@genesys_sip_server,300")
```

### Call Progress
```
Called PJSIP/1003@genesys_sip_server
100 Trying
180 Ringing
200 OK
```

### Media/RTP
```
Got RTP packet from 192.168.210.54:XXXXX
Sent RTP packet to 192.168.210.54:XXXXX
```

### Call End
```
BYE sip:... SIP/2.0
Hangup
Cause: 16 - Normal Clearing
```

## Download Logs to Your Local Machine

### From Linux Server to Windows
```bash
# On Windows (PowerShell):
scp Gencct@192.168.210.54:/home/Gencct/webrtc-genesys/asterisk/logs/testcall1_*.log .
```

### Or use WinSCP / FileZilla
- Connect to: 192.168.210.54
- Navigate to: /home/Gencct/webrtc-genesys/asterisk/logs/
- Download the testcall1_*.log file

## Quick Analysis Commands

```bash
# Search for INVITE messages
grep "INVITE sip:" asterisk/logs/testcall1_*.log

# Search for hangup causes
grep -i "hangup\|cause" asterisk/logs/testcall1_*.log

# Search for errors
grep -i "error\|failed" asterisk/logs/testcall1_*.log

# Count SIP messages
grep -c "SIP/2.0" asterisk/logs/testcall1_*.log

# Extract all SIP responses
grep "SIP/2.0 [0-9]" asterisk/logs/testcall1_*.log
```

## Troubleshooting Log Capture

### If logs are not verbose enough:
```bash
# Check current verbosity levels
sudo docker exec webrtc-asterisk asterisk -rx "core show settings" | grep -i verbose
```

### If PJSIP logger doesn't show messages:
```bash
# Verify it's enabled
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show logger"
```

### If logs are too large:
```bash
# Capture only last 10 minutes
sudo docker logs webrtc-asterisk --since 10m > asterisk/logs/recent.log
```

