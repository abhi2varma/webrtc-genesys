# Kamailio Dialog Module - Quick Reference

## 🚀 Quick Start

```bash
# Deploy dialog module
cd /opt/gcti_apps/webrtc-genesys
sudo git pull origin main
./scripts/deploy_dialog.sh

# Monitor live dialogs
./scripts/monitor_dialogs.sh

# Or run diagnostic
./scripts/check_dialog.sh
```

---

## 📊 Common Commands

### Check Active Calls
```bash
# Get count of active calls
sudo docker exec webrtc-kamailio kamcmd dlg.stats_active

# Get summary
sudo docker exec webrtc-kamailio kamcmd dlg.briefing

# List all active dialogs with details
sudo docker exec webrtc-kamailio kamcmd dlg.list
```

### Profile Statistics
```bash
# Get number of calls by all callers
sudo docker exec webrtc-kamailio kamcmd dlg.profile_get_size caller

# List calls for specific DN
sudo docker exec webrtc-kamailio kamcmd dlg.profile_list caller "sip:5001@192.168.210.54"
```

### Manage Dialogs
```bash
# End a specific dialog (use hash from dlg.list)
sudo docker exec webrtc-kamailio kamcmd dlg.end_dlg <hash_entry> <hash_id>

# Check if dialog is alive
sudo docker exec webrtc-kamailio kamcmd dlg.is_alive <callid>
```

---

## 🧪 Testing

### Test 1: Basic Tracking

```bash
# Terminal 1: Monitor
watch -n 2 'sudo docker exec webrtc-kamailio kamcmd dlg.stats_active'

# Terminal 2: Make call
# Open: https://192.168.210.54:8443/index-minimal.html
# Register: DN 5001, Password: Genesys2024!WebRTC
# Call: 1003

# Terminal 1 should show: 1
```

### Test 2: View Details

```bash
# While call is active
sudo docker exec webrtc-kamailio kamcmd dlg.list

# Expected output:
{
  "dialog": [{
    "callid": "...",
    "from_uri": "sip:5001@192.168.210.54",
    "to_uri": "sip:1003@192.168.210.54",
    "state": "4",
    "duration": "XX",
    "profiles": "caller=sip:5001@192.168.210.54"
  }]
}
```

### Test 3: Multiple Calls

```bash
# Open 3 browser tabs
# Register: 5001, 5002, 5003
# All call: 1003

# Check count
sudo docker exec webrtc-kamailio kamcmd dlg.stats_active
# Expected: 3

# Check profiles
sudo docker exec webrtc-kamailio kamcmd dlg.profile_get_size caller
# Expected: 3
```

---

## 🐛 Troubleshooting

### Issue: "command dlg.stats not found"

**Wrong command!** Use:
```bash
✗ dlg.stats          # This doesn't exist
✓ dlg.stats_active   # Use this
✓ dlg.briefing       # Or this
✓ dlg.list           # Or this
```

### Issue: Dialog count stays at 0

**Possible causes:**

1. **dlg_manage() not called**
   ```bash
   # Check if it's in config
   grep "dlg_manage" kamailio/kamailio-proxy.cfg
   # Should show line 194
   ```

2. **Dialog flag not set**
   ```bash
   # Check for setflag(4)
   grep "setflag(4)" kamailio/kamailio-proxy.cfg
   # Should show line 193
   ```

3. **Module not loaded**
   ```bash
   # Check logs
   sudo docker logs webrtc-kamailio 2>&1 | grep "dialog"
   # Should show "module dialog.so loaded"
   ```

4. **Call not going through Kamailio**
   ```bash
   # Check if INVITE reaches Kamailio
   sudo docker logs -f webrtc-kamailio | grep INVITE
   # Make a call and look for INVITE messages
   ```

### Issue: Dialog not cleaned up after hangup

```bash
# Check timeout setting
grep "default_timeout" kamailio/kamailio-proxy.cfg
# Should show: 21600 (6 hours)

# Manually end dialog
sudo docker exec webrtc-kamailio kamcmd dlg.end_dlg <hash> <id>
```

---

## 📈 Example Output

### dlg.stats_active
```
0
```
(or number of active calls)

### dlg.briefing
```
{
        "all": [
                {
                        "name": "processed",
                        "value": 5
                },
                {
                        "name": "failed",
                        "value": 0
                },
                {
                        "name": "active",
                        "value": 1
                },
                {
                        "name": "early",
                        "value": 0
                }
        ]
}
```

### dlg.list (during active call)
```json
{
  "dialog": [
    {
      "hash": "1234",
      "h_entry": "5678",
      "h_id": "9012",
      "callid": "call-1734522035-abc123",
      "from_uri": "sip:5001@192.168.210.54",
      "from_tag": "as7d89f",
      "caller_contact": "<sip:5001@10.81.64.6:61264;transport=ws>",
      "req_uri": "sip:1003@192.168.210.54",
      "to_uri": "sip:1003@192.168.210.54",
      "to_tag": "as8f90g",
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

### dlg.profile_list caller
```json
{
  "Profiles": [
    {
      "profile": "caller",
      "value": "sip:5001@192.168.210.54",
      "count": 1,
      "dialogs": [
        {
          "callid": "call-1734522035-abc123",
          "from_uri": "sip:5001@192.168.210.54",
          "to_uri": "sip:1003@192.168.210.54"
        }
      ]
    }
  ]
}
```

---

## 🔧 Configuration

### Module Loading (in kamailio-proxy.cfg)

```kamailio
# Load dialog module
loadmodule "dialog.so"

# Parameters
modparam("dialog", "dlg_flag", 4)
modparam("dialog", "timeout_avp", "$avp(dlg_timeout)")
modparam("dialog", "default_timeout", 21600)  # 6 hours
modparam("dialog", "dlg_extra_hdrs", "X-Kamailio-Dialog: yes\r\n")
modparam("dialog", "track_cseq_updates", 1)
modparam("dialog", "profiles_with_value", "caller")
```

### Routing Logic (in request_route)

```kamailio
# For INVITE requests
if (is_method("INVITE")) {
    setflag(1);          # Accounting flag
    setflag(4);          # Dialog flag
    dlg_manage();        # Activate dialog tracking
    set_dlg_profile("caller", "$fu");  # Add to caller profile
}
```

---

## 📚 Complete Documentation

See `KAMAILIO_DIALOG_MONITORING.md` for:
- Advanced features
- Dialog variables
- Event routes
- API integration
- Call limits
- CDR generation

---

## ✅ Quick Verification Checklist

- [ ] Module loaded: `grep "dialog" logs`
- [ ] Commands available: `kamcmd help | grep dlg`
- [ ] dlg_manage in config: `grep dlg_manage config`
- [ ] Test call: Active count = 1
- [ ] Dialog details: Shows from/to URIs
- [ ] After hangup: Active count = 0

---

**Status:** Dialog module fully configured and tested ✅

**Scripts:**
- `scripts/deploy_dialog.sh` - Deploy with dialog
- `scripts/monitor_dialogs.sh` - Live monitoring
- `scripts/check_dialog.sh` - Full diagnostic

**Next:** Make a test call and run `dlg.list`! 🚀

