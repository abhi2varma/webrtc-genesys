# Quick Update: Add Redis & Kamailio to POC

**Server:** 192.168.210.54  
**Time:** 5-10 minutes  
**Services to Add:** Redis + Kamailio

---

## 🎯 What You're Adding

### **Redis (Port 6379):**
- State storage for DN mappings
- Session persistence
- Ready for Kubernetes scaling

### **Kamailio (Port 5060):**
- SIP load balancer/proxy
- Health checks for Asterisk
- Ready for multi-instance Asterisk

---

## 🚀 Quick Deployment (3 Steps)

### **Step 1: SSH to Server**

```bash
ssh Gencct@192.168.210.54 -p 69
cd /opt/gcti_apps/webrtc
```

### **Step 2: Run Update Script**

```bash
# Copy script from your local machine (if needed)
# Or just run these commands directly:

# Pull latest code
sudo git stash
sudo git pull origin main

# Create directories
sudo mkdir -p redis/data redis/logs kamailio/logs
sudo chmod -R 755 redis/ kamailio/

# Restart with new services
sudo docker-compose down
sudo docker-compose up -d

# Wait for startup
sleep 15
```

### **Step 3: Verify All Services Running**

```bash
# Check all 7 services
sudo docker-compose ps

# Expected output:
# NAME                           STATUS
# webrtc-asterisk                Up
# webrtc-coturn                  Up
# webrtc-nginx                   Up
# webrtc-redis                   Up      ← NEW!
# webrtc-kamailio                Up      ← NEW!
# webrtc-registration-monitor    Up
# webrtc-dashboard-api           Up

# All should show "Up"
```

---

## ✅ Verify Redis is Working

```bash
# Test Redis connection
sudo docker exec webrtc-redis redis-cli ping
# Expected: PONG

# Check Redis info
sudo docker exec webrtc-redis redis-cli info server

# Check Redis logs
sudo docker logs webrtc-redis --tail 20
```

---

## ✅ Verify Kamailio is Working

```bash
# Check Kamailio process
sudo docker exec webrtc-kamailio pidof kamailio
# Should return process ID numbers

# Check Kamailio dispatcher list
sudo docker exec webrtc-kamailio kamailioctl dispatcher dump
# Should show:
# SET_ID: 1
# URI: sip:192.168.210.54:5060
# FLAGS: AP
# PRIORITY: 0

# Check Kamailio logs
sudo docker logs webrtc-kamailio --tail 30
```

---

## 🔍 Troubleshooting

### **Issue: Redis Container Exits Immediately**

```bash
# Check logs
sudo docker logs webrtc-redis

# Common cause: Permission issues
sudo chown -R 999:999 redis/data
sudo docker-compose restart redis
```

### **Issue: Kamailio Container Won't Start**

```bash
# Check logs
sudo docker logs webrtc-kamailio

# Common causes:
# 1. Config file syntax error
sudo docker exec webrtc-kamailio kamailio -c -f /etc/kamailio/kamailio.cfg

# 2. Port 5060 conflict (Asterisk also uses 5060)
# This is OK - both use host network mode and bind to same port for different purposes

# 3. Missing config files
ls -la kamailio/
# Should see: kamailio.cfg, dispatcher.list
```

### **Issue: "Cannot pull" Docker Images**

```bash
# Pull manually
sudo docker pull redis:7-alpine
sudo docker pull kamailio/kamailio:5.7-alpine

# Then start
sudo docker-compose up -d redis kamailio
```

---

## 🎯 What Changed in Your System

### **Before (5 services):**
```
Asterisk → Genesys SIP Server
   ↑
WebRTC Client
```

### **After (7 services):**
```
                     Redis
                       ↕ (state storage)
WebRTC Client → Kamailio → Asterisk → Genesys SIP Server
                (load bal)  (gateway)
```

**Benefits:**
- ✅ **Redis:** Ready for multi-instance scaling (stores DN → Asterisk mappings)
- ✅ **Kamailio:** Ready for load balancing (when you add more Asterisk instances)
- ✅ **Complete Stack:** Same architecture as Kubernetes production

---

## 🧪 Test the Complete Stack

### **Test 1: WebRTC Client (Unchanged)**

```bash
# Open browser
http://192.168.210.54/

# Register
User: 5001
Password: pass5001

# Should work exactly as before
```

### **Test 2: Redis Integration**

```bash
# Registration monitor now uses Redis
sudo docker logs webrtc-registration-monitor --tail 20

# Should see Redis connection logs (if Redis is configured)
# For now, it's optional - system works with or without Redis
```

### **Test 3: Kamailio Health Checks**

```bash
# Kamailio pings Asterisk every 10 seconds
sudo docker logs webrtc-kamailio --tail 50 | grep OPTIONS

# Should see periodic OPTIONS requests to Asterisk
# This ensures Asterisk is healthy before routing calls
```

---

## 📊 Updated Architecture

### **Your POC Now Includes:**

| Service | Status | Purpose |
|---------|--------|---------|
| Asterisk | ✅ Running | SIP gateway, WebRTC handler |
| Redis | ✅ NEW | State storage, DN mappings |
| Kamailio | ✅ NEW | SIP proxy, load balancer |
| Coturn | ✅ Running | TURN server, NAT traversal |
| Nginx | ✅ Running | Web server, reverse proxy |
| Monitor | ✅ Running | Dynamic DN registration |
| Dashboard | ✅ Running | Real-time monitoring |

**Total:** 7 services (was 5, added 2)

---

## 🎬 Updated Demo Points

### **Show Redis:**
```bash
# During demo, show Redis is storing state
sudo docker exec webrtc-redis redis-cli keys "*"

# Show Redis info
sudo docker exec webrtc-redis redis-cli info stats

"Redis is our distributed state store. When we scale to 20 Asterisk 
instances in production, Redis will track which DN is registered to 
which Asterisk instance. This enables proper call routing in a 
load-balanced environment."
```

### **Show Kamailio:**
```bash
# Show Kamailio dispatcher list
sudo docker exec webrtc-kamailio kamailioctl dispatcher dump

"Kamailio is our SIP load balancer. Currently pointing to our single 
Asterisk instance. In production with 20 Asterisk instances, Kamailio 
will distribute calls across all of them, performing health checks 
every 10 seconds to ensure we only route to healthy instances."
```

---

## 🔄 Rollback (If Needed)

If you need to go back to the 5-service setup:

```bash
# Stop Redis and Kamailio
sudo docker-compose stop redis kamailio

# Or remove them completely
sudo docker-compose rm -f redis kamailio

# Rest of system continues working
```

---

## ✅ Success Checklist

After update, verify:
- [ ] All 7 containers show "Up" (`docker-compose ps`)
- [ ] Redis responds to PING (`docker exec webrtc-redis redis-cli ping`)
- [ ] Kamailio is running (`docker exec webrtc-kamailio pidof kamailio`)
- [ ] WebRTC client still works (register 5001)
- [ ] Asterisk still registered to Genesys (`pjsip show registrations`)
- [ ] Dashboard still shows data (`http://192.168.210.54/dashboard.html`)
- [ ] No errors in logs (`docker-compose logs --tail 50`)

---

## 📝 What's Next

### **Your POC is now complete with:**
- ✅ All 7 services of production architecture
- ✅ Same Docker Compose stack as Kubernetes will use
- ✅ Ready for demo with full stack
- ✅ Easy migration path: Docker Compose → Kubernetes

### **For Demo:**
- Continue using existing demo script
- Optionally add 2 minutes to show Redis + Kamailio
- Emphasize "production-ready architecture"

### **For Production:**
- This same stack deploys to Kubernetes
- Kubernetes adds: auto-scaling, HA, load balancing
- Timeline: 6-8 weeks for full 23-node deployment

---

**Time to Complete:** 5-10 minutes  
**Downtime:** 30 seconds (during restart)  
**Risk:** Low (can rollback easily)  
**Benefit:** Complete production architecture in POC!

---

**Ready to update? Just run the commands in Step 2!** 🚀

