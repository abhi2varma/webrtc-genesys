# Asterisk WebRTC with Genesys SIP Endpoint Integration

A complete WebRTC telephony solution integrating Asterisk PBX as a SIP gateway, Genesys SIP Server, and a modern web-based client interface. Designed for Genesys Workspace Web Edition (GWS) integration.

## 🌟 Features

- **WebRTC Support**: Full browser-based calling with no plugins required
- **Asterisk Gateway**: Minimal SIP gateway (proxy only, no call routing logic)
- **Genesys SIP Integration**: Direct connection to Genesys SIP Server
- **GWS Integration**: Works with Genesys Workspace Web Edition for CTI control
- **Modern Web Client**: Beautiful, responsive interface with GWS CometD integration
- **TURN/STUN Support**: NAT traversal for reliable connectivity
- **Docker Compose**: Easy deployment and management

## 📋 Architecture

```
┌─────────────┐      WSS      ┌──────────┐     SIP/RTP    ┌────────────┐
│   WebRTC    │ ◄────────────► │  Nginx   │ ◄────────────► │  Asterisk  │
│   Client    │                │  Proxy   │                │  Gateway   │
└─────────────┘                └──────────┘                └────────────┘
                                                                  │
                                                                  │ SIP
                                                                  ▼
                                                            ┌────────────┐
                                                            │  Genesys   │
                                                            │ SIP Server │
                                                            └────────────┘
```

**Note:** Asterisk acts as a minimal gateway. All call routing and control is handled by Genesys T-Server via GWS.

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
- `asterisk/etc/pjsip.conf` - Update Genesys SIP settings and agent DNs (5001-5020)
- `asterisk/etc/rtp.conf` - Update public IP for RTP
- `asterisk/etc/extensions-sip-endpoint.conf` - Minimal dialplan (proxy only)
- `nginx/nginx.conf` - Update domain name
- `coturn/turnserver.conf` - Update public IP and realm

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

**Agent DN Endpoints (pjsip.conf):**
- Agent DNs: 5001-5020 (matching Genesys configuration)
- Passwords: GenesysAgent5001!, GenesysAgent5002!, etc.
- WebRTC-enabled with DTLS-SRTP encryption
- All calls forwarded to Genesys SIP Server

**Dialplan (extensions-sip-endpoint.conf):**
- Minimal proxy-only dialplan
- `[genesys-agent]` context: Forwards all outbound calls to Genesys
- `[from-genesys]` context: Routes incoming calls to agent DNs
- **No local routing logic** - all handled by Genesys T-Server

**Key Ports:**
- `5060`: SIP UDP (to Genesys SIP Server)
- `8089`: WebSocket Secure (WSS) for WebRTC clients
- `10000-20000`: RTP/SRTP media ports

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
- `${GENESYS_SIP_HOST}`: Your Genesys SIP server IP/hostname
- `${GENESYS_SIP_PORT}`: Genesys SIP port (typically 5060)
- `${GENESYS_USERNAME}`: Your Genesys username
- `${GENESYS_PASSWORD}`: Your Genesys password
- `${PUBLIC_IP}`: Your server's public IP address

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
   - Change default agent DN passwords in `pjsip.conf`
   - Use strong passwords for Genesys credentials
   - Rotate TURN server credentials regularly

4. **Network Security:**
   - Place Asterisk behind a firewall
   - Use fail2ban for brute-force protection
   - Implement rate limiting
   - Restrict access to Asterisk CLI

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
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoint genesys_sip_server"
docker exec -it webrtc-asterisk asterisk -rx "pjsip show aors genesys_sip_server"
docker exec -it webrtc-asterisk asterisk -rx "pjsip show registrations"
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

### View Coturn Status

```bash
# Check Coturn container
docker exec -it webrtc-coturn ps aux

# Test TURN server
turnutils_stunclient your-domain.com
```

### View Logs

```bash
# Asterisk logs
docker logs -f webrtc-asterisk

# Nginx logs
docker logs -f webrtc-nginx

# Coturn logs
docker logs -f webrtc-coturn

# All services
docker-compose logs -f
```

## 📞 Using the Web Client

1. **Connect:**
   - Enter WebSocket URL: `wss://your-domain.com/ws`
   - Enter Agent DN (e.g., `5001` - must match Genesys configuration)
   - Enter password (e.g., `GenesysAgent5001!`)
   - Click "Connect"
   
2. **Connect to GWS (Optional - for CTI control):**
   - Enter GWS URL: `https://localhost:8000`
   - Enter GWS credentials (if using Basic Auth)
   - Click "Connect GWS"
   - Enable "Use GWS for dialing" to route calls through GWS

3. **Make a Call:**
   - Enter destination number
   - Click "Call" or press Enter
   - If GWS is connected and "Use GWS for dialing" is enabled, call routes through GWS/T-Server
   - Otherwise, direct SIP call via Asterisk
   - Use dialpad during call for DTMF

4. **Features:**
   - **Mute/Unmute**: Control your microphone
   - **Hold/Resume**: Put call on hold
   - **Transfer**: Transfer to another extension
   - **Volume**: Adjust audio volume

## 🔧 Advanced Configuration

### Adding More Agent DNs

Edit `asterisk/etc/pjsip.conf` and add more agent DNs following the pattern:

```ini
; Agent 5021
[5021](agent_dn)
auth=5021
aors=5021
callerid="Agent 5021" <5021>

[5021](agent_dn_auth)
password=GenesysAgent5021!
username=5021

[5021](agent_dn_aor)
```

**Important:** Agent DN numbers must match your Genesys Configuration Server setup.

### GWS Integration

For full CTI control, integrate with Genesys Workspace Web Edition:
- See `GWS_SIP_ENDPOINT_INTEGRATION.md` for complete setup
- GWS handles all call control via T-Server
- WebRTC client provides audio/media only

## 🤝 Support

For issues and questions:
- Check the troubleshooting section
- Review Docker logs
- Consult Asterisk documentation
- See `ARCHITECTURE.md` for detailed architecture
- See `GWS_SIP_ENDPOINT_INTEGRATION.md` for GWS integration

## 📄 License

This project is provided as-is for educational and commercial use.

## 🙏 Credits

Built with:
- [Asterisk](https://www.asterisk.org/)
- [JsSIP](https://jssip.net/)
- [Coturn](https://github.com/coturn/coturn)
- [Docker](https://www.docker.com/)
- [Genesys Workspace Web Edition](https://docs.genesys.com/)




