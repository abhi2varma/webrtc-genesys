# Setting DN to Ready State on Login in Genesys

## Overview

When agents register their DN (extension) in Genesys, you can configure it to automatically go to "Ready" state so they can receive calls immediately.

---

## Method 1: Configuration Manager (Recommended)

### Step 1: Open Genesys Administrator (GAX)

1. Log in to **Genesys Administrator** (GAX)
2. Navigate to: **Provisioning** → **Environment** → **Switches**

### Step 2: Configure DN Properties

#### Option A: Configure Individual DN

1. Find your **SIP Server** switch
2. Click on **DNs** tab
3. Find DN **1002** (or 1003)
4. Click **Edit**
5. Go to **Annex** tab
6. Add these options:

```ini
[TServer]
auto-ready-on-register=true
auto-answer=true

[register-dn]
register=true
```

7. Click **Save**
8. Repeat for other DNs (1003, etc.)

#### Option B: Configure at Switch Level (All DNs)

1. Click on your **SIP Server** switch
2. Go to **Options** or **Annex** tab
3. Add section `[agent]`:

```ini
[agent]
auto-ready-on-register=true
auto-login=true
auto-ready=true
```

4. Click **Save**

### Step 3: Apply Configuration

1. **Restart T-Server** to apply changes:
   ```bash
   # On Genesys server
   systemctl restart t-server
   # Or from GAX: Right-click T-Server → Stop → Start
   ```

2. **Test**: Register DN 1002 - it should automatically go to Ready state

---

## Method 2: Agent Desktop Configuration

If using **Genesys Workspace Desktop Edition (WDE)** or **Workspace Web Edition (WWE)**:

### In Workspace Configuration:

1. Navigate to: **Provisioning** → **Environment** → **Applications**
2. Find your **Workspace** application
3. Go to **Options** or **Annex** tab
4. Add:

```ini
[agent-desktop]
auto-ready-on-login=true
auto-login-dn=true

[interaction.voice]
auto-ready=true
```

5. Save and restart Workspace

---

## Method 3: Business Attributes (Person Level)

For individual agent configuration:

### Step 1: Configure Person

1. Go to: **Provisioning** → **Accounts** → **Persons**
2. Find the agent
3. Go to **Annex** tab
4. Add:

```ini
[voice]
auto-ready=true
auto-answer=true
```

### Step 2: Agent Group Configuration

1. Go to: **Provisioning** → **Accounts** → **Agent Groups**
2. Select your agent group
3. Go to **Annex** tab
4. Add:

```ini
[group-settings]
auto-ready-on-login=true
auto-answer=true
```

---

## Method 4: T-Server Configuration File

For advanced configuration, edit T-Server config directly:

### Edit `tserver.cfg`:

```ini
[tserver]
auto-ready-on-register = true

[dn-register]
auto-ready = true
auto-answer = true

[agent-login]
default-state = Ready
auto-ready-timeout = 0
```

**Restart T-Server** after changes.

---

## Method 5: Via Workspace API (Programmatic)

If you want your WebRTC gateway to set DN to Ready programmatically:

### Add to Your Gateway Code:

```javascript
async function setDnReady(dn) {
    const workspaceApi = 'https://your-workspace-server:8080/api/v2';
    
    try {
        // Set DN to Ready
        const response = await fetch(`${workspaceApi}/voice/dn/${dn}/ready`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_TOKEN'
            },
            body: JSON.stringify({
                reasonCode: null
            })
        });
        
        if (response.ok) {
            console.log(`DN ${dn} set to Ready`);
        }
    } catch (error) {
        console.error('Failed to set DN Ready:', error);
    }
}

// Call after registration
ua.on('registered', () => {
    setDnReady('1002');
});
```

---

## Method 6: Stat Server Configuration

For reporting and state management:

1. Go to: **Provisioning** → **Environment** → **Stat Servers**
2. Select your Stat Server
3. Go to **Options** tab
4. Add:

```ini
[dn-actions]
auto-ready-on-register = true
default-dn-state = Ready
```

---

## Verification Steps

### After Configuration:

1. **Test DN Registration:**
   ```
   Open: https://103.167.180.166:8443/wwe-webrtc-gateway.html?dn=1002
   ```

2. **Check in Genesys:**
   - Open **Contact Center Pulse** or **GAX**
   - Go to **Real-Time Reports** → **Agent Status**
   - Should show DN 1002 as **Ready**

3. **Check T-Server Logs:**
   ```bash
   tail -f /path/to/tserver/logs/tserver.log | grep "DN 1002"
   ```
   
   Look for:
   ```
   DN 1002 registered
   DN 1002 state changed to Ready
   ```

---

## Troubleshooting

### DN Not Going to Ready

**Check 1: T-Server Configuration**
```bash
# Verify T-Server sees the DN
grep "1002" /path/to/tserver/logs/tserver.log

# Check DN configuration
```

**Check 2: Switch Configuration**
- Ensure DN is configured in GAX
- Verify switch is connected to T-Server
- Check DN has proper device type (Extension)

**Check 3: Agent Login**
- Agent must be logged in (if agent-login model)
- Check Place configuration
- Verify agent has permission for DN

### DN Goes to Not Ready Immediately

**Possible causes:**
- No agent logged in
- Agent group requires manual Ready
- Business rules forcing Not Ready
- Skill configuration issues

**Fix:**
Add to DN Annex:
```ini
[TServer]
force-ready-on-register=true
disable-not-ready-on-login=true
```

---

## Best Practice Configuration

For WebRTC + Genesys setup, use this configuration:

### 1. SIP Server Switch Annex:
```ini
[agent]
auto-ready-on-register=true
auto-login=true

[dn-defaults]
default-state=Ready
auto-answer=true
```

### 2. Each DN Annex (1002, 1003):
```ini
[TServer]
auto-ready-on-register=true
auto-answer=true

[register-dn]
register=true
enabled=true
```

### 3. T-Server Options:
```ini
[tserver]
auto-ready-on-register=true
agent-login-timeout=0
```

### 4. Workspace Application Annex:
```ini
[interaction.voice]
auto-ready=true
auto-answer=true
```

---

## Quick Configuration Checklist

- [ ] DN configured in GAX under SIP Server switch
- [ ] DN Annex has `auto-ready-on-register=true`
- [ ] Switch Annex has agent auto-ready settings
- [ ] T-Server restarted after configuration
- [ ] Agent has permission to use DN
- [ ] Place configured for DN (if using Places)
- [ ] Tested: DN registers → goes to Ready automatically

---

## For Your Current Setup

Since you're using WebRTC without WWE initially, the **simplest approach**:

1. **In GAX**, find your SIP Server switch
2. Go to **DNs** → Select **1002**
3. **Annex** tab, add:
   ```ini
   [TServer]
   auto-ready-on-register=true
   ```
4. **Save** and **Restart T-Server**

This will make DN 1002 automatically go to Ready when it registers via WebRTC!

---

## Need Help?

If you don't have access to GAX or need help with configuration:
1. Contact your Genesys administrator
2. Or provide me with:
   - Your Genesys version (9.x or GCloud?)
   - Access to GAX? (Yes/No)
   - Can restart T-Server? (Yes/No)

And I'll provide specific steps for your situation.
