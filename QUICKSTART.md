# Quick Start Guide

Get your Asterisk WebRTC system up and running in 10 minutes!

## Prerequisites

- Linux server (Ubuntu 20.04+ recommended)
- Docker and Docker Compose installed
- Domain name pointing to your server
- Genesys SIP account credentials

## Step 1: Installation (2 minutes)

```bash
# Clone or navigate to project
cd /path/to/WebRTC

# Run automated setup
chmod +x scripts/setup.sh
./scripts/setup.sh
```

The setup script will prompt you for:
- Domain name
- Public IP address
- Genesys SIP credentials

## Step 2: Start Services (1 minute)

```bash
# Start all services
docker-compose up -d

# Verify everything is running
docker-compose ps
```

You should see all services in "Up" state.

## Step 3: Test Connection (2 minutes)

1. Open browser: `https://your-domain.com`
2. Enter connection details:
   - **Server:** `wss://your-domain.com/ws`
   - **Username:** `1000`
   - **Password:** `webrtc1000pass`
3. Click "Connect"
4. Status should show "Connected" ✅

## Step 4: Make Test Call (1 minute)

### Test 1: Echo Test
1. Dial: `600`
2. Click "Call"
3. Speak and hear your voice back

### Test 2: Music on Hold
1. Dial: `601`
2. Click "Call"
3. Listen to music

### Test 3: Internal Call
1. Open another browser/tab
2. Register as user `1001` (password: `webrtc1001pass`)
3. From first user, dial: `1001`
4. Answer on second user
5. Test two-way audio

## Step 5: Test Genesys (2 minutes)

### Outbound Call:
1. Dial a 10-digit phone number (e.g., `5551234567`)
2. Call should route through Genesys

### Inbound Call:
1. Call your Genesys DID
2. Call should arrive at Asterisk
3. Based on configuration, routes to extension or IVR

## Troubleshooting

### Can't connect?
```bash
# Check logs
docker-compose logs asterisk

# Verify Asterisk WebSocket
docker exec -it webrtc-asterisk asterisk -rx "http show status"
```

### No audio?
```bash
# Check RTP configuration
docker exec -it webrtc-asterisk asterisk -rx "rtp show settings"

# Verify firewall
sudo ufw status
```

### Genesys not working?
```bash
# Check endpoint status
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoint genesys_trunk"

# Enable debug
docker exec -it webrtc-asterisk asterisk -rx "pjsip set logger on"
```

## Next Steps

✅ System is working! Now:

1. **Customize Users**
   - Edit `asterisk/etc/pjsip.conf`
   - Add more WebRTC extensions

2. **Configure DIDs**
   - Edit `asterisk/etc/extensions.conf`
   - Update `[from-genesys]` context with your DIDs

3. **Set Up IVR**
   - Record custom prompts
   - Edit `[ivr]` context

4. **Enable Monitoring**
   ```bash
   # Run monitor script
   ./scripts/monitor.sh
   
   # Set up automated backups
   crontab -e
   # Add: 0 2 * * * /path/to/WebRTC/scripts/backup.sh
   ```

5. **Security Hardening**
   - Change default passwords
   - Review firewall rules
   - Enable fail2ban
   - Set up SSL auto-renewal

## Useful Commands

```bash
# View all logs
docker-compose logs -f

# Restart service
docker-compose restart asterisk

# Asterisk CLI
docker exec -it webrtc-asterisk asterisk -r

# Monitor system
./scripts/monitor.sh

# Create backup
./scripts/backup.sh
```

## Default Credentials

### WebRTC Users
| Username | Password         | Purpose        |
|----------|-----------------|----------------|
| 1000     | webrtc1000pass  | WebRTC User 1  |
| 1001     | webrtc1001pass  | WebRTC User 2  |
| 1002     | webrtc1002pass  | WebRTC User 3  |

### Test Extensions
| Extension | Purpose              |
|-----------|---------------------|
| 600       | Echo test           |
| 601       | Music on hold       |
| 700       | Conference room     |
| *97       | Check voicemail     |

## Getting Help

- 📖 Full documentation: [README.md](README.md)
- 🔧 Detailed setup: [SETUP_GUIDE.md](SETUP_GUIDE.md)
- 🐛 Issues: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## Success Checklist

- [ ] All Docker containers running
- [ ] WebRTC client connects successfully
- [ ] Echo test (600) works
- [ ] Internal calls work (1000 → 1001)
- [ ] Outbound calls via Genesys work
- [ ] Inbound calls from Genesys work
- [ ] Audio quality is good
- [ ] Monitoring is set up
- [ ] Backups are configured

**System Status:** 
```bash
./scripts/monitor.sh
```

If all items are checked ✅ - Congratulations! Your WebRTC system is fully operational! 🎉

---

**Stuck?** Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or review logs:
```bash
docker-compose logs -f asterisk
```




