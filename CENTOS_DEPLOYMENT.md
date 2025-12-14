# CentOS Deployment Guide

Step-by-step guide to deploy this WebRTC system on CentOS.

## Architecture Overview

This deployment includes:
- **Asterisk** - WebRTC ↔ SIP Gateway (minimal proxy, no call routing logic)
- **Nginx** - Web server & reverse proxy for WebRTC client
- **Coturn** - TURN/STUN server for NAT traversal

**Note:** This is a simplified architecture. Asterisk connects directly to Genesys SIP Server. No Kamailio or MySQL required.

## Prerequisites

- CentOS 7/8/9 server (accessible via SSH on port 69)
- Root or sudo access
- Minimum: 2 CPU cores, 4GB RAM
- Network access to Genesys SIP Server (192.168.210.81:5060)

## Your Server Configuration

- **Server IP**: 192.168.210.54
- **SSH Port**: 69
- **Username**: Gencct
- **Genesys SIP Server**: 192.168.210.81:5060
- **GWS URL**: http://192.168.210.54:8090/ui/ad/v1/index.html
- **WebRTC Client**: http://192.168.210.54/
- **Project Path**: /opt/gcti_apps/webrtc

## Deployment Steps

### Step 1: Transfer Files to CentOS Server

From your Windows machine:

**Option A: Using SCP (Git Bash or PowerShell)**
```bash
# Navigate to project directory
cd D:\Abhi\WebRTC\webrtc-genesys

# Copy entire project to server
scp -P 69 -r . Gencct@192.168.210.54:/opt/gcti_apps/webrtc
```

**Option B: Using WinSCP or FileZilla**
1. Open WinSCP/FileZilla
2. Connect to: 192.168.210.54:69
3. Upload entire `webrtc-genesys` folder to `/opt/gcti_apps/`

**Option C: Using Git (Recommended)**
```bash
# On Windows - already pushed to GitHub
cd D:\Abhi\WebRTC\webrtc-genesys
git push origin main

# Then on CentOS server
ssh -p 69 Gencct@192.168.210.54
cd /opt/gcti_apps
git clone https://github.com/abhi2varma/webrtc-genesys.git
cd webrtc-genesys
```

### Step 2: Connect to CentOS Server

```bash
# From Windows PowerShell or Git Bash
ssh -p 69 Gencct@192.168.210.54
# Password: !QAZxsw23edcvfr4
```

### Step 3: Run CentOS Setup Script

Once connected to the server:

```bash
cd /opt/gcti_apps/webrtc-genesys
chmod +x scripts/*.sh
sudo ./scripts/centos-setup.sh
```

The script will:
- Install Docker and Docker Compose
- Configure firewall (firewalld)
- Set up SELinux policies
- Run the main setup script

### Step 4: Manual Configuration (if needed)

If you prefer manual setup:

```bash
# Update system
sudo yum update -y

# Install Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Configure firewall
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

# Configure SELinux (if enforcing)
sudo setsebool -P httpd_can_network_connect 1
sudo semanage port -a -t http_port_t -p tcp 8088
sudo semanage port -a -t http_port_t -p tcp 8089
```

### Step 5: Run Main Setup

```bash
cd ~/WebRTC
chmod +x scripts/*.sh
./scripts/setup.sh
```

Follow the prompts to configure:
- Domain name (or use localhost for testing)
- Public IP (use `curl ifconfig.me` to get your public IP)
- Genesys credentials

### Step 6: Start Services

```bash
docker-compose up -d
```

### Step 7: Verify Deployment

```bash
# Check container status (should show asterisk, nginx, coturn)
docker-compose ps

# Expected services:
# - webrtc-asterisk (Asterisk PBX)
# - webrtc-nginx (Web server)
# - webrtc-coturn (TURN server)

# View logs
docker-compose logs -f

# Check specific service
docker-compose logs asterisk
docker-compose logs nginx
docker-compose logs coturn

# Run monitoring script
./scripts/monitor.sh

# Verify Asterisk is running
docker exec -it webrtc-asterisk asterisk -rx "core show version"
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoints"
```

## CentOS-Specific Notes

### SELinux Considerations

If SELinux is enforcing (check with `getenforce`):

```bash
# Allow Docker containers
sudo semanage fcontext -a -t container_file_t "/opt/gcti_apps/webrtc-genesys(/.*)?"
sudo restorecon -Rv /opt/gcti_apps/webrtc-genesys

# Allow HTTP connections
sudo setsebool -P httpd_can_network_connect on

# If you encounter permission issues
sudo setenforce 0  # Temporary - for testing only
```

### Firewalld vs iptables

CentOS uses firewalld by default:

```bash
# Check firewall status
sudo firewall-cmd --state

# List all open ports
sudo firewall-cmd --list-all

# If using iptables instead
sudo systemctl stop firewalld
sudo systemctl disable firewalld
sudo yum install iptables-services
sudo systemctl enable iptables
```

### Systemd Service (Optional)

Create a systemd service to auto-start:

```bash
sudo nano /etc/systemd/system/webrtc.service
```

Add:
```ini
[Unit]
Description=WebRTC Asterisk System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/gcti_apps/webrtc-genesys
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
User=Gencct

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable webrtc
sudo systemctl start webrtc
```

## Testing from Windows

### Access Web Client

1. **Using server IP (current setup):**
   ```
   http://192.168.210.54/
   ```

2. **Access Genesys Workspace Web Edition:**
   ```
   http://192.168.210.54:8090/ui/ad/v1/index.html
   ```

3. **Using domain (if configured later):**
   ```
   https://your-domain.com
   ```

### SSH Tunnel (for testing)

If you want to test via localhost from Windows:

```powershell
# Create SSH tunnel
ssh -L 80:localhost:80 -L 8088:localhost:8088 -L 8090:localhost:8090 -p 69 Gencct@192.168.210.54

# Keep this terminal open
# Then access: http://localhost in browser
```

## Troubleshooting CentOS-Specific Issues

### Docker Permission Denied

```bash
sudo usermod -aG docker $USER
newgrp docker
# Or logout and login again
```

### Port Already in Use

```bash
# Check what's using the port
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :8088
sudo lsof -i :80

# Stop conflicting service
sudo systemctl stop httpd  # If Apache is running
```

### SELinux Blocking Containers

```bash
# Check SELinux denials
sudo ausearch -m avc -ts recent

# Add exception
sudo semanage permissive -a container_t

# Or disable SELinux (not recommended for production)
sudo setenforce 0
```

### Firewall Blocking Connections

```bash
# Temporarily disable firewall for testing
sudo systemctl stop firewalld

# If it works, add proper rules
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### Cannot Access from Windows

```bash
# On CentOS, ensure services are listening on all interfaces
sudo netstat -tulpn | grep -E '80|5060|8088|8090'

# Should show 0.0.0.0:PORT, not 127.0.0.1:PORT
# Asterisk (5060, 8088) should be in host mode
```

## Production Checklist for CentOS

- [ ] System fully updated: `sudo yum update -y`
- [ ] Docker installed and running
- [x] Firewalld configured with proper rules (ports: 80, 5060, 8088, 10000-20000, 3478)
- [x] SELinux configured (permissive mode for testing)
- [ ] SSL certificates installed in `./certs/` directory (optional for testing)
- [x] Configuration files updated:
  - [x] `asterisk/etc/pjsip.conf` - Genesys SIP Server (192.168.210.81:5060) and agent DNs (5001-5020)
  - [x] `asterisk/etc/extensions-sip-endpoint.conf` - Minimal dialplan
  - [x] `nginx/nginx.conf` - HTTP configuration (SSL optional)
  - [x] `nginx/html/index.html` - GWS URL and WebSocket endpoint configured
  - [ ] `coturn/turnserver.conf` - Public IP and realm (if using TURN)
- [ ] Services auto-start on boot: `sudo systemctl enable webrtc`
- [ ] Monitoring configured: `./scripts/monitor.sh`
- [ ] Backups scheduled via cron
- [ ] Security hardening applied (change default passwords)
- [ ] Genesys SIP Server connectivity verified

## Useful CentOS Commands

```bash
# System info
cat /etc/centos-release
hostnamectl

# Network
ip addr show
ss -tulpn

# Firewall
sudo firewall-cmd --list-all
sudo firewall-cmd --list-ports

# SELinux
getenforce
sudo semanage port -l | grep http

# Services
sudo systemctl status docker
sudo systemctl status firewalld

# Logs
sudo journalctl -u docker -f
sudo tail -f /var/log/messages
```

## Service Verification

After starting services, verify all components:

```bash
# Check all containers are running
docker-compose ps

# Expected output should show 3 services:
# - webrtc-asterisk (Up)
# - webrtc-nginx (Up)  
# - webrtc-coturn (Up)

# Test Asterisk
docker exec -it webrtc-asterisk asterisk -rx "core show version"
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoints"

# Test Nginx
curl -k https://localhost
curl -k https://localhost/ws  # Should return WebSocket upgrade

# Test Coturn
docker exec -it webrtc-coturn turnutils_stunclient localhost

# Check logs for errors
docker-compose logs --tail=50 asterisk
docker-compose logs --tail=50 nginx
docker-compose logs --tail=50 coturn
```

## Next Steps

1. ✅ Files transferred to CentOS
2. ✅ Docker and Docker Compose installed
3. ✅ Firewall configured
4. ✅ Configuration updated
5. ✅ Services started
6. 🎯 Test WebRTC client connection
7. 🎯 Verify Genesys SIP Server connectivity
8. 🎯 Test agent DN registration (5001-5020)
9. 🎯 Set up monitoring and backups

---

**Need Help?** Check logs:
```bash
docker-compose logs -f
./scripts/monitor.sh
```




