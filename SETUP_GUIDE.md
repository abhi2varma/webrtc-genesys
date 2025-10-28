# Complete Setup Guide

This guide provides step-by-step instructions for setting up your Asterisk WebRTC system with Genesys SIP and Kamailio.

## Table of Contents

1. [Server Preparation](#server-preparation)
2. [SSL Certificate Setup](#ssl-certificate-setup)
3. [Configuration Steps](#configuration-steps)
4. [Genesys Integration](#genesys-integration)
5. [Testing and Validation](#testing-and-validation)
6. [Production Deployment](#production-deployment)

---

## Server Preparation

### System Requirements

**Minimum:**
- 2 CPU cores
- 4 GB RAM
- 20 GB disk space
- Ubuntu 20.04/22.04 or CentOS 7/8

**Recommended:**
- 4+ CPU cores
- 8 GB RAM
- 50 GB SSD
- Ubuntu 22.04 LTS

### Install Docker and Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### Configure Firewall

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SIP
sudo ufw allow 5060:5061/tcp
sudo ufw allow 5060:5061/udp

# Allow WebSocket
sudo ufw allow 8088:8089/tcp

# Allow RTP
sudo ufw allow 10000:20000/udp

# Allow TURN
sudo ufw allow 3478:3479/tcp
sudo ufw allow 3478:3479/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp

# Enable firewall
sudo ufw enable
```

---

## SSL Certificate Setup

### Option 1: Let's Encrypt (Production)

1. **Install Certbot:**

```bash
sudo apt install certbot -y
```

2. **Create certificate directory:**

```bash
mkdir -p certs
```

3. **Generate certificates:**

```bash
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com
```

4. **Copy certificates:**

```bash
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem certs/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem certs/key.pem
sudo cp /etc/letsencrypt/live/your-domain.com/chain.pem certs/ca.pem
sudo chown -R $USER:$USER certs
sudo chmod 644 certs/*
```

5. **Set up auto-renewal:**

```bash
sudo crontab -e
# Add this line:
0 0 1 * * certbot renew --post-hook "cp /etc/letsencrypt/live/your-domain.com/*.pem /path/to/WebRTC/certs/ && docker-compose restart"
```

### Option 2: Self-Signed (Development/Testing)

1. **Create certificate directory:**

```bash
mkdir -p certs
```

2. **Generate self-signed certificate:**

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com"

cp certs/cert.pem certs/ca.pem
```

---

## Configuration Steps

### 1. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit environment file
nano .env
```

Update these critical values:

```bash
# Your domain name
DOMAIN=your-domain.com

# Server IP addresses
PUBLIC_IP=203.0.113.10  # Your public IP
PRIVATE_IP=10.0.0.5     # Your private IP (if behind NAT)

# Genesys SIP Configuration
GENESYS_SIP_HOST=sip.genesyscloud.com
GENESYS_SIP_PORT=5060
GENESYS_USERNAME=your-username
GENESYS_PASSWORD=your-password
GENESYS_CONTEXT=your-context

# TURN Server
TURN_SECRET=generate-a-strong-random-secret-here
TURN_REALM=your-domain.com
```

### 2. Asterisk Configuration

#### Update pjsip.conf

```bash
nano asterisk/etc/pjsip.conf
```

Find and update these sections:

1. **Transport external addresses:**
```ini
[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060
external_media_address=YOUR_PUBLIC_IP      # Change this
external_signaling_address=YOUR_PUBLIC_IP  # Change this
```

2. **Genesys trunk:**
```ini
[genesys_trunk]
type=aor
contact=sip:YOUR_GENESYS_HOST:5060  # Change this

[genesys_auth]
type=auth
username=YOUR_GENESYS_USERNAME      # Change this
password=YOUR_GENESYS_PASSWORD      # Change this

[genesys-identify]
type=identify
endpoint=genesys_trunk
match=YOUR_GENESYS_HOST             # Change this
```

#### Update extensions.conf

```bash
nano asterisk/etc/extensions.conf
```

Update DIDs in the `[from-genesys]` context:
```ini
[from-genesys]
; Match your actual DIDs
same => n,GotoIf($["${EXTEN}" = "+15551234567"]?ext1000)
same => n,GotoIf($["${EXTEN}" = "+15551234568"]?ext1001)
```

#### Update rtp.conf

```bash
nano asterisk/etc/rtp.conf
```

Add your TURN server:
```ini
turnaddr=your-domain.com:3478
turnusername=webrtc
turnpassword=YOUR_TURN_SECRET
```

### 3. Kamailio Configuration

```bash
nano kamailio/kamailio.cfg
```

Update these defines:
```c
#!define PUBLIC_IP "YOUR_PUBLIC_IP"
#!define DOMAIN "your-domain.com"
```

### 4. TURN Server Configuration

```bash
nano coturn/turnserver.conf
```

Update:
```ini
realm=your-domain.com
relay-ip=YOUR_PUBLIC_IP
external-ip=YOUR_PUBLIC_IP
user=webrtc:YOUR_TURN_SECRET
```

### 5. Nginx Configuration

```bash
nano nginx/nginx.conf
```

Update server_name:
```nginx
server_name your-domain.com www.your-domain.com;
```

### 6. Web Client Configuration

```bash
nano nginx/html/index.html
```

Update the default SIP server:
```html
<input type="text" id="sipServer" value="wss://your-domain.com/ws">
```

---

## Genesys Integration

### Understanding Genesys SIP

Genesys provides cloud-based SIP trunking. You'll need:

1. **Genesys Account**: Active Genesys Cloud or PureConnect account
2. **SIP Credentials**: Username and password for SIP trunk
3. **SIP Server**: Genesys SIP server hostname/IP
4. **DIDs**: Your assigned phone numbers

### Genesys Configuration in Asterisk

The configuration is in `asterisk/etc/pjsip.conf`:

```ini
[genesys_trunk]
type=endpoint
context=from-genesys           ; Incoming calls go here
transport=transport-udp
aors=genesys_trunk
outbound_auth=genesys_auth
disallow=all
allow=ulaw,alaw,g722,opus      ; Supported codecs
from_user=YOUR_GENESYS_USERNAME
force_rport=yes
direct_media=no                ; Media goes through Asterisk
ice_support=no
dtmf_mode=rfc4733
rtp_symmetric=yes
rewrite_contact=yes
send_rpid=yes
send_pai=yes
```

### Testing Genesys Connection

1. **Start the services:**
```bash
docker-compose up -d
```

2. **Check registration:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoint genesys_trunk"
```

3. **Test outbound call:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "originate PJSIP/+15555551234@genesys_trunk application Playback demo-congrats"
```

4. **Monitor SIP traffic:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "pjsip set logger on"
```

### Common Genesys Issues

**Issue: Registration fails**
- Verify username/password
- Check network connectivity to Genesys server
- Ensure firewall allows outbound SIP

**Issue: No audio on calls**
- Verify RTP ports are open (10000-20000)
- Check public IP configuration
- Enable `rtp_symmetric=yes`

**Issue: Calls fail with 403/407**
- Authentication credentials are incorrect
- Contact Genesys support to verify account status

---

## Testing and Validation

### 1. Verify Services

```bash
# Check all containers are running
docker-compose ps

# Should show all services as "Up"
```

### 2. Test WebSocket Connection

```bash
# Install wscat
npm install -g wscat

# Test WebSocket
wscat -c wss://your-domain.com/ws

# You should see a successful connection
```

### 3. Test WebRTC Registration

1. Open browser: `https://your-domain.com`
2. Enter credentials:
   - Server: `wss://your-domain.com/ws`
   - Username: `1000`
   - Password: `webrtc1000pass`
3. Click "Connect"
4. Status should show "Connected"

### 4. Test Internal Call

1. Register two users (1000 and 1001) in separate browsers
2. From 1000, dial `1001`
3. Answer on 1001
4. Verify two-way audio

### 5. Test Echo

1. Register as user 1000
2. Dial `600` (echo test)
3. Speak and hear your voice back

### 6. Test Genesys Outbound

1. Register as user 1000
2. Dial a valid external number (e.g., `15551234567`)
3. Call should route through Genesys

### 7. Test Genesys Inbound

1. Call one of your Genesys DIDs
2. Call should arrive at Asterisk
3. Based on dialplan, should route to extension or IVR

---

## Production Deployment

### Pre-Launch Checklist

- [ ] Valid SSL certificates installed
- [ ] All passwords changed from defaults
- [ ] Firewall properly configured
- [ ] Public IP addresses correctly set
- [ ] Genesys credentials verified
- [ ] TURN server configured
- [ ] Monitoring in place
- [ ] Backup strategy implemented

### Security Hardening

1. **Change all default passwords:**

```bash
# Update Asterisk user passwords in pjsip.conf
# Update MySQL passwords in docker-compose.yml
# Update TURN secret in coturn/turnserver.conf
```

2. **Enable fail2ban:**

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
```

3. **Limit SSH access:**

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Add/modify:
PermitRootLogin no
PasswordAuthentication no
AllowUsers yourusername

sudo systemctl restart sshd
```

4. **Regular updates:**

```bash
# Create update script
cat > update.sh << 'EOF'
#!/bin/bash
docker-compose pull
docker-compose down
docker-compose up -d
docker image prune -f
EOF

chmod +x update.sh
```

### Monitoring Setup

1. **Install monitoring tools:**

```bash
sudo apt install htop iotop nethogs -y
```

2. **Create monitoring script:**

```bash
cat > monitor.sh << 'EOF'
#!/bin/bash
echo "=== Container Status ==="
docker-compose ps

echo -e "\n=== Asterisk Active Calls ==="
docker exec webrtc-asterisk asterisk -rx "core show channels"

echo -e "\n=== System Resources ==="
docker stats --no-stream
EOF

chmod +x monitor.sh
```

3. **Set up log rotation:**

```bash
sudo nano /etc/logrotate.d/docker-webrtc
```

Add:
```
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  delaycompress
  missingok
  notifempty
}
```

### Backup Strategy

1. **Create backup script:**

```bash
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/webrtc-$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# Backup configurations
cp -r asterisk/etc $BACKUP_DIR/
cp -r kamailio $BACKUP_DIR/
cp -r nginx $BACKUP_DIR/
cp docker-compose.yml $BACKUP_DIR/

# Backup certificates
cp -r certs $BACKUP_DIR/

# Backup database
docker exec webrtc-mysql mysqldump -u root -prootpassword kamailio > $BACKUP_DIR/kamailio.sql

echo "Backup completed: $BACKUP_DIR"
EOF

chmod +x backup.sh
```

2. **Schedule automatic backups:**

```bash
crontab -e
# Add:
0 2 * * * /path/to/WebRTC/backup.sh
```

### Performance Tuning

1. **Increase Docker resources:**

```bash
# Edit Docker daemon config
sudo nano /etc/docker/daemon.json
```

Add:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

2. **Optimize Asterisk:**

Edit `asterisk/etc/asterisk.conf`:
```ini
[options]
maxcalls=1000
maxload=2.0
```

---

## Maintenance

### Regular Tasks

**Daily:**
- Monitor service status
- Check logs for errors
- Verify call quality

**Weekly:**
- Review call logs
- Check disk space
- Verify backups

**Monthly:**
- Update Docker images
- Review security
- Optimize database
- Test disaster recovery

### Common Commands

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart asterisk

# View logs
docker-compose logs -f asterisk

# Enter Asterisk CLI
docker exec -it webrtc-asterisk asterisk -r

# Reload Asterisk configuration
docker exec -it webrtc-asterisk asterisk -rx "core reload"

# Check disk usage
du -sh /var/lib/docker

# Clean up old images
docker system prune -a
```

---

## Support and Resources

- **Asterisk Documentation**: https://wiki.asterisk.org
- **Kamailio Documentation**: https://www.kamailio.org/wikidocs/
- **JsSIP Documentation**: https://jssip.net/documentation/
- **Genesys Support**: https://help.mypurecloud.com/

For project-specific issues, check the logs and troubleshooting section in README.md.




