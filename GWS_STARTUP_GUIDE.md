# GWS + WebRTC SIP Endpoint - Startup Guide

## 🚀 Quick Start Guide

This guide helps you get the Genesys Workspace Web Edition (GWS) application running with the WebRTC SIP endpoint infrastructure.

---

## 📋 Prerequisites

### System Requirements

- **Java**: JDK 8 or later
- **RAM**: Minimum 4GB for GWS application
- **Ports**: 8080 (GWS), 443/8089 (WebRTC), 5000/5025 (Genesys)

### Network Access

- [ ] Genesys Configuration Server accessible
- [ ] Genesys T-Server accessible  
- [ ] Genesys SIP Server accessible
- [ ] Asterisk WebRTC server accessible

---

## 🔧 Step-by-Step Setup

### Step 1: Prepare GWS Configuration

Create a configuration file for GWS:

**File**: `h:\Abhishek\gws-main\application.yml`

```yaml
# GWS Application Configuration
server:
  port: 8080
  servlet:
    context-path: /
  compression:
    enabled: true
    
spring:
  application:
    name: Genesys Workspace Web Edition
  session:
    timeout: 3600
    
# Logging
logging:
  level:
    com.genesyslab: INFO
    root: WARN
  file:
    name: logs/gws.log

# Genesys Platform Connections
contact-center:
  config-server:
    host: YOUR_CONFIG_SERVER_HOST
    port: 5000
    app-name: workspace-web-edition
    client-name: GWS-Instance-1
    
  t-server:
    primary:
      host: YOUR_TSERVER_HOST
      port: 5025
      client-name: GWS-TServer-1
    backup:
      enabled: false
      host: YOUR_BACKUP_TSERVER_HOST
      port: 5025
      
  # Connection timeout (seconds)
  connection-timeout: 30
  
  # Heartbeat interval (seconds)
  heartbeat-interval: 10

# CometD Configuration (Real-time push to browser)
cometd:
  enabled: true
  timeout: 30000
  interval: 0
  maxInterval: 10000
  maxMessageSize: 8192

# Security
security:
  # Basic authentication for now
  basic:
    enabled: true
  
  # SAML (if using SSO)
  saml:
    enabled: false
    
  # OAuth2 (if using OAuth)
  oauth2:
    enabled: false

# CORS Configuration (for WebRTC client)
cors:
  allowed-origins:
    - http://localhost
    - https://webrtc-server.company.com
  allowed-methods:
    - GET
    - POST
    - PUT
    - DELETE
    - OPTIONS
```

### Step 2: Update Configuration with Your Values

Edit the configuration file and replace:

1. **YOUR_CONFIG_SERVER_HOST**: Your Genesys Configuration Server hostname/IP
2. **YOUR_TSERVER_HOST**: Your Genesys T-Server hostname/IP  
3. **YOUR_BACKUP_TSERVER_HOST**: Backup T-Server (optional)

**Example**:
```yaml
config-server:
  host: 192.168.1.100
  port: 5000
  
t-server:
  primary:
    host: 192.168.1.101
    port: 5025
```

### Step 3: Start GWS Application

#### Option A: Using Command Line (Windows)

Create a startup script: `start-gws.bat`

```batch
@echo off
echo Starting Genesys Workspace Web Edition...

cd /d h:\Abhishek\gws-main

REM Set Java options
set JAVA_OPTS=-Xms512m -Xmx2048m -XX:MaxPermSize=512m

REM Run GWS application
java %JAVA_OPTS% -jar gws-main\org\springframework\boot\loader\JarLauncher.class ^
     --spring.config.location=file:///h:/Abhishek/gws-main/application.yml

pause
```

Run the script:
```cmd
start-gws.bat
```

#### Option B: Using PowerShell

Create: `start-gws.ps1`

```powershell
# Start GWS Application
Write-Host "Starting Genesys Workspace Web Edition..." -ForegroundColor Green

# Set location
Set-Location "h:\Abhishek\gws-main"

# Java options
$env:JAVA_OPTS = "-Xms512m -Xmx2048m -XX:MaxPermSize=512m"

# Run application
java $env:JAVA_OPTS.Split() `
     -jar gws-main\org\springframework\boot\loader\JarLauncher.class `
     --spring.config.location=file:///h:/Abhishek/gws-main/application.yml
```

Run:
```powershell
.\start-gws.ps1
```

#### Option C: Run Directly

```bash
cd h:\Abhishek\gws-main
java -Xmx2048m -jar gws-main\org\springframework\boot\loader\JarLauncher.class
```

### Step 4: Verify GWS Startup

Watch for these log messages:

```
✓ Started CloudWebApplication in X.XXX seconds
✓ Connected to Configuration Server [192.168.1.100:5000]
✓ T-Server connection established [192.168.1.101:5025]
✓ Jetty started on port 8080
✓ Application is ready
```

**Access GWS UI**: http://localhost:8080/ui/ad/v1/

### Step 5: Configure Genesys Objects

#### A. Create Agent in Configuration Manager

```
1. Open Genesys Administrator or Configuration Manager
2. Navigate to: Accounts → Persons → Create New

Person Details:
- User Name: agent5001
- First Name: John
- Last Name: Smith
- Employee ID: 5001
- Is Agent: Yes

Agent Settings:
- Place: Agent_Place
- Skills: CustomerService, Sales
- Capacity Rule: [Your rule]
```

#### B. Create Agent DN

```
Navigate to: Environment → DNs → Create New

DN Configuration:
- Number: 5001
- Type: Extension
- Switch: SIP_Server_Switch (or Asterisk Gateway)
- Place: Agent_Place
- Register: Yes
- Is Active: Yes
```

#### C. Link Agent to DN

```
Back to Person (agent5001):
- Skills/Capacities tab
- Agent Logins section
- Add Login:
  - Switch: SIP_Server_Switch
  - DN: 5001
```

### Step 6: Start WebRTC Infrastructure

```bash
# If using Docker Compose on remote server
ssh user@192.168.77.131

cd /home/user/WebRTC

# Start services
docker-compose up -d

# Verify running
docker-compose ps

# Should see:
# - webrtc-nginx (running)
# - webrtc-asterisk (running)
# - webrtc-coturn (running)
```

### Step 7: Configure Asterisk for Agent DNs

Ensure Asterisk has agent DN endpoints configured:

```bash
# Check configuration
docker exec -it webrtc-asterisk cat /etc/asterisk/pjsip.conf

# Look for agent DN sections:
# [5001]
# type=endpoint
# transport=transport-wss
# ...
```

If not present, add agent DN configuration (see `pjsip-sip-endpoint.conf`).

### Step 8: Test Agent Login

#### 8.1 Login to GWS

1. Open browser: http://localhost:8080/ui/ad/v1/
2. Login credentials:
   - Username: agent5001
   - Password: [your password]
3. Should see GWS desktop interface

#### 8.2 Register SIP Endpoint

1. Open another tab: https://webrtc-server/index-agent-dn.html
2. Enter connection details:
   - SIP Server: wss://webrtc-server:443/ws
   - Agent DN: 5001
   - Password: [SIP password]
3. Click "Connect"
4. Should see "Registered (DN: 5001)"

#### 8.3 Set Agent Ready

1. Back to GWS tab
2. Click "Ready" button
3. Status should change to "Ready"

#### 8.4 Test Call

Make a test call to DN 5001:
- Call should ring in WebRTC client
- Screen pop should appear in GWS
- Answer via GWS interface

---

## 🔍 Monitoring & Verification

### Check 1: GWS Health

```bash
# Health check endpoint
curl http://localhost:8080/actuator/health

# Should return:
# {"status":"UP"}
```

### Check 2: GWS Metrics

```bash
# View metrics
curl http://localhost:8080/actuator/metrics

# Specific metric (e.g., active sessions)
curl http://localhost:8080/actuator/metrics/http.server.requests
```

### Check 3: CometD Status

Open browser console on GWS page:

```javascript
// Check CometD connection
console.log(window.cometd.getStatus());
// Should be: "connected"

// Check subscriptions
console.log(window.cometd.getSubscriptions());
// Should show various /v2/ channels
```

### Check 4: Asterisk SIP Endpoints

```bash
# Check registered endpoints
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoints"

# Look for your agent DN:
# Endpoint:  5001/5001                                     In use  0 of inf
#     Contact:  5001/sip:5001@192.168.1.50:54321          Avail
```

### Check 5: Genesys Connections

Check T-Server log for:
```
Agent 'agent5001' logged in on DN '5001'
DN '5001' registered from 192.168.77.131
```

---

## 📊 Architecture Verification

Run through this checklist:

```
┌─────────────────────────────────────────────────┐
│ Component Status Checklist                      │
├─────────────────────────────────────────────────┤
│ ☐ GWS Application running (port 8080)          │
│ ☐ Config Server connection: OK                 │
│ ☐ T-Server connection: OK                      │
│ ☐ CometD WebSocket: Connected                  │
│ ☐ Asterisk running                             │
│ ☐ Nginx proxy running                          │
│ ☐ Agent object exists in Config Manager        │
│ ☐ Agent DN exists and assigned                 │
│ ☐ WebRTC client accessible via HTTPS           │
│ ☐ SIP endpoint registration: Success           │
│ ☐ Agent logged into GWS: Success              │
│ ☐ Agent state: Ready                           │
│ ☐ Test call: Rings in both GWS & WebRTC       │
│ ☐ Call control: Working from GWS              │
│ ☐ Two-way audio: OK                           │
└─────────────────────────────────────────────────┘
```

---

## 🐛 Common Issues & Solutions

### Issue 1: GWS Won't Start

**Error**: `Cannot connect to Configuration Server`

**Solution**:
```bash
# 1. Check network connectivity
ping YOUR_CONFIG_SERVER_HOST

# 2. Check port
telnet YOUR_CONFIG_SERVER_HOST 5000

# 3. Verify credentials in application.yml
# 4. Check firewall rules
```

### Issue 2: Agent Can't Login

**Error**: `Authentication failed`

**Solution**:
1. Verify agent exists in Config Manager
2. Check password
3. Verify agent is enabled (Is Active = Yes)
4. Check Person → Agent Logins has valid entry

### Issue 3: SIP Endpoint Won't Register

**Error**: `Registration failed: 403 Forbidden`

**Solution**:
1. Verify DN 5001 exists in Config Manager
2. Check SIP password in Asterisk `pjsip.conf`
3. Verify Asterisk → Genesys SIP trunk is up
4. Check SIP Server logs for rejection reason

### Issue 4: No Screen Pop on Incoming Call

**Solution**:
1. Check browser console for CometD errors
2. Verify T-Server connection in GWS logs
3. Check event subscriptions: `/v2/me/calls`
4. Verify agent DN is correctly linked to agent person

### Issue 5: Call Rings but No Audio

**Solution**:
1. Check WebRTC media permissions in browser
2. Verify STUN/TURN server configuration
3. Check NAT/firewall for RTP ports (10000-20000)
4. Verify `direct_media=no` in Asterisk
5. Check codec compatibility (Opus/G.711)

---

## 🔐 Security Checklist

Before going to production:

- [ ] Change default passwords
- [ ] Enable HTTPS for GWS (not just HTTP)
- [ ] Configure proper SSL certificates
- [ ] Enable SAML or OAuth2 for SSO
- [ ] Restrict CORS origins
- [ ] Enable firewall rules
- [ ] Use encrypted connection to T-Server
- [ ] Enable audit logging
- [ ] Set up session timeout
- [ ] Configure rate limiting

---

## 📈 Performance Tuning

### GWS JVM Settings

For production with many agents:

```bash
java -Xms1024m \
     -Xmx4096m \
     -XX:MaxPermSize=512m \
     -XX:+UseG1GC \
     -XX:MaxGCPauseMillis=200 \
     -XX:+HeapDumpOnOutOfMemoryError \
     -jar gws-main.jar
```

### Connection Pool Settings

In `application.yml`:

```yaml
contact-center:
  connection-pool:
    min-size: 2
    max-size: 20
    timeout: 30
```

### CometD Tuning

```yaml
cometd:
  timeout: 60000        # 60 seconds
  maxInterval: 20000    # 20 seconds
  maxMessageSize: 16384 # 16KB
  jsonContext: jackson  # Use Jackson for better performance
```

---

## 📚 Additional Resources

### Log Files

```
GWS Logs: h:\Abhishek\gws-main\logs\gws.log
Asterisk: docker logs -f webrtc-asterisk
Nginx: docker logs -f webrtc-nginx
```

### Useful Commands

```bash
# GWS
# Check if running
netstat -an | findstr 8080

# Check Java processes
jps -l

# Kill GWS
taskkill /F /IM java.exe

# Asterisk
docker exec -it webrtc-asterisk asterisk -rx "core show channels"
docker exec -it webrtc-asterisk asterisk -rx "pjsip show registrations"

# Genesys
# Check Config Server
telnet YOUR_CONFIG_HOST 5000

# Check T-Server  
telnet YOUR_TSERVER_HOST 5025
```

---

## 🎯 Next Steps

Once everything is working:

1. **Configure more agents** - Add additional agent DNs (5002, 5003, etc.)
2. **Set up routing strategies** - Configure call routing in URS
3. **Create queues** - Set up queue DNs in Config Manager
4. **Configure skills** - Add skill groups and assign to agents
5. **Enable reporting** - Set up Stat Server for real-time stats
6. **Customize UI** - Modify GWS interface as needed
7. **Load testing** - Test with multiple concurrent agents

---

## 📞 Support

For issues:
- Check logs first
- Review architecture documentation
- Refer to Genesys Platform SDK documentation
- Check Asterisk/WebRTC troubleshooting guides

---

**✨ You now have a fully integrated contact center agent desktop with WebRTC voice!**



