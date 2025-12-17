# Coturn STUN/TURN Server Deployment

## 🎯 What Changed

The WebRTC client now uses **local Coturn** instead of Google's public STUN servers:

### Before:
```javascript
iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
]
```

### After:
```javascript
iceServers: [
    { urls: 'stun:192.168.210.54:3478' },        // Local STUN
    { 
        urls: 'turn:192.168.210.54:3478',        // Local TURN
        username: 'webrtc',
        credential: 'Genesys2024!SecureTurn'
    }
]
```

---

## 📋 Deploy to POC Server (192.168.210.54)

### Step 1: SSH to Server
```bash
ssh Gencct@192.168.210.54 -p 69
# Password: !QAZxsw23edcvfr4
```

### Step 2: Pull Latest Changes
```bash
cd /opt/gcti_apps/webrtc-genesys
git pull origin main
```

### Step 3: Restart Coturn
```bash
sudo docker-compose restart coturn
```

### Step 4: Restart Nginx (to serve updated app.js)
```bash
sudo docker-compose restart nginx
```

### Step 5: Verify Coturn is Running
```bash
sudo docker logs webrtc-coturn --tail 50
```

**Expected output:**
```
0: : log file opened: /var/log/coturn/turnserver.log
0: : Coturn Version TURN Server
0: : Realm: webrtc.genesys.local
0: : Listener address to use: 0.0.0.0:3478
```

---

## 🧪 Testing

### Test STUN Server
From your **Windows PC**, open PowerShell:

```powershell
# Install STUN test tool (if not already)
npm install -g stun

# Test STUN
stun 192.168.210.54:3478
```

**Expected:** Should return your public IP and NAT type.

---

### Test WebRTC Client

1. Open browser: `http://192.168.210.54`
2. Open Developer Console (F12) → Network tab
3. Register as DN `5001` / Password `5001`
4. Check console for ICE candidates:
   ```
   ICE candidate: candidate:... typ srflx raddr 192.168.x.x rport xxxxx
   ```

**What to look for:**
- `typ host` - Local IP candidates ✅
- `typ srflx` - Server reflexive (STUN) candidates ✅
- `typ relay` - TURN relay candidates ✅ (only if STUN fails)

---

## 🔥 Firewall Rules (If Needed)

If clients outside the VPN cannot reach Coturn:

```bash
sudo firewall-cmd --permanent --add-port=3478/udp
sudo firewall-cmd --permanent --add-port=3478/tcp
sudo firewall-cmd --permanent --add-port=5349/tcp
sudo firewall-cmd --permanent --add-port=49152-65535/udp
sudo firewall-cmd --reload
```

---

## 📊 Configuration Details

| Parameter | Value |
|-----------|-------|
| **STUN Port** | 3478 (UDP/TCP) |
| **TURN Port** | 3478 (UDP/TCP) |
| **TLS Port** | 5349 (TCP) |
| **Server IP** | 192.168.210.54 |
| **Realm** | webrtc.genesys.local |
| **Username** | webrtc |
| **Password** | Genesys2024!SecureTurn |
| **Relay Range** | 49152-65535 (UDP) |

---

## 🎯 Benefits

✅ **No external dependency** - Google STUN removed  
✅ **Full TURN support** - Works behind symmetric NAT  
✅ **Better control** - We own the TURN server  
✅ **Better logging** - Can troubleshoot ICE issues  
✅ **VPN secure** - Only accessible on VPN network  

---

## 🔧 Troubleshooting

### Coturn Not Starting
```bash
sudo docker logs webrtc-coturn
```

### Check Coturn Listening Ports
```bash
sudo netstat -tulpn | grep 3478
```

**Expected:**
```
udp 0.0.0.0:3478    LISTEN    coturn
tcp 0.0.0.0:3478    LISTEN    coturn
```

### Test from Windows
```powershell
# Test UDP connectivity
Test-NetConnection -ComputerName 192.168.210.54 -Port 3478

# Test with curl (STUN binding request)
curl -v http://192.168.210.54:3478
```

---

## 📝 Notes

- **Username/Password** are hardcoded in `app.js` and `turnserver.conf`
- **Credentials** are sent over TLS (WebSocket Secure)
- **TURN relay** only used if STUN fails (rare)
- **Ports 49152-65535** are for RTP relay (UDP)

---

## ✅ Verification Checklist

- [ ] Git pull successful
- [ ] Coturn container restarted
- [ ] Nginx container restarted
- [ ] Coturn logs show "Realm: webrtc.genesys.local"
- [ ] Port 3478 is listening (UDP/TCP)
- [ ] WebRTC client shows STUN candidates in console
- [ ] Call works between agents

---

**Ready to deploy!** 🚀

