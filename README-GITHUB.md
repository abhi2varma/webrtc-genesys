# Asterisk WebRTC with Genesys SIP Endpoint Integration

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Asterisk](https://img.shields.io/badge/Asterisk-18+-green.svg)](https://www.asterisk.org/)
[![Genesys](https://img.shields.io/badge/Genesys-Engage%208.5-red.svg)](https://www.genesys.com/)

> 🚀 **Cloud-ready WebRTC solution that integrates with Genesys Engage using the SIP Endpoint model**

Transform your contact center agents into remote-capable, browser-based WebRTC endpoints that seamlessly integrate with Genesys Workspace Web Edition. No VPN required, deploy anywhere!

---

## 🎯 What This Project Does

This solution replaces traditional Genesys .NET SIP Endpoint SDK with a **browser-based WebRTC client**, enabling:

- ✅ **Agents work from anywhere** - Home, office, or on-the-go
- ✅ **No desktop software** - Just a web browser
- ✅ **Full Genesys integration** - Screen pops, routing, reporting
- ✅ **Cloud-ready** - Deploy on AWS, Azure, GCP, or on-premise
- ✅ **Scalable architecture** - Support hundreds of concurrent agents

---

## 🏗️ Architecture

### Traditional Genesys Setup vs. This Solution

```
┌─────────────────────────────────────────────────────────────┐
│  OLD: Desktop-Based (.NET SIP Endpoint SDK)                 │
│  ❌ Desktop application required                            │
│  ❌ VPN for remote agents                                   │
│  ❌ Complex deployment                                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  NEW: Browser-Based (This Solution)                         │
│  ✅ Just open a web browser                                 │
│  ✅ Works from anywhere with internet                       │
│  ✅ Simple deployment with Docker                           │
└─────────────────────────────────────────────────────────────┘
```

### System Diagram

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Browser    │  WSS    │   Asterisk   │   SIP   │   Genesys    │
│  (WebRTC)    │◄───────►│   Gateway    │◄───────►│ SIP Server   │
└──────────────┘         └──────────────┘         └──────────────┘
      │                                                    │
      │                                                    │
      └────────────── Workspace Web Edition ──────────────┘
                     (Call Control & Screen Pops)
```

---

## 🚀 Quick Start

### Prerequisites

- Linux server (Ubuntu 20.04+ or CentOS 7+)
- Docker & Docker Compose
- Domain name or public IP
- Genesys Engage 8.5+ with SIP Server

### Installation (5 Minutes)

```bash
# 1. Clone repository
git clone https://github.com/YOUR_USERNAME/asterisk-webrtc-genesys.git
cd asterisk-webrtc-genesys

# 2. Run automated setup
chmod +x scripts/centos-setup.sh
sudo ./scripts/centos-setup.sh

# 3. Configure environment
cp .env.example .env
nano .env  # Update with your settings

# 4. Generate SSL certificates
./scripts/generate-certs.sh development  # or 'production' for Let's Encrypt

# 5. Start services
docker-compose -f docker-compose-simple.yml up -d

# 6. Check status
docker-compose -f docker-compose-simple.yml ps
```

### Access Web Client

```
URL: https://your-server-ip
Agent DN: 5001
Password: GenesysAgent5001!
```

---

## 📋 Features

### WebRTC Client

- 🎤 **Browser-based audio** - No plugins, works in Chrome/Firefox/Edge
- 📞 **Agent DN registration** - Registers directly to Genesys
- 🔊 **HD audio** - Opus codec support
- 🎛️ **Audio controls** - Volume, device selection, audio testing
- 📊 **Real-time status** - Connection, call state, duration
- 🐛 **Debug console** - Troubleshooting and monitoring

### Genesys Integration

- 🖥️ **Workspace Web Edition** - Full agent desktop integration
- 📋 **Screen pops** - Customer information display
- 🔄 **Skills-based routing** - All Genesys routing features
- 📊 **Real-time reporting** - Standard Genesys reports
- 👥 **Agent states** - Ready, Not Ready, ACW, etc.
- 📞 **Call controls** - Transfer, conference, hold (via Workspace)

### Infrastructure

- 🐳 **Docker-based** - Easy deployment and scaling
- 🔒 **SSL/TLS** - Secure WebSocket connections
- 🌐 **NAT traversal** - STUN/TURN support
- 📈 **Scalable** - Load balance multiple Asterisk instances
- 🔍 **Monitoring** - Health checks and logging
- 💾 **Backup scripts** - Automated configuration backups

---

## 📖 Documentation

### Main Documentation

- **[README.md](README.md)** - Complete system overview
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Technical architecture
- **[GENESYS_SIP_ENDPOINT_ARCHITECTURE.md](GENESYS_SIP_ENDPOINT_ARCHITECTURE.md)** - Genesys integration details
- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Detailed setup instructions
- **[QUICKSTART.md](QUICKSTART.md)** - 10-minute quick start
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues and solutions

### Platform-Specific Guides

- **[CENTOS_DEPLOYMENT.md](CENTOS_DEPLOYMENT.md)** - CentOS deployment
- **[WINDOWS_NOTES.md](WINDOWS_NOTES.md)** - Windows development notes
- **[GENESYS_ENGAGE_SETUP.md](GENESYS_ENGAGE_SETUP.md)** - Genesys configuration

### Reference

- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - File organization
- **[DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)** - Deployment checklist

---

## ⚙️ Configuration

### Environment Variables

```bash
# Server Configuration
DOMAIN=your-domain.com
PUBLIC_IP=your-public-ip
PRIVATE_IP=your-private-ip

# Genesys Configuration
GENESYS_SIP_HOST=genesys-sip-server.com
GENESYS_SIP_PORT=5060
GENESYS_USERNAME=asterisk-gateway
GENESYS_PASSWORD=your-password

# Security
TURN_SECRET=your-random-secret
```

### Genesys Configuration

In Genesys Configuration Manager:

1. **Create SIP Switch**
   ```
   Type: External SIP Switch
   Name: Asterisk_WebRTC_Gateway
   Host: your-asterisk-ip:5060
   ```

2. **Create Agent DNs**
   ```
   DN: 5001
   Type: Extension
   Switch: Asterisk_WebRTC_Gateway
   ```

3. **Associate Agents**
   ```
   Agent LoginID: agent5001
   DN: 5001
   Place: Agent_Place
   ```

---

## 🛠️ Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **PBX** | Asterisk 18+ | SIP/WebRTC gateway |
| **Web Server** | Nginx | Reverse proxy & static files |
| **TURN Server** | Coturn | NAT traversal |
| **Container** | Docker | Orchestration |
| **WebRTC Library** | JsSIP 3.10+ | Browser SIP client |
| **Contact Center** | Genesys Engage 8.5+ | Call routing & agent desktop |

---

## 📦 Project Structure

```
├── asterisk/              # Asterisk configuration
│   └── etc/              # Config files (pjsip, extensions, rtp)
├── nginx/                # Web server
│   ├── nginx.conf        # Nginx configuration
│   └── html/             # WebRTC client (HTML/JS/CSS)
├── coturn/               # TURN server config
├── scripts/              # Utility scripts
│   ├── setup.sh          # Automated setup
│   ├── centos-setup.sh   # CentOS-specific setup
│   ├── generate-certs.sh # SSL certificate generator
│   ├── monitor.sh        # System monitoring
│   └── backup.sh         # Backup script
├── docker-compose-simple.yml  # Docker services
├── .env.example          # Environment template
└── README.md            # This file
```

---

## 🧪 Testing

### Basic Test (Internal)

```bash
# 1. Open WebRTC client
https://your-server-ip

# 2. Register as Agent DN
DN: 5001
Password: GenesysAgent5001!

# 3. Verify registration
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoints"
```

### Integration Test (with Genesys)

```bash
# 1. Agent logs into Workspace Web Edition
# 2. Agent registers WebRTC endpoint (DN 5001)
# 3. Agent sets "Ready" in Workspace
# 4. Make test call to agent
# 5. Verify screen pop appears in Workspace
# 6. Answer call in Workspace
# 7. Verify audio quality
```

---

## 📊 Monitoring

### Health Checks

```bash
# Service status
./scripts/monitor.sh

# Container logs
docker-compose -f docker-compose-simple.yml logs -f

# Asterisk CLI
docker exec -it webrtc-asterisk asterisk -r

# Active calls
docker exec -it webrtc-asterisk asterisk -rx "core show channels"

# Registered endpoints
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoints"
```

---

## 🔐 Security

### Built-in Security Features

- ✅ SSL/TLS for all connections
- ✅ SIP Digest authentication
- ✅ DTLS-SRTP for media encryption
- ✅ Firewall configuration
- ✅ SELinux policies (CentOS)

### Recommended Additional Security

- Use Let's Encrypt for production SSL certificates
- Change default passwords
- Implement fail2ban for brute-force protection
- Use VPN or IP whitelisting for Genesys connection
- Regular security updates

---

## 🚀 Deployment Options

### Cloud Platforms

- **AWS** - EC2 instance with Elastic IP
- **Azure** - Virtual Machine with public IP
- **GCP** - Compute Engine instance
- **DigitalOcean** - Droplet
- **Your own infrastructure**

### Scaling

```
             Load Balancer
                  │
     ┌────────────┼────────────┐
     ▼            ▼            ▼
Asterisk 1   Asterisk 2   Asterisk 3
     │            │            │
     └────────────┼────────────┘
                  │
          Genesys SIP Server
```

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Asterisk Project** - Open-source PBX
- **Genesys** - Enterprise contact center platform
- **JsSIP** - JavaScript SIP library
- **Docker** - Container platform
- **Coturn** - TURN server

---

## 📞 Support

- 📖 **Documentation:** See `/docs` folder
- 🐛 **Issues:** [GitHub Issues](https://github.com/YOUR_USERNAME/asterisk-webrtc-genesys/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/YOUR_USERNAME/asterisk-webrtc-genesys/discussions)

---

## 🗺️ Roadmap

- [ ] Multi-language support
- [ ] Video call support
- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Automated deployment scripts for cloud platforms
- [ ] Integration with other contact center platforms

---

## ⭐ Show Your Support

If this project helped you, please give it a ⭐ on GitHub!

---

**Built with ❤️ for the contact center community**

