# Production Architecture - Internet-Facing WebRTC Gateway

**Status:** ✅ **Confirmed Production Design**  
**Date:** December 16, 2025

---

## 🎯 Architecture Overview

This architecture deploys **Asterisk as an internet-facing WebRTC gateway** in the DMZ to support remote agents, while keeping Genesys infrastructure and the SBC internal and secure.

---

## 🏗️ Network Topology

```
                         INTERNET
                            │
                            │ Remote Agents (Home, Mobile, Anywhere)
                            │ HTTPS/WSS + SRTP (Encrypted)
                            │
                ┌───────────▼────────────────┐
                │         DMZ                │
                │                            │
                │  ┌──────────────────────┐  │
                │  │ Asterisk WebRTC      │  │ ◄─── INTERNET-FACING
                │  │ Gateway              │  │      Public IP
                │  │ (192.168.210.54)     │  │      WSS, HTTPS, TURN
                │  │                      │  │
                │  │ - WebSocket: 8088    │  │
                │  │ - HTTPS: 443         │  │
                │  │ - TURN: 3478         │  │
                │  │ - RTP: 10000-20000   │  │
                │  └──────────────────────┘  │
                │                            │
                └────────────┬───────────────┘
                             │
                    Internal Firewall
                    (Strict Rules)
                             │
                ┌────────────▼───────────────┐
                │   INTERNAL NETWORK         │
                │   (No Internet Access)     │
                │                            │
                │  ┌──────────────────────┐  │
                │  │  Genesys SIP Server  │  │
                │  │  (192.168.210.81)    │  │
                │  │                      │  │
                │  │  - T-Server          │  │
                │  │  - Call Routing      │  │
                │  │  - DN Management     │  │
                │  └──────────────────────┘  │
                │            ↕                │
                │  ┌──────────────────────┐  │
                │  │   SBC (Internal)     │  │ ◄─── NOT Internet-Facing
                │  │  (Audiocodes/Ribbon) │  │      Provider Gateway Only
                │  │                      │  │
                │  └──────────────────────┘  │
                │            │                │
                └────────────┼────────────────┘
                             │
                    MPLS / Dedicated Circuit
                    (Not Internet)
                             │
                             ▼
                   ┌─────────────────┐
                   │  SIP Provider   │
                   │  (PSTN Gateway) │
                   └─────────────────┘
```

---

## 🔄 Complete Call Flow

### **Inbound Call: PSTN Customer → Remote WebRTC Agent**

```
Step 1: Call Enters Network
   Customer dials → Provider → MPLS/SIP Trunk
      ↓
Step 2: SBC Processing (Internal)
   SBC (Internal) receives call
   - Normalizes SIP
   - Security checks
   - NO internet exposure
      ↓
Step 3: Genesys Routing
   Genesys SIP Server (192.168.210.81)
   - T-Server determines available agent
   - Finds: Agent DN 5001 (WebRTC) available
   - Lookup: DN 5001 registered at 192.168.210.54
      ↓
Step 4: Send to Asterisk
   INVITE sip:5001@192.168.210.54:5060
   (Internal network - Genesys to Asterisk)
      ↓
Step 5: Asterisk Converts to WebRTC
   Asterisk WebRTC Gateway (DMZ)
   - Receives SIP INVITE from Genesys
   - Looks up DN 5001's WebSocket session
   - Converts: SIP → WebRTC (INVITE over WSS)
      ↓
Step 6: Deliver to Remote Agent
   WebSocket INVITE → Internet → Agent's Browser
   - Agent at home, coffee shop, etc.
   - Browser rings
   - Agent answers
      ↓
Step 7: Media Path Established
   Customer ↔ Provider ↔ SBC ↔ Genesys ↔ Asterisk ↔ Internet ↔ Agent
     RTP       RTP      RTP     RTP       SRTP                SRTP
                                        (Encrypted)         (Browser)
```

---

## 🔒 Security Layers

### **Layer 1: Public Internet → Asterisk (DMZ)**

**Exposed Services:**
```
✅ Port 443/TCP  - HTTPS (Web client, dashboard)
✅ Port 8088/TCP - WSS (Secure WebSocket for SIP)
✅ Port 3478/UDP - TURN (NAT traversal)
✅ Port 3478/TCP - TURN (NAT traversal)
✅ Port 10000-20000/UDP - SRTP (Encrypted media)

❌ Port 5060 - BLOCKED from internet (internal SIP only)
❌ Port 5038 - BLOCKED (Asterisk AMI - localhost only)
❌ All other ports - BLOCKED
```

**Security Measures:**
- ✅ SSL/TLS certificates (Let's Encrypt or commercial)
- ✅ WSS (WebSocket Secure) - encrypted signaling
- ✅ SRTP (Secure RTP) - encrypted media
- ✅ TURN authentication (username/password)
- ✅ Rate limiting on web services
- ✅ DDoS protection (via reverse proxy/CDN if needed)
- ✅ Strong passwords on all WebRTC DNs
- ✅ IP-based restrictions (optional, for corporate agents)

---

### **Layer 2: Internal Firewall (Asterisk ↔ Genesys)**

**Allowed Traffic (Asterisk → Genesys):**
```
✅ Source: 192.168.210.54
   Dest: 192.168.210.81
   Port: 5060/UDP (SIP signaling)
   
✅ Source: 192.168.210.54
   Dest: 192.168.210.81
   Ports: 10000-20000/UDP (RTP media)

❌ All other traffic from DMZ → Internal: BLOCKED
```

**Allowed Traffic (Genesys → Asterisk):**
```
✅ Source: 192.168.210.81
   Dest: 192.168.210.54
   Port: 5060/UDP (SIP signaling)
   
✅ Source: 192.168.210.81
   Dest: 192.168.210.54
   Ports: 10000-20000/UDP (RTP media)
```

---

### **Layer 3: Internal Network (Fully Protected)**

**Components:**
- ✅ Genesys SIP Server (192.168.210.81) - NO internet access
- ✅ SBC - NO internet access
- ✅ T-Server - NO internet access
- ✅ Traditional SIP phones - NO internet access
- ✅ Genesys Configuration Manager - NO internet access

**SBC Connectivity:**
- ✅ Connected to providers via MPLS/Dedicated circuits
- ✅ More reliable than internet-based trunking
- ✅ Lower latency for voice quality
- ✅ Dedicated bandwidth guarantee

---

## 📞 Agent Types Supported

### **1. Remote WebRTC Agents (Internet-based)**

**Connection:**
```
Agent's Device (Anywhere)
   ↓ Internet
   ↓ HTTPS/WSS
Asterisk (DMZ)
   ↓ Internal SIP
Genesys
```

**Use Cases:**
- ✅ Work-from-home agents
- ✅ Mobile agents (coffee shops, co-working spaces)
- ✅ International agents
- ✅ Disaster recovery / business continuity
- ✅ No VPN required (secure by design)

**DN Range:** 5001-5020 (WebRTC)

---

### **2. Traditional Office Agents (Internal)**

**Connection:**
```
Agent's Desk Phone (Office)
   ↓ Internal LAN
Genesys SIP Server
```

**Use Cases:**
- ✅ Office-based agents
- ✅ Supervisor stations
- ✅ Quality monitoring stations
- ✅ Traditional desk phones

**DN Range:** 3001-3999 (or existing range)

---

## 🌐 DNS & SSL Configuration

### **DNS Setup:**

```
# Public A Record
webrtc.yourcompany.com  →  <Public IP of Asterisk>

# Or if behind NAT/Load Balancer
webrtc.yourcompany.com  →  <Public IP of Firewall/LB>
                            ↳ Forward to 192.168.210.54
```

### **SSL Certificate:**

**Option A: Let's Encrypt (Recommended for testing/small deployments)**
```bash
# On Asterisk server
./scripts/generate-certs.sh production webrtc.yourcompany.com
```

**Option B: Commercial Certificate (Recommended for enterprise)**
```bash
# Purchase from DigiCert, Sectigo, etc.
# Install on Nginx
cp yourcompany.crt /opt/gcti_apps/webrtc/certs/cert.pem
cp yourcompany.key /opt/gcti_apps/webrtc/certs/key.pem
```

**Certificate Requirements:**
- ✅ Valid for `webrtc.yourcompany.com`
- ✅ Not self-signed (browsers will reject WebRTC)
- ✅ Includes full certificate chain
- ✅ Valid for at least 1 year
- ✅ Renewal process documented

---

## 🔧 Asterisk Configuration for Internet-Facing

### **1. Enable SSL/TLS**

Update `docker-compose.yml`:
```yaml
nginx:
  ports:
    - "80:80"    # Redirect to HTTPS
    - "443:443"  # HTTPS
```

Update `nginx/nginx.conf`:
```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name webrtc.yourcompany.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name webrtc.yourcompany.com;
    
    ssl_certificate /etc/certs/cert.pem;
    ssl_certificate_key /etc/certs/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # WebRTC Client
    location / {
        root /usr/share/nginx/html;
        index index.html;
    }
    
    # WebSocket (WSS)
    location /ws {
        proxy_pass http://192.168.210.54:8088;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
    
    # Dashboard API
    location /api/ {
        proxy_pass http://192.168.210.54:5000/api/;
    }
}
```

---

### **2. Update WebRTC Client**

Update `nginx/html/index.html`:
```html
<!-- Change WebSocket URL from ws:// to wss:// -->
<script>
const config = {
    sipServer: 'wss://webrtc.yourcompany.com/ws',  // WSS instead of WS
    domain: 'webrtc.yourcompany.com',
    // ... rest of config
};
</script>
```

---

### **3. Configure STUN/TURN**

Update `nginx/html/app.js`:
```javascript
const rtcConfig = {
    iceServers: [
        {
            urls: 'stun:webrtc.yourcompany.com:3478'
        },
        {
            urls: 'turn:webrtc.yourcompany.com:3478',
            username: 'webrtc',
            credential: '<strong-random-password>'
        }
    ]
};
```

Update `coturn/turnserver.conf`:
```ini
realm=webrtc.yourcompany.com
external-ip=<Public IP>
user=webrtc:<strong-random-password>
```

---

## 🛡️ Firewall Configuration

### **Public Firewall (Internet → Asterisk)**

**CentOS Firewalld:**
```bash
# HTTPS
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-service=http

# WebSocket (if not using 443)
sudo firewall-cmd --permanent --add-port=8088/tcp

# TURN
sudo firewall-cmd --permanent --add-port=3478/udp
sudo firewall-cmd --permanent --add-port=3478/tcp

# RTP/SRTP
sudo firewall-cmd --permanent --add-port=10000-20000/udp

# Reload
sudo firewall-cmd --reload
```

**iptables (alternative):**
```bash
# HTTPS
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -p tcp --dport 80 -j ACCEPT

# WebSocket
iptables -A INPUT -p tcp --dport 8088 -j ACCEPT

# TURN
iptables -A INPUT -p udp --dport 3478 -j ACCEPT
iptables -A INPUT -p tcp --dport 3478 -j ACCEPT

# RTP/SRTP
iptables -A INPUT -p udp --dport 10000:20000 -j ACCEPT

# Save
service iptables save
```

---

### **Internal Firewall (Asterisk ↔ Genesys)**

```bash
# Allow SIP from Genesys to Asterisk
iptables -A INPUT -s 192.168.210.81 -d 192.168.210.54 -p udp --dport 5060 -j ACCEPT

# Allow RTP from Genesys to Asterisk
iptables -A INPUT -s 192.168.210.81 -d 192.168.210.54 -p udp --dport 10000:20000 -j ACCEPT

# Allow SIP from Asterisk to Genesys
iptables -A OUTPUT -s 192.168.210.54 -d 192.168.210.81 -p udp --dport 5060 -j ACCEPT

# Allow RTP from Asterisk to Genesys
iptables -A OUTPUT -s 192.168.210.54 -d 192.168.210.81 -p udp --dport 10000:20000 -j ACCEPT

# Block all other traffic from DMZ to internal
iptables -A FORWARD -i <dmz_interface> -o <internal_interface> -j DROP
```

---

## 📊 Media Quality & Bandwidth

### **Per-Agent Bandwidth Requirements:**

```
Audio Codec: opus @ 32kbps (typical)
Overhead: ~20% (IP/UDP/RTP headers)

Per active call:
- Upstream (agent → network): ~40 kbps
- Downstream (network → agent): ~40 kbps
- Total per call: ~80 kbps

Recommendations:
- 20 concurrent agents: ~1.6 Mbps minimum
- Add 50% buffer: ~2.5 Mbps recommended
- For 100 agents: ~12-15 Mbps recommended
```

### **Quality of Service (QoS):**

```
# Mark DSCP on outbound RTP packets (Asterisk)
# In asterisk/etc/rtp.conf:
[general]
rtpstart=10000
rtpend=20000
tos_audio=ef        # Expedited Forwarding (DSCP 46)
cos_audio=5         # High priority
```

---

## 🚀 Deployment Checklist

### **Pre-Deployment:**

- [ ] **DNS:** Create A record for `webrtc.yourcompany.com`
- [ ] **SSL:** Obtain valid SSL certificate
- [ ] **Network:** Assign public IP or configure NAT
- [ ] **Firewall:** Configure public firewall rules
- [ ] **Firewall:** Configure internal firewall rules (DMZ ↔ Internal)
- [ ] **Bandwidth:** Ensure sufficient internet bandwidth
- [ ] **Genesys:** Configure Asterisk trunk in Configuration Manager
- [ ] **Genesys:** Create DNs 5001-5020
- [ ] **Testing:** Test from external network

### **Deployment:**

```bash
# 1. Update configuration with public domain
cd /opt/gcti_apps/webrtc
nano .env  # Set DOMAIN=webrtc.yourcompany.com

# 2. Install SSL certificates
cp /path/to/cert.pem certs/
cp /path/to/key.pem certs/

# 3. Update WebRTC client with WSS
nano nginx/html/index.html  # Change to wss://

# 4. Deploy
sudo docker-compose down
sudo docker-compose up -d

# 5. Verify
curl https://webrtc.yourcompany.com
docker-compose ps
docker logs webrtc-asterisk
```

### **Post-Deployment Testing:**

- [ ] **Internal Test:** Access from internal network
- [ ] **External Test:** Access from 4G/external internet
- [ ] **SSL Test:** Verify https:// works, no certificate errors
- [ ] **WebSocket Test:** Verify WSS connection
- [ ] **Registration Test:** Register DN from remote location
- [ ] **Call Test:** Make inbound and outbound calls
- [ ] **Media Quality:** Verify audio quality
- [ ] **NAT Test:** Test from behind NAT/firewall
- [ ] **Dashboard:** Verify monitoring works
- [ ] **Logs:** Check all services logging correctly

---

## 🔍 Monitoring & Troubleshooting

### **Key Metrics to Monitor:**

```
1. WebSocket Connections
   - Active connections count
   - Connection failures
   - Location: Asterisk logs

2. Registrations
   - WebRTC client registrations (Asterisk)
   - DN registrations to Genesys
   - Location: Dashboard (http://webrtc.yourcompany.com/dashboard.html)

3. Call Quality
   - Packet loss
   - Jitter
   - MOS score
   - Location: Asterisk CDRs

4. Resource Usage
   - CPU usage
   - Memory usage
   - Bandwidth usage
   - Location: Server monitoring

5. Security
   - Failed authentication attempts
   - Unusual traffic patterns
   - Location: Asterisk security logs, firewall logs
```

### **Common Issues:**

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| Can't connect from internet | Firewall blocking | Check public firewall rules |
| SSL certificate error | Self-signed or expired cert | Use valid SSL certificate |
| No audio | TURN not working | Check TURN server config |
| One-way audio | Firewall blocking RTP | Check UDP 10000-20000 |
| Registration fails | Genesys config issue | Check trunk/DN config |
| High latency | Internet quality | Check bandwidth, use QoS |

---

## ✅ Production Readiness Checklist

### **Security:**
- [x] SSL/TLS enabled
- [x] WSS (Secure WebSocket) enabled
- [x] SRTP (encrypted media) enabled
- [x] TURN authentication configured
- [x] Strong passwords on all DNs
- [x] AMI restricted to localhost
- [x] Firewall rules configured
- [x] DMZ properly isolated from internal network

### **High Availability (Optional):**
- [ ] Load balancer in front of Asterisk
- [ ] Multiple Asterisk instances
- [ ] Database replication for CDRs
- [ ] Automated failover

### **Monitoring:**
- [x] Dashboard deployed
- [x] Log aggregation configured
- [ ] Alerting configured (email/SMS)
- [ ] Uptime monitoring (external probe)

### **Documentation:**
- [x] Architecture documented
- [x] Deployment guide created
- [ ] User manual for agents
- [ ] Troubleshooting runbook

---

## 🎯 Key Advantages of This Architecture

| Advantage | Benefit |
|-----------|---------|
| **Remote Work Ready** | Agents work from anywhere with internet |
| **No VPN Required** | Secure by design (WSS + SRTP) |
| **Genesys Protected** | Internal infrastructure not exposed |
| **Scalable** | Add agents without hardware |
| **Cost Effective** | No per-agent softphone licenses |
| **Business Continuity** | Survives office outages |
| **Unified Experience** | Voice embedded in WWE |
| **Provider Independent** | SBC/provider setup unchanged |

---

## 📚 Related Documentation

- `WEBRTC_GATEWAY_ARCHITECTURE.md` - Detailed technical architecture
- `CENTOS_DEPLOYMENT.md` - CentOS deployment guide
- `ARCHITECTURE_REVIEW.md` - Architecture compliance review
- `LOG_ROTATION_SETUP.md` - Log management
- `DYNAMIC_REGISTRATION_GUIDE.md` - DN registration system
- `DASHBOARD_SETUP.md` - Monitoring dashboard

---

## 📞 Support & Maintenance

### **Regular Tasks:**

```
Daily:
- Monitor dashboard for registration issues
- Check log files for errors
- Verify call quality metrics

Weekly:
- Review security logs
- Check SSL certificate expiration
- Backup configuration files

Monthly:
- Update Docker images
- Review and archive logs
- Test disaster recovery
- SSL certificate renewal (if needed)

Quarterly:
- Security audit
- Capacity planning review
- Performance optimization
```

---

**Status:** ✅ **Production Architecture - Validated**  
**Last Updated:** December 16, 2025

