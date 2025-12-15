# Fix Kamailio Logging

**Issue:** Kamailio logs not appearing in `kamailio/logs/` folder  
**Reason:** Kamailio logs go to syslog by default, not direct files  
**Solutions:** 3 options below

---

## 🎯 Solution 1: View Logs via Docker (EASIEST)

Kamailio logs are captured by Docker. View them directly:

```bash
# View all Kamailio logs
sudo docker logs webrtc-kamailio

# Follow logs in real-time
sudo docker logs -f webrtc-kamailio

# Last 50 lines
sudo docker logs webrtc-kamailio --tail 50

# Logs with timestamps
sudo docker logs -f --timestamps webrtc-kamailio

# Save logs to file
sudo docker logs webrtc-kamailio > kamailio-logs-$(date +%Y%m%d).txt
```

**This is the recommended way for POC!**

---

## 🎯 Solution 2: Rebuild with Syslog → File Logging

If you need physical log files in `kamailio/logs/`:

```bash
# On server
cd /opt/gcti_apps/webrtc

# Pull latest (includes updated Dockerfile with rsyslog)
sudo git pull origin main

# Rebuild Kamailio image
sudo docker build --no-cache -t webrtc-kamailio kamailio/

# Restart Kamailio
sudo docker-compose stop kamailio
sudo docker-compose up -d kamailio

# Wait a moment
sleep 5

# Check if log file is created
ls -la kamailio/logs/

# Should see: kamailio.log

# View log file
tail -f kamailio/logs/kamailio.log
```

---

## 🎯 Solution 3: Configure Log Rotation

For production-like log management:

```bash
# Create log rotation config
cat > kamailio/logs/.logrotate << 'EOF'
/var/log/kamailio/kamailio.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF

# Docker already has log rotation configured in docker-compose.yml:
# logging:
#   driver: "json-file"
#   options:
#     max-size: "5m"
#     max-file: "3"
```

---

## ✅ Verify Kamailio Logging

### **Check Docker Logs (Always Works):**

```bash
# Should see startup messages
sudo docker logs webrtc-kamailio | head -20

# Should see SIP messages
sudo docker logs webrtc-kamailio | grep -i sip

# Should see dispatcher checks
sudo docker logs webrtc-kamailio | grep -i options

# Should see no errors
sudo docker logs webrtc-kamailio | grep -i error
```

### **Check File Logs (After Solution 2):**

```bash
# Check log file exists
ls -lh kamailio/logs/kamailio.log

# View log
tail -20 kamailio/logs/kamailio.log

# Follow log
tail -f kamailio/logs/kamailio.log

# Search for errors
grep -i error kamailio/logs/kamailio.log
```

---

## 🔍 What to Look For in Logs

### **Good Signs:**

```bash
# Kamailio started
INFO: <core> [main.c:...]: kamailio ...

# UDP listener active
INFO: <core> [main.c:...]: UDP listener on 192.168.210.54:5060

# Dispatcher loaded
INFO: dispatcher [dispatch.c:...]: loaded destinations

# Sending OPTIONS to Asterisk (health check)
INFO: tm [t_lookup.c:...]: OPTIONS sip:192.168.210.54:5060

# Received 200 OK from Asterisk (healthy)
INFO: <core> [core/receive.c:...]: SIP/2.0 200 OK
```

### **Warning Signs:**

```bash
# Can't reach Asterisk
WARNING: dispatcher [dispatch.c:...]: destination marked as inactive

# Configuration errors
ERROR: <core> [cfg.y:...]: parse error in config file

# Port binding issues
ERROR: <core> [socket_info.c:...]: bind: Address already in use
```

---

## 📊 Compare: Docker Logs vs File Logs

| Method | Pros | Cons | Use Case |
|--------|------|------|----------|
| **Docker Logs** | ✅ Always works<br>✅ No config needed<br>✅ Integrated | ❌ Stored in Docker layer<br>❌ Harder to parse | POC, development |
| **File Logs** | ✅ Easy to access<br>✅ Can use standard tools<br>✅ Persistent | ❌ Needs syslog setup<br>❌ Extra complexity | Production |

---

## 🎬 For Your Demo

### **Show Kamailio Logs:**

```bash
# Real-time log viewing during demo
sudo docker logs -f webrtc-kamailio

"Here are Kamailio's logs in real-time. You can see:
- It's sending OPTIONS requests every 10 seconds to Asterisk
- Receiving 200 OK responses, confirming Asterisk is healthy
- This health check ensures we only route calls to functioning instances

In production with 20 Asterisk instances, Kamailio monitors all 
of them continuously and automatically removes any that fail health 
checks."
```

### **Show Kamailio Activity:**

```bash
# Show OPTIONS (health checks)
sudo docker logs webrtc-kamailio --tail 100 | grep OPTIONS

# Show responses from Asterisk
sudo docker logs webrtc-kamailio --tail 100 | grep "200 OK"

# Show dispatcher status
sudo docker exec webrtc-kamailio kamailioctl dispatcher dump
```

---

## 🚀 Quick Commands

### **For POC (Use Docker Logs):**

```bash
# Real-time monitoring
sudo docker logs -f webrtc-kamailio

# Save snapshot for review
sudo docker logs webrtc-kamailio > kamailio-$(date +%Y%m%d-%H%M%S).log

# Check for issues
sudo docker logs webrtc-kamailio | grep -iE "(error|warning|fail)"
```

### **For Production (File Logs):**

```bash
# After rebuilding with syslog support
tail -f kamailio/logs/kamailio.log

# Rotate logs manually
sudo docker-compose restart kamailio

# Check log size
du -h kamailio/logs/
```

---

## 🔧 Troubleshooting

### **No Logs at All:**

```bash
# Check if Kamailio is running
sudo docker ps | grep kamailio

# Check if it's crashing
sudo docker logs webrtc-kamailio | tail -50

# Check debug level in config
grep debug kamailio/kamailio.cfg
# Should be: debug=3 (or higher for more verbosity)
```

### **Logs but No File:**

```bash
# Check volume mount
sudo docker inspect webrtc-kamailio | grep -A 5 Mounts

# Check permissions
ls -la kamailio/logs/
sudo chmod 777 kamailio/logs/

# Rebuild with syslog support (Solution 2)
sudo docker build --no-cache -t webrtc-kamailio kamailio/
sudo docker-compose restart kamailio
```

### **Too Many Logs:**

```bash
# Reduce debug level in kamailio.cfg
# Change: debug=3 to debug=1

# Rebuild
sudo docker build -t webrtc-kamailio kamailio/
sudo docker-compose restart kamailio

# Or use log filtering
sudo docker logs webrtc-kamailio | grep -v DEBUG
```

---

## 📝 Other Service Logs (For Reference)

All services write logs to their folders:

```bash
# Asterisk logs (physical files)
ls -lh asterisk/logs/
tail -f asterisk/logs/full

# Coturn logs  
ls -lh coturn/logs/
tail -f coturn/logs/turnserver.log

# Nginx logs
ls -lh nginx/logs/
tail -f nginx/logs/access.log

# Registration monitor logs
ls -lh registration-monitor/logs/
tail -f registration-monitor/logs/registration_monitor.log

# Dashboard API logs
ls -lh dashboard/logs/
tail -f dashboard/logs/dashboard_api.log

# Redis logs (Docker only)
sudo docker logs webrtc-redis

# Kamailio logs (Docker by default, file after Solution 2)
sudo docker logs webrtc-kamailio
# OR
tail -f kamailio/logs/kamailio.log  # After Solution 2
```

---

## 🎯 Recommendation for POC

**Use Docker logs** (`sudo docker logs webrtc-kamailio`) for your POC.

**Why?**
- ✅ Works immediately, no rebuild needed
- ✅ Sufficient for demo and troubleshooting  
- ✅ Can export to file anytime: `docker logs webrtc-kamailio > file.log`
- ✅ Integrated with Docker's log rotation (already configured)

**For production Kubernetes:**
- Logs automatically collected by Kubernetes
- Sent to centralized logging (ELK/EFK stack)
- Grafana Loki or similar for log aggregation
- No need for file-based logs

---

**TL;DR:** Use `sudo docker logs -f webrtc-kamailio` for POC. Physical log files are optional and need rebuilding with Solution 2. ✅

