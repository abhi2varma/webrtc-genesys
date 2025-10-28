# Genesys Engage On-Premise Integration Guide

This guide covers integrating Asterisk WebRTC with **Genesys Engage** (formerly PureEngage/Genesys Enterprise) on-premise deployment.

## Overview

Genesys Engage is an on-premise contact center platform. This integration connects:
- **Asterisk** (WebRTC SIP PBX) ↔ **Genesys SIP Server** ↔ **Genesys Platform**

## Prerequisites

### Genesys Engage Components

You need access to:
- **Genesys SIP Server** (SIP endpoint)
- **Configuration Manager** (to configure DNs and Route Points)
- **T-Server** (optional, for CTI integration)
- Network connectivity between Asterisk and Genesys SIP Server

### Information Needed

Gather from your Genesys administrator:

1. **SIP Server Details:**
   - Genesys SIP Server IP/Hostname: `_______________`
   - SIP Port: `_______________` (usually 5060 or 5061)
   - Transport: `_______________` (UDP, TCP, or TLS)

2. **Authentication:**
   - Method: □ IP-based  □ Username/Password
   - Username/Access Code: `_______________`
   - Password: `_______________`
   - Realm/Domain: `_______________`

3. **Codecs Supported:**
   - □ G.711 (ulaw/alaw)
   - □ G.729
   - □ G.722
   - Other: `_______________`

4. **Route Points/DNs:**
   - Inbound DNs: `_______________`
   - Outbound Access Code: `_______________`
   - Agent DNs: `_______________`

5. **DTMF Mode:**
   - □ RFC2833 (recommended)
   - □ Inband
   - □ SIP INFO

## Configuration Steps

### Step 1: Update Environment Variables

Edit `.env`:

```bash
# Genesys Engage Configuration
GENESYS_SIP_HOST=your-genesys-sip-server.company.com
GENESYS_SIP_PORT=5060
GENESYS_USERNAME=your-access-code-or-username
GENESYS_PASSWORD=your-password
GENESYS_TRANSPORT=udp  # or tcp, tls
```

### Step 2: Configure Asterisk SIP Trunk

Use the Genesys Engage-specific configuration:

```bash
# Copy Genesys Engage configuration
cp asterisk/etc/pjsip-genesys-engage.conf asterisk/etc/pjsip.conf
```

**Edit `asterisk/etc/pjsip.conf`:**

Replace placeholders:
- `${GENESYS_SIP_HOST}` → Your Genesys SIP Server IP
- `${GENESYS_SIP_PORT}` → Usually 5060
- `${GENESYS_USERNAME}` → Your username or access code
- `${GENESYS_PASSWORD}` → Your password

**If using IP-based authentication** (no username/password):
```ini
[genesys_engage_trunk]
type=endpoint
context=from-genesys-engage
transport=transport-udp
aors=genesys_engage_trunk
disallow=all
allow=ulaw,alaw
direct_media=no
rtp_symmetric=yes
from_user=asterisk

[genesys-engage-identify]
type=identify
endpoint=genesys_engage_trunk
match=YOUR_GENESYS_SIP_SERVER_IP
```

### Step 3: Configure Route Points in Genesys

In **Genesys Configuration Manager**:

1. **Create SIP Endpoint:**
   - Navigate to: Environment → Switches
   - Add new switch: Type "External SIP Switch"
   - Name: "Asterisk-WebRTC"
   - Host: `<Asterisk-IP>:5060`

2. **Create DNs:**
   - Navigate to: Environment → DNs
   - Create DNs for:
     - Inbound route points (e.g., 5000-5099)
     - Outbound access (e.g., 9 + external number)
     - WebRTC extensions (e.g., 1000-1999)

3. **Create Routing Strategy:**
   - Navigate to: Routing → Strategies
   - Define how calls flow:
     - Inbound: PSTN → Genesys → Asterisk → WebRTC Agents
     - Outbound: WebRTC → Asterisk → Genesys → PSTN

4. **Configure Trunk:**
   - Navigate to: Environment → Trunk Groups
   - Add trunk to Asterisk
   - Assign DIDs/Route Points

### Step 4: Network Configuration

**Firewall Rules (both sides):**

Between Asterisk and Genesys SIP Server, allow:
- **SIP Signaling:**
  - Port: 5060 (UDP/TCP) or 5061 (TLS)
  - Bidirectional

- **RTP Media:**
  - Asterisk: Ports 10000-20000 UDP
  - Genesys: Check your RTP port range
  - Bidirectional

**On Asterisk server:**
```bash
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="GENESYS_SIP_SERVER_IP" port port="5060" protocol="udp" accept'
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="GENESYS_SIP_SERVER_IP" port port="10000-20000" protocol="udp" accept'
sudo firewall-cmd --reload
```

### Step 5: Test Configuration

#### Test 1: Verify SIP Trunk

```bash
# SSH to Asterisk server
ssh abhishek@192.168.77.131

# Check endpoint status
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoint genesys_engage_trunk"

# Should show: Registered or Available
```

#### Test 2: Test Outbound Call

From WebRTC client:
1. Register as extension 1000
2. Dial: `95551234567` (9 + external number)
3. Call should route: WebRTC → Asterisk → Genesys → PSTN

#### Test 3: Test Inbound Call

1. Call your Genesys DID from external phone
2. Genesys should route to configured Route Point
3. Asterisk receives call on DN (e.g., 5000)
4. Call routes to WebRTC extension or IVR

### Step 6: Configure Dialplan for Genesys

Edit `asterisk/etc/extensions.conf`:

```ini
[from-genesys-engage]
; Incoming calls from Genesys with Route Point DN
exten => 5000,1,NoOp(Customer Service Queue)
 same => n,Answer()
 same => n,Queue(customer-service)
 same => n,Hangup()

exten => 5001,1,NoOp(Sales Queue)
 same => n,Answer()
 same => n,Queue(sales)
 same => n,Hangup()

exten => 5002,1,NoOp(Technical Support)
 same => n,Answer()
 same => n,Queue(tech-support)
 same => n,Hangup()

; Direct extension routing
exten => _1XXX,1,NoOp(Direct to extension ${EXTEN})
 same => n,Dial(PJSIP/${EXTEN},30)
 same => n,Hangup()

[from-internal]
; Outbound through Genesys (9 + number)
exten => _9NXXXXXXXXX,1,NoOp(Outbound: ${EXTEN:1})
 same => n,Set(CALLERID(num)=${CALLERID(num)})
 same => n,Dial(PJSIP/${EXTEN:1}@genesys_engage_trunk,60)
 same => n,Hangup()

; Direct access to Genesys Route Points
exten => _5XXX,1,NoOp(Genesys Route Point: ${EXTEN})
 same => n,Dial(PJSIP/${EXTEN}@genesys_engage_trunk,30)
 same => n,Hangup()
```

## Advanced Integration

### Option 1: CTI Integration (Screen Pops)

For agent desktop integration with screen pops:

1. **Install CTI Connector:**
   - Genesys CTI Connector connects to T-Server
   - Provides call control and screen pop data
   - Requires separate CTI server

2. **Configure AMI (Asterisk Manager Interface):**
   ```ini
   # asterisk/etc/manager.conf
   [genesys-cti]
   secret=your-secret
   read=all
   write=all
   ```

3. **Use Custom Application:**
   - WebRTC client receives CTI events
   - Displays customer data on incoming calls

### Option 2: Call Recording

Record calls for quality/compliance:

```ini
[from-genesys-engage]
exten => _X.,1,NoOp(Recording enabled)
 same => n,Set(CHANNEL(recordfile)=/var/spool/asterisk/recording/${UNIQUEID})
 same => n,MixMonitor(${CHANNEL(recordfile)}.wav)
 same => n,Dial(PJSIP/${EXTEN},30)
 same => n,Hangup()
```

### Option 3: Agent Status Sync

Sync agent status between Genesys and Asterisk:
- Use Genesys Agent API
- Update queue membership dynamically
- Pause/unpause agents based on Genesys state

## Troubleshooting

### Issue: No connectivity to Genesys SIP Server

**Check:**
```bash
# Test network connectivity
ping GENESYS_SIP_SERVER_IP

# Test SIP port
nc -zv GENESYS_SIP_SERVER_IP 5060

# Enable SIP debugging
docker exec -it webrtc-asterisk asterisk -rx "pjsip set logger on"
```

### Issue: Authentication failures

**Check:**
- Username/password correct in `pjsip.conf`
- Realm matches Genesys configuration
- Check if IP-based auth is required
- Review Genesys SIP Server logs

### Issue: No audio (one-way or both ways)

**Check:**
- RTP ports open on firewall (10000-20000)
- `direct_media=no` in endpoint config
- `rtp_symmetric=yes` enabled
- NAT settings correct

### Issue: Calls disconnect after answer

**Check:**
- SIP timers: Add `timers=no` to endpoint
- Session refreshes: Check Genesys SIP Server settings
- Keep-alive: Ensure `qualify_frequency=60`

### Issue: Wrong caller ID

**Check:**
- `from_user` setting in endpoint
- `send_rpid=yes` and `send_pai=yes` enabled
- Genesys trust settings for caller ID

## Monitoring and Logs

### Asterisk Logs
```bash
docker exec -it webrtc-asterisk tail -f /var/log/asterisk/full
```

### SIP Debugging
```bash
docker exec -it webrtc-asterisk asterisk -rx "pjsip set logger on"
docker logs -f webrtc-asterisk | grep -i genesys
```

### Check Call Quality
```bash
docker exec -it webrtc-asterisk asterisk -rx "rtp show stats"
```

## Best Practices

1. **Use Dedicated VLAN** for voice traffic between Asterisk and Genesys
2. **QoS/DSCP marking** for RTP packets
3. **Monitoring**: Set up alerts for trunk status
4. **Failover**: Configure backup Genesys SIP Server if available
5. **Capacity Planning**: 1 call ≈ 100Kbps bandwidth (G.711)
6. **Regular Testing**: Test failover and call quality periodically

## Quick Reference

| Component | Default | Your Value |
|-----------|---------|------------|
| Genesys SIP Server | - | |
| SIP Port | 5060 | |
| Transport | UDP | |
| Codec | G.711 ulaw | |
| DTMF | RFC2833 | |
| Outbound Access | 9 | |
| Route Points | 5000-5099 | |

## Support Contacts

- **Genesys Admin:** `_______________`
- **Network Team:** `_______________`
- **Asterisk Admin:** `_______________`

---

For Genesys-specific configuration, consult your Genesys documentation or contact Genesys support.




