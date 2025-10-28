# Genesys SIP Endpoint Architecture

## WebRTC Agents with Genesys Workspace Web Edition

This architecture enables agents to use WebRTC endpoints that register directly to Genesys as SIP Endpoints, controlled through Genesys Workspace Web Edition.

---

## 🎯 Architecture Overview

### **Current Architecture (Trunk Model) - What We Built:**

```
WebRTC Client → Asterisk (Dialplan Control) → Genesys (Trunk) → PSTN
```
- Asterisk handles routing and features
- Genesys is just a SIP trunk for external calls
- Limited Genesys features available

### **New Architecture (SIP Endpoint Model) - What You Want:**

```
WebRTC Client → Asterisk (SIP Gateway) → Genesys SIP Server ← Agent DN Registration
                                                ↓
                                    Genesys Workspace Web Edition
                                                ↓
                                    All call control & features
```

---

## 🏗️ Detailed Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  AGENT WORKSTATION (Remote/Cloud/Office)                         │
│                                                                   │
│  ┌────────────────────────────────────────────┐                 │
│  │  Web Browser                                │                 │
│  │                                              │                 │
│  │  ┌────────────────────────────────────┐    │                 │
│  │  │  Genesys Workspace Web Edition     │    │                 │
│  │  │  https://workspace.company.com     │    │                 │
│  │  │                                     │    │                 │
│  │  │  - Agent login                      │    │                 │
│  │  │  - Ready/Not Ready states           │    │                 │
│  │  │  - Call controls                    │    │                 │
│  │  │  - Screen pops                      │    │                 │
│  │  │  - Interactions panel               │    │                 │
│  │  └────────────────────────────────────┘    │                 │
│  │                                              │                 │
│  │  ┌────────────────────────────────────┐    │                 │
│  │  │  WebRTC SIP Client                  │    │                 │
│  │  │  https://webrtc.company.com         │    │                 │
│  │  │                                     │    │                 │
│  │  │  - SIP registration as Agent DN     │    │                 │
│  │  │  - Audio/Video interface            │    │                 │
│  │  │  - No call control logic            │    │                 │
│  │  │  - Just media handling              │    │                 │
│  │  └────────────────────────────────────┘    │                 │
│  └────────────────────────────────────────────┘                 │
│                         │                                         │
│                         │ WSS/HTTPS                               │
└─────────────────────────┼─────────────────────────────────────────┘
                          │
                          │ Internet / Corporate Network
                          │
┌─────────────────────────┼─────────────────────────────────────────┐
│  ASTERISK SERVER (DMZ / Cloud)                                    │
│                         │                                          │
│  ┌──────────────────────▼──────────────────────────┐             │
│  │  Nginx (Reverse Proxy)                          │             │
│  │  - SSL termination                               │             │
│  │  - WebSocket proxy                               │             │
│  └──────────────────────┬──────────────────────────┘             │
│                         │                                          │
│  ┌──────────────────────▼──────────────────────────┐             │
│  │  Asterisk (SIP/WebRTC Gateway ONLY)             │             │
│  │                                                   │             │
│  │  Role: WebRTC ←→ SIP Translation                │             │
│  │                                                   │             │
│  │  ┌─────────────────────────────────────────┐   │             │
│  │  │  WebSocket Transport (WSS)              │   │             │
│  │  │  - Accept WebRTC clients                 │   │             │
│  │  │  - Convert to standard SIP               │   │             │
│  │  └─────────────────────────────────────────┘   │             │
│  │                                                   │             │
│  │  ┌─────────────────────────────────────────┐   │             │
│  │  │  SIP Trunk to Genesys                    │   │             │
│  │  │  - Forward ALL calls to Genesys          │   │             │
│  │  │  - No dialplan logic                     │   │             │
│  │  │  - Just registration proxy               │   │             │
│  │  └─────────────────────────────────────────┘   │             │
│  │                                                   │             │
│  │  ┌─────────────────────────────────────────┐   │             │
│  │  │  RTP/SRTP Engine                         │   │             │
│  │  │  - Media transcoding                     │   │             │
│  │  │  - WebRTC ↔ RTP conversion              │   │             │
│  │  └─────────────────────────────────────────┘   │             │
│  └───────────────────────┬───────────────────────┘             │
│                          │ SIP Trunk                             │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           │ SIP (UDP/TCP/TLS)
                           │
┌──────────────────────────┼───────────────────────────────────────┐
│  GENESYS ENGAGE PLATFORM │                                        │
│                          │                                        │
│  ┌───────────────────────▼────────────────────────┐             │
│  │  Genesys SIP Server                            │             │
│  │                                                 │             │
│  │  - Agent DN Registration (5001, 5002, etc.)    │             │
│  │  - Receives calls from Asterisk                │             │
│  │  - Routes based on Genesys strategy            │             │
│  └───────────────────────┬────────────────────────┘             │
│                          │                                        │
│  ┌───────────────────────▼────────────────────────┐             │
│  │  T-Server                                       │             │
│  │  - Call control & state management              │             │
│  │  - Agent state (Ready, Not Ready, ACW)         │             │
│  │  - Call events to Workspace                    │             │
│  └───────────────────────┬────────────────────────┘             │
│                          │                                        │
│  ┌───────────────────────▼────────────────────────┐             │
│  │  Universal Routing Server (URS)                │             │
│  │  - Intelligent routing                          │             │
│  │  - Skills-based routing                         │             │
│  │  - Queue management                             │             │
│  └───────────────────────┬────────────────────────┘             │
│                          │                                        │
│  ┌───────────────────────▼────────────────────────┐             │
│  │  Configuration Server                           │             │
│  │  - Agent configuration                          │             │
│  │  - DN assignments                               │             │
│  │  - Routing strategies                           │             │
│  └─────────────────────────────────────────────────┘             │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 🔄 How It Works

### 1. Agent Login Process

```
Step 1: Agent opens Genesys Workspace Web Edition
    ↓
    Logs in with credentials
    ↓
    Workspace connects to Configuration Server
    ↓
    Agent assigned DN: 5001

Step 2: Agent opens WebRTC client
    ↓
    Enters DN: 5001
    ↓
    SIP REGISTER to Asterisk (via WSS)
    ↓
    Asterisk forwards REGISTER to Genesys SIP Server
    ↓
    Genesys validates DN 5001
    ↓
    Registration successful
    
Step 3: Agent sets Ready in Workspace
    ↓
    T-Server updates agent state
    ↓
    Agent available for calls
```

### 2. Inbound Call Flow

```
1. Customer calls 1-800-COMPANY
   ↓
2. PSTN → Genesys SIP Server
   ↓
3. T-Server receives call event
   ↓
4. URS applies routing strategy
   ↓
5. Agent 5001 selected (Ready, skilled)
   ↓
6. T-Server sends call to DN 5001
   ↓
7. Genesys SIP Server → Asterisk (SIP INVITE to 5001)
   ↓
8. Asterisk → WebRTC Client (WSS INVITE)
   ↓
9. Browser rings
   ↓
10. Workspace shows screen pop with customer data
    ↓
11. Agent clicks "Answer" in Workspace
    ↓
12. Workspace sends answer command to T-Server
    ↓
13. T-Server connects call
    ↓
14. Media path: PSTN ↔ Genesys ↔ Asterisk ↔ WebRTC Client
```

### 3. Outbound Call Flow (Click-to-Dial)

```
1. Agent searches customer in Workspace
   ↓
2. Clicks phone number
   ↓
3. Workspace sends dial request to T-Server
   ↓
4. T-Server initiates call:
   a) Dials external number via PSTN
   b) Simultaneously calls agent DN 5001
   ↓
5. Genesys SIP Server → Asterisk (INVITE to 5001)
   ↓
6. Asterisk → WebRTC Client
   ↓
7. Agent auto-answers
   ↓
8. Customer answers
   ↓
9. Call connected
```

### 4. Call Transfer

```
1. Agent in call with Customer
   ↓
2. Agent clicks "Transfer" in Workspace
   ↓
3. Enters target: Agent 5002 or Queue
   ↓
4. Workspace sends transfer request to T-Server
   ↓
5. T-Server executes transfer
   ↓
6. Genesys handles all transfer logic
   ↓
7. Original agent released
   ↓
8. New agent/queue receives call
```

---

## 🔑 Key Differences from Trunk Model

| Aspect | Trunk Model (Current) | SIP Endpoint Model (Target) |
|--------|----------------------|----------------------------|
| **Control** | Asterisk dialplan | Genesys platform |
| **Agent State** | Not synced | Fully synced via Workspace |
| **Screen Pops** | Manual integration | Native Genesys feature |
| **Routing** | Asterisk extensions.conf | Genesys URS strategies |
| **Reporting** | Asterisk CDR | Genesys reporting |
| **Transfers** | Asterisk blind/attended | Genesys transfer types |
| **Queues** | Asterisk queues | Genesys queues |
| **Agent Desktop** | Separate tool | Genesys Workspace |
| **Deployment** | On-premise only | Cloud-friendly |
| **Scalability** | Limited | Enterprise-scale |

---

## 🛠️ Configuration Changes Needed

### 1. Asterisk Configuration (Simplified)

**pjsip.conf - Remove dialplan control:**

```ini
;=====================================
; Genesys SIP Endpoint Registration Proxy
;=====================================

[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
cert_file=/etc/certs/cert.pem
priv_key_file=/etc/certs/key.pem

;=====================================
; Genesys SIP Trunk (Registration Proxy)
;=====================================

[genesys_sip_server]
type=endpoint
context=from-genesys
transport=transport-udp
aors=genesys_sip_server
outbound_auth=genesys_auth
disallow=all
allow=ulaw,alaw,opus
direct_media=no
rtp_symmetric=yes

[genesys_sip_server]
type=aor
contact=sip:GENESYS_SIP_SERVER:5060

[genesys_auth]
type=auth
auth_type=userpass
username=asterisk-gateway
password=YOUR_PASSWORD

;=====================================
; Agent DN Template (5001-5999)
;=====================================

[agent_dn](!)
type=endpoint
transport=transport-wss
context=genesys-agent
disallow=all
allow=opus,ulaw,alaw
webrtc=yes
ice_support=yes
use_avpf=yes
media_encryption=dtls
dtls_verify=fingerprint
dtls_cert_file=/etc/certs/cert.pem
dtls_private_key=/etc/certs/key.pem
rtcp_mux=yes
direct_media=no
rtp_symmetric=yes

; Forward ALL to Genesys
outbound_proxy=sip:GENESYS_SIP_SERVER:5060

[agent_dn_auth](!)
type=auth
auth_type=userpass

[agent_dn_aor](!)
type=aor
max_contacts=1
remove_existing=yes

;=====================================
; Individual Agent DNs
;=====================================

[5001](agent_dn)
auth=5001
aors=5001
callerid="Agent 5001" <5001>

[5001](agent_dn_auth)
password=agent5001pass
username=5001

[5001](agent_dn_aor)

[5002](agent_dn)
auth=5002
aors=5002
callerid="Agent 5002" <5002>

[5002](agent_dn_auth)
password=agent5002pass
username=5002

[5002](agent_dn_aor)

; Add more agents as needed...
```

**extensions.conf - Minimal dialplan:**

```ini
;=====================================
; Genesys Agent Context
;=====================================

[genesys-agent]
; All calls go to Genesys for routing
exten => _X.,1,NoOp(Agent DN ${EXTEN} - Forward to Genesys)
 same => n,Dial(PJSIP/${EXTEN}@genesys_sip_server)
 same => n,Hangup()

[from-genesys]
; Incoming from Genesys to agent DN
exten => _X.,1,NoOp(Call from Genesys to DN ${EXTEN})
 same => n,Dial(PJSIP/${EXTEN})
 same => n,Hangup()
```

---

### 2. Genesys Configuration

#### A. Create Agent DNs in Configuration Manager

```
Environment → DNs → Create New

DN: 5001
Type: Extension
Switch: SIP_Server_Switch
Number: 5001
Place: Default_Place
Register: Yes
```

Create DNs for all agents (5001, 5002, 5003, etc.)

#### B. Create SIP Endpoint in Configuration Manager

```
Environment → Switches → Create New

Type: External SIP Switch
Name: Asterisk_SIP_Gateway
Host: <Asterisk_IP>:5060
Protocol: UDP
```

#### C. Associate DNs with Switch

```
For each DN:
  - Switch: Asterisk_SIP_Gateway
  - Endpoint Address: <DN>@<Asterisk_IP>
```

#### D. Configure Agents

```
Environment → Persons → Agent Properties

Login: agent5001
DN: 5001
Place: Agent_Place
Skills: [Customer Service, Sales, etc.]
```

#### E. Configure Routing Strategies

```
Routing → Strategies → Create New

- Queue to skill groups
- Longest waiting caller first
- Agent selection by skills
- Overflow to voicemail
```

---

### 3. WebRTC Client Updates

**Update client to register as Agent DN:**

```javascript
// In app.js
class WebRTCClient {
    constructor() {
        // Agent DN (not internal extension)
        this.agentDN = null;
        this.workspaceConnected = false;
    }

    connect() {
        // Get agent DN from Workspace or user input
        const dn = document.getElementById('agentDN').value; // e.g., "5001"
        const password = document.getElementById('agentPassword').value;
        
        // Register to Asterisk (which forwards to Genesys)
        const configuration = {
            sockets: [new JsSIP.WebSocketInterface(this.sipServer.value)],
            uri: `sip:${dn}@${this.sipDomain}`,
            password: password,
            display_name: `Agent ${dn}`,
            register: true
        };
        
        this.ua = new JsSIP.UA(configuration);
        this.ua.start();
    }
    
    // No dialplan logic needed
    // All call control comes from Workspace
}
```

**Update HTML:**

```html
<div class="form-group">
    <label>Agent DN (from Genesys):</label>
    <input type="text" id="agentDN" placeholder="5001">
</div>

<div class="form-group">
    <label>Agent Password:</label>
    <input type="password" id="agentPassword">
</div>

<div class="form-group">
    <label>Workspace URL:</label>
    <input type="text" id="workspaceURL" 
           value="https://workspace.company.com">
</div>

<button onclick="window.open(document.getElementById('workspaceURL').value)">
    Open Workspace
</button>
```

---

## 🌐 Cloud Deployment Benefits

### Why This Architecture is Cloud-Ready:

1. **Asterisk can be in DMZ or Cloud**
   - Not tied to corporate network
   - Can be AWS, Azure, GCP
   - Or your own cloud infrastructure

2. **Agents can work from anywhere**
   - Home
   - Remote offices
   - Different countries
   - Mobile networks

3. **Only SIP trunk needed to Genesys**
   - Not VPN required for agents
   - Just HTTPS/WSS to Asterisk
   - SIP trunk Asterisk → Genesys

4. **Scalable architecture**
   ```
   Load Balancer
        ↓
   ┌─────────┬─────────┬─────────┐
   Asterisk1 Asterisk2 Asterisk3
   └─────────┴─────────┴─────────┘
        ↓
   Genesys SIP Server
   ```

---

## 📋 Implementation Steps

### Phase 1: Update Asterisk Configuration

```bash
ssh abhishek@192.168.77.131
cd /home/abhishek/WebRTC

# Backup current config
cp asterisk/etc/pjsip.conf asterisk/etc/pjsip.conf.trunk-model

# Update to SIP Endpoint model
nano asterisk/etc/pjsip.conf
# (Use configuration above)

# Restart Asterisk
docker-compose -f docker-compose-simple.yml restart asterisk
```

### Phase 2: Configure Genesys

1. **Create Switch for Asterisk**
2. **Create Agent DNs (5001-5999)**
3. **Associate DNs with Asterisk Switch**
4. **Configure Agents with DNs**
5. **Set up Routing Strategies**

### Phase 3: Update WebRTC Client

```bash
# Update client to use Agent DNs
nano nginx/html/app.js
nano nginx/html/index.html

# Restart Nginx
docker-compose -f docker-compose-simple.yml restart nginx
```

### Phase 4: Test

1. **Agent logs into Workspace**
2. **Agent opens WebRTC client**
3. **Agent registers with DN (5001)**
4. **Agent sets Ready in Workspace**
5. **Make test call to agent**
6. **Verify screen pop in Workspace**

---

## 🎯 Agent Workflow

```
Morning:
1. Agent opens Genesys Workspace Web Edition
2. Logs in with credentials
3. Opens WebRTC client in another tab
4. Enters assigned DN: 5001
5. Registers SIP endpoint
6. Sets "Ready" in Workspace
7. Waits for calls

During Call:
1. Call arrives (rings in WebRTC client)
2. Workspace shows screen pop with customer info
3. Agent answers via Workspace
4. Audio through WebRTC client
5. Uses Workspace for:
   - Transfer
   - Conference
   - Hold
   - Dispositions
   - Notes

End of Day:
1. Sets "Not Ready" in Workspace
2. Completes after-call work
3. Logs out of Workspace
4. Closes WebRTC client
```

---

## 💡 Advantages of SIP Endpoint Model

✅ **Full Genesys Features**
- Skills-based routing
- Real-time adherence
- Quality management
- Workforce management

✅ **Unified Agent Desktop**
- Single pane of glass
- Integrated CTI
- Screen pops
- Customer context

✅ **Enterprise Reporting**
- All data in Genesys
- Standard reports
- Real-time dashboards
- Historical analytics

✅ **Scalability**
- Genesys handles routing
- Asterisk just gateway
- Can scale independently

✅ **Cloud-Friendly**
- Deploy anywhere
- Multi-region support
- Disaster recovery
- Geographic distribution

---

## 📚 Next Steps

1. **Get Genesys Admin Access**
   - Configuration Manager
   - T-Server access
   - SIP Server configuration

2. **Plan DN Range**
   - How many agents?
   - DN numbering scheme
   - Growth planning

3. **Update Configurations**
   - Asterisk (simplified)
   - Genesys (agent DNs)
   - WebRTC client (DN-based)

4. **Test with Pilot Group**
   - 2-3 agents
   - Verify all features
   - Gather feedback

5. **Roll Out**
   - Train agents
   - Migrate gradually
   - Monitor performance

---

**This architecture gives you the best of both worlds: WebRTC flexibility + Genesys power!** 🚀




