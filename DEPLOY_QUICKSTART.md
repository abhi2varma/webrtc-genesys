# Quick Deployment Reference

**Fast deployment guide for experienced users.**

## Prerequisites

- CentOS server with SSH access
- Domain or IP address
- Genesys SIP credentials

## Option 1: Automated Deployment (Recommended)

### From Windows using PowerShell

```powershell
cd D:\Abhi\WebRTC\webrtc-genesys
.\scripts\deploy-to-centos.ps1
```

Follow the prompts.

### From Windows using Git Bash

```bash
cd /d/Abhi/WebRTC/webrtc-genesys
bash scripts/deploy-to-centos.sh
```

Follow the prompts.

---

## Option 2: Manual Deployment

### 1. Transfer Files to CentOS

From Windows (Git Bash):
```bash
cd /d/Abhi/WebRTC/webrtc-genesys
scp -r . username@centos-ip:/home/username/webrtc
```

### 2. SSH to CentOS and Setup

```bash
ssh username@centos-ip
cd ~/webrtc
chmod +x scripts/*.sh
```

### 3. Run Setup Script

```bash
# CentOS system setup
sudo ./scripts/centos-setup.sh

# Main setup
./scripts/setup.sh
```

### 4. Start Services

```bash
docker-compose up -d
```

---

## Quick Configuration

### Create `.env` file:

```bash
cd ~/webrtc
nano .env
```

Paste:
```bash
DOMAIN=your-server-ip
PUBLIC_IP=YOUR_PUBLIC_IP
PRIVATE_IP=YOUR_PRIVATE_IP
GENESYS_SIP_HOST=genesys-server.com
GENESYS_USERNAME=username
GENESYS_PASSWORD=password
```

### Update Configuration Files:

```bash
# Replace placeholders in pjsip.conf
sed -i "s/YOUR_PUBLIC_IP_HERE/YOUR_ACTUAL_IP/g" asterisk/etc/pjsip.conf
sed -i "s/GENESYS_SIP_HOST/actual-genesys-host/g" asterisk/etc/pjsip.conf
sed -i "s/YOUR_GENESYS_USERNAME/actual-username/g" asterisk/etc/pjsip.conf
sed -i "s/YOUR_GENESYS_PASSWORD/actual-password/g" asterisk/etc/pjsip.conf

# Update Nginx
sed -i "s/your-domain.com/actual-domain/g" nginx/nginx.conf

# Update TURN server
sed -i "s/YOUR_PUBLIC_IP_HERE/YOUR_ACTUAL_IP/g" coturn/turnserver.conf
sed -i "s/your-domain.com/actual-domain/g" coturn/turnserver.conf
```

### Generate Certificates:

```bash
./scripts/generate-certs.sh development
```

---

## Test Deployment

1. **Access WebRTC Client:**
   ```
   https://your-server-ip
   ```

2. **Register:**
   - Server: `wss://your-server-ip/ws`
   - Username: `1000`
   - Password: `webrtc1000pass`

3. **Test Call:**
   - Dial: `600` (Echo test)

---

## Verify Services

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# Asterisk CLI
docker exec -it webrtc-asterisk asterisk -r
```

---

## Troubleshooting

### Cannot Access Web Client

```bash
# Check Nginx
docker logs webrtc-nginx
docker exec -it webrtc-nginx nginx -t

# Check firewall
sudo firewall-cmd --list-ports
```

### No Audio

```bash
# Check RTP configuration
docker exec -it webrtc-asterisk asterisk -rx "rtp show settings"

# Check firewall for RTP ports
sudo firewall-cmd --list-ports | grep 10000
```

### Services Not Starting

```bash
# View logs
docker-compose logs asterisk
docker-compose logs nginx

# Restart
docker-compose restart
```

---

## Default Credentials

### WebRTC Users
- 1000 / webrtc1000pass
- 1001 / webrtc1001pass
- 1002 / webrtc1002pass

### Test Extensions
- 600 - Echo test
- 601 - Music on hold
- 700 - Conference room

---

## Quick Commands

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart asterisk

# Stop services
docker-compose down

# Start services
docker-compose up -d

# View real-time logs
docker-compose logs -f asterisk

# Asterisk CLI
docker exec -it webrtc-asterisk asterisk -r

# Monitor system
./scripts/monitor.sh

# Create backup
./scripts/backup.sh
```

---

## Firewall Ports

Required ports:
- 80/tcp - HTTP
- 443/tcp - HTTPS
- 5060/tcp+udp - SIP
- 8088/tcp - WebSocket
- 8089/tcp - WebSocket Secure
- 10000-20000/udp - RTP
- 3478/tcp+udp - TURN
- 5349/tcp+udp - TURN/TLS

---

## Next Steps

1. Change default passwords
2. Add more WebRTC users
3. Configure your DIDs
4. Set up SSL certificates
5. Configure monitoring
6. Set up backups

---

## Help

- Full guide: `DEPLOYMENT_GUIDE.md`
- Architecture: `ARCHITECTURE.md`
- Troubleshooting: `TROUBLESHOOTING.md`

