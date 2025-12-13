# Quick Test Checklist

## Before Testing - Update These Values

### 1. `asterisk/etc/pjsip.conf`

Find and replace these placeholders:

```ini
# Line ~31-32: Replace ${PUBLIC_IP}
external_media_address=YOUR_ACTUAL_PUBLIC_IP
external_signaling_address=YOUR_ACTUAL_PUBLIC_IP

# Line ~59: Replace ${GENESYS_SIP_HOST} and ${GENESYS_SIP_PORT}
contact=sip:YOUR_GENESYS_IP:5060

# Line ~65-66: Replace ${GENESYS_USERNAME} and ${GENESYS_PASSWORD}
username=your_genesys_username
password=your_genesys_password

# Line ~71: Replace ${GENESYS_SIP_HOST}
match=YOUR_GENESYS_IP

# Line ~102, 372-373: Replace ${GENESYS_SIP_HOST} and ${GENESYS_SIP_PORT}
outbound_proxy=sip:YOUR_GENESYS_IP:5060
server_uri=sip:YOUR_GENESYS_IP
```

### 2. `nginx/nginx.conf`

```nginx
# Line ~55: Replace your-domain.com
server_name your-actual-domain.com;
# OR use IP: server_name _;
```

### 3. `coturn/turnserver.conf`

```conf
# Replace YOUR_PUBLIC_IP_HERE (appears twice)
relay-ip=YOUR_ACTUAL_PUBLIC_IP
external-ip=YOUR_ACTUAL_PUBLIC_IP

# Replace your-domain.com
realm=your-actual-domain.com

# Replace your-turn-secret-key
user=webrtc:your-actual-secret-key
```

---

## Quick Start Test

### Step 1: Generate SSL Certificates

```bash
# Self-signed (for testing)
./scripts/generate-certs.sh
```

### Step 2: Start Services

```bash
docker-compose up -d
```

### Step 3: Verify Services

```bash
# Check all containers
docker-compose ps

# Should show:
# - webrtc-asterisk (Up)
# - webrtc-nginx (Up)  
# - webrtc-coturn (Up)
```

### Step 4: Test WebRTC Client

1. Open browser: `https://your-domain.com` (or `https://your-ip`)
2. Connect:
   - Server: `wss://your-domain.com/ws`
   - Username: `5001`
   - Password: `GenesysAgent5001!`
3. Click "Connect"
4. Status should show "Connected" ✅

### Step 5: Verify Registration

```bash
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoint 5001"
# Should show: Contact: <registered>
```

---

## If Something Doesn't Work

### Check Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker logs -f webrtc-asterisk
docker logs -f webrtc-nginx
docker logs -f webrtc-coturn
```

### Common Issues

1. **Can't connect:** Check SSL certs exist in `./certs/`
2. **Registration fails:** Verify password matches in `pjsip.conf`
3. **No audio:** Check RTP ports (10000-20000) are open
4. **Genesys connection fails:** Verify IP and credentials in `pjsip.conf`

---

**Ready?** Update the placeholders above, then run the quick start steps! 🚀

