# Asterisk WebRTC with Genesys SIP and Kamailio RTP Engine

A complete WebRTC telephony solution integrating Asterisk PBX, Kamailio SIP proxy, Genesys SIP trunk, and a modern web-based client interface.

## 🌟 Features

- **WebRTC Support**: Full browser-based calling with no plugins required
- **Asterisk PBX**: Enterprise-grade call routing and features
- **Kamailio Integration**: High-performance SIP proxy with RTP engine
- **Genesys SIP Trunk**: Connect to Genesys cloud telephony
- **Modern Web Client**: Beautiful, responsive interface for making/receiving calls
- **TURN/STUN Support**: NAT traversal for reliable connectivity
- **Docker Compose**: Easy deployment and management

## 📋 Architecture

```
┌─────────────┐      WSS      ┌──────────┐     SIP/RTP    ┌────────────┐
│   WebRTC    │ ◄────────────► │  Nginx   │ ◄────────────► │  Asterisk  │
│   Client    │                │  Proxy   │                │    PBX     │
└─────────────┘                └──────────┘                └────────────┘
                                                                  │
                                                                  │ SIP
                                                                  ▼
                                                            ┌────────────┐
                                                            │  Kamailio  │
                                                            │ SIP Proxy  │
                                                            └────────────┘
                                                                  │
                                                                  │ SIP
                                                                  ▼
                                                            ┌────────────┐
                                                            │  Genesys   │
                                                            │ SIP Trunk  │
                                                            └────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Valid SSL certificates (or use Let's Encrypt)
- Public IP address for WebRTC/SIP connectivity
- Genesys SIP account credentials

### Installation

1. **Clone and navigate to the project:**
```bash
cd /path/to/WebRTC
```

2. **Configure environment variables:**
```bash
cp .env.example .env
nano .env
```

Update the following critical values:
- `DOMAIN`: Your domain name
- `PUBLIC_IP`: Your server's public IP
- `PRIVATE_IP`: Your server's private IP
- `GENESYS_SIP_HOST`: Genesys SIP server
- `GENESYS_USERNAME`: Your Genesys username
- `GENESYS_PASSWORD`: Your Genesys password

3. **Generate SSL certificates:**

For Let's Encrypt (production):
```bash
./scripts/generate-certs.sh production
```

For self-signed (testing):
```bash
./scripts/generate-certs.sh
```

4. **Update configuration files:**

Edit the following files with your specific values:
- `asterisk/etc/pjsip.conf` - Update Genesys SIP settings
- `asterisk/etc/rtp.conf` - Update public IP for RTP
- `kamailio/kamailio.cfg` - Update domain and IP addresses
- `nginx/nginx.conf` - Update domain name

5. **Start the services:**
```bash
docker-compose up -d
```

6. **Verify services are running:**
```bash
docker-compose ps
```

7. **Access the WebRTC client:**
Open your browser and navigate to: `https://your-domain.com`

## 📝 Configuration Details

### Asterisk Configuration

**WebRTC Extensions (pjsip.conf):**
- Default users: 1000, 1001, 1002
- Passwords: webrtc1000pass, webrtc1001pass, webrtc1002pass

**Dialplan Features (extensions.conf):**
- `600`: Echo test
- `601`: Music on hold test
- `700`: Conference room
- `*97`: Voicemail
- `1000-1999`: Internal extensions
- `NXXXXXXXXX`: External calls via Genesys (10-digit)
- `011.*`: International calls via Genesys
- `911`: Emergency calls

### Kamailio Configuration

Kamailio acts as a SIP proxy and RTP engine, handling:
- WebSocket to SIP translation
- NAT traversal with RTP proxying
- Load balancing (if configured)
- Security filtering

**Key Ports:**
- `5060`: SIP UDP/TCP
- `5061`: SIP TLS
- `8080`: WebSocket
- `4443`: WebSocket Secure (WSS)

### Genesys SIP Integration

The system connects to Genesys via SIP trunk configured in `asterisk/etc/pjsip.conf`:

```ini
[genesys_trunk]
type=endpoint
context=from-genesys
transport=transport-udp
aors=genesys_trunk
outbound_auth=genesys_auth
```

Update the following in `pjsip.conf`:
- `GENESYS_SIP_HOST`: Your Genesys SIP server
- `YOUR_GENESYS_USERNAME`: Your Genesys username
- `YOUR_GENESYS_PASSWORD`: Your Genesys password

### TURN Server Configuration

For NAT traversal, Coturn TURN server is included:

**Credentials:**
- Username: `webrtc`
- Password: Set in `.env` as `TURN_SECRET`

Update `coturn/turnserver.conf` with your public IP.

## 🔒 Security Considerations

1. **SSL/TLS Certificates:**
   - Use valid SSL certificates from Let's Encrypt or a trusted CA
   - Never use self-signed certificates in production

2. **Firewall Configuration:**
   - Allow ports: 443 (HTTPS), 5060-5061 (SIP), 8088-8089 (WebSocket)
   - Allow RTP range: 10000-20000

3. **Strong Passwords:**
   - Change default passwords in `pjsip.conf`
   - Use strong passwords for Genesys credentials
   - Update MySQL passwords

4. **Network Security:**
   - Place Asterisk/Kamailio behind a firewall
   - Use fail2ban for brute-force protection
   - Implement rate limiting

## 🛠️ Troubleshooting

### Cannot Connect to WebSocket

**Check:**
1. SSL certificates are valid and installed correctly
2. Nginx is running and configured properly
3. Asterisk HTTP/WebSocket module is loaded
4. Firewall allows port 443

**Test WebSocket:**
```bash
wscat -c wss://your-domain.com/ws
```

### No Audio in Calls

**Check:**
1. RTP ports are open (10000-20000)
2. STUN/TURN server is accessible
3. Public IP is correctly set in `rtp.conf`
4. NAT settings in `pjsip.conf`

**Debug RTP:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "rtp set debug on"
```

### Registration Failures

**Check:**
1. Username and password are correct
2. SIP domain matches configuration
3. Asterisk logs for error messages

**View Asterisk logs:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "pjsip show registrations"
docker logs webrtc-asterisk
```

### Genesys SIP Connection Issues

**Check:**
1. Genesys credentials are correct
2. Genesys SIP server is reachable
3. Firewall allows outbound SIP connections

**Test Genesys connection:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoint genesys_trunk"
docker exec -it webrtc-asterisk asterisk -rx "pjsip show aors genesys_trunk"
```

## 📊 Monitoring

### View Asterisk Status

```bash
# Access Asterisk CLI
docker exec -it webrtc-asterisk asterisk -r

# Show registered endpoints
pjsip show endpoints

# Show active calls
core show channels

# Show SIP registrations
pjsip show registrations

# Show RTP statistics
rtp show stats
```

### View Kamailio Status

```bash
# Access Kamailio container
docker exec -it webrtc-kamailio bash

# Check running processes
kamctl monitor

# View active dialogs
kamctl dialog show

# Check statistics
kamctl stats
```

### View Logs

```bash
# Asterisk logs
docker logs -f webrtc-asterisk

# Kamailio logs
docker logs -f webrtc-kamailio

# Nginx logs
docker logs -f webrtc-nginx

# All services
docker-compose logs -f
```

## 📞 Using the Web Client

1. **Connect:**
   - Enter WebSocket URL: `wss://your-domain.com/ws`
   - Enter username (e.g., `1000`)
   - Enter password (e.g., `webrtc1000pass`)
   - Click "Connect"

2. **Make a Call:**
   - Enter destination number
   - Click "Call" or press Enter
   - Use dialpad during call for DTMF

3. **Features:**
   - **Mute/Unmute**: Control your microphone
   - **Hold/Resume**: Put call on hold
   - **Transfer**: Transfer to another extension
   - **Volume**: Adjust audio volume

## 🔧 Advanced Configuration

### Adding More WebRTC Users

Edit `asterisk/etc/pjsip.conf`:

```ini
[1003](webrtc_client)
type=endpoint
auth=1003
aors=1003
callerid="WebRTC User 1003" <1003>

[1003](webrtc_auth)
type=auth
password=your-password-here
username=1003

[1003](webrtc_aor)
type=aor
```

### Custom IVR

Edit `asterisk/etc/extensions.conf` to create custom IVR menus:

```ini
[ivr]
exten => s,1,NoOp(Custom IVR)
 same => n,Answer()
 same => n,Background(your-custom-prompt)
 same => n,WaitExten(10)
```

### Load Balancing Multiple Asterisk Servers

Configure Kamailio dispatcher to load balance across multiple Asterisk instances.

## 🤝 Support

For issues and questions:
- Check the troubleshooting section
- Review Docker logs
- Consult Asterisk/Kamailio documentation

## 📄 License

This project is provided as-is for educational and commercial use.

## 🙏 Credits

Built with:
- [Asterisk](https://www.asterisk.org/)
- [Kamailio](https://www.kamailio.org/)
- [JsSIP](https://jssip.net/)
- [Coturn](https://github.com/coturn/coturn)
- [Docker](https://www.docker.com/)




