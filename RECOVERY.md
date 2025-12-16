# 🛡️ Quick Recovery Guide

## Failsafe Version

**Tag:** `v1.0-failsafe-hybrid-mode`  
**Commit:** `2634bd1`  
**Status:** ✅ Working - Hybrid Mode (Outbound Registration + Inbound Trunk)

---

## 🚨 Quick Recovery

### On Server (192.168.210.54)

```bash
cd /opt/gcti_apps/webrtc-genesys
git fetch --all --tags
git reset --hard v1.0-failsafe-hybrid-mode
sudo docker-compose down
sudo docker-compose up -d
```

### On Local Windows

```powershell
cd D:\Abhi\WebRTC\webrtc-genesys
git fetch --all --tags
git reset --hard v1.0-failsafe-hybrid-mode
```

---

## 📦 Fresh Deployment

```bash
# Clone and checkout failsafe
git clone https://github.com/abhi2varma/webrtc-genesys.git
cd webrtc-genesys
git checkout v1.0-failsafe-hybrid-mode

# Build images
sudo docker build -t webrtc-registration-monitor ./registration-monitor
sudo docker build -t webrtc-dashboard-api ./dashboard
sudo docker build -t webrtc-kamailio ./kamailio

# Create directories with permissions
sudo mkdir -p registration-monitor/logs dashboard/logs kamailio/logs asterisk/logs nginx/logs coturn/logs redis/data
sudo chmod -R 777 registration-monitor/logs dashboard/logs kamailio/logs asterisk/logs nginx/logs coturn/logs redis/data

# Deploy
sudo docker-compose up -d
```

---

## 🔍 Verification

```bash
# Check services
sudo docker-compose ps

# Check Asterisk
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints"

# Check logs
sudo docker logs webrtc-asterisk --tail 20
sudo docker logs webrtc-registration-monitor --tail 20
```

---

## 🔧 Quick Fixes

### Fix Permissions

```bash
cd /opt/gcti_apps/webrtc-genesys
sudo docker-compose down
sudo rm -rf */logs/* redis/data/*
sudo mkdir -p registration-monitor/logs dashboard/logs kamailio/logs asterisk/logs nginx/logs coturn/logs redis/data
sudo chmod -R 777 registration-monitor/logs dashboard/logs kamailio/logs asterisk/logs nginx/logs coturn/logs redis/data
sudo docker-compose up -d
```

### Rebuild Everything

```bash
sudo docker-compose down
sudo docker system prune -a -f
sudo docker build -t webrtc-registration-monitor ./registration-monitor
sudo docker build -t webrtc-dashboard-api ./dashboard
sudo docker build -t webrtc-kamailio ./kamailio
sudo docker-compose up -d
```

---

## 📞 Server Info

- **Server:** 192.168.210.54:69 (SSH)
- **Project:** /opt/gcti_apps/webrtc-genesys
- **WebRTC:** http://192.168.210.54
- **Dashboard:** http://192.168.210.54/dashboard.html
- **Genesys SIP:** 192.168.210.81:5060

---

## 🔐 Create New Failsafe

```bash
git add .
git commit -m "Description"
git tag -a v1.X-failsafe -m "Description"
git branch backup/v1.X
git push origin v1.X-failsafe backup/v1.X
```

---

**Last Updated:** December 17, 2025
