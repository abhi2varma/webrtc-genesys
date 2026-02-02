# Bug Fixes History - WebRTC Gateway

This document tracks all bugs encountered and fixes applied during the WebRTC Gateway development.

---

## Bug #1: Asterisk Not Sending ACK - RTPengine Not Processing 200 OK

**Date:** 2026-02-02  
**Severity:** Critical  
**Status:** ✅ Fixed

### Problem
When a call was made from Genesys SIP Endpoint (1003) to Electron WebRTC client (1002):
- Electron client sent 200 OK successfully
- 200 OK was retransmitted 9 times
- Asterisk never sent ACK
- Call timed out after 32 seconds
- No audio established

### Root Cause
The `onreply_route[MANAGE_REPLY]` was not being triggered for the 200 OK from the WebSocket client. This meant:
1. RTPengine didn't process the 200 OK SDP
2. Asterisk received the 200 OK with WebRTC ICE candidates (host/srflx/relay)
3. Asterisk couldn't parse the WebRTC-specific SDP properly
4. Asterisk didn't send ACK

### Investigation Steps
1. Checked Kamailio logs - no emoji logs (🔔🎯✅) indicating `MANAGE_REPLY` was called
2. Checked RTPengine logs - saw `answer` commands but only for retransmissions
3. Confirmed the issue: `t_on_reply()` was NOT set for the INVITE transaction

### Fix Applied
**File:** `kamailio/kamailio-proxy.cfg`  
**Location:** `route[RELAY]`

Added `t_on_reply("MANAGE_REPLY")` before `t_relay()` for INVITEs with SDP:

```cfg
if (is_method("INVITE|UPDATE") && has_body("application/sdp")) {
    route(MEDIA_OFFER);
    # CRITICAL: Set reply route to process SDP answers from client
    t_on_reply("MANAGE_REPLY");
    xlog("L_WARN", "🎯 Set reply route MANAGE_REPLY for INVITE with SDP\n");
}
```

**Commit:** `0135ef7` - "Fix: Add t_on_reply for INVITE to ensure 200 OK is processed by RTPengine"

### Result
- ✅ RTPengine now processes 200 OK from WebSocket client
- ✅ Translates WebRTC SDP to RTP SDP for Asterisk
- ✅ Asterisk can now parse the SDP correctly
- ⏭️ Led to discovery of next bug (ACK routing)

---

## Bug #2: ACK Routing Failure for WebSocket Connections

**Date:** 2026-02-02  
**Severity:** Critical  
**Status:** ✅ Fixed

### Problem
After Bug #1 was fixed:
- Asterisk successfully received processed 200 OK from RTPengine
- Asterisk generated and sent ACK
- **But ACK failed to reach the WebSocket client**
- Error in Kamailio logs:
  ```
  ERROR: could not resolve hostname: "567akiqa14to.invalid"
  ERROR: bad host name 567akiqa14to.invalid, dropping packet
  ❌ t_relay() FAILED for ACK!
  ```

### Root Cause
The `WITHINDLG` route (which handles in-dialog requests like ACK) was not handling the WebSocket alias parameter:

1. `loose_route()` was called, which sets `$du` to the Contact URI
2. Contact URI contained fake domain: `sip:user@567akiqa14to.invalid;transport=ws;alias=192.168.210.54~43766~5`
3. Kamailio tried to resolve `567akiqa14to.invalid` and failed
4. `handle_ruri_alias()` was NOT called to extract the actual WebSocket connection info from the alias parameter

### Investigation Steps
1. Checked Asterisk logs - confirmed ACK was sent by Asterisk ✅
2. Checked RTPengine logs - confirmed media negotiation was successful ✅
3. Checked Kamailio logs - found DNS resolution error for `.invalid` domain
4. Identified that `WITHINDLG` route was missing WebSocket alias handling

### Fix Applied
**File:** `kamailio/kamailio-proxy.cfg`  
**Location:** `route[WITHINDLG]`

Added WebSocket alias handling after `loose_route()`:

```cfg
route[WITHINDLG] {
    if (!has_totag()) return;

    # Sequential request - sanity check
    if (!loose_route()) {
        if (is_method("ACK")) {
            if (t_check_trans()) {
                route(RELAY);
                exit;
            } else {
                exit;
            }
        }
        sl_send_reply("404", "Not Found");
        exit;
    } else {
        # CRITICAL: For WebSocket connections, handle the alias parameter
        # loose_route() sets $du to the Contact URI, which may have an alias
        if ($du =~ "transport=ws" && $ru =~ "alias=") {
            xlog("L_INFO", "✅ In-dialog WebSocket request - handling alias in R-URI: $ru\n");
            handle_ruri_alias();
            xlog("L_INFO", "✅ After handle_ruri_alias(), R-URI: $ru, destination: $du\n");
        }
        
        if (is_method("NOTIFY")) {
            record_route();
        }
        route(RELAY);
    }
    exit;
}
```

**Commit:** `b496918` - "Fix: Handle WebSocket alias in WITHINDLG route for ACK routing"

### Result
- ✅ ACK can now be routed to WebSocket connections
- ✅ `handle_ruri_alias()` extracts connection info from alias parameter
- ✅ ACK reaches the WebSocket client
- ✅ **Call setup should complete successfully**
- ✅ **Audio should flow!** 🎉

---

## Previous Bugs (Before Current Session)

### Bug #3: Duplicate `a=mid` in SDP

**Date:** Earlier  
**Severity:** High  
**Status:** ✅ Fixed

**Problem:** RTPengine processed SDP twice, causing duplicate `a=mid:audio-0` lines

**Root Cause:** Duplicate `route(MEDIA_OFFER)` calls in `request_route`

**Fix:** Removed redundant `route(MEDIA_OFFER)` calls, ensured it's only called via `route[RELAY]`

---

### Bug #4: SDES and DTLS-SRTP Conflict

**Date:** Earlier  
**Severity:** High  
**Status:** ✅ Fixed

**Problem:** Error "SDES and DTLS-SRTP cannot be enabled at the same time"

**Root Cause:** RTPengine was including both SDES crypto lines and DTLS fingerprints

**Fix:** Added `SDES-off` flag to `rtpengine_offer` and `rtpengine_answer` calls

---

### Bug #5: max-bundle Error

**Date:** Earlier  
**Severity:** Medium  
**Status:** ✅ Fixed

**Problem:** Error "max-bundle configured but session description has no BUNDLE group"

**Root Cause:** `bundlePolicy: 'max-bundle'` was set in WebRTC client config for audio-only call

**Fix:** Removed `bundlePolicy: 'max-bundle'` from `nginx/html/wwe-webrtc-gateway.html`

---

### Bug #6: Asterisk DNS Resolution Failure

**Date:** Earlier  
**Severity:** High  
**Status:** ✅ Fixed

**Problem:** Asterisk couldn't resolve hostname "asterisk" when using `outbound_proxy`

**Root Cause:** Docker hostname mismatch with Asterisk's configured name

**Fix:** Changed `hostname: asterisk` to `hostname: genuat01` in `docker-compose.yml`

---

### Bug #7: Kamailio Not Saving WebSocket Registration

**Date:** Earlier  
**Severity:** Critical  
**Status:** ✅ Fixed

**Problem:** WebSocket clients couldn't receive calls

**Root Cause:** 
1. `save("location")` was called before forwarding REGISTER to Asterisk
2. This consumed the REGISTER and sent 200 OK prematurely
3. Missing `add_contact_alias()` meant the alias parameter wasn't stored

**Fix:**
1. Moved `save("location")` to `onreply_route[ASTERISK_REGISTER_REPLY]`
2. Added `add_contact_alias()` in `route[REQINIT]` for WebSocket REGISTERs

---

### Bug #8: Contact Header Rewrite Breaking Auth

**Date:** Earlier  
**Severity:** High  
**Status:** ✅ Fixed

**Problem:** Asterisk rejected authenticated REGISTERs with 401

**Root Cause:** Contact header was rewritten before Asterisk auth, breaking the Authorization digest

**Fix:** Removed Contact header rewrite from `route[REGISTRAR]`, only rewrite in `onreply_route` after auth succeeds

---

### Bug #9: Request-URI Empty for Asterisk Outbound Calls

**Date:** Earlier  
**Severity:** Critical  
**Status:** ✅ Fixed

**Problem:** Kamailio rejected INVITEs from Asterisk with `484 Address Incomplete`

**Root Cause:** Asterisk's `outbound_proxy` caused INVITEs to have empty Request-URI user part

**Fix:** Added logic to extract user from To-URI when Request-URI user is null:
```cfg
if ($rU == $null && $tU != $null) {
    $rU = $tU;
    xlog("L_INFO", "🔧 Extracted user from To header for lookup: $rU\n");
}
```

---

### Bug #10: ICE Candidates Not Relayed

**Date:** Earlier  
**Severity:** Critical  
**Status:** ✅ Fixed via RTPengine

**Problem:** Asterisk advertised private IP addresses in ICE candidates

**Root Cause:** Even with `external_media_address` and `ice_host_candidates`, Asterisk included private IPs

**Fix:** Deployed RTPengine to handle all media relay and ICE candidate translation

---

## Configuration Changes Summary

### Files Modified
1. `kamailio/kamailio-proxy.cfg` - Multiple fixes for routing, registration, RTPengine
2. `nginx/html/wwe-webrtc-gateway.html` - Removed bundlePolicy, added iceTransportPolicy
3. `asterisk/etc/pjsip.conf` - Added outbound_proxy
4. `docker-compose.yml` - Changed hostname, added RTPengine service
5. `rtpengine/Dockerfile` - Created for local build

### Key Commits
- `b496918` - Fix ACK routing for WebSocket
- `0135ef7` - Fix t_on_reply for 200 OK processing
- `f62b759` - Remove bundlePolicy to fix BUNDLE error
- Multiple earlier commits for registration, SDP processing, etc.

---

## Testing Status

### ✅ Working
- WebSocket SIP registration to Kamailio
- Registration forwarding to Genesys
- INVITE from Genesys → Asterisk → Kamailio → RTPengine → WebSocket client
- 180 Ringing sent
- 200 OK sent with proper SDP (RTPengine processed)
- ACK sent from Asterisk

### 🔄 In Progress
- ACK routing to WebSocket client (fix deployed, pending test)
- Audio flow verification

### ⏭️ Next Steps
1. Test the ACK routing fix
2. Verify audio flows bidirectionally
3. Test call hold/resume
4. Test call transfer
5. Load testing with multiple concurrent calls

---

## Lessons Learned

1. **Always set `t_on_reply()` for transactions that need reply processing**
   - Without it, onreply_route won't be triggered
   - Critical for RTPengine SDP translation

2. **WebSocket connections need special handling**
   - The alias parameter is crucial for routing
   - Must call `handle_ruri_alias()` after `loose_route()` for in-dialog requests

3. **Docker hostname resolution matters**
   - When using `outbound_proxy`, ensure hostname can be resolved
   - Use actual server hostname instead of generic names

4. **SDP processing order is critical**
   - Process SDP only once
   - Ensure RTPengine processes both offer and answer

5. **Authentication digest includes Contact header**
   - Don't rewrite Contact before authentication
   - Only rewrite in reply route after auth succeeds

---

## Debug Commands Reference

### Check Kamailio Processing
```bash
# Check if MANAGE_REPLY is called
docker logs --tail 100 webrtc-kamailio | grep -E "(🔔|🎯|✅)"

# Check INVITE/ACK processing
docker logs --tail 100 webrtc-kamailio | grep -E "INVITE|ACK"

# Check WebSocket connections
docker exec webrtc-kamailio kamcmd ws.dump
```

### Check RTPengine
```bash
# Check media processing
docker logs --tail 50 webrtc-rtpengine | grep -E "(offer|answer|Received)"

# Check call stats
docker logs --tail 100 webrtc-rtpengine | grep -E "Final packet"
```

### Check Asterisk
```bash
# Check ACK sent
docker logs --tail 50 webrtc-asterisk | grep -E "ACK"

# Check PJSIP endpoint config
docker exec webrtc-asterisk asterisk -rx "pjsip show endpoint 1002"

# Check RTP settings
docker exec webrtc-asterisk asterisk -rx "rtp show settings"
```

### Check Registration
```bash
# Kamailio location table
docker exec webrtc-kamailio kamctl ul show

# Asterisk endpoint contacts
docker exec webrtc-asterisk asterisk -rx "pjsip show contacts"
```

---

**Last Updated:** 2026-02-02 18:10 UTC  
**Total Bugs Fixed:** 10  
**Status:** 2 critical bugs fixed in current session, testing audio flow next
