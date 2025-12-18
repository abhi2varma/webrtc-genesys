# Kamailio Dialog Module - Live SIP Call Monitoring

## Overview

The **dialog module** in Kamailio tracks active SIP dialogs (calls) in real-time, providing visibility into live calls, statistics, and call details.

---

## ✅ What's Enabled

### 1. Dialog Tracking
- Automatically tracks all INVITE-based calls
- Stores dialog state, duration, and endpoints
- Profiles by caller for statistics

### 2. Features
- **Live call list** - See all active calls
- **Call statistics** - Count, duration, endpoints
- **Dialog timeout** - 6 hours (configurable)
- **CSeq tracking** - Track message sequence numbers
- **Caller profiles** - Group calls by caller

---

## 🔧 Configuration Added

### In `kamailio-proxy.cfg`:

```kamailio
# Load module
loadmodule "dialog.so"

# Parameters
modparam("dialog", "dlg_flag", 4)
modparam("dialog", "timeout_avp", "$avp(dlg_timeout)")
modparam("dialog", "default_timeout", 21600)  # 6 hours
modparam("dialog", "dlg_extra_hdrs", "X-Kamailio-Dialog: yes\r\n")
modparam("dialog", "track_cseq_updates", 1)
modparam("dialog", "profiles_with_value", "caller")

# In routing logic for INVITE:
if (is_method("INVITE")) {
    setflag(4);  # dialog flag
    dlg_manage();
    set_dlg_profile("caller", "$fu");
}
```

---

## 📊 How to View Live Calls

### Method 1: kamcmd (Command Line)

```bash
# SSH to server
ssh Gencct@192.168.210.54

# Enter Kamailio container
sudo docker exec -it webrtc-kamailio bash

# List all active dialogs
kamcmd dlg.list

# Get dialog statistics
kamcmd dlg.stats

# Get profile statistics
kamcmd dlg.profile_get_size caller

# Get dialogs by caller
kamcmd dlg.profile_list caller
```

### Method 2: JSON-RPC API

Add to nginx configuration to expose Kamailio RPC:

```bash
# Query active dialogs via HTTP
curl -X POST http://192.168.210.54:5060/RPC \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"dlg.list","id":1}'
```

### Method 3: Kamailio Logs

Watch live call events in logs:

```bash
# Follow Kamailio logs
sudo docker logs -f webrtc-kamailio | grep -i dialog
```

---

## 📋 Dialog Information Available

### For Each Active Call:

```
Dialog ID:          Unique identifier
Call-ID:            SIP Call-ID
From URI:           sip:5001@192.168.210.54
To URI:             sip:1003@192.168.210.54
State:              4 (confirmed)
Start Time:         2025-12-18 14:00:35
Duration:           120 seconds
Caller Contact:     <sip:5001@10.81.64.6:61264;transport=ws>
Callee Contact:     <sip:1003@192.168.210.54:5060>
Route Set:          Record-Route headers
CSeq:               Current sequence number
```

---

## 🎯 Example Output

### kamcmd dlg.list

```json
{
  "dialog": [
    {
      "hash": "1234",
      "h_entry": "5678",
      "h_id": "9012",
      "callid": "call-1734522035-abc123",
      "from_uri": "sip:5001@192.168.210.54",
      "to_uri": "sip:1003@192.168.210.54",
      "caller_contact": "<sip:5001@10.81.64.6:61264;transport=ws>",
      "callee_contact": "<sip:1003@192.168.210.54:5060>",
      "state": "4",
      "start_time": "1734522035",
      "duration": "120",
      "timeout": "21600",
      "profiles": "caller=sip:5001@192.168.210.54"
    }
  ]
}
```

### kamcmd dlg.stats

```
{
  "processed": 42,      # Total dialogs processed since start
  "failed": 3,          # Failed dialog creations
  "active": 2,          # Currently active dialogs
  "early": 0,           # Early dialogs (ringing)
  "expired": 5          # Expired dialogs
}
```

---

## 🔍 Real-Time Monitoring Examples

### 1. Watch Call Setup

```bash
# Terminal 1: Watch Kamailio logs
sudo docker logs -f webrtc-kamailio

# Terminal 2: Make a call from browser
# You'll see:
# - INVITE received
# - Dialog created (dlg_manage)
# - Dialog added to profile
# - 200 OK forwarded
# - ACK received
# - Dialog confirmed
```

### 2. Check Active Calls Count

```bash
# Quick check
sudo docker exec webrtc-kamailio kamcmd dlg.stats_active

# Output: 2 (two active calls)
```

### 3. List All Callers

```bash
# Get all unique callers
sudo docker exec webrtc-kamailio kamcmd dlg.profile_get_values caller

# Output:
# sip:5001@192.168.210.54
# sip:5002@192.168.210.54
```

### 4. Get Calls for Specific DN

```bash
# List dialogs where DN 5001 is caller
sudo docker exec webrtc-kamailio kamcmd dlg.profile_list caller "sip:5001@192.168.210.54"
```

---

## 🚀 Deploy Dialog Module

### Quick Deployment:

```bash
# 1. Pull latest config
cd /opt/gcti_apps/webrtc-genesys
sudo git pull origin main

# 2. Update Kamailio config
sudo docker cp kamailio/kamailio-proxy.cfg webrtc-kamailio:/etc/kamailio/kamailio.cfg

# 3. Restart Kamailio
sudo docker restart webrtc-kamailio

# 4. Wait for startup
sleep 5

# 5. Verify dialog module loaded
sudo docker logs webrtc-kamailio 2>&1 | grep -i "dialog"

# Should see: "module dialog.so loaded"
```

---

## 📈 Use Cases

### 1. Live Dashboard

Create a dashboard that shows:
- Active calls count
- Average call duration
- Calls by DN
- Call history

**Implementation:**
```bash
# Cron job every 10 seconds
*/10 * * * * kamcmd dlg.stats_active > /var/www/html/active_calls.txt
```

### 2. Call Detail Records (CDR)

Export dialog data for billing/reporting:

```kamailio
# In routing logic
route[RELAY] {
    if (is_method("BYE")) {
        # Log dialog details before ending
        xlog("L_INFO", "CALL_END: from=$fu to=$tu duration=$DLG_lifetime\n");
    }
    t_relay();
}
```

### 3. Concurrent Call Limits

Prevent DN from making multiple calls:

```kamailio
if (is_method("INVITE")) {
    get_profile_size("caller", "$fu", "$var(count)");
    if ($var(count) > 1) {
        sl_send_reply("486", "Busy - Maximum calls reached");
        exit;
    }
    dlg_manage();
}
```

### 4. Call Timeout Enforcement

Force call disconnect after 2 hours:

```kamailio
if (is_method("INVITE")) {
    $avp(dlg_timeout) = 7200;  # 2 hours
    dlg_manage();
}
```

---

## 🛠️ Advanced Dialog Commands

### Terminate a Dialog

```bash
# End specific call by dialog hash
kamcmd dlg.end_dlg 1234 5678
```

### Dialog Variables

Set custom variables on dialog:

```kamailio
$dlg_var(customer_id) = "CUST123";
$dlg_var(queue) = "sales";

# Later retrieve
xlog("Customer: $dlg_var(customer_id)\n");
```

### Dialog Callbacks

Execute actions on dialog events:

```kamailio
event_route[dialog:start] {
    xlog("L_INFO", "Dialog started: $DLG_did\n");
}

event_route[dialog:end] {
    xlog("L_INFO", "Dialog ended: $DLG_did, duration=$DLG_lifetime\n");
}
```

---

## 📊 Monitoring Script

Create `/opt/gcti_apps/monitor_calls.sh`:

```bash
#!/bin/bash

echo "========================================="
echo "Kamailio Live Call Monitor"
echo "========================================="
echo ""

# Active calls
ACTIVE=$(docker exec webrtc-kamailio kamcmd dlg.stats_active 2>/dev/null || echo "0")
echo "Active Calls: $ACTIVE"

# Stats
echo ""
echo "Dialog Statistics:"
docker exec webrtc-kamailio kamcmd dlg.stats 2>/dev/null | grep -E "(processed|active|failed|expired)"

# List active dialogs
if [ "$ACTIVE" != "0" ]; then
    echo ""
    echo "Active Dialogs:"
    docker exec webrtc-kamailio kamcmd dlg.list 2>/dev/null | grep -E "(callid|from_uri|to_uri|duration|state)"
fi

echo ""
echo "========================================="
```

**Usage:**
```bash
chmod +x /opt/gcti_apps/monitor_calls.sh
watch -n 5 /opt/gcti_apps/monitor_calls.sh
```

---

## 🔧 Troubleshooting

### Issue 1: Dialog Module Not Loaded

**Symptoms:** `kamcmd dlg.stats` returns error

**Fix:**
```bash
# Check module loaded
sudo docker exec webrtc-kamailio kamailio -V
sudo docker logs webrtc-kamailio 2>&1 | grep "dialog"

# If not loaded, check config syntax
sudo docker exec webrtc-kamailio kamailio -c -f /etc/kamailio/kamailio.cfg
```

### Issue 2: Dialogs Not Tracked

**Symptoms:** `dlg.stats` shows 0 active but calls are working

**Fix:**
```kamailio
# Ensure dlg_manage() is called for INVITE
if (is_method("INVITE")) {
    setflag(4);      # Set dialog flag
    dlg_manage();    # Must be called!
}
```

### Issue 3: Dialogs Expire Too Soon

**Symptoms:** Calls drop after X minutes

**Fix:**
```kamailio
# Increase default timeout
modparam("dialog", "default_timeout", 21600)  # 6 hours

# Or set per-call
$avp(dlg_timeout) = 14400;  # 4 hours
dlg_manage();
```

---

## 📖 Summary

**Status:** ✅ Dialog module enabled in both configs

**Configs Updated:**
- `kamailio/kamailio-proxy.cfg`
- `kamailio/kamailio-custom-signaling.cfg`

**Next Steps:**
1. Deploy updated config to server
2. Test with a call
3. Run `kamcmd dlg.list` to see live dialog
4. Create monitoring dashboard (optional)

**Quick Test:**
```bash
# After deployment, make a call then:
sudo docker exec webrtc-kamailio kamcmd dlg.list

# You should see your active call details!
```

---

**References:**
- [Kamailio Dialog Module Docs](https://www.kamailio.org/docs/modules/stable/modules/dialog.html)
- [Dialog Commands](https://www.kamailio.org/docs/modules/stable/modules/dialog.html#dialog.rpc)

