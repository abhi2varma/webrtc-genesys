# WebRTC Gateway Bridge - Linux

Bridge service between Genesys WWE and WebRTC Gateway for Linux servers.

## 🚀 Quick Installation

### On your Linux server (192.168.210.54):

```bash
# 1. Copy files to server
scp -r webrtc-gateway-bridge-linux/ Gencct@192.168.210.54:/tmp/

# 2. SSH to server
ssh Gencct@192.168.210.54

# 3. Run installer
cd /tmp/webrtc-gateway-bridge-linux
sudo chmod +x install.sh
sudo ./install.sh
```

That's it! The service is now running.

---

## 📋 Manual Installation

### Prerequisites

```bash
# Install Node.js (if not already installed)
sudo yum install -y nodejs npm

# Install Chromium (for Puppeteer)
sudo yum install -y chromium
```

### Installation Steps

```bash
# 1. Create service user
sudo useradd --system --no-create-home --shell /bin/false webrtc-bridge

# 2. Create directories
sudo mkdir -p /opt/webrtc-gateway-bridge
sudo mkdir -p /var/lib/webrtc-bridge
sudo mkdir -p /var/log/webrtc-bridge

# 3. Copy files
sudo cp -r ./* /opt/webrtc-gateway-bridge/

# 4. Install dependencies
cd /opt/webrtc-gateway-bridge
sudo npm install --production

# 5. Set permissions
sudo chown -R webrtc-bridge:webrtc-bridge /opt/webrtc-gateway-bridge
sudo chown -R webrtc-bridge:webrtc-bridge /var/lib/webrtc-bridge
sudo chown -R webrtc-bridge:webrtc-bridge /var/log/webrtc-bridge

# 6. Install systemd service
sudo cp webrtc-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable webrtc-bridge
sudo systemctl start webrtc-bridge

# 7. Check status
sudo systemctl status webrtc-bridge
```

---

## 🔧 Configuration

Configuration is done via environment variables in the systemd service file:

```bash
sudo nano /etc/systemd/system/webrtc-bridge.service
```

**Available Options:**

```ini
Environment="BRIDGE_HOST=0.0.0.0"                                      # Bind address
Environment="BRIDGE_PORT=8000"                                         # Listen port
Environment="GATEWAY_URL=https://192.168.210.54:8443"                  # WebRTC Gateway URL
Environment="IFRAME_URL=https://192.168.210.54:8443/wwe-webrtc-gateway.html"
Environment="SIP_SERVER=wss://192.168.210.54:8443/ws"                 # SIP WebSocket
Environment="WWE_ORIGINS=http://192.168.210.54:8090"                  # Allowed WWE origins
Environment="AGENT_PASSWORD=Genesys2024!WebRTC"                        # Default password
Environment="DATA_DIR=/var/lib/webrtc-bridge"                          # Data directory
Environment="LOG_LEVEL=info"                                           # Logging level
```

After editing, reload and restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart webrtc-bridge
```

---

## 📊 Monitoring

### View Logs

```bash
# Real-time logs
sudo journalctl -u webrtc-bridge -f

# Last 100 lines
sudo journalctl -u webrtc-bridge -n 100

# Web interface
curl -k https://192.168.210.54:8000/logs
```

### Check Status

```bash
# Service status
sudo systemctl status webrtc-bridge

# Health check
curl -k https://192.168.210.54:8000/health

# Dashboard (open in browser)
https://192.168.210.54:8000/dashboard
```

---

## 🧪 Testing

### 1. Test Bridge is Running

```bash
curl -k https://192.168.210.54:8000/health
```

**Expected:**
```json
{
  "status": "ok",
  "registered": false,
  "dn": null,
  "callActive": false,
  "browserRunning": true,
  "uptime": 123.456
}
```

### 2. Test Registration

```bash
curl -k -X POST https://192.168.210.54:8000/RegisterDn \
  -H "Content-Type: application/json" \
  -d '{
    "addresses": ["192.168.210.81:5060"],
    "users": ["1003"]
  }'
```

**Expected:**
```json
{
  "RegisterDnResult": true
}
```

### 3. Check Registration Status

```bash
curl -k https://192.168.210.54:8000/GetIsEndpointActive
```

**Expected:**
```json
{
  "get_IsEndpointActiveResult": true
}
```

### 4. Test Call

```bash
# Make call
curl -k -X POST https://192.168.210.54:8000/MakeCall \
  -H "Content-Type: application/json" \
  -d '{"destination": "5002"}'

# Hangup
curl -k -X POST https://192.168.210.54:8000/HangUp
```

---

## 🔥 Firewall Configuration

```bash
# Allow port 8000 (Bridge API)
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload

# Verify
sudo firewall-cmd --list-ports
```

---

## 🐛 Troubleshooting

### Service won't start

```bash
# Check logs
sudo journalctl -u webrtc-bridge -n 50 --no-pager

# Check if port is already in use
sudo netstat -tlnp | grep 8000

# Check file permissions
ls -la /opt/webrtc-gateway-bridge
ls -la /var/lib/webrtc-bridge
```

### Browser fails to launch

```bash
# Check Chromium is installed
which chromium-browser

# Check Puppeteer dependencies
cd /opt/webrtc-gateway-bridge
ldd /opt/webrtc-gateway-bridge/node_modules/puppeteer/.local-chromium/linux-*/chrome-linux/chrome
```

### Registration fails

```bash
# Check WebRTC Gateway is accessible
curl -k https://192.168.210.54:8443/wwe-webrtc-gateway.html

# Check logs for detailed error
sudo journalctl -u webrtc-bridge -f
```

### WWE doesn't detect endpoint

```bash
# Verify service is listening
sudo netstat -tlnp | grep 8000

# Test from WWE server
curl -k https://192.168.210.54:8000/GetIsEndpointActive

# Check CORS origins
curl -k -H "Origin: http://192.168.210.54:8090" \
  https://192.168.210.54:8000/health -v
```

---

## 🔄 Management Commands

```bash
# Start service
sudo systemctl start webrtc-bridge

# Stop service
sudo systemctl stop webrtc-bridge

# Restart service
sudo systemctl restart webrtc-bridge

# Enable auto-start on boot
sudo systemctl enable webrtc-bridge

# Disable auto-start
sudo systemctl disable webrtc-bridge

# View status
sudo systemctl status webrtc-bridge

# View logs (real-time)
sudo journalctl -u webrtc-bridge -f

# View logs (last 100 lines)
sudo journalctl -u webrtc-bridge -n 100
```

---

## 📦 Uninstallation

```bash
# Stop and disable service
sudo systemctl stop webrtc-bridge
sudo systemctl disable webrtc-bridge

# Remove service file
sudo rm /etc/systemd/system/webrtc-bridge.service
sudo systemctl daemon-reload

# Remove files
sudo rm -rf /opt/webrtc-gateway-bridge
sudo rm -rf /var/lib/webrtc-bridge
sudo rm -rf /var/log/webrtc-bridge

# Remove user
sudo userdel webrtc-bridge
```

---

## 📚 Architecture

```
┌──────────────────────────────────────────────────┐
│  WWE (Genesys)                                   │
│  http://192.168.210.54:8090                      │
└──────────────────────────────────────────────────┘
                     │
                     │ HTTPS REST API
                     │ https://192.168.210.54:8000
                     ▼
┌──────────────────────────────────────────────────┐
│  WebRTC Bridge Service (systemd)                 │
│  /opt/webrtc-gateway-bridge/server.js            │
│                                                  │
│  ┌────────────────────────────────────────┐    │
│  │  Express API Server                    │    │
│  │  - /RegisterDn, /MakeCall, etc.        │    │
│  └────────────────────────────────────────┘    │
│                     │                            │
│                     │ postMessage                │
│                     ▼                            │
│  ┌────────────────────────────────────────┐    │
│  │  Puppeteer Headless Browser            │    │
│  │  Loads: wwe-webrtc-gateway.html        │    │
│  │  JsSIP Client                          │    │
│  └────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
                     │
                     │ WSS (SIP)
                     ▼
┌──────────────────────────────────────────────────┐
│  Nginx → Kamailio → Asterisk → Genesys          │
└──────────────────────────────────────────────────┘
```

---

## 🆘 Support

### Check Service Health

```bash
# Quick health check
curl -k https://192.168.210.54:8000/health | jq .

# Full dashboard
curl -k https://192.168.210.54:8000/dashboard
```

### Enable Debug Logging

```bash
# Edit service
sudo nano /etc/systemd/system/webrtc-bridge.service

# Change LOG_LEVEL
Environment="LOG_LEVEL=debug"

# Restart
sudo systemctl daemon-reload
sudo systemctl restart webrtc-bridge

# Watch logs
sudo journalctl -u webrtc-bridge -f
```

---

## ✅ Success Indicators

When properly running:

1. ✅ Service is active: `systemctl status webrtc-bridge` shows "active (running)"
2. ✅ Port is listening: `netstat -tlnp | grep 8000` shows LISTEN
3. ✅ Health check returns: `curl -k https://192.168.210.54:8000/health` returns JSON
4. ✅ Browser is running: health check shows `"browserRunning": true`
5. ✅ WWE can connect: WWE detects endpoint and shows "Ready"

---

## 📝 License

MIT

