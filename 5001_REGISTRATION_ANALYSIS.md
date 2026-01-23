# DN 5001 Registration Analysis

## Date: January 22, 2026

## Executive Summary

DN 5001 **successfully registers to Asterisk** via the Electron app but **fails to register to Genesys SIP Server** because the `Asterisk_WebRTC_Gateway` gateway in Genesys is not configured to accept DNs 5001-5020.

## Registration Flow Analysis

### 1. Electron App → Asterisk Registration (SUCCESSFUL ✓)

From `logs.txt` at timestamp `23:30:44`:

```
[Bridge] Sending command: {"command":"sign_in","data":{"agentId":"5001","dn":"5001","password":"Genesys2024!WebRTC","sipServer":"wss://192.168.210.54:8443/ws"}}

REGISTER sip:192.168.210.54 SIP/2.0
From: "5001" <sip:5001@192.168.210.54>
To: <sip:5001@192.168.210.54>
CSeq: 1 REGISTER

Response: SIP/2.0 401 Unauthorized (Digest auth challenge)

REGISTER sip:192.168.210.54 SIP/2.0 (with Authorization header)
CSeq: 2 REGISTER
Authorization: Digest algorithm=MD5, username="5001", ...

Response: SIP/2.0 200 OK
Server: Asterisk-Genesys-Gateway

[Gateway] Sending event to Electron bridge: {event: 'registered', ...}
```

**Result**: DN 5001 successfully registered to Asterisk at `192.168.210.54:8443` (WebSocket) / `192.168.210.54:5060` (SIP).

### 2. Asterisk → Genesys SIP Server Registration (FAILED ✗)

From `SIP_P-001.20260116_220242_332.log`:

```
21:46:45.862: Unable to resolve number for DN:5001
21:46:45.862: trunk ip addr 192.168.210.54
21:46:45.862: no gateway is found using address '192.168.210.54' for number '5001'
21:46:45.862: REGISTRAR: TERMINATED:5001
```

**Result**: Genesys SIP Server **rejects** the registration from Asterisk because:
1. It finds the IP `192.168.210.54` is associated with the `Asterisk_WebRTC_Gateway`
2. BUT the gateway is not configured to handle DN 5001
3. The registration is terminated

### 3. Comparison with DN 1002/1003 (SUCCESSFUL ✓)

From the same SIP log:

```
23:17:20.813: Unable to resolve number for DN:1002
23:17:20.813: trunk ip addr 192.168.210.54
23:17:20.813: gateway 'Asterisk_WebRTC_Gateway' associated with address '192.168.210.54'
23:17:20.813: Assocaited transport for the device [455] changed from [:0:0] to [192.168.210.54:5060:1]
[Registration proceeds successfully]
```

**Result**: DN 1002 is **accepted** because the `Asterisk_WebRTC_Gateway` is configured to allow it.

## WWE Integration Issue

From `logs.txt`, when user `test1` logs into WWE:

```json
{
  "userName": "test1",
  "phoneNumber": "1003",
  "deviceState": "Active"
}

RegisterDN Command:
{
  "addresses": ["192.168.210.81:5060"],
  "users": ["1003"]
}
```

**Key Finding**: WWE is configured to use DN **1003** for user `test1`, NOT DN **5001**.

This explains why:
- When you login with DN 1002/1003, WWE uses those DNs which ARE configured in the Genesys gateway
- When you try to use DN 5001/5002, the Electron app registers them to Asterisk successfully, but:
  1. The `registration-monitor` service tries to forward the registration to Genesys
  2. Genesys rejects it because DNs 5001-5020 are not in the allowed list for `Asterisk_WebRTC_Gateway`
  3. WWE still tries to register its configured DN (1003) which works, but the SIP endpoint shows "Out of Service" because the actual DN (5001) that Asterisk has is not registered to Genesys

## Root Cause

**The `Asterisk_WebRTC_Gateway` in Genesys Configuration Manager is only configured to accept DNs 1002 and 1003, but NOT DNs 5001-5020.**

## Solution

### Option 1: Add DNs 5001-5020 to Asterisk_WebRTC_Gateway (RECOMMENDED)

1. Open **Genesys Administrator** or **Configuration Manager**
2. Navigate to **Switching** → **Gateways**
3. Find and edit `Asterisk_WebRTC_Gateway`
4. Add DNs 5001-5020 to the allowed DN list or pattern
5. Apply and save configuration
6. Restart Genesys SIP Server (or it may pick up the change automatically)

### Option 2: Configure WWE User with DN 5001

If you want user `test1` to use DN 5001:

1. In Genesys Administrator, edit the user `test1`
2. Change the assigned device from DN 1003 to DN 5001
3. Ensure DN 5001 is also added to the gateway as described in Option 1

### Option 3: Map Asterisk DNs to Genesys DNs

If you want Asterisk to use DNs 5001-5020 internally but register them as 1002/1003 to Genesys:

1. Modify the `registration-monitor` service to map DN 5001 → 1002, 5002 → 1003, etc.
2. This is more complex and not recommended unless you have a specific architectural reason

## Verification Steps

After implementing the solution:

1. Check Genesys SIP Server logs for DN 5001 registration:
   ```
   grep "5001" /path/to/SIP_P*.log | grep -i "REGISTRAR\|gateway"
   ```

2. You should see:
   ```
   gateway 'Asterisk_WebRTC_Gateway' associated with address '192.168.210.54'
   REGISTRAR: IN_SERVICE:5001
   ```
   Instead of:
   ```
   no gateway is found using address '192.168.210.54' for number '5001'
   REGISTRAR: TERMINATED:5001
   ```

3. In WWE, the DN should show as "In Service" instead of "Out of Service"

## Additional Notes

- The Electron app and WebRTC gateway are working correctly
- Asterisk is accepting and registering DNs 5001-5020 successfully
- The bottleneck is at the Genesys SIP Server gateway configuration
- The old SIP log (Jan 16) shows the same pattern for all DNs 5001-5020, suggesting they were never configured in the gateway
