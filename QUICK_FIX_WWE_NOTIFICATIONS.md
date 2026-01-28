# Quick Fix: WWE Not Receiving Call Notifications

## Issue
Calls ring at WebRTC client, but WWE doesn't show notifications.

## Root Cause (Confirmed via grep)
```bash
# Agent Place Config
"login.SIP_Switch.voice.1.dn-agent-login": "3075"

# Actual DN being registered
RegisterDn/ → "users":["1002"]

# T-Server logs show
ProcessRegister: No GSIPCTI subscription found for [1002]
ProcessRegister: No GSIPCTI subscription found for [1003]

# No references to DN 3075 in T-Server logs (not registered, not subscribed)
```

**WWE is subscribed to DN 3075, but the WebRTC client is using DN 1002.**

## Fix (5 minutes)

### Step 1: Update Genesys Configuration
Open **Genesys Administrator** or **Genesys Configuration Manager**:

1. Navigate to: **Environment → Resources → Agents → abhishek.varma**
2. Click the **Annex** tab
3. Find the section: `SIP_Switch.voice.1`
4. Locate: `dn-agent-login` 
5. Change value from: `3075` → `1002`
   - OR leave it **blank** (WWE will auto-use device DN)
6. Click **Save**

### Step 2: Restart T-Server (if required)
Some Genesys versions cache agent configurations:
```bash
# Check if T-Server restart is needed
# Most configurations take effect on next agent login
```

### Step 3: Agent Re-login
1. Agent logs out of WWE
2. Agent logs back in to WWE
3. WWE will now subscribe to DN 1002

### Step 4: Test
1. Make a test call to DN 1002 from DN 1003
2. WWE should now display the incoming call notification
3. Agent can answer the call from WWE interface

## Verification Commands

### Check T-Server logs for subscription
```bash
grep "ProcessRegister.*1002" SIP_P-001.*.log
# Should NOT see "No GSIPCTI subscription found" after fix
```

### Check WWE logs for RegisterDN
```bash
grep "RegisterDn.*users" logs.txt
# Should show: "users":["1002"]
```

### Check agent place config
```bash
grep "dn-agent-login" logs.txt
# Should show: "value": "1002" (or empty)
```

## Expected Result
✅ T-Server will show: `ProcessRegister: Subscription found for [1002]`  
✅ WWE will receive `DN_IN_SERVICE` events for DN 1002  
✅ WWE will display incoming call notifications  
✅ Agent can answer calls from WWE interface  

## Technical Notes
- This is a **pure Genesys configuration issue**
- All infrastructure components are working correctly:
  - ✅ WebRTC client registration
  - ✅ Asterisk → Genesys registration forwarding
  - ✅ T-Server DN registration processing
  - ✅ T-Server DN_IN_SERVICE event firing
- Only the WWE subscription target DN needs correction

## Alternative: Change Device DN to 3075
If you prefer to keep the place config at 3075:
1. Update device phone number: `1002` → `3075` in Genesys Config
2. Update `asterisk/etc/pjsip.conf`: All `[1002]` sections → `[3075]`
3. Update `registration-monitor`: DN range to include 3075
4. Restart Asterisk and registration-monitor

**This is more complex and not recommended.**
