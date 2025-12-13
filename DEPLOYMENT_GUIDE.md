# Complete CentOS Deployment Guide

## 📋 Overview

This guide will walk you through deploying the WebRTC Asterisk system with Genesys SIP integration to a CentOS server.

### Architecture

```
Browser → Nginx → Asterisk → Genesys SIP Server
              ↓
         (WebRTC)
```

### Components

1. **Asterisk** - SIP/WebRTC Gateway
2. **Nginx** - Web Server & Reverse Proxy
3. **Coturn** - TURN Server for NAT Traversal
4. **MySQL** - Database for Kamailio (optional)

---

## 🚀 Deployment Steps

### Step 1: Prepare Your Windows Machine

#### Option A: Using Git (Recommended)

1. **Install Git for Windows** (if not already installed)
   - Download: https://git-scm.com/download/win
   
2. **Clone/Copy the project**
   ```powershell
   # If you have the project locally
   cd D:\Abhi\WebRTC\webrtc-genesys
   
   # Or initialize git
   git init
   git add .
   git commit -m "Initial commit"
   ```

#### Option B: Using WinSCP or FileZilla

You can directly transfer files using:
- WinSCP: https://winscp.net/
- FileZilla: https://filezilla-project.org/

---

### Step 2: Connect to Your CentOS Server

From your Windows machine:

```powershell
# Using PowerShell or Git Bash
ssh your-username@your-centos-server-ip

# Example:
# ssh abhishek@192.168.1.100
```

---

### Step 3: Transfer Files to CentOS

#### Method 1: Using SCP (From Windows Git Bash)

```bash
# From Git Bash on Windows
cd /d/Abhi/WebRTC/webrtc-genesys

# Transfer entire project
scp -r . your-username@your-centos-ip:/home/your-username/webrtc

# Example:
scp -r . abhishek@192.168.1.100:/home/abhishek/webrtc
```

#### Method 2: Using WinSCP

1. Open WinSCP
2. Connect to your CentOS server
3. Navigate to `/home/abhishek/` (or your user directory)
4. Upload the entire `webrtc-genesys` folder

#### Method 3: Using Git (If server has git)

```bash
# On CentOS server
cd ~
git clone https://github.com/your-username/webrtc-genesys.git
```

---

### Step 4: Run CentOS Setup Script

Once files are on the CentOS server:

```bash
# SSH into CentOS
ssh your-username@your-centos-ip

# Navigate to project
cd ~/webrtc

# Make scripts executable
chmod +x scripts/*.sh

# Run CentOS setup (requires root/sudo)
sudo ./scripts/centos-setup.sh
```

This script will:
- ✅ Update system packages
- ✅ Install Docker and Docker Compose
- ✅ Configure firewall (firewalld)
- ✅ Configure SELinux
- ✅ Set up directories
- ✅ Create systemd service

---

### Step 5: Create Environment Configuration

Create a `.env` file:

```bash
cd ~/webrtc
nano .env
```

Paste the following and update with your values:

```bash
# Domain Configuration
DOMAIN=your-server-ip-or-domain
PUBLIC_IP=YOUR_SERVER_PUBLIC_IP
PRIVATE_IP=YOUR_SERVER_PRIVATE_IP

# Genesys SIP Configuration
GENESYS_SIP_HOST=your-genesys-sip-server.com
GENESYS_SIP_PORT=5060
GENESYS_USERNAME=your-genesys-username
GENESYS_PASSWORD=your-genesys-password

# TURN Server Configuration
TURN_SECRET=$(openssl rand -hex 32)
TURN_REALM=your-domain.com

# Asterisk Configuration
ASTERISK_HTTP_PORT=8088
ASTERISK_HTTPS_PORT=8089
```

Or use the setup script:

```bash
./scripts/setup.sh
```

This will prompt you for:
- Domain name
- Public IP
- Private IP
- Genesys SIP credentials

---

### Step 6: Generate SSL Certificates

```bash
# For development/testing (self-signed)
./scripts/generate-certs.sh development

# For production (Let's Encrypt)
./scripts/generate-certs.sh production
```

**Note:** For development, you can use the IP address directly:
```bash
DOMAIN="192.168.1.100" ./scripts/generate-certs.sh development
```

---

### Step 7: Update Configuration Files

#### A. Update Asterisk pjsip.conf

```bash
nano asterisk/etc/pjsip.conf
```

Replace these placeholders:
- `YOUR_PUBLIC_IP_HERE` → Your server's public IP
- `GENESYS_SIP_HOST` → Your Genesys SIP server
- `YOUR_GENESYS_USERNAME` → Your Genesys username
- `YOUR_GENESYS_PASSWORD` → Your Genesys password

**Key configuration to update:**
```ini
[transport-udp]
external_media_address=YOUR_PUBLIC_IP_HERE
external_signaling_address=YOUR_PUBLIC_IP_HERE

[genesys_trunk]
contact=sip:GENESYS_SIP_HOST:5060

[genesys_auth]
username=YOUR_GENESYS_USERNAME
password=YOUR_GENESYS_PASSWORD
```

#### B. Update Nginx Configuration

```bash
nano nginx/nginx.conf
```

Replace:
- `your-domain.com` → Your domain or IP

#### C. Update TURN Server Configuration

```bash
nano coturn/turnserver.conf
```

Replace:
- `YOUR_PUBLIC_IP_HERE` → Your server's public IP
- `your-domain.com` → Your domain
- `your-turn-secret-key` → Generate a secret key

Or use a script to update automatically:

```bash
# Get your public IP
PUBLIC_IP=$(curl -s ifconfig.me)

# Update TURN config
sed -i "s/YOUR_PUBLIC_IP_HERE/$PUBLIC_IP/g" coturn/turnserver.conf
sed -i "s/your-domain.com/$DOMAIN/g" coturn/turnserver.conf

# Generate TURN secret
TURN_SECRET=$(openssl rand -hex 32)
sed -i "s/your-turn-secret-key/$TURN_SECRET/g" coturn/turnserver.conf
```

---

### Step 8: Start Services

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

**Expected output:**
```
NAME                IMAGE                  STATUS
webrtc-asterisk     asterisk:latest        Up
webrtc-nginx        nginx:alpine           Up  
webrtc-coturn       coturn/coturn:latest   Up
webrtc-mysql        mysql:8.0              Up
```

---

### Step 9: Configure Firewall (If not already done)

The centos-setup.sh script should have done this, but verify:

```bash
# Check firewall status
sudo firewall-cmd --list-all

# If ports are not open, run:
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=5060-5061/tcp
sudo firewall-cmd --permanent --add-port=5060-5061/udp
sudo firewall-cmd --permanent --add-port=8088-8089/tcp
sudo firewall-cmd --permanent --add-port=10000-20000/udp
sudo firewall-cmd --permanent --add-port=3478-3479/tcp
sudo firewall-cmd --permanent --add-port=3478-3479/udp
sudo firewall-cmd --permanent --add-port=5349/tcp
sudo firewall-cmd --permanent --add-port=5349/udp
sudo firewall-cmd --reload
```

---

### Step 10: Verify Deployment

#### Check Asterisk

```bash
# View Asterisk logs
docker logs webrtc-asterisk

# Access Asterisk CLI
docker exec -it webrtc-asterisk asterisk -r

# In Asterisk CLI:
asterisk*CLI> sip show peers
asterisk*CLI> pjsip show endpoints
asterisk*CLI> module show like http
```

#### Check Nginx

```bash
# Test Nginx configuration
docker exec -it webrtc-nginx nginx -t

# View Nginx logs
docker logs webrtc-nginx
```

#### Check Services from Browser

1. **Access WebRTC Client:**
   ```
   https://your-server-ip
   # or
   https://localhost (if accessing locally)
   ```

2. **Test Registration:**
   - Open browser
   - Go to `https://your-server-ip`
   - Server: `wss://your-server-ip/ws`
   - Username: `1000`
   - Password: `webrtc1000pass`
   - Click "Connect"

---

## 🧪 Testing

### Test 1: Echo Test

1. Register as user 1000
2. Dial: `600`
3. Click "Call"
4. You should hear your voice echoed back

### Test 2: Internal Call

1. Register as user 1000 in Browser 1
2. Register as user 1001 in Browser 2 (different tab/incognito)
3. From 1000, dial `1001`
4. Answer on 1001
5. Verify two-way audio

### Test 3: Genesys Integration

1. Register a user
2. Dial external number (e.g., `95551234567`)
3. Call should route through Genesys

---

## 🔧 Configuration Reference

### Default WebRTC Users

| Username | Password | Purpose |
|----------|----------|---------|
| 1000 | webrtc1000pass | User 1 |
| 1001 | webrtc1001pass | User 2 |
| 1002 | webrtc1002pass | User 3 |

### Test Extensions

| Extension | Function |
|-----------|----------|
| 600 | Echo test |
| 601 | Music on hold |
| 700 | Conference room |
| *97 | Voicemail |

---

## 🔍 Troubleshooting

### Cannot Access Web Client

```bash
# Check if Nginx is running
docker ps | grep nginx

# Check Nginx logs
docker logs webrtc-nginx

# Check firewall
sudo firewall-cmd --list-ports
```

### No Audio in Calls

```bash
# Check RTP configuration
docker exec -it webrtc-asterisk asterisk -rx "rtp show settings"

# Check firewall for RTP ports
sudo firewall-cmd --list-ports | grep 10000
```

### Asterisk Not Starting

```bash
# View logs
docker logs webrtc-asterisk

# Check configuration
docker exec -it webrtc-asterisk asterisk -rx "config show" 

# Common issues:
# - SSL certificates missing
# - Configuration syntax errors
# - Port conflicts
```

### SELinux Issues

```bash
# Check SELinux status
getenforce

# If Enforcing, temporarily disable for testing
sudo setenforce 0

# For production, configure proper policies
sudo semanage fcontext -a -t container_file_t "/home/*/webrtc(/.*)?"
```

---

## 📊 Monitoring

### View Service Status

```bash
# All services
docker-compose ps

# Specific service logs
docker logs -f webrtc-asterisk
docker logs -f webrtc-nginx
docker logs -f webrtc-coturn
```

### Asterisk Monitoring

```bash
# Connect to Asterisk CLI
docker exec -it webrtc-asterisk asterisk -r

# Show registered endpoints
asterisk*CLI> pjsip show endpoints

# Show active calls
asterisk*CLI> core show channels

# Show registrations
asterisk*CLI> pjsip show registrations
```

### System Monitoring

```bash
# Run monitoring script
./scripts/monitor.sh

# Check system resources
htop
iostat
df -h
```

---

## 🔄 Maintenance

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart asterisk
```

### Update Configuration

```bash
# Edit configuration
nano asterisk/etc/pjsip.conf

# Reload Asterisk configuration
docker exec -it webrtc-asterisk asterisk -rx "core reload"

# Or restart container
docker-compose restart asterisk
```

### Backup

```bash
# Run backup script
./scripts/backup.sh

# Manual backup
tar -czf backup-$(date +%Y%m%d).tar.gz asterisk/ nginx/ .env certs/
```

### Enable Auto-Start

```bash
# Enable systemd service
sudo systemctl enable webrtc
sudo systemctl start webrtc

# Check status
sudo systemctl status webrtc
```

---

## 🎯 Next Steps

1. **Change Default Passwords**
   - Edit `asterisk/etc/pjsip.conf`
   - Change WebRTC user passwords
   - Update Genesys credentials if needed

2. **Add More Users**
   - Edit `asterisk/etc/pjsip.conf`
   - Add new endpoints following the template
   - Reload Asterisk

3. **Configure DIDs**
   - Edit `asterisk/etc/extensions.conf`
   - Update [from-genesys] context with your DIDs

4. **Set Up SSL Certificates**
   - For production, use Let's Encrypt
   - Set up auto-renewal

5. **Configure Monitoring**
   - Set up log aggregation
   - Configure alerts
   - Set up monitoring dashboard

---

## 📞 Support

For issues:
1. Check logs: `docker-compose logs -f`
2. Review TROUBLESHOOTING.md
3. Check Asterisk documentation
4. Contact support team

---

## ✅ Deployment Checklist

- [ ] Files transferred to CentOS
- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] Firewall configured
- [ ] SELinux configured
- [ ] Environment variables configured
- [ ] SSL certificates generated
- [ ] Asterisk configuration updated
- [ ] Nginx configuration updated
- [ ] TURN server configured
- [ ] Services started
- [ ] Web client accessible
- [ ] Test calls working
- [ ] Genesys integration working
- [ ] Backups configured
- [ ] Monitoring set up

---

**Congratulations! Your WebRTC system is now deployed on CentOS! 🎉**

