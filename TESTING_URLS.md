# 🧪 Testing URLs - WebRTC Gateway

**Server:** `192.168.210.54`  
**Release:** v1.0-browser-jssip-working  
**Date:** December 29, 2025

---

## 🌐 Quick Access URLs

### 1. **Main Application (Browser)**
```
https://192.168.210.54:8443/wwe-demo.html
```
**Purpose:** WWE integration demo page  
**What it does:** Shows how WWE would embed the WebRTC gateway  
**Test:** Click "Sign In" → "Make Call" → "Hangup"

---

### 2. **WebRTC Gateway (Standalone)**
```
https://192.168.210.54:8443/wwe-webrtc-gateway.html
```
**Purpose:** Direct access to WebRTC gateway iframe  
**What it does:** JsSIP client with comprehensive logging  
**Test:** Open browser console to see detailed SIP/WebRTC logs

---

### 3. **Dashboard (Monitoring)**
```
https://192.168.210.54:8443/
```
**Purpose:** Real-time monitoring dashboard  
**What it does:** Shows registrations, calls, and system status  
**Test:** View live registration and call statistics

---

## 📡 API Endpoints (Public - HTTPS)

### Dashboard APIs - Port 8443

#### 1. Health Check
```bash
curl -k https://192.168.210.54:8443/api/health
```
**Expected Response:**
```json
{
  "status": "ok",
  "service": "webrtc-dashboard",
  "version": "1.0.0",
  "uptime_seconds": 3600
}
```

---

#### 2. Get Active Registrations
```bash
curl -k https://192.168.210.54:8443/api/registrations
```
**Expected Response:**
```json
{
  "success": true,
  "registrations": [
    {
      "endpoint": "5001",
      "status": "Registered",
      "contact": "sip:5001@192.168.210.54:5060"
    }
  ],
  "total_count": 1
}
```

---

#### 3. Get Kamailio Status
```bash
curl -k https://192.168.210.54:8443/api/kamailio
```
**Expected Response:**
```json
{
  "success": true,
  "kamailio_running": true,
  "dispatchers": [
    {
      "destination": "sip:192.168.210.54:5060",
      "health": "Healthy"
    }
  ]
}
```

---

## 🔌 Internal APIs (From Server - HTTP)

### Gateway APIs - Port 8084

**Note:** These must be run from the server (SSH to genuat01)

```bash
ssh Gencct@192.168.210.54
```

#### 1. Gateway Health Check
```bash
curl http://localhost:8084/api/health
```

---

#### 2. List Registered Agents
```bash
curl http://localhost:8084/api/agents
```
**Expected Response:**
```json
{
  "agents": [
    {
      "id": "agent123",
      "dn": "5001",
      "status": "available"
    }
  ],
  "count": 1
}
```

---

#### 3. List Active Calls
```bash
curl http://localhost:8084/api/calls/active
```
**Expected Response:**
```json
{
  "calls": [
    {
      "call_id": "call-1703347845123",
      "agent_dn": "5001",
      "remote_party": "1003",
      "status": "connected"
    }
  ],
  "count": 1
}
```

---

#### 4. Sign In (Register Agent)
```bash
curl 'http://localhost:8084/api/webrtc/sign_in?id=test001&dn=5001&password=Genesys2024!WebRTC'
```
**Expected Response:**
```
OK
```

---

#### 5. Sign Out (Unregister Agent)
```bash
curl 'http://localhost:8084/api/webrtc/sign_out?id=test001'
```
**Expected Response:**
```
OK
```

---

## 🧪 Complete Test Flow

### **Test Scenario 1: Browser-Based Call**

1. **Open WWE Demo Page**
   ```
   https://192.168.210.54:8443/wwe-demo.html
   ```

2. **Open Browser Console** (F12)
   - Watch for connection logs

3. **Sign In**
   - Agent ID: `agent123`
   - DN: `5001`
   - Password: `Genesys2024!WebRTC`
   - SIP Server: `wss://192.168.210.54:8443/ws`

4. **Check Registration** (in another terminal)
   ```bash
   curl -k https://192.168.210.54:8443/api/registrations | jq '.registrations[] | select(.endpoint == "5001")'
   ```

5. **Make Test Call**
   - Destination: `1003` (Genesys agent DN)
   - Watch browser console for SIP messages

6. **Verify Call** (in terminal)
   ```bash
   curl -k https://192.168.210.54:8443/api/calls/active
   ```

7. **Hangup Call**
   - Click "Hangup" button

8. **Sign Out**
   - Click "Sign Out" button

---

### **Test Scenario 2: API-Based Monitoring**

```bash
# SSH to server
ssh Gencct@192.168.210.54

# 1. Check overall health
curl -k https://192.168.210.54:8443/api/health
curl http://localhost:8084/api/health

# 2. Check registrations
curl -k https://192.168.210.54:8443/api/registrations | jq .

# 3. Check Kamailio backends
curl -k https://192.168.210.54:8443/api/kamailio | jq .

# 4. Check active calls
curl http://localhost:8084/api/calls/active | jq .

# 5. Check registered agents
curl http://localhost:8084/api/agents | jq .
```

---

### **Test Scenario 3: Asterisk Verification**

```bash
# SSH to server
ssh Gencct@192.168.210.54

# 1. Check PJSIP endpoints
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints"

# 2. Check registrations
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show registrations"

# 3. Check active calls
sudo docker exec webrtc-asterisk asterisk -rx "core show channels"

# 4. Monitor call in real-time
sudo docker logs -f webrtc-asterisk
```

---

### **Test Scenario 4: Kamailio Verification**

```bash
# 1. Check Kamailio is running
sudo docker ps | grep kamailio

# 2. Check dispatcher status
sudo docker exec webrtc-kamailio kamctl dispatcher dump

# 3. Monitor SIP traffic
sudo docker logs -f webrtc-kamailio

# 4. Check WebSocket connections
sudo docker exec webrtc-kamailio netstat -tlnp | grep 8080
```

---

## 🔍 Troubleshooting URLs

### Check Service Status
```bash
# All containers
sudo docker ps

# Individual services
sudo docker logs webrtc-nginx --tail 50
sudo docker logs webrtc-kamailio --tail 50
sudo docker logs webrtc-asterisk --tail 50
sudo docker logs webrtc-dashboard --tail 50
```

---

### Check Network Connectivity

```bash
# From server to Genesys
ping 192.168.210.81

# Check Genesys SIP port
nc -zv 192.168.210.81 5060

# Check WebSocket port
curl -k -I https://192.168.210.54:8443/ws
```

---

### Check Logs with Filters

```bash
# SIP INVITE messages
sudo docker logs webrtc-kamailio 2>&1 | grep INVITE

# Authentication attempts
sudo docker logs webrtc-asterisk 2>&1 | grep -i auth

# Call failures
sudo docker logs webrtc-asterisk 2>&1 | grep -i "404\|failed"

# WebRTC errors
sudo docker logs webrtc-asterisk 2>&1 | grep -i "webrtc\|ice\|dtls"
```

---

## 📊 Monitoring URLs (Dashboard)

### Real-Time Dashboard Sections

**Main Dashboard:**
```
https://192.168.210.54:8443/
```

**Sections Available:**
1. **Active Registrations** - Shows all registered endpoints
2. **Active Calls** - Real-time call list
3. **Kamailio Status** - Backend health
4. **System Metrics** - Container stats

---

## 🔐 WebSocket Connection Test

### Test WebSocket from Browser Console

```javascript
// Open browser console on https://192.168.210.54:8443/wwe-demo.html
// Run this:

const ws = new WebSocket('wss://192.168.210.54:8443/ws', 'sip');

ws.onopen = () => {
    console.log('✅ WebSocket Connected');
};

ws.onmessage = (event) => {
    console.log('📩 Received:', event.data);
};

ws.onerror = (error) => {
    console.error('❌ WebSocket Error:', error);
};

ws.onclose = (event) => {
    console.log('🔌 WebSocket Closed:', event.code, event.reason);
};
```

---

## 📱 Mobile Testing

### Access from Mobile Device

**Prerequisites:**
- Mobile device on same network (192.168.x.x)
- Accept self-signed certificate

**URLs:**
```
https://192.168.210.54:8443/wwe-demo.html
```

**Steps:**
1. Open URL in mobile browser
2. Accept certificate warning
3. Grant microphone permission
4. Test call functionality

---

## 🎯 Load Testing URLs

### Simulate Multiple Agents

```bash
# Sign in multiple agents
for i in {1..5}; do
    curl "http://localhost:8084/api/webrtc/sign_in?id=agent$i&dn=500$i&password=Genesys2024!WebRTC"
done

# Check agent count
curl http://localhost:8084/api/agents | jq '.count'

# Sign out all agents
for i in {1..5}; do
    curl "http://localhost:8084/api/webrtc/sign_out?id=agent$i"
done
```

---

## 📈 Performance Testing URLs

### Check Response Times

```bash
# Dashboard API
time curl -k https://192.168.210.54:8443/api/health

# Gateway API
time curl http://localhost:8084/api/health

# Registrations (can be slow)
time curl -k https://192.168.210.54:8443/api/registrations
```

---

## 🛠️ Developer Testing

### Test with Detailed Logging

```bash
# Enable verbose curl output
curl -k -v https://192.168.210.54:8443/api/health

# Pretty print JSON
curl -k https://192.168.210.54:8443/api/registrations | jq -C . | less -R

# Save response to file
curl -k https://192.168.210.54:8443/api/registrations > registrations.json
```

---

## 🚨 Critical Test Checklist

### Before Go-Live

- [ ] **Browser Access**
  - [ ] https://192.168.210.54:8443/wwe-demo.html loads
  - [ ] https://192.168.210.54:8443/wwe-webrtc-gateway.html loads
  - [ ] No console errors

- [ ] **Dashboard APIs**
  - [ ] /api/health returns 200 OK
  - [ ] /api/registrations returns data
  - [ ] /api/kamailio shows healthy backends

- [ ] **Gateway APIs** (from server)
  - [ ] /api/health returns 200 OK
  - [ ] /api/agents returns empty array initially
  - [ ] /api/calls/active returns empty array initially

- [ ] **Sign In Flow**
  - [ ] Can sign in with valid credentials
  - [ ] Shows "registered" status
  - [ ] Appears in /api/registrations
  - [ ] Appears in /api/agents

- [ ] **Call Flow**
  - [ ] Can place call to 1003
  - [ ] Hears ringback tone
  - [ ] Call connects
  - [ ] Two-way audio works
  - [ ] Can hangup cleanly
  - [ ] Call appears in /api/calls/active while active

- [ ] **Sign Out Flow**
  - [ ] Can sign out
  - [ ] Disappears from /api/registrations
  - [ ] Disappears from /api/agents

- [ ] **Error Handling**
  - [ ] Invalid credentials rejected
  - [ ] Invalid destination returns 404
  - [ ] Network errors handled gracefully

---

## 📝 Test Results Template

```
Test Date: _________________
Tester: ____________________

[ ] Browser Access - OK / FAIL
[ ] Dashboard APIs - OK / FAIL
[ ] Gateway APIs - OK / FAIL
[ ] Sign In - OK / FAIL
[ ] Make Call - OK / FAIL
[ ] Audio Quality - OK / FAIL
[ ] Hangup - OK / FAIL
[ ] Sign Out - OK / FAIL

Notes:
_________________________________
_________________________________
_________________________________
```

---

## 🆘 Quick Help

**If nothing works:**
```bash
# Restart all services
cd /opt/webrtc-genesys
sudo docker-compose restart

# Wait 30 seconds
sleep 30

# Check status
sudo docker ps

# Test again
curl -k https://192.168.210.54:8443/api/health
```

**If calls fail:**
```bash
# Check Genesys connectivity
./check-genesys-trunk.sh

# Check Asterisk logs
sudo docker logs webrtc-asterisk --tail 100 | grep -i error
```

**If registration fails:**
```bash
# Check credentials in pjsip.conf
sudo docker exec webrtc-asterisk grep -A 5 "\[5001\]" /etc/asterisk/pjsip.conf
```

---

## 📚 Related Documentation

- **API Documentation:** `API_DOCUMENTATION.md`
- **Packet Logging Guide:** `PACKET_LOGGING_GUIDE.md`
- **Quick Test Guide:** `QUICK_TEST_GUIDE.md`

---

**🎉 Happy Testing!**

