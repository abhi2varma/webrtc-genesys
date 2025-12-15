# Fix Kamailio Image Issue

**Error:** `pull access denied for kamailio/kamailio`  
**Reason:** The image path was incorrect  
**Solutions:** Build locally OR skip Kamailio for POC

---

## 🚀 Solution 1: Build Kamailio Locally (RECOMMENDED)

```bash
# On server 192.168.210.54
cd /opt/gcti_apps/webrtc

# Pull latest code (includes Dockerfile for Kamailio)
sudo git pull origin main

# Build Kamailio image locally
cd kamailio
sudo docker build -t webrtc-kamailio .

# Go back and start all services
cd ..
sudo docker-compose up -d

# Verify
sudo docker-compose ps
```

**Expected:** All 7 services running, including `webrtc-kamailio`

---

## 🎯 Solution 2: Skip Kamailio for POC (FASTER)

**Why skip?** Kamailio is a load balancer - not needed for single Asterisk instance POC.

```bash
# On server 192.168.210.54
cd /opt/gcti_apps/webrtc

# Start all services EXCEPT Kamailio
sudo docker-compose up -d asterisk coturn nginx redis registration-monitor dashboard-api

# Verify (6 services without Kamailio)
sudo docker-compose ps
```

**Your POC still works perfectly:**
- ✅ WebRTC client: http://192.168.210.54/
- ✅ Dashboard: http://192.168.210.54/dashboard.html
- ✅ Asterisk → Genesys: Working
- ✅ Redis: State storage
- ❌ Kamailio: Skipped (not needed for single instance)

---

## 📊 Comparison

| Approach | Services | Time | Complexity | Demo Impact |
|----------|----------|------|------------|-------------|
| **Build Kamailio** | 7 | 5 min | Medium | Show complete stack |
| **Skip Kamailio** | 6 | 1 min | Low | POC works fine |

---

## ✅ Quick Fix (Choose One)

### **Option A: Build Kamailio (Complete Stack)**

```bash
ssh Gencct@192.168.210.54 -p 69
cd /opt/gcti_apps/webrtc

# Pull latest (includes Kamailio Dockerfile)
sudo git pull origin main

# Build Kamailio
sudo docker build -t webrtc-kamailio kamailio/

# Start all services
sudo docker-compose up -d

# Check all 7 running
sudo docker-compose ps
```

### **Option B: Skip Kamailio (Faster POC)**

```bash
ssh Gencct@192.168.210.54 -p 69
cd /opt/gcti_apps/webrtc

# Start 6 services (without Kamailio)
sudo docker-compose up -d asterisk coturn nginx redis registration-monitor dashboard-api

# Check 6 running
sudo docker-compose ps
```

---

## 🎬 For Your Demo

### **If you built Kamailio (7 services):**
```
"We have the complete production stack running:
- Asterisk for SIP gateway
- Redis for state storage
- Kamailio for SIP load balancing (ready for multi-instance)
- Plus Coturn, Nginx, Monitor, and Dashboard

This is the exact same stack that will run on Kubernetes."
```

### **If you skipped Kamailio (6 services):**
```
"We have 6 services running for this POC:
- Asterisk for SIP gateway
- Redis for state storage
- Plus Coturn, Nginx, Monitor, and Dashboard

For production with 20 Asterisk instances, we'll add Kamailio 
as the SIP load balancer to distribute calls across all instances."
```

---

## 🔍 Why This Error Happened

The original `docker-compose.yml` referenced:
```yaml
image: kamailio/kamailio:5.7-alpine
```

**Issue:** This image doesn't exist on Docker Hub in that exact path.

**Fix:** Build Kamailio locally from Alpine Linux + Kamailio package.

---

## 📝 What Changed

**Old (broken):**
```yaml
kamailio:
  image: kamailio/kamailio:5.7-alpine  # ← Doesn't exist
```

**New (working):**
```yaml
kamailio:
  build: ./kamailio           # ← Build from Dockerfile
  image: webrtc-kamailio
```

**New file added:** `kamailio/Dockerfile`

---

## ✅ Verify Everything Works

### **After Building Kamailio:**

```bash
# Check image exists
sudo docker images | grep kamailio
# Should show: webrtc-kamailio

# Check container running
sudo docker ps | grep kamailio
# Should show: webrtc-kamailio

# Test Kamailio
sudo docker exec webrtc-kamailio pidof kamailio
# Should return process IDs

# Check logs
sudo docker logs webrtc-kamailio --tail 20
```

### **After Skipping Kamailio:**

```bash
# Check 6 services running
sudo docker-compose ps

# Test WebRTC client
curl http://192.168.210.54/
# Should return HTML

# Test Redis
sudo docker exec webrtc-redis redis-cli ping
# Should return PONG
```

---

## 🎯 Recommendation

**For immediate POC demo:** Choose **Option B** (skip Kamailio) - faster and works fine

**For complete architecture demo:** Choose **Option A** (build Kamailio) - shows full stack

**My suggestion:** Skip Kamailio now, add it later if stakeholders want to see load balancing capabilities.

---

## 🚨 If Build Fails

```bash
# Check Alpine package availability
sudo docker run --rm alpine:3.18 apk search kamailio

# If kamailio package not found, use this alternative Dockerfile:
cat > kamailio/Dockerfile << 'EOF'
FROM debian:bullseye-slim

RUN apt-get update && apt-get install -y \
    kamailio \
    kamailio-json-modules \
    kamailio-tls-modules \
    kamailio-websocket-modules \
    && rm -rf /var/lib/apt/lists/*

COPY kamailio.cfg /etc/kamailio/kamailio.cfg
COPY dispatcher.list /etc/kamailio/dispatcher.list

EXPOSE 5060/udp 5060/tcp

CMD ["kamailio", "-DD", "-E"]
EOF

# Then build
sudo docker build -t webrtc-kamailio kamailio/
```

---

**Quick Decision:**
- **Need demo NOW?** → Skip Kamailio (Option B)
- **Have 5 minutes?** → Build Kamailio (Option A)
- **Either way,** your POC works! ✅

