# Project Structure

Complete overview of the Asterisk WebRTC system file organization.

## Directory Layout

```
WebRTC/
├── asterisk/                      # Asterisk PBX configuration
│   ├── etc/                       # Configuration files
│   │   ├── pjsip.conf            # SIP/WebRTC endpoints & transports
│   │   ├── extensions.conf       # Dialplan (call routing)
│   │   ├── rtp.conf              # RTP/media settings
│   │   ├── http.conf             # HTTP/WebSocket settings
│   │   ├── modules.conf          # Module loading
│   │   ├── voicemail.conf        # Voicemail configuration
│   │   └── confbridge.conf       # Conference bridge settings
│   ├── logs/                     # Asterisk logs (generated)
│   ├── sounds/                   # Audio files (generated)
│   └── keys/                     # Security keys (generated)
│
├── kamailio/                      # Kamailio SIP proxy
│   ├── kamailio.cfg              # Main configuration
│   ├── kamctlrc                  # Control tool configuration
│   ├── tls.cfg                   # TLS/SSL settings
│   └── schema.sql                # Database schema
│
├── coturn/                        # TURN server for NAT traversal
│   └── turnserver.conf           # TURN configuration
│
├── nginx/                         # Web server & reverse proxy
│   ├── nginx.conf                # Nginx configuration
│   └── html/                     # Web client files
│       ├── index.html            # WebRTC client interface
│       ├── style.css             # Client styling
│       └── app.js                # WebRTC client logic (JsSIP)
│
├── scripts/                       # Utility scripts
│   ├── setup.sh                  # Automated setup script
│   ├── generate-certs.sh         # SSL certificate generator
│   ├── backup.sh                 # Backup script
│   └── monitor.sh                # System monitoring
│
├── certs/                         # SSL certificates (generated)
│   ├── cert.pem                  # Certificate
│   ├── key.pem                   # Private key
│   └── ca.pem                    # CA chain
│
├── docker-compose.yml             # Docker service definitions
├── .env.example                   # Environment variables template
├── .gitignore                     # Git ignore rules
│
├── README.md                      # Main documentation
├── SETUP_GUIDE.md                 # Detailed setup instructions
├── QUICKSTART.md                  # Quick start guide
├── TROUBLESHOOTING.md             # Troubleshooting guide
├── WINDOWS_NOTES.md               # Windows-specific notes
└── PROJECT_STRUCTURE.md           # This file
```

## File Descriptions

### Core Configuration Files

#### `docker-compose.yml`
Defines all services and their relationships:
- **asterisk**: PBX service
- **kamailio**: SIP proxy
- **coturn**: TURN server
- **nginx**: Web server
- **mysql**: Database for Kamailio

#### `.env.example`
Template for environment variables:
- Domain configuration
- IP addresses
- Genesys credentials
- Port mappings
- Secrets and passwords

### Asterisk Configuration

#### `asterisk/etc/pjsip.conf`
**Purpose:** SIP/WebRTC endpoint configuration

**Key Sections:**
- `[global]`: Global PJSIP settings
- `[transport-*]`: Network transports (UDP, TCP, WS, WSS)
- `[genesys_trunk]`: Genesys SIP trunk configuration
- `[webrtc_client]`: Template for WebRTC users
- `[1000]`, `[1001]`, etc.: Individual user accounts

**Key Settings:**
- WebRTC support (ICE, DTLS, SRTP)
- Genesys authentication
- NAT traversal
- Codec preferences

#### `asterisk/etc/extensions.conf`
**Purpose:** Call routing and dialplan logic

**Contexts:**
- `[from-internal]`: WebRTC user calls
  - `600`: Echo test
  - `601`: Music on hold
  - `700`: Conference room
  - `1XXX`: Internal extensions
  - `NXXXXXXXXX`: External calls via Genesys
  
- `[from-genesys]`: Incoming calls from Genesys
  - DID routing
  - IVR menu
  
- `[ivr]`: Interactive voice response menu
- `[from-kamailio]`: Calls from Kamailio proxy

#### `asterisk/etc/rtp.conf`
**Purpose:** RTP/media configuration

**Key Settings:**
- Port range (10000-20000)
- ICE support
- STUN server
- TURN server
- Timeouts

#### `asterisk/etc/http.conf`
**Purpose:** HTTP/WebSocket server

**Key Settings:**
- WebSocket ports (8088, 8089)
- TLS configuration
- Certificate paths

#### `asterisk/etc/modules.conf`
**Purpose:** Module loading

**Loaded Modules:**
- `res_pjsip*`: SIP stack
- `res_http_websocket`: WebSocket support
- `codec_*`: Audio codecs
- `app_*`: Applications (dial, voicemail, etc.)

#### `asterisk/etc/voicemail.conf`
**Purpose:** Voicemail system

**Configuration:**
- Email notifications
- Mailbox quotas
- User mailboxes

#### `asterisk/etc/confbridge.conf`
**Purpose:** Conference bridge

**Configuration:**
- Bridge profiles
- User roles
- Audio settings

### Kamailio Configuration

#### `kamailio/kamailio.cfg`
**Purpose:** SIP proxy and RTP engine

**Key Features:**
- WebSocket to SIP translation
- NAT traversal with RTPEngine
- Load balancing
- Security filtering
- Authentication
- Registration handling
- Call routing to Asterisk

**Key Routes:**
- `request_route`: Main request handler
- `route[TOASTERISK]`: Forward to Asterisk
- `route[NATMANAGE]`: NAT handling
- `route[RELAY]`: Message relaying

#### `kamailio/kamctlrc`
**Purpose:** Kamailio control tool settings

**Configuration:**
- Database connection
- SIP domain
- User management

#### `kamailio/tls.cfg`
**Purpose:** TLS/SSL configuration

**Settings:**
- Certificate paths
- TLS methods
- Cipher suites

#### `kamailio/schema.sql`
**Purpose:** MySQL database initialization

**Tables:**
- `subscriber`: User accounts
- `location`: Registration data
- `dialog`: Active calls
- `version`: Schema versioning

### TURN Server Configuration

#### `coturn/turnserver.conf`
**Purpose:** TURN server for NAT traversal

**Key Settings:**
- Listening ports (3478, 5349)
- Realm configuration
- User credentials
- Relay addresses
- TLS certificates

### Web Server Configuration

#### `nginx/nginx.conf`
**Purpose:** Reverse proxy and web server

**Key Features:**
- HTTPS termination
- WebSocket proxy
- Static file serving
- Security headers
- Gzip compression

**Proxy Routes:**
- `/ws`: Asterisk WebSocket
- `/kamailio-ws`: Kamailio WebSocket

#### `nginx/html/index.html`
**Purpose:** WebRTC client interface

**Features:**
- Connection management
- Dialpad
- Call controls
- Audio controls
- Call log
- Debug console

#### `nginx/html/style.css`
**Purpose:** Client styling

**Styling:**
- Responsive design
- Modern UI components
- Dark/light themes
- Animations

#### `nginx/html/app.js`
**Purpose:** WebRTC client logic

**Functionality:**
- JsSIP integration
- WebSocket connection
- Call management
- Audio handling
- UI updates
- DTMF support

### Utility Scripts

#### `scripts/setup.sh`
**Purpose:** Automated initial setup

**Tasks:**
- Check prerequisites
- Collect configuration
- Update config files
- Generate certificates
- Configure firewall
- Start services

#### `scripts/generate-certs.sh`
**Purpose:** SSL certificate generation

**Modes:**
- Production: Let's Encrypt
- Development: Self-signed

#### `scripts/backup.sh`
**Purpose:** System backup

**Backs up:**
- Configuration files
- Database
- Certificates
- Custom sounds

#### `scripts/monitor.sh`
**Purpose:** System monitoring

**Displays:**
- Container status
- Active calls
- Resource usage
- Service health
- Recent errors

### Documentation

#### `README.md`
Main documentation covering:
- Features
- Architecture
- Installation
- Configuration
- Usage
- Monitoring
- Troubleshooting

#### `SETUP_GUIDE.md`
Detailed step-by-step setup:
- Server preparation
- SSL certificates
- Configuration
- Genesys integration
- Testing
- Production deployment

#### `QUICKSTART.md`
Rapid deployment guide:
- 10-minute setup
- Quick testing
- Essential commands

#### `TROUBLESHOOTING.md`
Problem-solving guide:
- Common issues
- Solutions
- Diagnostic commands
- Debug procedures

#### `WINDOWS_NOTES.md`
Windows-specific information:
- Development on Windows
- WSL usage
- PowerShell commands
- Deployment to Linux

#### `PROJECT_STRUCTURE.md`
This file - project organization.

## Configuration Dependencies

### Service Dependencies

```
nginx ──┐
        ├─→ asterisk ─→ kamailio ─→ mysql
coturn ─┘              
```

### Configuration Dependencies

```
.env.example
    ├─→ asterisk/etc/pjsip.conf (IPs, Genesys)
    ├─→ asterisk/etc/rtp.conf (TURN)
    ├─→ kamailio/kamailio.cfg (Domain, IPs)
    ├─→ coturn/turnserver.conf (Domain, Secret)
    └─→ nginx/nginx.conf (Domain)
```

### Port Mappings

| Service   | Port(s)        | Purpose              |
|-----------|----------------|----------------------|
| Nginx     | 80, 443        | HTTP/HTTPS           |
| Asterisk  | 5060-5061      | SIP                  |
| Asterisk  | 8088-8089      | WebSocket            |
| Asterisk  | 10000-20000    | RTP                  |
| Kamailio  | 5060-5061      | SIP                  |
| Kamailio  | 8080, 4443     | WebSocket            |
| Coturn    | 3478-3479      | TURN                 |
| Coturn    | 5349           | TURN TLS             |
| MySQL     | 3306           | Database             |

## Data Flow

### WebRTC Call Setup

```
Browser (WebRTC Client)
    │
    ├── WSS ──→ Nginx ──→ Asterisk (WebSocket)
    │
    ├── SRTP ──→ Asterisk (RTP)
    │
    └── ICE ──→ Coturn (TURN)
```

### Genesys Integration

```
WebRTC User
    │
    ├──→ Asterisk (PJSIP/WSS)
    │
    ├──→ Dialplan routing
    │
    └──→ Genesys Trunk (SIP/UDP) ──→ PSTN
```

### Registration Flow

```
WebRTC Client
    │
    ├── REGISTER ──→ Nginx
    │
    ├──→ Asterisk (auth)
    │
    └──→ Location stored
```

## Customization Points

### Adding WebRTC Users
**File:** `asterisk/etc/pjsip.conf`
- Add endpoint, auth, and aor sections

### Modifying Dialplan
**File:** `asterisk/etc/extensions.conf`
- Update contexts and extensions

### Changing Genesys Settings
**Files:**
- `asterisk/etc/pjsip.conf` (trunk config)
- `.env` (credentials)

### Adjusting Ports
**File:** `docker-compose.yml`
- Modify port mappings

### Customizing Web Client
**Files:**
- `nginx/html/index.html` (structure)
- `nginx/html/style.css` (appearance)
- `nginx/html/app.js` (functionality)

## Generated Files (Not in Git)

These are created during setup:

```
certs/                  # SSL certificates
asterisk/logs/          # Asterisk logs
asterisk/sounds/        # Generated sounds
asterisk/keys/          # Security keys
.env                    # Environment variables
backups/               # Backup archives
```

## Security Considerations

### Sensitive Files
- `.env`: Contains passwords and secrets
- `certs/*`: SSL certificates and keys
- `asterisk/etc/pjsip.conf`: User passwords

### File Permissions
- Configuration: 644
- Scripts: 755
- Certificates: 600
- Private keys: 600

---

**Note:** This structure is designed for scalability and maintainability. Each component is isolated and can be updated independently.




