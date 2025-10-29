# Your Network Setup - Complete Configuration

## 🌐 Your Network Details

### IP Addresses

| Type | IP Address | Description |
|------|------------|-------------|
| **Public IP (Internet)** | `103.167.180.159` | Accessible from internet |
| **Genesys Server** | `192.168.210.81` | Internal - Genesys Engage Platform |
| **WebRTC Server** | `192.168.210.54` | Internal - CentOS with Asterisk/Nginx |

---

## 🔓 Required Port Forwarding (On Router)

Configure your router to forward these ports from **103.167.180.159** to **192.168.210.54**:

| Service | External Port | Internal IP | Internal Port | Protocol | Purpose |
|---------|---------------|-------------|---------------|----------|---------|
| **HTTPS/WSS** | 443 | 192.168.210.54 | 443 | TCP | WebRTC client & SIP signaling |
| **RTP Media** | 10000-20000 | 192.168.210.54 | 10000-20000 | UDP | Audio streams |
| **STUN** | 3478 | 192.168.210.54 | 3478 | UDP/TCP | NAT discovery |
| **TURN/TLS** | 5349 | 192.168.210.54 | 5349 | TCP | Secure NAT relay |

---

## 🔒 Firewall Rules (On CentOS 192.168.210.54)

```bash
# Add these rules to allow incoming traffic
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=10000-20000/udp
sudo firewall-cmd --permanent --add-port=3478/tcp
sudo firewall-cmd --permanent --add-port=3478/udp
sudo firewall-cmd --permanent --add-port=5349/tcp
sudo firewall-cmd --reload
```

---

## 🌐 Access URLs

### For Local (LAN) Agents

| Service | URL |
|---------|-----|
| **GWS Desktop** | http://localhost:8080/ui/ad/v1/ |
| **WebRTC Client** | https://192.168.210.54/index-agent-dn.html |

### For Remote (Internet) Agents

| Service | URL |
|---------|-----|
| **GWS Desktop** | http://localhost:8080/ui/ad/v1/ (via VPN) |
| **WebRTC Client** | https://103.167.180.159/index-agent-dn.html |

---

## 🔧 Configuration Updates Needed

### 1. Update Nginx Configuration

Edit on **192.168.210.54**: `/etc/nginx/conf.d/webrtc.conf`

```nginx
server {
    listen 443 ssl http2;
    server_name 103.167.180.159;
    
    ssl_certificate /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem;
    
    # WebSocket proxy for Asterisk
    location /ws {
        proxy_pass http://127.0.0.1:8089;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    location / {
        root /usr/share/nginx/html;
        index index-agent-dn.html;
    }
}
```

### 2. Update COTURN Configuration

Edit on **192.168.210.54**: `/etc/turnserver.conf`

```ini
# Public and private IPs
external-ip=103.167.180.159/192.168.210.54
listening-ip=192.168.210.54
relay-ip=192.168.210.54

# Realm
realm=103.167.180.159

# Ports
listening-port=3478
tls-listening-port=5349

# SSL Certificate
cert=/etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem
pkey=/etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem

# Authentication
user=webrtc:your_secret_password
```

### 3. Update WebRTC Client Configuration

Edit: `F:\Project\WebRTC\nginx\html\app-agent-dn.js`

```javascript
// For remote agents
const sipServer = 'wss://103.167.180.159/ws';
const sipDomain = '103.167.180.159';

// STUN/TURN servers
const iceServers = [
    { urls: 'stun:103.167.180.159:3478' },
    { urls: 'stun:stun.l.google.com:19302' },  // Backup
    { 
        urls: 'turn:103.167.180.159:3478',
        username: 'webrtc',
        credential: 'your_secret_password'
    },
    {
        urls: 'turns:103.167.180.159:5349',
        username: 'webrtc',
        credential: 'your_secret_password'
    }
];
```

### 4. Asterisk Configuration (Already Correct)

The Asterisk configuration in `f:\Project\WebRTC\asterisk\etc\extensions.conf` already points to the correct Genesys server:

```ini
[default]
; genesys_sip_server endpoint points to 192.168.210.81:5060
exten => _X.,1,Dial(PJSIP/${EXTEN}@genesys_sip_server)
```

---

## ✅ Testing Your Setup

### Test 1: From External Network (Mobile Hotspot)

```bash
# Test HTTPS access
curl -I https://103.167.180.159
# Expected: HTTP/1.1 200 OK

# Test port accessibility
nmap -p 443,3478,5349 103.167.180.159
# Expected: All ports show "open"
```

### Test 2: WebRTC Client from Browser

1. From external network (mobile hotspot or remote location)
2. Open browser
3. Navigate to: `https://103.167.180.159/index-agent-dn.html`
4. Enter Agent DN: 5001 (or your agent DN)
5. Click "Register"
6. Check browser console (F12):
   ```
   WebSocket connected: wss://103.167.180.159/ws
   ICE gathering complete
   SIP Registration: 200 OK
   ```

### Test 3: Make Test Call

1. Register two agents from different external locations
2. Make call between them
3. Verify two-way audio quality

---

## 📊 Your Network Diagram

```
┌─────────────────────────────────────────────────┐
│         Internet (103.167.180.159)              │
└──────────────────┬──────────────────────────────┘
                   │
         ┌─────────▼────────┐
         │  Router/Firewall │
         │  Port Forwarding │
         └─────────┬────────┘
                   │
┌──────────────────┴──────────────────────────────┐
│         Internal LAN: 192.168.210.0/24          │
│                                                  │
│  ┌──────────────────┐    ┌───────────────────┐ │
│  │ 192.168.210.54   │    │ 192.168.210.81    │ │
│  │ (WebRTC Server)  │────│ (Genesys Server)  │ │
│  │                  │    │                   │ │
│  │ - Nginx:443      │    │ - Config:5000     │ │
│  │ - Asterisk:5060  │    │ - T-Server:5025   │ │
│  │ - RTP:10k-20k    │    │ - SIP:5060        │ │
│  │ - COTURN:3478    │    │                   │ │
│  └──────────────────┘    └───────────────────┘ │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 🚨 Security Notes

### ✅ Safe to Expose to Internet
- Port 443 (HTTPS/WSS) - Encrypted
- Ports 10000-20000 (RTP) - Voice only, can't access system
- Port 3478, 5349 (STUN/TURN) - NAT traversal only

### ⚠️ DO NOT Expose to Internet
- Port 8080 (GWS) - Sensitive admin interface
- Port 5000 (Config Server) - Genesys configuration
- Port 5025 (T-Server) - Call control system
- Port 5060 (Internal SIP) - Between Asterisk and Genesys only

### Recommendations
1. **Use VPN** for GWS access (port 8080)
2. **Keep Genesys servers** (192.168.210.81) internal only
3. **Use strong passwords** for TURN server
4. **Get SSL certificate** from Let's Encrypt for production
5. **Monitor firewall logs** for suspicious activity

---

## 📝 Quick Commands

### Check Services on 192.168.210.54

```bash
# SSH to server
ssh user@192.168.210.54

# Check if services are running
sudo netstat -tunlp | grep -E '443|3478|5349|5060'

# Check firewall rules
sudo firewall-cmd --list-all

# Restart services
sudo systemctl restart nginx
sudo systemctl restart coturn
docker restart webrtc-asterisk
```

### Check from Windows (Development Machine)

```powershell
# Test connectivity to public IP
Test-NetConnection 103.167.180.159 -Port 443

# Test connectivity to CentOS host (LAN)
Test-NetConnection 192.168.210.54 -Port 443

# Test connectivity to Genesys server (LAN)
Test-NetConnection 192.168.210.81 -Port 5060
```

---

## 📚 Documentation Reference

- **Network Setup Guide**: [NETWORK_SETUP_REMOTE_AGENTS.md](NETWORK_SETUP_REMOTE_AGENTS.md)
- **Port Requirements**: [INTERNET_PORTS_GUIDE.md](INTERNET_PORTS_GUIDE.md)
- **Environment Config**: [ENVIRONMENT_CONFIG.md](ENVIRONMENT_CONFIG.md)
- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Quick Reference**: [QUICK_REFERENCE.md](QUICK_REFERENCE.md)

---

## ✅ Setup Checklist

- [ ] Public IP verified: `103.167.180.159`
- [ ] Router port forwarding configured (4 rules)
- [ ] CentOS firewall rules added and reloaded
- [ ] SSL certificate obtained (Let's Encrypt or self-signed)
- [ ] Nginx configuration updated with public IP
- [ ] COTURN configuration updated with external-ip
- [ ] WebRTC client app updated with public IP
- [ ] Services restarted on 192.168.210.54
- [ ] Tested from external network (mobile hotspot)
- [ ] Two-way audio verified between remote agents

---

**🎉 Once all items are checked, your system is ready for remote agents!**


