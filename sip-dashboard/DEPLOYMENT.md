# SIP Registration Dashboard - Docker Deployment Guide

## 📋 Overview

This service runs on **Server 54** and monitors SIP logs from **Server 81** via network share.

**Features:**
- Real-time SIP registration monitoring
- Web-based dashboard with auto-refresh
- Monitors `D:\gcti_logs\SIP_P` folder on Server 81
- Accessible at http://192.168.210.54:5500

---

## 🚀 Deployment Steps

### **Step 1: Setup Network Share (on Server 81 - Windows)**

Share the SIP logs folder:

```powershell
# Open PowerShell as Administrator on Server 81

# Create network share for SIP logs
New-SmbShare -Name "gcti_logs" -Path "D:\gcti_logs" -FullAccess "Everyone"

# Or use GUI:
# Right-click D:\gcti_logs → Properties → Sharing → Share →  Add "Everyone" → Read permission
```

**Alternative - Direct path access:**
```powershell
# Give Server 54 access to D$ share (already enabled by default on Windows Server)
# The dashboard will access: //192.168.210.81/D$/gcti_logs/SIP_P
```

### **Step 2: Test Network Access (from Server 54)**

```bash
# SSH to Server 54
ssh Gencct@192.168.210.54

# Test access to Server 81 share
# Install cifs-utils if not present
sudo yum install cifs-utils -y

# Create test mount
sudo mkdir -p /mnt/test-sip-logs
sudo mount -t cifs -o guest //192.168.210.81/D$/gcti_logs/SIP_P /mnt/test-sip-logs

# Check if logs are accessible
ls -la /mnt/test-sip-logs

# Unmount test
sudo umount /mnt/test-sip-logs
```

### **Step 3: Deploy Docker Service**

```bash
# Navigate to project directory
cd /opt/gcti_apps/webrtc_genesys

# Pull latest changes (if using git)
git pull

# Build the SIP dashboard image
docker-compose build sip-dashboard

# Start the service
docker-compose up -d sip-dashboard

# Check logs
docker logs -f webrtc-sip-dashboard
```

### **Step 4: Verify Deployment**

```bash
# Check container status
docker ps | grep sip-dashboard

# Test API endpoint
curl http://localhost:5500/api/health

# View logs
docker logs webrtc-sip-dashboard | tail -20
```

---

## 🌐 Access Dashboard

**Internal Network:**
- http://192.168.210.54:5500
- http://localhost:5500 (from Server 54)

**API Endpoints:**
- `/api/registrations` - Current registrations
- `/api/events` - Recent events
- `/api/stats` - Statistics
- `/api/health` - Health check

---

## 🔧 Configuration

### **Change Log Path**

Edit `docker-compose.yml`:

```yaml
volumes:
  - type: bind
    source: //192.168.210.81/D$/gcti_logs/SIP_P  # Change this path
    target: /logs
    read_only: true
```

### **Change Port**

Edit `docker-compose.yml`:

```yaml
ports:
  - "5500:5000"  # Change 5500 to your preferred port
```

### **With Credentials (if share requires auth)**

Edit `docker-compose.yml`:

```yaml
volumes:
  - type: bind
    source: //192.168.210.81/gcti_logs
    target: /logs
    read_only: true
    volume:
      driver_opts:
        type: cifs
        o: username=your_user,password=your_pass,domain=DOMAIN
        device: //192.168.210.81/gcti_logs/SIP_P
```

---

## 🐛 Troubleshooting

### **Issue: Dashboard shows "No log files found"**

**Check:**
```bash
# SSH to Server 54
docker exec webrtc-sip-dashboard ls -la /logs

# If empty, check mount
docker exec webrtc-sip-dashboard df -h | grep logs
```

**Solution:**
```bash
# Ensure Server 81 share is accessible
# From Server 54:
smbclient -L //192.168.210.81 -N

# Restart container
docker-compose restart sip-dashboard
```

### **Issue: Permission denied**

**Solution:**
```bash
# On Server 81 (Windows), ensure share permissions allow read access
# Right-click folder → Properties → Sharing → Advanced Sharing → Permissions

# Or mount with credentials
# Update docker-compose.yml with username/password
```

### **Issue: Connection timeout**

**Check firewall:**
```bash
# On Server 81 (Windows)
# Allow SMB/CIFS ports 139, 445
netsh advfirewall firewall add rule name="SMB" dir=in action=allow protocol=TCP localport=445
```

### **Issue: Logs not updating**

**Check:**
```bash
# View container logs
docker logs webrtc-sip-dashboard

# Check if logs are being written on Server 81
# Ensure new log files match pattern: SIP_P-001.*.log
```

---

## 🔄 Updates & Maintenance

### **Update Dashboard**

```bash
cd /opt/gcti_apps/webrtc_genesys

# Pull latest code
git pull

# Rebuild and restart
docker-compose build sip-dashboard
docker-compose restart sip-dashboard
```

### **View Logs**

```bash
# Real-time logs
docker logs -f webrtc-sip-dashboard

# Last 100 lines
docker logs --tail 100 webrtc-sip-dashboard
```

### **Stop/Start**

```bash
# Stop
docker-compose stop sip-dashboard

# Start
docker-compose start sip-dashboard

# Restart
docker-compose restart sip-dashboard

# Remove and recreate
docker-compose rm -f sip-dashboard
docker-compose up -d sip-dashboard
```

---

## 📊 Dashboard Features

### **Real-time Stats**
- Currently registered endpoints
- Total registration requests
- Successful registrations
- Failed attempts
- Unique DNs count

### **Registered Endpoints Table**
- DN number
- Contact address
- Expiration time
- Last update timestamp

### **Recent Events Feed**
- Last 50 registration events
- Color-coded status (green=success, red=error)
- Timestamp, DN, contact, and source IP

### **Auto-refresh**
- Updates every 2 seconds
- Live indicator shows connection status
- Error banner if log monitoring fails

---

## 🔐 Security Notes

1. **Read-only mount**: Logs are mounted read-only for security
2. **No write access**: Dashboard cannot modify log files
3. **Network isolation**: Uses host network mode for simplicity
4. **Consider:** Add authentication if exposing to wider network

---

## ✅ Success Indicators

After deployment, you should see:

1. ✅ Container running: `docker ps | grep sip-dashboard`
2. ✅ Health check OK: `curl http://localhost:5500/api/health`
3. ✅ Dashboard accessible: http://192.168.210.54:5500
4. ✅ Logs visible: Current registrations showing
5. ✅ Live indicator: Green "● LIVE" badge

---

## 📝 Example docker-compose.yml Entry

```yaml
sip-dashboard:
  build: ./sip-dashboard
  image: webrtc-sip-dashboard
  container_name: webrtc-sip-dashboard
  hostname: sip-dashboard
  network_mode: host
  restart: unless-stopped
  volumes:
    - type: bind
      source: //192.168.210.81/D$/gcti_logs/SIP_P
      target: /logs
      read_only: true
  environment:
    - LOG_PATH=/logs
    - FLASK_ENV=production
  ports:
    - "5500:5000"
  logging:
    driver: "json-file"
    options:
      max-size: "5m"
      max-file: "3"
```

---

## 🎯 Next Steps

1. Deploy using the steps above
2. Access dashboard at http://192.168.210.54:5500
3. Verify registrations are showing
4. Share dashboard URL with team
5. Monitor for any errors in container logs

**Need help?** Check container logs: `docker logs webrtc-sip-dashboard`
