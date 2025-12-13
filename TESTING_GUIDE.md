# Testing Guide - Current Setup

Quick guide to test the WebRTC Genesys integration with the current architecture.

---

## Pre-Test Checklist

### 1. Configuration Files Updated

Before testing, update these placeholders:

**`asterisk/etc/pjsip.conf`:**
- Replace `${PUBLIC_IP}` with your server's public IP
- Replace `${GENESYS_SIP_HOST}` with Genesys SIP Server IP
- Replace `${GENESYS_SIP_PORT}` with port (usually 5060)
- Replace `${GENESYS_USERNAME}` with your Genesys username
- Replace `${GENESYS_PASSWORD}` with your Genesys password

**`nginx/nginx.conf`:**
- Replace `your-domain.com` with your actual domain (or use IP)

**`coturn/turnserver.conf`:**
- Replace `YOUR_PUBLIC_IP_HERE` with your public IP
- Replace `your-domain.com` with your domain
- Update `your-turn-secret-key` with a secure key

### 2. SSL Certificates

Generate SSL certificates:

```bash
# Self-signed (for testing)
./scripts/generate-certs.sh

# Or Let's Encrypt (production)
./scripts/generate-certs.sh production
```

Certificates should be in `./certs/` directory:
- `cert.pem`
- `key.pem`
- `ca.pem` (optional)

### 3. Network/Firewall

Ensure ports are open:
- 80 (HTTP)
- 443 (HTTPS/WSS)
- 5060-5061 (SIP)
- 8088-8089 (WebSocket)
- 10000-20000 (RTP)
- 3478-3479 (TURN)
- 5349 (TURN/TLS)

---

## Test Steps

### Step 1: Start Services

```bash
# Start all services
docker-compose up -d

# Verify all containers are running
docker-compose ps

# Expected output:
# - webrtc-asterisk (Up)
# - webrtc-nginx (Up)
# - webrtc-coturn (Up)
```

### Step 2: Verify Asterisk

```bash
# Check Asterisk is running
docker exec -it webrtc-asterisk asterisk -rx "core show version"

# Check PJSIP endpoints
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoints"

# Should show agent DNs: 5001, 5002, 5003, etc.

# Check transports
docker exec -it webrtc-asterisk asterisk -rx "pjsip show transports"

# Should show:
# - transport-udp (5060)
# - transport-wss (8089)
```

### Step 3: Verify Nginx

```bash
# Check Nginx is running
curl -k https://localhost

# Should return HTML (WebRTC client page)

# Check WebSocket proxy
curl -k -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  https://localhost/ws

# Should return 101 Switching Protocols or connection upgrade
```

### Step 4: Verify Coturn

```bash
# Check Coturn is running
docker exec -it webrtc-coturn ps aux | grep turnserver

# Test TURN server (if turnutils installed)
turnutils_stunclient localhost
```

### Step 5: Test WebRTC Client

1. **Open browser:** `https://your-domain.com` (or `https://your-ip`)

2. **Connect to SIP:**
   - Server: `wss://your-domain.com/ws`
   - Username: `5001` (Agent DN)
   - Password: `GenesysAgent5001!`
   - Click "Connect"

3. **Verify Registration:**
   ```bash
   docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoint 5001"
   # Should show: Contact: <registered>
   ```

### Step 6: Test GWS Integration (Optional)

1. **Start GWS Application:**
   ```bash
   cd H:\Abhishek\gws-main
   .\start-gws.ps1
   ```

2. **In WebRTC Client:**
   - GWS URL: `https://localhost:8000` (or your GWS URL)
   - Enter GWS credentials
   - Click "Connect GWS"
   - Status should show "Connected"

3. **Test Call via GWS:**
   - Enable "Use GWS for dialing"
   - Enter phone number
   - Click "Call"
   - Call should route through GWS/T-Server

### Step 7: Test Genesys SIP Connection

```bash
# Check Genesys trunk status
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoint genesys_sip_server"

# Check AOR
docker exec -it webrtc-asterisk asterisk -rx "pjsip show aors genesys_sip_server"

# Test SIP connectivity (if sip tool available)
sip -s sip:test@GENESYS_SIP_HOST -u asterisk-gateway
```

---

## Test Scenarios

### Test 1: Basic SIP Registration

**Goal:** Verify WebRTC client can register with Asterisk

**Steps:**
1. Open WebRTC client
2. Enter Agent DN (5001) and password
3. Click "Connect"

**Expected:**
- Status shows "Connected"
- Asterisk shows endpoint registered:
  ```bash
  docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoint 5001"
  ```

### Test 2: Internal Call (If Available)

**Goal:** Test call between two agents

**Steps:**
1. Open two browser tabs/windows
2. Register as 5001 in first tab
3. Register as 5002 in second tab
4. From 5001, dial 5002

**Expected:**
- Call connects
- Audio works both ways

### Test 3: Outbound Call via Genesys

**Goal:** Test call routing through Genesys

**Steps:**
1. Register agent DN 5001
2. Dial external number (e.g., 10-digit number)
3. Call should route: Client → Asterisk → Genesys → PSTN

**Expected:**
- Call connects
- Audio works
- Genesys handles routing

### Test 4: Inbound Call from Genesys

**Goal:** Test incoming call routing

**Steps:**
1. Register agent DN 5001
2. Set agent "Ready" in GWS (if using)
3. Make external call to Genesys DID
4. Call should route to agent DN 5001

**Expected:**
- Incoming call notification
- Can answer call
- Audio works

### Test 5: GWS CTI Control

**Goal:** Test GWS call control

**Steps:**
1. Connect WebRTC client (SIP registration)
2. Connect GWS (CometD)
3. In GWS, make a call
4. WebRTC client should receive call

**Expected:**
- Call arrives at WebRTC client
- Can answer via GWS or WebRTC client
- Audio works
- Call control (hold, transfer) works via GWS

---

## Troubleshooting Tests

### Issue: Can't Connect to WebSocket

**Check:**
```bash
# Verify Nginx is running
docker logs webrtc-nginx

# Verify Asterisk WebSocket is listening
docker exec -it webrtc-asterisk asterisk -rx "http show status"

# Check firewall
sudo firewall-cmd --list-ports
```

### Issue: Registration Fails

**Check:**
```bash
# View Asterisk logs
docker logs webrtc-asterisk | grep -i register

# Check endpoint configuration
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoint 5001"

# Verify credentials match
grep "5001" asterisk/etc/pjsip.conf
```

### Issue: No Audio

**Check:**
```bash
# Verify RTP ports are open
sudo netstat -tulpn | grep -E "10000|20000"

# Check RTP settings
docker exec -it webrtc-asterisk asterisk -rx "rtp show settings"

# Test TURN server
turnutils_stunclient your-domain.com
```

### Issue: Genesys Connection Fails

**Check:**
```bash
# Verify Genesys endpoint
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoint genesys_sip_server"

# Check network connectivity
ping GENESYS_SIP_HOST
telnet GENESYS_SIP_HOST 5060

# View Asterisk logs
docker logs webrtc-asterisk | grep -i genesys
```

---

## Quick Test Commands

```bash
# Full system status
./scripts/monitor.sh

# View all logs
docker-compose logs -f

# Restart a service
docker-compose restart asterisk

# Reload Asterisk config
docker exec -it webrtc-asterisk asterisk -rx "pjsip reload"

# Check active calls
docker exec -it webrtc-asterisk asterisk -rx "core show channels"
```

---

## Success Criteria

✅ All containers running  
✅ WebRTC client connects  
✅ SIP registration successful  
✅ Asterisk shows registered endpoints  
✅ Genesys trunk configured (if testing with Genesys)  
✅ GWS connects (if using GWS)  
✅ Audio works in calls  

---

**Ready to test?** Start with Step 1 and work through each test scenario! 🚀

