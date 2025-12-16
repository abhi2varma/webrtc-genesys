# 🛡️ WebRTC-Genesys Recovery Guide

## Failsafe Version Information

**Version:** v1.0-failsafe-hybrid-mode  
**Commit:** 2634bd1  
**Date:** December 17, 2025  
**Status:** ✅ WORKING - Tested and Verified

### Features in This Version
- ✅ Hybrid Mode (Outbound Registration + Inbound Trunk)
- ✅ 20 DNs configured (5001-5020)
- ✅ Registration monitor working
- ✅ Dashboard API functional
- ✅ Host network mode for server deployment
- ✅ Genesys SIP Server: 192.168.210.81
- ✅ Asterisk Server: 192.168.210.54

---

## 🚨 Quick Recovery (If Something Breaks)

### On Server (192.168.210.54)

```bash
# Complete recovery with container restart
cd /opt/gcti_apps/webrtc-genesys
git fetch --all --tags
git reset --hard v1.0-failsafe-hybrid-mode
sudo docker-compose down
sudo docker-compose up -d
sudo docker-compose ps
```

### On Local Windows Development Machine

```powershell
# Navigate to project
cd D:\Abhi\WebRTC\webrtc-genesys

# Fetch and reset to failsafe
git fetch --all --tags
git reset --hard v1.0-failsafe-hybrid-mode

# Verify
git log --oneline -1
```

---

## 📋 Detailed Recovery Methods

### Method 1: Reset to Failsafe Tag (Recommended)

This is the **safest** and **fastest** method.

```bash
# Fetch all updates including tags
git fetch --all --tags

# Reset to the failsafe tag
git reset --hard v1.0-failsafe-hybrid-mode

# Force push to origin if you're on main branch
git push origin main --force
```

**When to use:**
- Quick rollback needed
- Testing went wrong
- Configuration broken

---

### Method 2: Switch to Backup Branch

Use this if you want to work from a clean branch.

```bash
# Fetch all branches
git fetch --all

# Checkout the backup branch
git checkout backup/working-hybrid-mode

# Optional: Make it the new main
git branch -D main
git checkout -b main
git push origin main --force
```

**When to use:**
- Want to start fresh from working state
- Main branch is corrupted
- Need clean working branch

---

### Method 3: Cherry-Pick Specific Commits

If you want to keep some changes but revert others.

```bash
# View commit history
git log --oneline

# Reset to failsafe
git reset --hard v1.0-failsafe-hybrid-mode

# Cherry-pick specific good commits
git cherry-pick <commit-hash>

# Push changes
git push origin main
```

**When to use:**
- Some new changes are good
- Want to keep specific features
- Selective recovery needed

---

## 🔍 Verification Commands

### Check Current Version

```bash
# Show current commit
git log --oneline -1

# Show all tags
git tag -l

# Show tag details
git show v1.0-failsafe-hybrid-mode

# Check if on failsafe commit
git describe --tags
```

### Verify Services After Recovery

```bash
# Check all containers
sudo docker-compose ps

# Check Asterisk endpoints
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints"

# Check Genesys registrations
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show registrations"

# Check registration monitor
sudo docker logs webrtc-registration-monitor --tail 30

# Check dashboard API
sudo docker logs webrtc-dashboard-api --tail 20
```

---

## 📦 Complete Fresh Deployment from Failsafe

If you need to deploy from scratch on a new server:

```bash
# Clone repository
git clone https://github.com/abhi2varma/webrtc-genesys.git
cd webrtc-genesys

# Checkout failsafe version
git checkout v1.0-failsafe-hybrid-mode

# Build custom images
sudo docker build -t webrtc-registration-monitor ./registration-monitor
sudo docker build -t webrtc-dashboard-api ./dashboard
sudo docker build -t webrtc-kamailio ./kamailio

# Create and set log/data directory permissions (BUG FIX #1: Added redis/data)
sudo mkdir -p registration-monitor/logs dashboard/logs kamailio/logs asterisk/logs nginx/logs coturn/logs redis/data
sudo chmod -R 777 registration-monitor/logs dashboard/logs kamailio/logs asterisk/logs nginx/logs coturn/logs redis/data

# Start services
sudo docker-compose up -d

# Verify
sudo docker-compose ps
```

---

## 🎯 Troubleshooting After Recovery

### If Containers Don't Start

```bash
# Stop everything
sudo docker-compose down

# Remove old containers and volumes
sudo docker system prune -a

# Rebuild images
sudo docker build -t webrtc-registration-monitor ./registration-monitor
sudo docker build -t webrtc-dashboard-api ./dashboard
sudo docker build -t webrtc-kamailio ./kamailio

# Start fresh
sudo docker-compose up -d
```

### If Registration Monitor Fails

```bash
# Fix log permissions (BUG FIX #2: Create all service log directories)
cd /opt/gcti_apps/webrtc-genesys
sudo rm -rf */logs/* redis/data/*
sudo mkdir -p registration-monitor/logs dashboard/logs kamailio/logs asterisk/logs nginx/logs coturn/logs redis/data
sudo chmod -R 777 registration-monitor/logs dashboard/logs kamailio/logs asterisk/logs nginx/logs coturn/logs redis/data

# Restart
sudo docker-compose restart registration-monitor
sudo docker logs webrtc-registration-monitor --tail 20
```

### If Asterisk Fails to Start

```bash
# View current endpoints and status (BUG FIX #3: Corrected comment)
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints"

# Validate PJSIP configuration syntax
sudo docker exec webrtc-asterisk asterisk -rx "pjsip reload"

# View Asterisk logs
sudo docker logs webrtc-asterisk --tail 50

# Restart Asterisk
sudo docker-compose restart asterisk
```

---

## 🔐 Backup Strategy

### Create New Failsafe Point

When you have a new working version:

```bash
# Commit your changes
git add .
git commit -m "New working version description"

# Create new failsafe tag
git tag -a v1.X-failsafe-description -m "Description of this failsafe"

# Create backup branch
git branch backup/working-v1.X

# Push to remote
git push origin v1.X-failsafe-description
git push origin backup/working-v1.X
```

### List All Failsafe Points

```bash
# List all failsafe tags
git tag -l | grep failsafe

# List all backup branches
git branch -r | grep backup
```

---

## 📞 Emergency Contacts

### Access Information
- **Server:** 192.168.210.54
- **SSH Port:** 69
- **SSH User:** Gencct
- **Project Path:** /opt/gcti_apps/webrtc-genesys

### Service Endpoints
- **WebRTC Client:** http://192.168.210.54
- **Dashboard:** http://192.168.210.54/dashboard.html
- **Genesys SIP:** 192.168.210.81:5060

### Key Configuration Files
- `asterisk/etc/pjsip.conf` - SIP endpoint and registration config
- `asterisk/etc/extensions.conf` - Dialplan
- `docker-compose.yml` - Service orchestration
- `nginx/nginx.conf` - Web proxy configuration

---

## ⚠️ Important Notes

1. **Always test on a dev environment first** before deploying to production
2. **Create a new failsafe tag** after making significant working changes
3. **Document any configuration changes** in commit messages
4. **Keep backup branches** for at least 30 days
5. **Test recovery procedure** periodically to ensure it works

---

## 📝 Recovery Checklist

After recovery, verify these items:

- [ ] All containers are running (`docker-compose ps`)
- [ ] Asterisk endpoints configured (`pjsip show endpoints`)
- [ ] Registration monitor connected (`docker logs webrtc-registration-monitor`)
- [ ] Dashboard API responding (`curl http://localhost/api/registrations`)
- [ ] WebRTC client page loads (`http://192.168.210.54`)
- [ ] WebRTC client can connect (test with DN 5001)
- [ ] Genesys SIP server reachable (check registrations)
- [ ] Audio/video calls working (end-to-end test)

---

## 🆘 If All Else Fails

1. Stop all containers: `sudo docker-compose down`
2. Backup current state: `tar -czf backup-$(date +%Y%m%d).tar.gz /opt/gcti_apps/webrtc-genesys`
3. Clone fresh from failsafe: `git clone -b backup/working-hybrid-mode <repo-url>`
4. Follow "Complete Fresh Deployment" steps above
5. Contact system administrator if issues persist

---

**Last Updated:** December 17, 2025  
**Failsafe Version:** v1.0-failsafe-hybrid-mode  
**Recovery Tested:** ✅ Yes
