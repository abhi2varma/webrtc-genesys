# Manual Deployment Guide

## Step-by-Step Manual Deployment to CentOS Server

Follow these steps exactly in order:

---

## Step 1: Create Directory Structure on Server

```powershell
# SSH to server and create all directories
ssh -p 69 Gencct@192.168.210.54 "mkdir -p /opt/gcti_apps/webrtc-genesys/asterisk/etc /opt/gcti_apps/webrtc-genesys/asterisk/sounds /opt/gcti_apps/webrtc-genesys/asterisk/keys /opt/gcti_apps/webrtc-genesys/asterisk/logs /opt/gcti_apps/webrtc-genesys/nginx/html /opt/gcti_apps/webrtc-genesys/certs /opt/gcti_apps/webrtc-genesys/coturn /opt/gcti_apps/webrtc-genesys/scripts"
```

If that's too long, run this instead:

```powershell
ssh -p 69 Gencct@192.168.210.54

# Once logged in, run:
mkdir -p /opt/gcti_apps/webrtc-genesys/{asterisk/{etc,sounds,keys,logs},nginx/html,certs,coturn,scripts}
exit
```

---

## Step 2: Copy Docker Compose File

```powershell
cd D:\Abhi\WebRTC\webrtc-genesys
scp -P 69 docker-compose.yml Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/
```

---

## Step 3: Copy Asterisk Configuration Files

```powershell
scp -P 69 asterisk/etc/pjsip.conf Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/asterisk/etc/
scp -P 69 asterisk/etc/logger.conf Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/asterisk/etc/
scp -P 69 asterisk/etc/asterisk.conf Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/asterisk/etc/
scp -P 69 asterisk/etc/extensions-sip-endpoint.conf Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/asterisk/etc/
```

---

## Step 4: Copy Nginx Configuration

```powershell
scp -P 69 nginx/nginx.conf Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/nginx/
```

---

## Step 5: Copy Nginx HTML Files

```powershell
scp -P 69 nginx/html/index.html Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/nginx/html/
scp -P 69 nginx/html/app.js Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/nginx/html/
scp -P 69 nginx/html/style.css Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/nginx/html/
scp -P 69 nginx/html/jssip.min.js Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/nginx/html/
```

---

## Step 6: Copy Certificates (if they exist)

```powershell
# Check if certificates exist
if (Test-Path "certs\cert.pem") {
    scp -P 69 certs/cert.pem Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/certs/
    scp -P 69 certs/key.pem Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/certs/
    scp -P 69 certs/ca.pem Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/certs/
} else {
    Write-Host "No certificates found. Will generate on server." -ForegroundColor Yellow
}
```

---

## Step 7: Generate Certificates on Server (if needed)

```powershell
# SSH to server
ssh -p 69 Gencct@192.168.210.54

# Generate certificates
cd /opt/gcti_apps/webrtc-genesys
docker run --rm -v $(pwd)/certs:/certs alpine/openssl req -x509 -newkey rsa:2048 -keyout /certs/key.pem -out /certs/cert.pem -days 365 -nodes -subj '/CN=192.168.210.54'
cp certs/cert.pem certs/ca.pem

# Exit SSH
exit
```

---

## Step 8: Start Services on Server

```powershell
# SSH to server
ssh -p 69 Gencct@192.168.210.54

# Navigate to project
cd /opt/gcti_apps/webrtc-genesys

# Stop any existing services
docker-compose down

# Start services
docker-compose up -d

# Check status
docker-compose ps
```

Expected output:
```
NAME              STATUS
webrtc-asterisk   Up (healthy)
webrtc-coturn     Up
webrtc-nginx      Up
```

---

## Step 9: Verify Deployment

Still in SSH:

```bash
# Check Asterisk configuration
docker exec webrtc-asterisk asterisk -rx "pjsip show transports"

# Check endpoints
docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints" | head -20

# Check logs
docker logs webrtc-asterisk --tail 30

# Check log files are being created
ls -lh asterisk/logs/

# Exit SSH
exit
```

---

## Step 10: Test from Browser

Open your browser and navigate to:

**http://192.168.210.54/**

You should see the WebRTC client with:
- SIP Server: ws://192.168.210.54:8088/ws
- Agent DN: 5001
- Password: GenesysAgent5001!

Click "Connect" to test registration.

---

## Quick Copy-Paste Commands

Here are all the commands in sequence:

```powershell
# 1. Create directories
ssh -p 69 Gencct@192.168.210.54 "mkdir -p /opt/gcti_apps/webrtc-genesys/{asterisk/{etc,sounds,keys,logs},nginx/html,certs,coturn,scripts}"

# 2. Navigate to project on Windows
cd D:\Abhi\WebRTC\webrtc-genesys

# 3. Copy docker-compose
scp -P 69 docker-compose.yml Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/

# 4. Copy Asterisk configs
scp -P 69 asterisk/etc/pjsip.conf Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/asterisk/etc/
scp -P 69 asterisk/etc/logger.conf Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/asterisk/etc/
scp -P 69 asterisk/etc/asterisk.conf Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/asterisk/etc/
scp -P 69 asterisk/etc/extensions-sip-endpoint.conf Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/asterisk/etc/

# 5. Copy Nginx configs
scp -P 69 nginx/nginx.conf Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/nginx/
scp -P 69 nginx/html/index.html Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/nginx/html/
scp -P 69 nginx/html/app.js Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/nginx/html/
scp -P 69 nginx/html/style.css Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/nginx/html/
scp -P 69 nginx/html/jssip.min.js Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/nginx/html/

# 6. Copy certificates (if they exist)
scp -P 69 certs/*.pem Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/certs/

# 7. SSH and start services
ssh -p 69 Gencct@192.168.210.54 "cd /opt/gcti_apps/webrtc-genesys && docker-compose down && docker-compose up -d && docker-compose ps"
```

---

## Troubleshooting

### If SCP fails with "No such file or directory"

The directory doesn't exist. Run Step 1 again:

```powershell
ssh -p 69 Gencct@192.168.210.54 "mkdir -p /opt/gcti_apps/webrtc-genesys/{asterisk/{etc,sounds,keys,logs},nginx/html,certs,coturn,scripts}"
```

### If docker-compose not found

Install Docker Compose on the server:

```bash
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### If permission denied

Fix ownership:

```bash
sudo chown -R Gencct:Gencct /opt/gcti_apps/webrtc-genesys
```

---

## What Genesys Admin Needs

After successful deployment, provide these details to your Genesys administrator:

**Asterisk IP to Whitelist:** `192.168.210.54`
**Port:** `5060` (UDP)
**DNs:** `5001-5020`
**Authentication:** IP-based (no credentials)

---

## Success Checklist

- [ ] All files copied without errors
- [ ] Services show "Up" status
- [ ] WebRTC client accessible at http://192.168.210.54/
- [ ] Can see DN 5001 registration form
- [ ] Asterisk logs show no errors
- [ ] PJSIP transports loaded
- [ ] Ready for Genesys configuration

