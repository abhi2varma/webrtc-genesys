# Issue Analysis: WWE Not Receiving Call Notifications

## Problem Statement
Calls are successfully landing at the WebRTC client (phone rings), but WWE does not display incoming call notifications or allow the agent to answer the call.

## Root Cause
The agent's **Place configuration** in Genesys Configuration Server has a **DN mismatch**:
- The agent's **device** is configured with phone number: `1002`
- The agent's **place** has `dn-agent-login` set to: `3075`

When WWE logs in, it subscribes to CTI events for the DN specified in the **place** configuration (`3075`), not the device configuration (`1002`).

## Evidence from Logs

### 1. Agent Place Configuration (from WWE logs)
```json
{
  "name": "login.SIP_Switch.voice.1.dn-agent-login",
  "value": "3075"
}
```

### 2. Device Configuration (from WWE logs)
```json
{
  "phoneNumber": "1002",
  "deviceUri": "/devices/27379f71-0f5a-42a1-b899-ea4456c6b337"
}
```

### 3. WWE RegisterDN Call
```
$.ajax({
  "url":"https://127.0.0.1:8000/RegisterDn/",
  "data": "{\"addresses\":[\"192.168.210.81:5060\"],\"users\":[\"1002\"]}"
})
```
**Result:** WebRTC client successfully registers DN 1002 to Asterisk.

### 4. T-Server Registration Processing (from SIP logs)
```
18:32:19.740: SIPTS: handle registration event 0
18:32:19.740: ProcessRegister: No GSIPCTI subscription found for [1003]
18:32:19.741: $*:SIP:CTI:DN_IN_SERVICE:5
18:32:19.741: $+CTI:PRM:ON_DN_IN_SERVICE:191:60
```
**Interpretation:**
- `handle registration event 0` = DN registration (not trunk)
- `DN_IN_SERVICE` event is fired correctly
- `No GSIPCTI subscription found for [1003]` = WWE is not subscribed to events for this DN

## Call Flow

```
Incoming Call to 1002
    ↓
Genesys T-Server
    ↓
Asterisk (via SIP)
    ↓
WebRTC Client (phone rings) ✓
    ↓
T-Server fires DN_IN_SERVICE event for DN 1002
    ↓
WWE is subscribed to DN 3075 (from place config) ✗
    ↓
WWE does not receive notification ✗
```

## Solution

### Option 1: Update Place Configuration (Recommended)
In **Genesys Configuration Server**, navigate to:
```
Environment → Resources → Agents → [Agent Name] → Annex Tab
```

**Find and update:**
```
login.SIP_Switch.voice.1.dn-agent-login = 1002
```
OR
```
login.SIP_Switch.voice.1.dn-agent-login = (blank/empty)
```
Setting it to blank will make WWE use the device DN automatically.

### Option 2: Update Device Configuration
Alternatively, update the **device** phone number to `3075` to match the place configuration. However, this would require:
1. Updating the device in Genesys Configuration Server
2. Updating Asterisk `pjsip.conf` to use DN 3075
3. Re-registering the WebRTC client with DN 3075

**Option 1 is much simpler and less disruptive.**

## Verification Steps

After updating the place configuration:

1. **Restart T-Server** (may be required for config changes to take effect)

2. **Agent Logs Out and Logs Back In to WWE**

3. **Check T-Server Logs** for successful subscription:
   ```
   SIPTS: handle registration event 0
   $+CTI:PRM:ON_DN_IN_SERVICE
   ProcessRegister: Subscription found for [1002]  ← Should NOT see "No GSIPCTI subscription"
   ```

4. **Make a Test Call** to DN 1002 from another DN (e.g., 1003)

5. **Verify WWE Displays the Call Notification**

## Additional Notes

- This issue is **not** related to Asterisk, WebRTC client, or the Electron bridge configuration
- The technical infrastructure is working correctly:
  - WebRTC client registers successfully
  - Asterisk forwards registration to Genesys correctly
  - T-Server processes DN registration correctly
  - Calls reach the WebRTC client successfully
- The issue is purely a **Genesys Configuration mismatch** between place DN and device DN

## Related Documentation
- `GENESYS_CONFIG_FIX_FOR_DN_REGISTRATION.md` - T-Server configuration for DN registrations
- `OPTION2_SEPARATE_PORT_SETUP.md` - Alternative port-based configuration
- `TESTING_DYNAMIC_REGISTRATION.md` - Dynamic registration testing guide
