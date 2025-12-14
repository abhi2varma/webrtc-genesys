# Deployment Scripts

This directory contains scripts to deploy the WebRTC-Genesys project to the CentOS server.

## Quick Deployment

### Using PowerShell (Windows)

```powershell
cd D:\Abhi\WebRTC\webrtc-genesys
.\scripts\deploy-to-centos.ps1
```

### Using Bash (Git Bash / Linux / macOS)

```bash
cd /d/Abhi/WebRTC/webrtc-genesys
chmod +x scripts/deploy-to-centos.sh
./scripts/deploy-to-centos.sh
```

## What the Scripts Do

1. ✅ Create all necessary directories on the remote server
2. ✅ Copy Asterisk configuration files
3. ✅ Copy Nginx configuration and web files
4. ✅ Copy SSL certificates (or generate them)
5. ✅ Copy docker-compose.yml and documentation
6. ✅ Optionally restart services automatically

## Default Configuration

- **Server IP**: 192.168.210.54
- **SSH Port**: 69
- **Username**: Gencct
- **Remote Path**: /opt/gcti_apps/webrtc-genesys

## Custom Parameters

### PowerShell

```powershell
.\scripts\deploy-to-centos.ps1 -ServerIP "192.168.210.54" -Port 69 -Username "Gencct"
```

### Bash

```bash
./scripts/deploy-to-centos.sh 192.168.210.54 69 Gencct
```

## Manual Deployment

If scripts don't work, you can manually copy files:

```powershell
# Copy all configuration files
scp -P 69 -r asterisk/etc/* Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/asterisk/etc/
scp -P 69 -r nginx/* Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/nginx/
scp -P 69 docker-compose.yml Gencct@192.168.210.54:/opt/gcti_apps/webrtc-genesys/

# SSH and restart
ssh -p 69 Gencct@192.168.210.54
cd /opt/gcti_apps/webrtc-genesys
docker-compose down
docker-compose up -d
```

## Verification After Deployment

```bash
# Check services
docker-compose ps

# Check Asterisk
docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints"

# Check logs
docker logs webrtc-asterisk --tail 50

# Test in browser
# http://192.168.210.54/
```

## Troubleshooting

### SSH Connection Issues

If you get "Permission denied" or password prompts fail:

```powershell
# Test SSH connection
ssh -p 69 Gencct@192.168.210.54 "echo Connection successful"
```

### SCP Issues

If files don't copy:

```powershell
# Test SCP
echo "test" > test.txt
scp -P 69 test.txt Gencct@192.168.210.54:/tmp/
rm test.txt
```

### Directory Permissions

If you get permission errors on the server:

```bash
# SSH to server and fix permissions
ssh -p 69 Gencct@192.168.210.54
sudo chown -R Gencct:Gencct /opt/gcti_apps/webrtc-genesys
```

## Notes

- Scripts will create directories if they don't exist
- Existing files will be overwritten
- SSL certificates will be generated if missing
- Services can be restarted automatically (optional prompt)

