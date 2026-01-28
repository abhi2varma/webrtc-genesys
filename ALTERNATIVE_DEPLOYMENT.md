# Alternative Deployment - Run SIP Monitor on Host

## Problem
The server's Docker Compose version is too old (`compose build requires buildx 0.17 or later`)

## Solution: Run Without Docker

Run the SIP NOTIFY monitor directly on the host system.

## Steps

### 1. On Server (103.167.180.166)

```bash
# Pull latest code (already done)
cd /root/webrtc-genesys
git pull origin main

# Make script executable
chmod +x scripts/start-sip-monitor-host.sh
chmod +x asterisk/sip-notify-parser.py
chmod +x asterisk/start-notify-monitor.sh

# Install dependencies
yum install -y python3 python3-pip tcpdump
pip3 install requests urllib3
```

### 2. Start the Monitor

**Option A: Run in foreground (to see logs)**
```bash
cd /root/webrtc-genesys
bash scripts/start-sip-monitor-host.sh
```

**Option B: Run in background**
```bash
cd /root/webrtc-genesys
nohup bash scripts/start-sip-monitor-host.sh > /var/log/sip-notify-monitor.log 2>&1 &

# View logs
tail -f /var/log/sip-notify-monitor.log
```

**Option C: Manual command**
```bash
cd /root/webrtc-genesys
tcpdump -i any -n -A -l port 5061 2>/dev/null | python3 asterisk/sip-notify-parser.py
```

### 3. Expected Output

```
🔍 Starting SIP NOTIFY Monitor...
   Listening on port 5061 for Genesys NOTIFY messages

✅ Bridge is running

Starting tcpdump on port 5061...
SIP NOTIFY Parser started
Listening for NOTIFY messages on stdin (from tcpdump)...

📩 NOTIFY detected
  DN: 1002
  Call-ID: D6F9763C-E5D5-4C4B-97C3-C0725E0E2E17-84@192.168.210.81
  CallUUID: UIVB8J6JE91C53UIM3VI59VHQ400001T
  Event: talk
✅ Bridge notified: DN=1002, CallUUID=UIVB8J6JE91C53UIM3VI59VHQ400001T
```

### 4. Test

1. Make a call from DN 1003 to DN 1002
2. Watch the monitor logs for CallUUID extraction
3. Check WWE - the call should now appear!

## Troubleshooting

### Bridge Not Running
If you see `❌ Bridge not running on port 8000`:
- The WebRTC Gateway Bridge needs to be running on your **local machine**
- Start it with: `cd webrtc-gateway-bridge && npm start`
- The monitor on the server will send CallUUID to your local bridge

### Permission Denied (tcpdump)
```bash
# Run as root
sudo bash scripts/start-sip-monitor-host.sh
```

### Port 5061 Not Captured
```bash
# Check if port 5061 is actually receiving NOTIFY
tcpdump -i any -n port 5061
# You should see NOTIFY messages when a call is made
```

### Python Module Not Found
```bash
pip3 install --user requests urllib3
# or
python3 -m pip install requests urllib3
```

## Stop the Monitor

```bash
# Find the process
ps aux | grep sip-notify-parser

# Kill it
pkill -f sip-notify-parser
# or
pkill -f tcpdump.*5061
```

## Make it Persistent (systemd)

Create `/etc/systemd/system/sip-notify-monitor.service`:

```ini
[Unit]
Description=SIP NOTIFY Monitor for Genesys CallUUID
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/webrtc-genesys
ExecStart=/bin/bash /root/webrtc-genesys/scripts/start-sip-monitor-host.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
systemctl daemon-reload
systemctl enable sip-notify-monitor
systemctl start sip-notify-monitor
systemctl status sip-notify-monitor
```

