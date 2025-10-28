# CentOS Deployment Guide

Step-by-step guide to deploy this WebRTC system on CentOS.

## Prerequisites

- CentOS 7/8/9 server (accessible via SSH on port 22)
- Root or sudo access
- Minimum: 2 CPU cores, 4GB RAM

## Deployment Steps

### Step 1: Transfer Files to CentOS Server

From your Windows machine:

**Option A: Using SCP (Git Bash or WSL)**
```bash
# Navigate to project directory
cd /f/Project/WebRTC

# Copy entire project to server
scp -r -P 22 . user@localhost:/home/user/WebRTC
```

**Option B: Using WinSCP or FileZilla**
1. Open WinSCP/FileZilla
2. Connect to: localhost:22
3. Upload entire `WebRTC` folder to `/home/user/`

**Option C: Using Git (if server has git)**
```bash
# On Windows - push to git repository first
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main

# Then on CentOS server
ssh user@localhost -p 22
git clone <your-repo-url> WebRTC
```

### Step 2: Connect to CentOS Server

```bash
# From Windows PowerShell, Git Bash, or WSL
ssh user@localhost -p 22
```

### Step 3: Run CentOS Setup Script

Once connected to the server:

```bash
cd WebRTC
chmod +x scripts/centos-setup.sh
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
# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# Run monitoring script
./scripts/monitor.sh
```

## CentOS-Specific Notes

### SELinux Considerations

If SELinux is enforcing (check with `getenforce`):

```bash
# Allow Docker containers
sudo semanage fcontext -a -t container_file_t "/home/user/WebRTC(/.*)?"
sudo restorecon -Rv /home/user/WebRTC

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
WorkingDirectory=/home/user/WebRTC
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
User=user

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

1. **Using localhost:**
   ```
   https://localhost
   ```

2. **Using server IP:**
   ```
   https://SERVER_IP
   ```

3. **Using domain (if configured):**
   ```
   https://your-domain.com
   ```

### SSH Tunnel (for testing)

If you want to test via localhost from Windows:

```powershell
# Create SSH tunnel
ssh -L 443:localhost:443 -L 8089:localhost:8089 user@localhost -p 22

# Keep this terminal open
# Then access: https://localhost in browser
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
sudo netstat -tulpn | grep :443
sudo lsof -i :443

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
sudo netstat -tulpn | grep -E '443|5060|8089'

# Should show 0.0.0.0:PORT, not 127.0.0.1:PORT
```

## Production Checklist for CentOS

- [ ] System fully updated: `sudo yum update -y`
- [ ] Docker installed and running
- [ ] Firewalld configured with proper rules
- [ ] SELinux configured (not disabled)
- [ ] SSL certificates installed
- [ ] All configuration files updated
- [ ] Services auto-start on boot
- [ ] Monitoring configured
- [ ] Backups scheduled via cron
- [ ] Security hardening applied

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

## Next Steps

1. ✅ Files transferred to CentOS
2. ✅ Docker and Docker Compose installed
3. ✅ Firewall configured
4. ✅ Configuration updated
5. ✅ Services started
6. 🎯 Test WebRTC client connection
7. 🎯 Verify Genesys integration
8. 🎯 Set up monitoring and backups

---

**Need Help?** Check logs:
```bash
docker-compose logs -f
./scripts/monitor.sh
```




