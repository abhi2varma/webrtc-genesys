# 🔧 Troubleshooting: DN Goes Out of Service (5001, 5002 vs 1002, 1003)

**Issue:** When using DN 5001 or 5002, the agent can log into WWE via Electron app but the DN goes out of service. DN 1002 and 1003 work correctly.

**Date:** January 22, 2026

---

## 🔍 Root Cause Analysis

Based on the SIP logs (`SIP_P-001.20260116_220242_332.log`), I've identified the critical difference:

### ❌ **Problem with 5001/5002:**

```log
21:06:21.751: Unable to resolve number for DN:5002
21:06:21.751: trunk ip addr 192.168.210.54
21:06:21.751: no gateway is found using address '192.168.210.54' for number '5002'
21:06:21.751: TRNMNGR: internal domain 192.168.210.81
21:06:21.752: SIPTS: handle registration event 2
21:06:21.752: REGISTRAR: TERMINATED:5002
```

### ✅ **Working with 1003:**

```log
18:32:19.740: Unable to resolve number for DN:1003
18:32:19.740: trunk ip addr 192.168.210.81
18:32:19.740: no gateway is found using address '192.168.210.81' for number '1003'
18:32:19.740: TRNMNGR: internal domain 192.168.210.81
18:32:19.740: SIPTS: handle registration event 0
18:32:19.741: $*:SIP:CTI:DN_IN_SERVICE:5
```

### 🔑 **Key Differences:**

| Aspect | DN 5001/5002 (FAILING) | DN 1002/1003 (WORKING) |
|--------|------------------------|------------------------|
| **Trunk IP** | `192.168.210.54` (Asterisk) | `192.168.210.81` (Genesys itself) |
| **Registration Event** | Event 2 (TERMINATED) | Event 0 (NEW/INITIAL) |
| **Result** | `REGISTRAR: TERMINATED` | `DN_IN_SERVICE` |
| **Contact URI** | `sip:5002@192.168.210.54:5060` | `sip:1003@192.168.210.81:5090` |

---

## 🎯 The Problem Explained

### Issue #1: DNs 5001-5020 Are NOT Configured in Genesys CME

From the SIP Server startup log:
```log
21:05:25.572: PRESMGR:STOP: DN="5001" - monitoring not started
21:05:25.572: PRESMGR:STOP: DN="5002" - monitoring not started
```

And during registration attempts:
```log
21:41:08.205: GetRegistration::Unable to resolve number for DN:5008
21:41:08.205: DN 5008 is not configured or disabled in CME. Registration attempt rejected
21:41:08.205: Sending 404 Not Found
```

**This means:** DNs 5001-5020 are defined in your Asterisk `pjsip.conf`, but they are **NOT defined in Genesys Configuration Manager**.

### Issue #2: Registration from Wrong IP Address

When Asterisk tries to register 5001/5002 to Genesys:
- **Contact comes from**: `192.168.210.54` (Asterisk)
- **Genesys expects DNs to register from**: Internal softphones or known gateways
- **Genesys rejects** registrations for unknown DNs from unknown IP addresses

### Issue #3: 1002/1003 Work Because They Use Different Registration Method

Looking at the logs, DN 1003 registers differently:
- **User-Agent**: `Genesys-Softphone/9.0.014.13` (from `192.168.210.81:5090`)
- **Source IP**: `192.168.210.81` (same as Genesys SIP Server)
- This is likely **Genesys Softphone** or another Genesys component on the same server

---

## ✅ Solutions

### Solution 1: Add DNs 5001-5020 to Genesys Configuration (RECOMMENDED)

You need to configure these DNs in **Genesys Configuration Manager (Genesys Administrator)**:

#### Step-by-Step:

1. **Open Genesys Administrator**
   - Navigate to `Provisioning` → `Switching` → `DNs`

2. **Create DN 5001**
   - Click "New"
   - **Switch**: Select your SIP Server (`SIP_P`)
   - **Number**: `5001`
   - **Type**: `Extension`
   - **Switch-Specific Properties**:
     ```
     forward-type = Both
     number-type = Undefined
     reg-mode = dynamic
     ```
   - **Save**

3. **Repeat for DNs 5002-5020**
   - Create each DN (5002, 5003, 5004... 5020)

4. **Associate DNs with Places (if needed for WWE)**
   - Navigate to `Provisioning` → `Environment` → `Places`
   - For each agent workstation, add the DN to the Place's DN list

5. **Apply Configuration**
   - Stop and restart SIP_P service for changes to take effect

#### Alternative: Bulk Import via DB Script

If you have many DNs to create, you can use Genesys Configuration Server database:

```sql
-- Example for Genesys Configuration DB (adjust for your DB type)
-- This is EXAMPLE ONLY - verify against your Genesys version

INSERT INTO cfg_dn (dbid, tenant_dbid, switch_dbid, number, type, state)
VALUES 
  (next_dbid, 101, <sip_server_dbid>, '5001', 5, 1),
  (next_dbid, 101, <sip_server_dbid>, '5002', 5, 1),
  -- ... etc for 5003-5020
```

**⚠️ WARNING**: Direct database manipulation is risky. Use Genesys Administrator GUI or consult Genesys documentation.

---

### Solution 2: Configure Genesys to Accept Registrations from Asterisk IP

Modify your **SIP_P Gateway** configuration in Genesys:

#### In Genesys Administrator:

1. **Navigate to Gateway Configuration**
   - `Provisioning` → `Switching` → `Switches` → `SIP_P`

2. **Add Asterisk as Trusted Gateway**
   - In `Annexes` or `Options` tab
   - Add option:
     ```
     sip.trusted-gateways = 192.168.210.54
     ```

3. **Configure IP-based Authentication**
   - Add to SIP Server options:
     ```
     sip.gateway-auth-mode = IP-based
     sip.gateway-ip-list = 192.168.210.54
     ```

4. **Restart SIP_P Service**

---

### Solution 3: Use IP Trunk Instead of DN Registration (Alternative Approach)

Instead of registering individual DNs from Asterisk to Genesys, configure an **IP trunk** and let Genesys route calls to Asterisk:

#### Current Architecture (Failing):
```
Asterisk registers DN 5001 → Genesys SIP Server (REJECTED)
```

#### Better Architecture (IP Trunk):
```
Asterisk ←→ IP Trunk ←→ Genesys SIP Server
```

#### Configuration:

**In Genesys:**

1. **Create IP Trunk Resource**
   - Navigate to `Provisioning` → `Switching` → `Switches` → `SIP_P` → `DNs`
   - Create new DN: `AsteriskTrunk`
   - **Type**: `Trunk`
   - **Number**: `AsteriskTrunk` or `8000` (arbitrary)

2. **Configure Trunk Options**
   ```
   remote-host = 192.168.210.54
   remote-port = 5060
   trunk-type = IP
   ```

3. **Create Routing Point**
   - Map specific DN ranges to the trunk
   - Example: Route pattern `50XX` → `AsteriskTrunk`

**In Asterisk `pjsip.conf`:**

Already configured! Your existing config has:
```ini
[genesys_sip_server]
type=endpoint
context=from-genesys
transport=transport-udp
aors=genesys_sip_server

[genesys_sip_server]
type=aor
contact=sip:192.168.210.81:5060
```

This allows bidirectional calls without DN registration.

---

### Solution 4: Modify Registration-Monitor to Handle This Scenario

Update your **registration-monitor** to suppress Asterisk's outbound registrations for DNs that aren't configured in Genesys:

#### In `registration-monitor/registration_monitor.py`:

Add a **pre-flight check** before attempting registration:

```python
async def check_dn_exists_in_genesys(self, dn: str) -> bool:
    """Check if DN is configured in Genesys before registering"""
    try:
        # Query Genesys Configuration Server via API or DB
        # Example: Call Genesys Configuration Server REST API
        
        # For now, use a whitelist
        configured_dns = ['1001', '1002', '1003', '1004', '1005']
        return dn in configured_dns
        
    except Exception as e:
        logger.error(f"Failed to check DN {dn} in Genesys: {e}")
        return False

async def register_to_genesys(self, dn: str):
    """Register DN to Genesys SIP Server via AMI"""
    
    # PRE-FLIGHT CHECK
    if not await self.check_dn_exists_in_genesys(dn):
        logger.warning(f"⚠️ DN {dn} not configured in Genesys, skipping registration")
        return
    
    # Existing registration logic...
    registration_name = f"genesys_reg_{dn}"
    
    response = await self.ami_client.send_action({
        'Action': 'PJSIPRegister',
        'Registration': registration_name
    })
    
    logger.info(f"✅ Registered {dn} to Genesys")
```

---

## 🔍 Diagnostic Commands

### Check DN Configuration in Genesys

From Genesys SIP Server logs, grep for DN initialization:

```bash
grep "DN_CHANGED.*5001\|5002\|1002\|1003" SIP_P-*.log
```

### Check Asterisk Registrations

```bash
# SSH to Asterisk server
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show registrations"

# Look for genesys_reg_5001, genesys_reg_5002 status
```

Expected output if working:
```
genesys_reg_5001    sip:192.168.210.81    Registered
genesys_reg_5002    sip:192.168.210.81    Registered
```

### Check Registration Monitor Logs

```bash
sudo docker logs webrtc-registration-monitor | grep -E "5001|5002"
```

Look for registration attempts and any errors.

### Test Manual Registration from Asterisk

```bash
sudo docker exec webrtc-asterisk asterisk -rx "pjsip send register genesys_reg_5001"
```

Check response in Genesys SIP Server logs for 200 OK or 404 Not Found.

---

## 📋 Verification Checklist

After implementing fixes:

- [ ] DNs 5001-5020 exist in Genesys Configuration Manager
- [ ] DNs are associated with correct Switch (SIP_P)
- [ ] DNs have `reg-mode = dynamic` in properties
- [ ] Asterisk can successfully register DNs (check `pjsip show registrations`)
- [ ] Genesys SIP Server logs show `DN_IN_SERVICE` for 5001/5002
- [ ] WWE shows DN as "In Service" in agent desktop
- [ ] Agent can make/receive calls using DN 5001/5002

---

## 🎓 Why 1002/1003 Work

Based on log analysis:

1. **DN 1003 Registration Source**:
   ```
   User-Agent: Genesys-Softphone/9.0.014.13
   Contact: <sip:1003@192.168.210.81:5090>
   From IP: 192.168.210.81 (same as Genesys SIP Server)
   ```

2. **This is likely**:
   - Genesys Softphone running on the same server as SIP_P
   - OR a test endpoint within Genesys infrastructure
   - OR WWE SIP Endpoint using Genesys's internal softphone driver

3. **Why it succeeds**:
   - DNs 1002/1003 ARE configured in Genesys Configuration
   - Registration comes from trusted IP (same server)
   - Uses Genesys-native User-Agent string

4. **Key difference**:
   - **Source**: Internal Genesys component vs. External Asterisk
   - **DNs**: Pre-configured in Genesys vs. Not configured

---

## 🚀 Recommended Action Plan

### Immediate (Do This First):

1. **Verify DN Configuration in Genesys**
   ```bash
   # Check Genesys Configuration DB or Administrator GUI
   # List all DNs on SIP_P switch
   ```

2. **If DNs 5001-5020 are missing → Add them** (Solution 1)
   - Use Genesys Administrator GUI
   - Create DNs 5001, 5002, 5003... 5020
   - Set `reg-mode = dynamic`

3. **Test one DN first (5001)**
   - After creating DN in Genesys, restart SIP_P
   - Try registering from Asterisk
   - Check for `DN_IN_SERVICE` in logs

### Short-term:

4. **Automate DN provisioning** if you need many DNs
   - Use Genesys Configuration API
   - Or bulk import script

5. **Update Registration Monitor** with pre-flight check (Solution 4)
   - Prevent registration attempts for non-existent DNs
   - Reduce log noise

### Long-term:

6. **Consider IP Trunk architecture** (Solution 3)
   - Cleaner design for large-scale deployment
   - Easier to manage than individual DN registrations

---

## 📞 Support Resources

- **Genesys Documentation**: SIP Server Configuration Guide
- **Asterisk PJSIP**: https://wiki.asterisk.org/wiki/display/AST/Configuring+res_pjsip
- **Your Logs**: `d:\Abhi\WebRTC\webrtc-genesys\SIP_P-001.20260116_220242_332.log`

---

**Last Updated:** January 22, 2026  
**Issue:** DN 5001/5002 out of service, 1002/1003 working  
**Status:** Root cause identified, solutions provided
