# 🔧 Troubleshooting: DN Goes Out of Service (5001, 5002 vs 1002, 1003)

**Issue:** When using DN 5001 or 5002 via Electron app, the agent can log into WWE but the DN goes out of service. DN 1002 and 1003 work correctly.

**Date:** January 22, 2026  
**Updated:** After confirmation that both use Electron app

---

## 🔍 Root Cause Analysis - UPDATED

The issue is **NOT about DN configuration** in Genesys. Both 1003 and 5002 show "Unable to resolve number" but have **completely different outcomes**:

### ❌ **DN 5002 (FAILING):**

```log
Registration from: 192.168.210.54:5060 (Asterisk server)
User-Agent: Asterisk-Genesys-Gateway

21:06:21.751: Unable to resolve number for DN:5002
21:06:21.751: trunk ip addr 192.168.210.54
21:06:21.751: no gateway is found using address '192.168.210.54' for number '5002'
21:06:21.752: SIPTS: handle registration event 2
21:06:21.752: REGISTRAR: TERMINATED:5002  ❌
```

### ✅ **DN 1003 (WORKING):**

```log
Registration from: 192.168.210.81:5090 (Genesys server IP)
User-Agent: Genesys-Softphone/9.0.014.13

18:32:19.740: Unable to resolve number for DN:1003
18:32:19.740: trunk ip addr 192.168.210.81
18:32:19.740: no gateway is found using address '192.168.210.81' for number '1003'
18:32:19.740: SIPTS: handle registration event 0
18:32:19.741: $*:SIP:CTI:DN_IN_SERVICE:5  ✅
```

### 🎯 **The Real Problem:**

**Genesys SIP Server trusts registrations from `192.168.210.81` (its own server) but REJECTS registrations from `192.168.210.54` (Asterisk server).**

Both say "no gateway is found" but:
- **192.168.210.81** → Treated as internal/trusted → Registration succeeds
- **192.168.210.54** → Treated as unknown gateway → Registration TERMINATED

---

## 📊 Architecture Difference

### When 1002/1003 Works:

```
┌─────────────┐                                    ┌──────────────┐
│ Electron App│ → localhost:8000                   │   Genesys    │
│ (on .81)    │ → WebRTC client                    │  SIP Server  │
└─────────────┘ → ??? (direct connection?)         │  (.81:5060)  │
                                                    └──────────────┘
       REGISTER comes from 192.168.210.81:5090          ↓
       User-Agent: Genesys-Softphone              ✅ ACCEPTED
                                                   (Same IP = trusted)
```

### When 5001/5002 Fails:

```
┌─────────────┐    WebRTC/WSS    ┌──────────┐    REGISTER    ┌──────────────┐
│ Electron App│ → Nginx/Kamailio │ Asterisk │──────────────→│   Genesys    │
│ (on ???)    │                   │ (.54)    │               │  SIP Server  │
└─────────────┘                   └──────────┘               │  (.81:5060)  │
                                       ↓                      └──────────────┘
                              registration-monitor                   ↓
                              triggers Asterisk to            ❌ REJECTED
                              REGISTER to Genesys         (Unknown gateway)
```

---

## 🔑 Key Questions to Answer:

### **Question 1:** Where is the Electron app running for 1002/1003?

Based on the logs showing `192.168.210.81:5090` as source:
- **Option A**: Electron app is running ON the Genesys server (192.168.210.81)
- **Option B**: There's a direct SIP connection from Electron app to Genesys (bypassing Asterisk)

### **Question 2:** What's listening on 192.168.210.81:5090?

The registration for 1003 comes from:
- IP: `192.168.210.81` (Genesys SIP Server's IP)
- Port: `5090` (not the standard SIP port 5060)
- User-Agent: `Genesys-Softphone/9.0.014.13`

This could be:
1. **Genesys SIP Endpoint** service running on port 5090
2. **Your Electron app** with a SIP UA that uses Genesys UA string
3. **WWE SIP Endpoint component** that registers directly to SIP Server

---

## ✅ Solutions

### Solution 1: Add Asterisk as Trusted Gateway in Genesys (RECOMMENDED)

Configure Genesys SIP Server to trust registrations from Asterisk server.

#### In Genesys Configuration Manager:

1. **Open Genesys Administrator**

2. **Navigate to Switch Configuration**:
   - `Provisioning` → `Switching` → `Switches` → `SIP_P`

3. **Add to Options/Annexes**:
   ```
   [sip]
   trusted-gateways = 192.168.210.54
   gateway-ip-auth-mode = enabled
   ```

4. **OR Create Gateway Object**:
   - `Provisioning` → `Switching` → `Gateways`
   - Create new Gateway:
     - **Name**: `AsteriskGateway`
     - **Type**: `SIP Gateway`
     - **IP Address**: `192.168.210.54`
     - **Port**: `5060`
   
5. **Associate Gateway with Switch**:
   - In `SIP_P` switch configuration
   - Add `AsteriskGateway` to the list of gateways

6. **Restart SIP_P Service**:
   ```bash
   # On Genesys server
   net stop TSrvSIP64
   net start TSrvSIP64
   ```

#### Verify:

After restart, check logs for:
```log
Gateway registered: AsteriskGateway (192.168.210.54:5060)
```

Try registering 5001/5002 again and look for:
```log
REGISTRAR: ACTIVE:5001  ✅
```

---

### Solution 2: Make Electron App Use Same Path as 1002/1003

Since 1002/1003 work, replicate their configuration for 5001/5002.

#### Option A: Run Electron App on Genesys Server

If 1002/1003's Electron app is running on `192.168.210.81`:

1. **Install Electron app on Genesys server** (192.168.210.81)
2. **Use the same port/configuration** as 1002/1003
3. **Electron app registers directly** to local SIP Server (localhost:5060)

#### Option B: Configure Electron App to Use Genesys SIP Endpoint

If there's a Genesys SIP Endpoint component on port 5090:

1. **Configure Electron app** to connect to that endpoint instead of Asterisk
2. **Update bridge configuration**:
   ```javascript
   // In webrtc-gateway-bridge config
   config.gateway.sipServer = 'sip:192.168.210.81:5090'
   ```

---

### Solution 3: Use IP Trunk (No DN Registration)

Configure Genesys to route calls to/from Asterisk via IP trunk, avoiding per-DN registration.

#### In Genesys:

1. **Create Trunk Resource**:
   - Navigate to `Provisioning` → `Switching` → `DNs`
   - Create DN: `AsteriskTrunk`
   - Type: `Trunk`
   - Options:
     ```
     remote-host = 192.168.210.54
     remote-port = 5060
     trunk-type = IP
     codec-list = PCMU,PCMA
     ```

2. **Create Routing Rules**:
   - Route pattern `50XX` → `AsteriskTrunk`
   - Route pattern `500X` → `AsteriskTrunk`

3. **Configure Reverse Routing**:
   - In Asterisk `extensions.conf`:
     ```ini
     [from-genesys]
     exten => _5XXX,1,NoOp(Call from Genesys to ${EXTEN})
     exten => _5XXX,n,Dial(PJSIP/${EXTEN})
     ```

#### Benefits:
- No per-DN registration needed
- Genesys doesn't care about Asterisk's IP
- Cleaner architecture for many DNs

---

### Solution 4: Investigate 1002/1003 Configuration

**Find out exactly how 1002/1003 are working:**

#### Check Electron App Configuration:

```powershell
# On the machine running Electron app for 1002/1003
Get-Process | Where-Object {$_.Name -like "*electron*" -or $_.Name -like "*webrtc*"}

# Check what port it's listening on
netstat -ano | findstr "5090"
```

#### Check Genesys Server:

```bash
# On Genesys server (192.168.210.81)
netstat -ano | findstr "5090"
# See what process is listening on port 5090
```

#### Compare Electron App Configurations:

1. **For working 1002/1003**:
   - What's the gateway URL in config?
   - What's the SIP server URL?
   - Check logs: `%APPDATA%/WebRTC-Gateway-Bridge/bridge.log`

2. **For failing 5001/5002**:
   - Same questions
   - Compare the differences

---

## 🔍 Diagnostic Steps

### Step 1: Determine Where 1002/1003 Electron App Is Running

```powershell
# Check if Electron app is running on Genesys server
# RDP/SSH to 192.168.210.81
Get-Process -Name "*electron*" -ErrorAction SilentlyContinue
```

### Step 2: Check What's on Port 5090

```bash
# On Genesys server (192.168.210.81)
netstat -ano | findstr ":5090"

# Check if it's Genesys SIP Endpoint or your app
```

### Step 3: Capture SIP Traffic

```bash
# On Genesys server
# Use Wireshark or tcpdump to see the difference

# For 1003 (working):
tcpdump -i any -n port 5090 -w 1003_working.pcap

# For 5002 (failing):
tcpdump -i any -n port 5060 and host 192.168.210.54 -w 5002_failing.pcap
```

Compare the SIP REGISTER messages:
- Contact header
- Via header
- User-Agent
- Authentication headers

### Step 4: Check Genesys Gateway Configuration

```bash
# Check current gateway configuration in Genesys
# Via Genesys Administrator GUI or database query

# Look for any gateway with IP 192.168.210.54
# Look for gateway with IP 192.168.210.81
```

---

## 📋 Information Needed

To provide more precise solution, please provide:

1. **Where is the Electron app running for 1002/1003?**
   - On Genesys server (192.168.210.81)?
   - On agent workstation?
   - Other location?

2. **What's listening on 192.168.210.81:5090?**
   ```powershell
   # Run this on 192.168.210.81
   Get-NetTCPConnection -LocalPort 5090 | 
     Select LocalAddress, LocalPort, State, OwningProcess | 
     ForEach-Object { 
       $_ | Add-Member -NotePropertyName ProcessName -NotePropertyValue (Get-Process -Id $_.OwningProcess).Name -PassThru 
     }
   ```

3. **Electron app configuration for 1002/1003**:
   ```javascript
   // Check config file or environment variables
   // What's the SIP server URL configured?
   ```

4. **Are there any Genesys gateways configured?**
   - Check in Genesys Administrator
   - Look for gateway objects associated with SIP_P

---

## 🎯 Most Likely Scenario

Based on the evidence:

### Hypothesis A: Electron App on Genesys Server
- **1002/1003**: Electron app runs on `192.168.210.81`, registers locally to SIP Server
- **5001/5002**: Electron app runs elsewhere, registers via Asterisk path
- **Solution**: Add Asterisk as trusted gateway (Solution 1)

### Hypothesis B: Direct SIP Endpoint
- **1002/1003**: Uses Genesys SIP Endpoint service (port 5090) that's trusted
- **5001/5002**: Uses Asterisk path which is not trusted
- **Solution**: Either use same SIP Endpoint or add Asterisk as trusted

### Hypothesis C: Different Architecture
- **1002/1003**: Uses different WebRTC/SIP stack that registers directly
- **5001/5002**: Uses your custom Asterisk-based stack
- **Solution**: Make both use same architecture

---

## 🚀 Recommended Action Plan

### Immediate:

1. **Answer the diagnostic questions** above
   - Where is Electron app running for 1002/1003?
   - What's on port 5090?

2. **Add Asterisk as trusted gateway** (Solution 1)
   - This should fix the issue regardless

3. **Test with one DN** (e.g., 5001)
   - After adding gateway config
   - Monitor SIP logs for success

### Short-term:

4. **Standardize the architecture**
   - All DNs should use same path
   - Either all via Asterisk OR all direct

5. **Document working configuration**
   - For future DN additions

---

## 📊 Expected Log After Fix

After adding Asterisk as trusted gateway, you should see:

```log
21:06:21.751: trunk ip addr 192.168.210.54
21:06:21.751: Gateway found: AsteriskGateway (192.168.210.54)
21:06:21.752: SIPTS: handle registration event 0
21:06:21.752: $*:SIP:CTI:DN_IN_SERVICE:5  ✅
21:06:21.752: REGISTRAR: ACTIVE:5002  ✅
```

Instead of:
```log
21:06:21.751: no gateway is found using address '192.168.210.54' for number '5002'
21:06:21.752: REGISTRAR: TERMINATED:5002  ❌
```

---

**Last Updated:** January 22, 2026  
**Issue:** Asterisk IP not trusted by Genesys SIP Server  
**Primary Solution:** Add Asterisk (192.168.210.54) as trusted gateway in Genesys
