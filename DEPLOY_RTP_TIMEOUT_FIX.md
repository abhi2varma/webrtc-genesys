# Deploy RTP Timeout Fix (Bug #11)

**Issue:** Audio cuts out after 40 seconds  
**Fix:** Increase RTP timeout, add keepalive, configure RTPengine timeouts  
**Commit:** `17fbdb1`

---

## Quick Deploy (Copy and Paste)

SSH to the server and run these commands:

```bash
# 1. Navigate to the project directory
cd /opt/gcti_apps/webrtc-genesys

# 2. Pull the latest changes
sudo git pull origin main

# 3. Rebuild RTPengine container (needed for new timeout flags)
docker-compose build --no-cache rtpengine

# 4. Restart RTPengine with new configuration
docker-compose up -d rtpengine

# 5. Restart Asterisk to reload pjsip.conf with new RTP timeout settings
docker restart webrtc-asterisk

# 6. Verify containers are running
docker ps | grep -E "rtpengine|asterisk"

# 7. Check logs for errors
docker logs --tail 20 webrtc-rtpengine
docker logs --tail 20 webrtc-asterisk
```

---

## What Changed

### 1. Asterisk Configuration (`asterisk/etc/pjsip.conf`)

```ini
# Increased RTP timeout from 60 to 300 seconds (5 minutes)
rtp_timeout=300

# Increased hold timeout from 300 to 600 seconds (10 minutes)
rtp_timeout_hold=600

# Added RTP keepalive - sends packets every 30 seconds
rtp_keepalive=30

# Disabled SIP session timers
timers=no
```

### 2. RTPengine Configuration (`docker-compose.yml`)

```yaml
# Added timeout configuration
- "--timeout=600"           # 10 minutes total timeout
- "--silent-timeout=600"    # 10 minutes even if silent
```

---

## Testing Steps

After deployment:

1. **Make a test call from 1003 to 1002**
   ```
   Genesys SIP Endpoint (1003) → WebRTC Client (1002)
   ```

2. **Verify audio works initially**
   - Speak from 1003 → Hear on 1002 ✓
   - Speak from 1002 → Hear on 1003 ✓

3. **Keep call active for at least 90 seconds**
   - Previously failed at 40 seconds
   - Should now continue working

4. **Verify audio still flows after 90 seconds**
   - Test speaking in both directions
   - Confirm no silence or dropout

5. **Test for extended duration** (optional)
   - Keep call active for 3-5 minutes
   - Confirm audio quality remains good

---

## Verification Commands

### Check if RTPengine has new timeout settings:

```bash
docker logs --tail 50 webrtc-rtpengine | grep -E "timeout|Listening"
```

Expected output should show:
```
INFO: [core] Listening on: udp6:::2223 udp:127.0.0.1:2223
```

### Check if Asterisk loaded new RTP settings:

```bash
docker exec webrtc-asterisk asterisk -rx "rtp show settings"
```

Expected output:
```
RTP timeout:              300
RTP timeout on hold:      600
RTP keepalive:            30
```

### Check Asterisk endpoint configuration:

```bash
docker exec webrtc-asterisk asterisk -rx "pjsip show endpoint 1002" | grep -E "rtp_|timers"
```

Expected output:
```
rtp_timeout              : 300
rtp_timeout_hold         : 600
rtp_keepalive            : 30
timers                   : no
```

---

## Rollback (If Needed)

If the fix causes issues, rollback:

```bash
# Revert to previous commit
cd /opt/gcti_apps/webrtc-genesys
sudo git reset --hard 944014a

# Rebuild and restart
docker-compose build --no-cache rtpengine
docker-compose up -d rtpengine
docker restart webrtc-asterisk
```

---

## Expected Behavior

**Before Fix:**
- ✅ Call establishes successfully
- ✅ Audio works for first 40 seconds
- ❌ Audio goes silent after 40 seconds
- ❌ Call stays connected but no audio

**After Fix:**
- ✅ Call establishes successfully
- ✅ Audio works for first 40 seconds
- ✅ **Audio continues to work after 40 seconds**
- ✅ **Audio works for entire call duration (up to 5-10 minutes)**
- ✅ RTP keepalive prevents NAT timeout
- ✅ No SIP session refresh issues

---

## Troubleshooting

### If audio still cuts out:

1. **Check RTPengine logs during the call:**
   ```bash
   docker logs -f webrtc-rtpengine | grep -E "timeout|call destroyed"
   ```

2. **Check Asterisk RTP statistics:**
   ```bash
   docker exec webrtc-asterisk asterisk -rx "core show channels verbose"
   ```

3. **Check for firewall/NAT timeout:**
   ```bash
   # On the client machine, check if RTP packets are still flowing
   # This requires packet capture tools
   ```

4. **Verify RTP keepalive is working:**
   ```bash
   # Look for periodic RTP packets every 30 seconds
   docker exec webrtc-asterisk asterisk -rx "rtp set debug on"
   # Make call and watch for keepalive packets
   ```

---

## Related Issues

- **Bug #1:** Asterisk not sending ACK - ✅ Fixed
- **Bug #2:** ACK routing failure - ✅ Fixed
- **Bug #11:** Audio timeout at 40 seconds - ✅ Fixed (this deployment)

---

## Status

- [x] Code committed
- [x] Code pushed to GitHub
- [ ] Deployed to server - **DEPLOY NOW**
- [ ] Tested (make call > 90 seconds)
- [ ] Verified audio continues working

---

**Deploy this fix now to resolve the audio timeout issue! 🚀**
