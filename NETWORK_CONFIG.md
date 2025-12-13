# Network Configuration

## Current Environment Setup

### GWS (Genesys Workspace Web Edition)
- **URL:** http://192.168.18.109:8090/ui/ad/v1/index.html
- **Host:** 192.168.18.109
- **Port:** 8090 (HTTP)
- **CometD Endpoint:** http://192.168.18.109:8090/cometd
- **REST API:** http://192.168.18.109:8090/api/v2

### Genesys Environment
- **Genesys Platform IP:** 10.78.3.90
- **Config Server:** 10.78.3.90:5000 (typically)
- **T-Server:** 10.78.3.90:5025 (typically)
- **SIP Server:** 10.78.3.90:5060 (typically)

### WebRTC Infrastructure
- **Asterisk:** (To be configured - your WebRTC server IP)
- **Nginx:** (To be configured - your WebRTC server IP)
- **Coturn:** (To be configured - your WebRTC server IP)

---

## Configuration Updates Needed

### 1. GWS Application (`application.yml`)

Update in `H:\Abhishek\gws-main\application.yml`:

```yaml
contact-center:
  config-server:
    host: 10.78.3.90
    port: 5000
    
  t-server:
    primary:
      host: 10.78.3.90
      port: 5025
```

### 2. WebRTC Client (Already Updated)

The web client now defaults to:
- GWS URL: `http://192.168.18.109:8090`
- Agent DN: `5001`
- Password: `GenesysAgent5001!`

### 3. Asterisk Configuration

Update `asterisk/etc/pjsip.conf`:
- `${GENESYS_SIP_HOST}` → `10.78.3.90`
- `${GENESYS_SIP_PORT}` → `5060`
- `${PUBLIC_IP}` → Your WebRTC server's public IP

### 4. CORS Configuration

Ensure GWS allows connections from your WebRTC server:

In `H:\Abhishek\gws-main\application.yml`:

```yaml
security:
  cors:
    enabled: true
    allowed-origins:
      - http://192.168.18.109:8090
      - https://your-webrtc-domain.com
      - https://your-webrtc-ip
```

---

## Network Flow

```
Agent Browser
    ↓ HTTPS
GWS (192.168.18.109:8090)
    ↓ TCP 5025
T-Server (10.78.3.90:5025)
    ↓
Genesys Platform (10.78.3.90)

Agent Browser
    ↓ WSS
WebRTC Server (Asterisk)
    ↓ SIP UDP 5060
SIP Server (10.78.3.90:5060)
    ↓
Genesys Platform (10.78.3.90)
```

---

## Testing Connectivity

### Test GWS Connection

```bash
# From WebRTC server, test GWS connectivity
curl http://192.168.18.109:8090/actuator/health

# Test CometD endpoint
curl http://192.168.18.109:8090/cometd
```

### Test Genesys Connectivity

```bash
# Test Config Server
telnet 10.78.3.90 5000

# Test T-Server
telnet 10.78.3.90 5025

# Test SIP Server
telnet 10.78.3.90 5060
# Or
ping 10.78.3.90
```

---

## Firewall Rules

Ensure these ports are open:

**On GWS Server (192.168.18.109):**
- 8090 (HTTP - GWS application)

**On Genesys Server (10.78.3.90):**
- 5000 (Config Server)
- 5025 (T-Server)
- 5060-5061 (SIP)

**On WebRTC Server:**
- 80, 443 (Nginx)
- 5060-5061 (SIP)
- 8088-8089 (WebSocket)
- 10000-20000 (RTP)
- 3478-3479, 5349 (TURN)

---

## Quick Reference

| Component | IP/URL | Port | Purpose |
|-----------|--------|------|---------|
| GWS | 192.168.18.109 | 8090 | Agent Desktop |
| Config Server | 10.78.3.90 | 5000 | Configuration |
| T-Server | 10.78.3.90 | 5025 | Call Control |
| SIP Server | 10.78.3.90 | 5060 | SIP Signaling |
| WebRTC Server | (Your IP) | 443 | Web Client |
| Asterisk | (Your IP) | 8089 | WebSocket SIP |

---

**Note:** Update all `${GENESYS_SIP_HOST}` references in `pjsip.conf` to `10.78.3.90`

