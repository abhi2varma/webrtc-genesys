# WebRTC Genesys Deployment - Final Summary

## 📋 What We've Prepared

We've reviewed your WebRTC Asterisk system with Genesys SIP integration and prepared comprehensive deployment documentation and scripts for deploying to a CentOS server.

---

## 📁 Files Created for Deployment

### 1. **DEPLOYMENT_GUIDE.md**
Complete step-by-step guide covering:
- Prerequisites and requirements
- Transferring files to CentOS
- Running setup scripts
- Configuration updates
- Service management
- Testing and verification
- Troubleshooting

### 2. **DEPLOY_QUICKSTART.md**
Quick reference for fast deployment:
- Automated deployment options
- Manual deployment steps
- Quick configuration commands
- Default credentials
- Troubleshooting shortcuts

### 3. **scripts/deploy-to-centos.sh**
Bash script for deploying from Windows (Git Bash/WSL):
- Automates file transfer
- Runs setup on CentOS
- Updates all configuration files
- Starts services automatically

### 4. **scripts/deploy-to-centos.ps1**
PowerShell script for Windows deployment:
- Interactive prompts
- File transfer
- Automatic setup
- Service verification

---

## 🚀 Ready-to-Deploy Architecture

### Components
1. **Asterisk** - SIP/WebRTC Gateway
2. **Nginx** - Web Server & Reverse Proxy
3. **Coturn** - TURN Server (NAT traversal)
4. **Kamailio** - SIP Proxy (optional)
5. **MySQL** - Database (for Kamailio)

### Network Flow
```
Browser → Nginx (443) → Asterisk (WSS 8089) → Genesys SIP
                           ↓
                      Media (RTP 10000-20000)
```

---

## 📝 Deployment Steps

### Step 1: Transfer Files to CentOS

**Option A: Using PowerShell**
```powershell
.\scripts\deploy-to-centos.ps1
```

**Option B: Using Git Bash**
```bash
bash scripts/deploy-to-centos.sh
```

**Option C: Using SCP Manually**
```bash
scp -r . username@centos-ip:/home/username/webrtc
```

---

### Step 2: Setup on CentOS

SSH to your CentOS server:

```bash
ssh username@centos-ip
cd ~/webrtc
chmod +x scripts/*.sh
sudo ./scripts/centos-setup.sh
```

This will:
- Install Docker and Docker Compose
- Configure firewall
- Configure SELinux
- Create necessary directories
- Set up systemd service

---

### Step 3: Configure Environment

Create `.env` file:
```bash
cd ~/webrtc
nano .env
```

Add:
```bash
DOMAIN=your-server-ip-or-domain
PUBLIC_IP=your-public-ip
PRIVATE_IP=your-private-ip
GENESYS_SIP_HOST=genesys-server.com
GENESYS_USERNAME=your-username
GENESYS_PASSWORD=your-password
TURN_SECRET=generate-secret-key
TURN_REALM=your-domain
```

Or use the automated setup:
```bash
./scripts/setup.sh
```

---

### Step 4: Update Configuration Files

**Update Asterisk (pjsip.conf):**
```bash
sed -i "s/YOUR_PUBLIC_IP_HERE/your-actual-ip/g" asterisk/etc/pjsip.conf
sed -i "s/GENESYS_SIP_HOST/actual-genesys-host/g" asterisk/etc/pjsip.conf
sed -i "s/YOUR_GENESYS_USERNAME/actual-username/g" asterisk/etc/pjsip.conf
sed -i "s/YOUR_GENESYS_PASSWORD/actual-password/g" asterisk/etc/pjsip.conf
```

**Update Nginx:**
```bash
sed -i "s/your-domain.com/your-domain/g" nginx/nginx.conf
```

**Update TURN Server:**
```bash
sed -i "s/YOUR_PUBLIC_IP_HERE/your-actual-ip/g" coturn/turnserver.conf
sed -i "s/your-domain.com/your-domain/g" coturn/turnserver.conf
```

---

### Step 5: Generate SSL Certificates

```bash
./scripts/generate-certs.sh development
# or for production
./scripts/generate-certs.sh production
```

---

### Step 6: Start Services

```bash
docker-compose up -d
```

Verify:
```bash
docker-compose ps
```

---

### Step 7: Test Deployment

1. **Access Web Client:**
   ```
   https://your-server-ip
   ```

2. **Register:**
   - Server: `wss://your-server-ip/ws`
   - Username: `1000`
   - Password: `webrtc1000pass`

3. **Test Calls:**
   - Dial `600` - Echo test
   - Dial `1001` - Internal call
   - Dial `95551234567` - External via Genesys

---

## 🔑 Default Credentials

### WebRTC Users
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

## 🔧 Configuration Files

### Key Files to Update

1. **asterisk/etc/pjsip.conf**
   - WebRTC endpoints
   - Genesys trunk configuration
   - IP addresses

2. **asterisk/etc/extensions.conf**
   - Call routing logic
   - DIDs
   - IVR menus

3. **nginx/nginx.conf**
   - Domain name
   - SSL certificates

4. **coturn/turnserver.conf**
   - Public IP
   - TURN credentials

5. **.env**
   - All environment variables

---

## 🌐 Network Configuration

### Required Firewall Ports

```bash
# HTTP/HTTPS
80/tcp, 443/tcp

# SIP
5060-5061/tcp, 5060-5061/udp

# WebRTC
8088-8089/tcp

# RTP
10000-20000/udp

# TURN
3478-3479/tcp, 3478-3479/udp
5349/tcp, 5349/udp
```

### Configure Firewall

```bash
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=5060-5061/tcp
sudo firewall-cmd --permanent --add-port=5060-5061/udp
sudo firewall-cmd --permanent --add-port=8088-8089/tcp
sudo firewall-cmd --permanent --add-port=10000-20000/udp
sudo firewall-cmd --permanent --add-port=3478-3479/tcp
sudo firewall-cmd --permanent --add-port=3478-3479/udp
sudo firewall-cmd --permanent --add-port=5349/tcp
sudo firewall-cmd --reload
```

---

## 📊 Monitoring

### View Service Status

```bash
# All services
docker-compose ps

# Specific logs
docker-compose logs -f asterisk
docker-compose logs -f nginx

# Run monitoring script
./scripts/monitor.sh
```

### Asterisk CLI

```bash
docker exec -it webrtc-asterisk asterisk -r

# Common commands:
pjsip show endpoints    # Show registered endpoints
core show channels      # Show active calls
pjsip show registrations # Show SIP registrations
```

---

## 🔄 Common Tasks

### Restart Services

```bash
docker-compose restart
# or specific service
docker-compose restart asterisk
```

### Update Configuration

```bash
# Edit configuration
nano asterisk/etc/pjsip.conf

# Reload Asterisk
docker exec -it webrtc-asterisk asterisk -rx "core reload"

# Or restart
docker-compose restart asterisk
```

### Backup

```bash
./scripts/backup.sh
# or manual
tar -czf backup.tar.gz asterisk/ nginx/ .env certs/
```

---

## 🐛 Troubleshooting

### Cannot Access Web Client

1. Check Nginx is running:
   ```bash
   docker logs webrtc-nginx
   ```

2. Check firewall:
   ```bash
   sudo firewall-cmd --list-ports
   ```

3. Check SSL certificates:
   ```bash
   ls -la certs/
   ```

### No Audio

1. Check RTP ports are open
2. Verify TURN server is accessible
3. Check Asterisk RTP settings:
   ```bash
   docker exec -it webrtc-asterisk asterisk -rx "rtp show settings"
   ```

### Services Not Starting

1. View logs:
   ```bash
   docker-compose logs asterisk
   ```

2. Check configuration:
   ```bash
   docker exec -it webrtc-asterisk asterisk -rx "config show"
   ```

---

## 📚 Documentation References

- **DEPLOYMENT_GUIDE.md** - Comprehensive deployment guide
- **DEPLOY_QUICKSTART.md** - Quick deployment reference
- **ARCHITECTURE.md** - System architecture details
- **CENTOS_DEPLOYMENT.md** - CentOS-specific notes
- **TROUBLESHOOTING.md** - Common issues and solutions
- **GENESYS_SIP_ENDPOINT_ARCHITECTURE.md** - Genesys integration details

---

## ✅ Deployment Checklist

- [ ] Files transferred to CentOS
- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] Firewall configured
- [ ] SELinux configured
- [ ] Environment variables set
- [ ] Configuration files updated
- [ ] SSL certificates generated
- [ ] Services started
- [ ] Web client accessible
- [ ] Test calls working
- [ ] Genesys integration verified
- [ ] Default passwords changed
- [ ] Monitoring configured
- [ ] Backups set up

---

## 🎯 Next Steps After Deployment

1. **Change Default Passwords**
   - Update WebRTC user passwords
   - Update Genesys credentials
   - Update admin passwords

2. **Configure Genesys Integration**
   - Update Asterisk trunk config
   - Test inbound/outbound calls
   - Configure DIDs

3. **Add More Users**
   - Create additional WebRTC endpoints
   - Update extensions.conf

4. **Set Up SSL Certificates**
   - Use Let's Encrypt for production
   - Configure auto-renewal

5. **Configure Monitoring**
   - Set up log aggregation
   - Configure alerts
   - Set up dashboards

6. **Production Hardening**
   - Review firewall rules
   - Enable fail2ban
   - Set up rate limiting
   - Configure backups

---

## 🚀 You're Ready to Deploy!

Everything is prepared for deployment. Choose your preferred method:

1. **Automated** - Run the PowerShell/Bash script
2. **Manual** - Follow DEPLOYMENT_GUIDE.md
3. **Quick** - Follow DEPLOY_QUICKSTART.md

For help:
- Check TROUBLESHOOTING.md
- Review logs: `docker-compose logs -f`
- Contact support

**Good luck with your deployment! 🎉**

