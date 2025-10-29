# Network Setup for Remote Agents - Complete Guide

## 🎯 Scenario 2: Remote Agents (Internet Access)

This guide covers **everything needed from the network side** to support remote agents accessing your GWS + WebRTC system over the internet.

---

## 📋 Network Requirements Checklist

### ✅ **1. Public IP Address**

**What you need:**
- [ ] One public IP address
- [ ] Static (recommended) or Dynamic with DDNS

**Your Public IP:** `103.167.180.159` ✅

**Verify it:**
```bash
# Check your public IP
curl ifconfig.me
# Should return: 103.167.180.159

# Check if it's behind carrier NAT (CGNAT)
# If your public IP is in these ranges, you're behind CGNAT:
#   100.64.0.0/10 (carrier NAT)
#   10.0.0.0/8 (private)
#   172.16.0.0/12 (private)
#   192.168.0.0/16 (private)
```

**If behind CGNAT:** Contact ISP to request real public IP or use VPN solution

---

### ✅ **2. Router/Firewall with Port Forwarding**

**What you need:**
- [ ] Access to router/firewall admin interface
- [ ] Ability to configure port forwarding (NAT)
- [ ] Ability to configure firewall rules

**Check compatibility:**
```
Common routers that support this:
✅ Business routers (Cisco, Ubiquiti, Mikrotik)
✅ Consumer routers (TP-Link, Netgear, ASUS)
✅ Firewall appliances (pfSense, OPNsense, FortiGate)
✅ Cloud firewalls (AWS Security Groups, Azure NSG)
```

---

### ✅ **3. Internet Bandwidth**

**Minimum requirements:**

| Number of Agents | Upload Speed | Download Speed | Recommended Connection |
|------------------|--------------|----------------|------------------------|
| 1-10 agents | 5 Mbps | 5 Mbps | 10 Mbps+ symmetric |
| 11-25 agents | 10 Mbps | 10 Mbps | 25 Mbps+ symmetric |
| 26-50 agents | 20 Mbps | 20 Mbps | 50 Mbps+ symmetric |
| 51-100 agents | 40 Mbps | 40 Mbps | 100 Mbps+ symmetric |

**Test your connection:**
```bash
# Check speed
speedtest-cli

# Or visit
https://www.speedtest.net
```

**⚠️ Important:** Upload speed is CRITICAL for voice quality!

---

### ✅ **4. SSL/TLS Certificate**

**What you need:**
- [ ] Valid SSL certificate for HTTPS/WSS
- [ ] Certificate for your domain or public IP

**Options:**

#### Option A: Let's Encrypt (Free, Recommended)
```bash
# On CentOS host (192.168.210.54)
sudo yum install certbot

# If using domain name
certbot certonly --standalone -d webrtc.yourcompany.com

# If using IP address (works for testing)
certbot certonly --standalone -d 103.167.180.159
```

#### Option B: Self-Signed (Testing Only)
```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/nginx-selfsigned.key \
  -out /etc/ssl/certs/nginx-selfsigned.crt

# Warning: Browsers will show security warning
```

#### Option C: Commercial Certificate
- Purchase from: DigiCert, Sectigo, GlobalSign
- Better for enterprise deployments
- Includes warranty and support

---

### ✅ **5. DNS Configuration (Optional but Recommended)**

**What you need:**
- [ ] Domain name (e.g., yourcompany.com)
- [ ] Access to DNS management

**DNS Records to create:**

```
A Record:
webrtc.yourcompany.com → 103.167.180.159

Optional additional records:
turn.yourcompany.com → 103.167.180.159
stun.yourcompany.com → 103.167.180.159
```

**If using Dynamic IP:**

Set up Dynamic DNS:
- **Free services:** No-IP, DuckDNS, FreeDNS
- **Result:** webrtc.yourcompany.ddns.net

---

## 🔧 Step-by-Step Network Configuration

### **STEP 1: Configure Port Forwarding on Router**

#### 1.1 Access Router Admin

```
1. Open browser
2. Go to router IP (usually):
   - 192.168.1.1
   - 192.168.0.1
   - 192.168.210.1 (your network)
3. Login with admin credentials
```

#### 1.2 Find Port Forwarding Section

```
Look for menu items:
- "Port Forwarding"
- "Virtual Server"
- "NAT"
- "Advanced" → "Port Forwarding"
```

#### 1.3 Create Port Forwarding Rules

**Rule 1: HTTPS/WSS (WebRTC Client)**
```
Service Name: WebRTC-HTTPS
Protocol: TCP
External Port: 443
Internal IP: 192.168.210.54
Internal Port: 443
Enable: ✓
```

**Rule 2: RTP Media (Audio)**
```
Service Name: WebRTC-RTP
Protocol: UDP
External Port Range: 10000-20000
Internal IP: 192.168.210.54
Internal Port Range: 10000-20000
Enable: ✓
```

**Rule 3: STUN/TURN**
```
Service Name: WebRTC-STUN
Protocol: UDP and TCP
External Port: 3478
Internal IP: 192.168.210.54
Internal Port: 3478
Enable: ✓
```

**Rule 4: TURN/TLS**
```
Service Name: WebRTC-TURN-TLS
Protocol: TCP
External Port: 5349
Internal IP: 192.168.210.54
Internal Port: 5349
Enable: ✓
```

#### 1.4 Example Screenshot Reference

```
┌─────────────────────────────────────────────────────────────┐
│ Port Forwarding Rules                                        │
├─────────────────────────────────────────────────────────────┤
│ Name          │ Ext Port    │ Int IP          │ Int Port   │
├───────────────┼─────────────┼─────────────────┼────────────┤
│ WebRTC-HTTPS  │ 443 TCP     │ 192.168.210.54 │ 443        │
│ WebRTC-RTP    │ 10000-20000 │ 192.168.210.54 │ 10000-20000│
│               │    UDP      │                 │            │
│ WebRTC-STUN   │ 3478 UDP/TCP│ 192.168.210.54 │ 3478       │
│ WebRTC-TURN   │ 5349 TCP    │ 192.168.210.54 │ 5349       │
└───────────────┴─────────────┴─────────────────┴────────────┘
```

---

### **STEP 2: Configure Firewall on CentOS Host (192.168.210.54)**

#### 2.1 Check Current Firewall Status

```bash
# SSH to CentOS host
ssh user@192.168.210.54

# Check firewall status
sudo firewall-cmd --state
# Should return: running

# List current rules
sudo firewall-cmd --list-all
```

#### 2.2 Add Firewall Rules

```bash
# Allow HTTPS/WSS (port 443)
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=443/tcp

# Allow RTP/SRTP (ports 10000-20000)
sudo firewall-cmd --permanent --add-port=10000-20000/udp

# Allow STUN/TURN (port 3478)
sudo firewall-cmd --permanent --add-port=3478/udp
sudo firewall-cmd --permanent --add-port=3478/tcp

# Allow TURN/TLS (port 5349)
sudo firewall-cmd --permanent --add-port=5349/tcp

# Optional: Allow HTTP (redirect to HTTPS)
sudo firewall-cmd --permanent --add-port=80/tcp

# Reload firewall
sudo firewall-cmd --reload

# Verify rules
sudo firewall-cmd --list-all
```

#### 2.3 Expected Output

```
public (active)
  target: default
  icmp-block-inversion: no
  interfaces: eth0
  sources:
  services: dhcpv6-client https ssh
  ports: 443/tcp 10000-20000/udp 3478/tcp 3478/udp 5349/tcp
  protocols:
  masquerade: no
```

---

### **STEP 3: Configure Network Security**

#### 3.1 Optional: Restrict Source IPs

If you know agent IP ranges:

```bash
# Only allow from specific IP/subnet
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="203.0.113.0/24" port port="443" protocol="tcp" accept'

# Only allow from specific country (using GeoIP)
# Requires firewalld with GeoIP support
```

#### 3.2 Rate Limiting (DDoS Protection)

In Nginx configuration:

```nginx
# /etc/nginx/nginx.conf or sites-available/default

# Define rate limit zone
http {
    limit_req_zone $binary_remote_addr zone=webrtc:10m rate=10r/s;
    limit_conn_zone $binary_remote_addr zone=addr:10m;
    
    server {
        listen 443 ssl;
        
        # Apply rate limits
        limit_req zone=webrtc burst=20 nodelay;
        limit_conn addr 10;
        
        # Rest of configuration...
    }
}
```

#### 3.3 Fail2Ban (Brute Force Protection)

```bash
# Install fail2ban
sudo yum install fail2ban

# Enable and start
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Create jail for Nginx
sudo nano /etc/fail2ban/jail.local
```

Add:
```ini
[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 5
bantime = 3600
```

---

### **STEP 4: Update Application Configurations**

#### 4.1 Update Nginx Configuration

```bash
# Edit Nginx config
sudo nano /etc/nginx/conf.d/webrtc.conf
```

Update with your public IP or domain:

```nginx
server {
    listen 443 ssl http2;
    server_name 103.167.180.159;  # or webrtc.yourcompany.com
    
    ssl_certificate /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # WebSocket proxy for Asterisk
    location /ws {
        proxy_pass http://127.0.0.1:8089;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Serve WebRTC client
    location / {
        root /usr/share/nginx/html;
        index index-agent-dn.html;
    }
}

# HTTP redirect to HTTPS
server {
    listen 80;
    server_name 103.167.180.159;
    return 301 https://$server_name$request_uri;
}
```

Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### 4.2 Update COTURN Configuration

```bash
# Edit COTURN config
sudo nano /etc/turnserver.conf
```

Update with your public IP:

```ini
# External IP (your public IP / internal IP)
external-ip=103.167.180.159/192.168.210.54

# Listening IP
listening-ip=192.168.210.54

# Relay IP
relay-ip=192.168.210.54

# Realm (your domain or public IP)
realm=103.167.180.159

# Ports
listening-port=3478
tls-listening-port=5349

# TLS certificates
cert=/etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem
pkey=/etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem

# Authentication
user=webrtc:your_secret_password

# Logging
verbose
log-file=/var/log/turnserver.log
```

Restart COTURN:
```bash
sudo systemctl restart coturn
```

#### 4.3 Update WebRTC Client Configuration

Edit `nginx/html/app-agent-dn.js`:

```javascript
// Update with your public IP or domain
const sipServer = 'wss://103.167.180.159/ws';  // or 'wss://webrtc.yourcompany.com/ws'
const sipDomain = '103.167.180.159';           // or 'webrtc.yourcompany.com'

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

---

## ✅ Verification & Testing

### **Test 1: Port Forwarding**

From external network (use mobile hotspot or ask colleague):

```bash
# Test HTTPS port
curl -I https://103.167.180.159
# Should return: HTTP/1.1 200 OK

# Test if ports are open (from external)
nmap -p 443,3478,5349 103.167.180.159
# Should show: open

# Test UDP port range (harder to test externally)
# Use online port checker: https://www.yougetsignal.com/tools/open-ports/
```

### **Test 2: SSL Certificate**

```bash
# Check certificate
openssl s_client -connect 103.167.180.159:443 -servername 103.167.180.159

# Should show valid certificate chain
# Look for: Verify return code: 0 (ok)
```

### **Test 3: STUN Server**

```bash
# Install stun tools
sudo yum install stun

# Test STUN
stun 103.167.180.159 -p 3478

# Should return your public IP (103.167.180.159)
```

### **Test 4: WebRTC Client Access**

From remote location:

1. **Open browser** (from external network)
2. **Navigate to:** `https://103.167.180.159/index-agent-dn.html`
3. **Check browser console** (F12)
4. **Try to register** SIP endpoint
5. **Verify WebSocket connection**

Expected console output:
```
WebSocket connected: wss://103.167.180.159/ws
ICE gathering complete
ICE candidate: type=host
ICE candidate: type=srflx (via STUN)
ICE candidate: type=relay (via TURN)
SIP Registration: 200 OK
```

### **Test 5: Make Test Call**

1. Register two agents from different external networks
2. Make call between them
3. Verify two-way audio
4. Check for latency/jitter

---

## 🔧 Common Network Issues & Solutions

### Issue 1: Ports Not Accessible

**Symptoms:**
- Can't access https://103.167.180.159
- Connection timeout

**Check:**
```bash
# From external network
telnet 103.167.180.159 443

# If fails, check:
1. Port forwarding configured correctly?
2. Firewall on CentOS host allows port 443?
3. ISP blocking ports? (some ISPs block 443/80)
```

**Solution:**
```bash
# Double-check port forwarding on router
# Verify firewall rules on CentOS
sudo firewall-cmd --list-all

# Test locally first
curl -I https://192.168.210.54
# If this works, issue is port forwarding
```

### Issue 2: One-Way Audio

**Symptoms:**
- Agent can hear but can't be heard (or vice versa)

**Cause:** RTP ports (10000-20000) not forwarded

**Solution:**
```bash
# Verify UDP ports forwarded
# On router: 10000-20000 UDP → 192.168.210.54

# On CentOS:
sudo firewall-cmd --list-ports | grep 10000
# Should show: 10000-20000/udp
```

### Issue 3: Behind Symmetric NAT

**Symptoms:**
- STUN doesn't work
- Always need TURN relay

**Solution:**
```bash
# Ensure TURN server is working
sudo systemctl status coturn

# Check TURN logs
sudo tail -f /var/log/turnserver.log

# Make sure TURN credentials are correct in WebRTC client
```

### Issue 4: SSL Certificate Errors

**Symptoms:**
- Browser shows "Not Secure"
- WebSocket connection fails

**Solution:**
```bash
# If using Let's Encrypt, ensure certificate is valid
certbot certificates

# Renew if needed
certbot renew

# Restart Nginx
sudo systemctl restart nginx
```

---

## 📊 Network Monitoring

### Monitor Bandwidth Usage

```bash
# Install iftop
sudo yum install iftop

# Monitor real-time bandwidth
sudo iftop -i eth0

# Monitor by port
sudo tcpdump -i eth0 port 443
```

### Monitor Active Connections

```bash
# Show active connections on port 443
sudo netstat -anp | grep :443

# Show UDP connections (RTP)
sudo netstat -anup | grep "10000\|15000\|20000"

# Count active connections
sudo netstat -an | grep :443 | wc -l
```

### Monitor Firewall Logs

```bash
# Watch firewall logs
sudo journalctl -u firewalld -f

# Watch Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Watch for errors
sudo tail -f /var/log/nginx/error.log
```

---

## 📋 Network Configuration Summary

### **What's Needed from IT/Network Team:**

1. **Public IP Address**
   - Static or Dynamic with DDNS
   - Not behind CGNAT

2. **Router Configuration**
   - Port forwarding rules (4 rules)
   - Access to router admin

3. **Firewall Rules**
   - Allow incoming: 443, 10000-20000, 3478, 5349
   - On both router and CentOS host

4. **Internet Bandwidth**
   - Adequate upload speed (critical!)
   - ~200 Kbps per concurrent agent

5. **SSL Certificate**
   - Valid certificate for HTTPS/WSS
   - Let's Encrypt or commercial

6. **Optional: DNS**
   - Domain name for easier access
   - A record pointing to public IP

---

## 🚀 Quick Setup Summary

```bash
# 1. Your Public IP: 103.167.180.159 ✅

# 2. Configure router port forwarding
443 → 192.168.210.54:443
10000-20000 → 192.168.210.54:10000-20000
3478 → 192.168.210.54:3478
5349 → 192.168.210.54:5349

# 3. Configure CentOS firewall
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=10000-20000/udp
sudo firewall-cmd --permanent --add-port=3478/tcp
sudo firewall-cmd --permanent --add-port=3478/udp
sudo firewall-cmd --permanent --add-port=5349/tcp
sudo firewall-cmd --reload

# 4. Get SSL certificate
certbot certonly --standalone -d webrtc.yourcompany.com

# 5. Update configurations
# - Nginx (server_name, SSL paths)
# - COTURN (external-ip)
# - WebRTC client (sipServer URL)

# 6. Test from external network
curl https://103.167.180.159
```

---

## 📞 Need Help?

**Before contacting IT/Network team, prepare:**

- [ ] Your public IP address
- [ ] Internal server IP (192.168.210.54)
- [ ] List of ports needed (443, 10000-20000, 3478, 5349)
- [ ] This document as reference

**Show them this simple diagram:**

```
Internet
    ↓
Router (Port Forwarding)
    ↓
192.168.210.54:443, 10000-20000, 3478, 5349
    ↓
WebRTC + COTURN services
```

---

**That's everything needed from the network side!** 🎉


