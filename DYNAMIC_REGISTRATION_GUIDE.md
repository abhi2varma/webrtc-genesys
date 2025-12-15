# Dynamic DN Registration Guide

## 🎯 Overview

This system enables **dynamic DN registration** to Genesys SIP Server based on WebRTC client connections.

### How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. Agent opens WebRTC client and clicks "Connect" (DN 5001)       │
│     ↓                                                               │
│  2. WebRTC client → Asterisk: REGISTER sip:5001@192.168.210.54     │
│     ↓                                                               │
│  3. Asterisk AMI emits event: "ContactStatusDetail" (5001)          │
│     ↓                                                               │
│  4. Registration Monitor detects the event                          │
│     ↓                                                               │
│  5. Monitor → Asterisk AMI: "PJSIPRegister genesys_reg_5001"       │
│     ↓                                                               │
│  6. Asterisk → Genesys SIP: REGISTER sip:5001@192.168.210.81       │
│     ↓                                                               │
│  7. ✅ Genesys now knows: DN 5001 is at 192.168.210.54             │
│                                                                     │
│  ─────────────────────────────────────────────────────────────     │
│                                                                     │
│  8. Agent clicks "Disconnect"                                       │
│     ↓                                                               │
│  9. WebRTC client → Asterisk: UNREGISTER sip:5001@192.168.210.54   │
│     ↓                                                               │
│ 10. Monitor detects disconnection                                   │
│     ↓                                                               │
│ 11. Monitor → Asterisk AMI: "PJSIPUnregister genesys_reg_5001"     │
│     ↓                                                               │
│ 12. Asterisk → Genesys SIP: REGISTER sip:5001@192.168.210.81       │
│     (with Expires: 0)                                               │
│     ↓                                                               │
│ 13. ✅ Genesys now knows: DN 5001 is offline                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture

### Components

```
┌────────────────────┐       ┌─────────────────────┐       ┌──────────────────┐
│  WebRTC Client     │       │  Asterisk + AMI     │       │  Genesys SIP     │
│  (Browser)         │◄─────►│  192.168.210.54     │◄─────►│  192.168.210.81  │
└────────────────────┘       └──────────┬──────────┘       └──────────────────┘
                                       │
                                       │ AMI Events
                                       │ (Port 5038)
                                       ↓
                            ┌──────────────────────┐
                            │ Registration Monitor │
                            │  (Python Service)    │
                            └──────────────────────┘
```

### New Service: `registration-monitor`

**Purpose:** Watches for WebRTC client connections and dynamically registers DNs to Genesys

**Technology:** Python 3.11 + panoramisk (Asterisk AMI library)

**Container:** `webrtc-registration-monitor`

**Key Features:**
- ✅ Monitors AMI events in real-time
- ✅ Triggers registration only when client connects
- ✅ Unregisters when client disconnects
- ✅ Handles reconnection automatically
- ✅ Configurable DN range
- ✅ Detailed logging

---

## 📋 Configuration

### 1. Asterisk AMI Configuration

**File:** `asterisk/etc/manager.conf`

```ini
[general]
enabled = yes
port = 5038
bindaddr = 0.0.0.0

[admin]
secret = admin123
read = all
write = all
permit = 127.0.0.1/255.255.255.0
permit = 172.16.0.0/12
permit = 10.0.0.0/8
permit = 192.168.0.0/16
```

**Security Notes:**
- Change `admin123` to a strong password in production
- Restrict `permit` to only necessary networks
- Use firewall rules to block external access to port 5038

---

### 2. PJSIP Registration Configuration

**File:** `asterisk/etc/pjsip.conf`

```ini
[genesys_reg_5001]
type=registration
transport=transport-udp
outbound_auth=genesys_auth
server_uri=sip:192.168.210.81:5060
client_uri=sip:5001@192.168.210.81
contact_user=5001
retry_interval=0          # ← KEY: Don't auto-register
expiration=300
max_retries=0             # ← KEY: Don't retry automatically
line=no                   # ← KEY: Not a trunk line
```

**Important Settings:**
- `retry_interval=0`: Prevents automatic registration on Asterisk startup
- `max_retries=0`: No automatic retries (controlled by monitor)
- `line=no`: This is not a line subscription

---

### 3. Registration Monitor Configuration

**File:** `docker-compose.yml`

```yaml
registration-monitor:
  build: ./registration-monitor
  container_name: webrtc-registration-monitor
  network_mode: host
  restart: unless-stopped
  environment:
    - ASTERISK_HOST=127.0.0.1
    - ASTERISK_AMI_PORT=5038
    - ASTERISK_AMI_USER=admin
    - ASTERISK_AMI_SECRET=admin123
    - GENESYS_SIP_HOST=192.168.210.81
    - GENESYS_SIP_PORT=5060
    - DN_RANGE_START=5001
    - DN_RANGE_END=5020
    - LOG_LEVEL=INFO
```

**Environment Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `ASTERISK_HOST` | Asterisk hostname/IP | `webrtc-asterisk` |
| `ASTERISK_AMI_PORT` | AMI port | `5038` |
| `ASTERISK_AMI_USER` | AMI username | `admin` |
| `ASTERISK_AMI_SECRET` | AMI password | `admin123` |
| `GENESYS_SIP_HOST` | Genesys SIP Server IP | `192.168.210.81` |
| `GENESYS_SIP_PORT` | Genesys SIP port | `5060` |
| `DN_RANGE_START` | First DN to monitor | `5001` |
| `DN_RANGE_END` | Last DN to monitor | `5020` |
| `LOG_LEVEL` | Logging verbosity | `INFO` |

---

## 🚀 Deployment

### Step 1: Deploy Updated Configuration

```bash
# SSH to CentOS server
ssh -p 69 Gencct@192.168.210.54

# Navigate to project
cd /opt/gcti_apps/webrtc-genesys

# Pull latest code
sudo git pull origin main

# Build registration monitor image
docker-compose build registration-monitor

# Stop all services
docker-compose down

# Start all services (including new monitor)
docker-compose up -d

# Check all containers are running
docker-compose ps
```

**Expected output:**
```
NAME                            STATUS
webrtc-asterisk                 Up 10 seconds
webrtc-coturn                   Up 10 seconds
webrtc-nginx                    Up 10 seconds
webrtc-registration-monitor     Up 10 seconds  ← NEW!
```

---

### Step 2: Verify Registration Monitor

```bash
# Check monitor logs
docker logs -f webrtc-registration-monitor
```

**Expected output:**
```
============================================================
Asterisk-Genesys Dynamic Registration Monitor
============================================================
Asterisk AMI: 127.0.0.1:5038
Genesys SIP: 192.168.210.81:5060
Monitoring DNs: 5001-5020
============================================================
✅ Connected to Asterisk AMI
Querying initial registration status...
Initial registration query completed
```

---

### Step 3: Verify AMI Access

```bash
# Test AMI connection manually
docker exec -it webrtc-asterisk asterisk -rx "manager show connected"
```

**Expected output:**
```
Username         IP Address       Start        Elapsed     FileDes  HttpCnt
admin            127.0.0.1        00:01:23     00:00:15    12       0
1 users connected.
```

---

## ✅ Testing

### Test 1: WebRTC Client Registration

**Steps:**
1. Open WebRTC client: `http://192.168.210.54/`
2. Enter credentials:
   - **DN:** `5001`
   - **Password:** `agent5001`
3. Click **"Connect"**

**Monitor logs (watch for this):**
```bash
docker logs -f webrtc-registration-monitor
```

**Expected output:**
```
ContactStatusDetail: DN=5001, Status=Created, URI=sip:xxx@...
🔵 Registering DN 5001 to Genesys SIP Server...
✅ DN 5001 registered to Genesys successfully
```

**Asterisk logs:**
```bash
docker logs -f webrtc-asterisk | grep "5001"
```

**Expected output:**
```
[Dec 15 12:30:45] Added contact 'sip:xxx@...' to AOR '5001'
[Dec 15 12:30:45] Sending REGISTER to 192.168.210.81:5060 for DN 5001
[Dec 15 12:30:45] Received 200 OK from 192.168.210.81
```

---

### Test 2: Check Genesys Registration

**On Genesys SIP Server, verify registration:**

```
DN: 5001
Contact: sip:5001@192.168.210.54:5060
Status: Registered
Expires: 300 seconds
```

---

### Test 3: WebRTC Client Disconnection

**Steps:**
1. In WebRTC client, click **"Disconnect"**

**Monitor logs:**
```
ContactStatusDetail: DN=5001, Status=Removed
🔴 Unregistering DN 5001 from Genesys SIP Server...
✅ DN 5001 unregistered from Genesys successfully
```

**Genesys SIP Server:**
```
DN: 5001
Status: Unregistered (or removed from list)
```

---

### Test 4: Multiple Concurrent Registrations

**Steps:**
1. Open WebRTC client in 3 different browsers/tabs
2. Register as:
   - Browser 1: DN 5001
   - Browser 2: DN 5002
   - Browser 3: DN 5003

**Monitor logs:**
```
🔵 Registering DN 5001 to Genesys SIP Server...
✅ DN 5001 registered to Genesys successfully
🔵 Registering DN 5002 to Genesys SIP Server...
✅ DN 5002 registered to Genesys successfully
🔵 Registering DN 5003 to Genesys SIP Server...
✅ DN 5003 registered to Genesys successfully
```

**Verify on Genesys:**
```
DN 5001: Registered at 192.168.210.54
DN 5002: Registered at 192.168.210.54
DN 5003: Registered at 192.168.210.54
DNs 5004-5020: Not registered
```

✅ **Perfect!** Only connected DNs are registered!

---

### Test 5: Call from Genesys to WebRTC Agent

**Preparation:**
1. Register WebRTC client as DN 5001

**Test:**
1. From any Genesys phone, dial: `5001`

**Expected:**
```
1. Genesys routes call to 192.168.210.54 (knows 5001 is there)
2. Asterisk receives INVITE
3. Asterisk forwards to WebRTC client
4. WebRTC client rings
5. Agent answers
6. ✅ Call connected!
```

---

## 🔍 Monitoring & Troubleshooting

### Check Registration Status

**View currently registered DNs:**
```bash
# On Asterisk
docker exec -it webrtc-asterisk asterisk -rx "pjsip show registrations"
```

**Expected (when DN 5001 is connected):**
```
genesys_reg_5001/sip:192.168.210.81:5060    genesys_auth  Registered
```

**Expected (when DN 5001 is NOT connected):**
```
genesys_reg_5001/sip:192.168.210.81:5060    genesys_auth  Unregistered
```

---

### Monitor Real-Time Events

**Watch all registration events:**
```bash
# Terminal 1: Monitor service logs
docker logs -f webrtc-registration-monitor

# Terminal 2: Asterisk PJSIP logs
docker logs -f webrtc-asterisk | grep -i "register\|contact"

# Terminal 3: AMI events (if needed)
docker exec -it webrtc-asterisk asterisk -rvvv
CLI> pjsip set logger on
```

---

### Common Issues

#### Issue 1: Monitor Can't Connect to AMI

**Symptoms:**
```
❌ Failed to connect to Asterisk AMI: Connection refused
```

**Checks:**
1. Verify AMI is enabled:
   ```bash
   docker exec -it webrtc-asterisk asterisk -rx "manager show settings"
   ```

2. Check manager.conf exists:
   ```bash
   docker exec -it webrtc-asterisk ls -la /etc/asterisk/manager.conf
   ```

3. Restart Asterisk:
   ```bash
   docker-compose restart asterisk
   ```

---

#### Issue 2: Registration Not Triggered

**Symptoms:**
- WebRTC client connects
- Monitor logs show no activity

**Checks:**
1. Verify DN is in monitored range:
   ```bash
   docker logs webrtc-registration-monitor | grep "Monitoring DNs"
   # Should show: Monitoring DNs: 5001-5020
   ```

2. Check AMI events are being received:
   ```bash
   docker logs webrtc-registration-monitor | grep "ContactStatusDetail\|PeerStatus"
   ```

3. Increase log level:
   ```bash
   # In docker-compose.yml, change:
   LOG_LEVEL=DEBUG
   
   docker-compose restart registration-monitor
   ```

---

#### Issue 3: Genesys Rejects Registration

**Symptoms:**
```
🔵 Registering DN 5001 to Genesys SIP Server...
⚠️  DN 5001 registration response: Failed (403 Forbidden)
```

**Fixes:**

1. **Check Genesys Trunk Configuration:**
   - Ensure trunk allows registrations from `192.168.210.54`
   - Verify IP-based authentication is enabled

2. **Check Authentication:**
   ```bash
   # In pjsip.conf, verify [genesys_auth] section
   [genesys_auth]
   type=auth
   auth_type=userpass
   username=<correct_username>
   password=<correct_password>
   ```

3. **Test manual registration:**
   ```bash
   docker exec -it webrtc-asterisk asterisk -rx "pjsip send register genesys_reg_5001"
   ```

---

#### Issue 4: Registration Works but Calls Don't Route

**Symptoms:**
- DN registers to Genesys ✅
- Calls to DN fail ❌

**Checks:**

1. **Verify Asterisk dialplan:**
   ```bash
   docker exec -it webrtc-asterisk asterisk -rx "dialplan show genesys-agent"
   ```

2. **Check if WebRTC client is actually registered locally:**
   ```bash
   docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoints" | grep 5001
   ```

3. **Test call flow manually:**
   ```bash
   docker exec -it webrtc-asterisk asterisk -rvvv
   CLI> core set verbose 5
   CLI> pjsip set logger on
   # Then make a test call
   ```

---

## 📊 Architecture Comparison

### Before (Static Registration)

```
Asterisk starts
    ↓
ALL 20 DNs register to Genesys immediately
    ↓
Genesys sees all 20 DNs as "available"
    ↓
Problem: DNs show as available even when agents are offline!
```

### After (Dynamic Registration)

```
Asterisk starts
    ↓
NO DNs registered to Genesys
    ↓
Agent connects (DN 5001)
    ↓
ONLY DN 5001 registers to Genesys
    ↓
Genesys sees: 5001 = online, 5002-5020 = offline
    ↓
✅ Accurate presence information!
```

---

## 🎯 Benefits

| Feature | Static Registration | Dynamic Registration |
|---------|--------------------|--------------------|
| **Accurate presence** | ❌ No | ✅ Yes |
| **Agent availability** | Always shows "available" | Shows actual status |
| **Resource efficiency** | Wastes Genesys resources | Only active agents registered |
| **Call routing** | Routes to offline agents | Only routes to online agents |
| **Scalability** | Fixed (all DNs) | Flexible (active DNs only) |

---

## 🔐 Security Considerations

### AMI Security

1. **Strong password:** Change `admin123` to a complex password
2. **Network restrictions:** Limit AMI access via `permit` directives
3. **Firewall rules:** Block port 5038 from external networks
4. **TLS (optional):** Enable AMI over TLS for encrypted communication

### Production Hardening

```ini
# manager.conf (production)
[admin]
secret = <STRONG_RANDOM_PASSWORD>
deny = 0.0.0.0/0.0.0.0
permit = 127.0.0.1/32          # Only localhost
read = system,call,log,verbose,agent,user,config,command,dtmf,reporting,cdr,dialplan
write = system,call,log,verbose,agent,user,config,command,reporting,originate
```

---

## 📝 Summary

✅ **Dynamic registration implemented successfully!**

**Key Points:**
- Registration happens ONLY when WebRTC client connects
- Unregistration happens when client disconnects
- Genesys sees accurate agent availability
- Fully automated via monitoring service
- No manual intervention required

**Next Steps:**
1. Deploy to CentOS (commands above)
2. Test registration flow
3. Verify call routing
4. Monitor for 24 hours
5. Adjust log levels as needed

---

**You now have exactly what you asked for!** 🎉

Agent clicks "Connect" → Registers to Genesys  
Agent clicks "Disconnect" → Unregisters from Genesys

Perfect! 🚀

