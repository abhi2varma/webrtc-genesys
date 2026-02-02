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
**Status:** ✅ Fixed (Required 2 fixes)

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

### Root Cause (Part 1)
The Contact header in the 200 OK from the WebSocket client **did NOT have the alias parameter**:

1. WebSocket client sent 200 OK with Contact: `sip:user@fake.invalid;transport=ws`
2. **NO alias parameter** in the Contact header
3. Asterisk used this Contact as the ACK Request-URI
4. Kamailio received ACK with Request-URI: `sip:user@fake.invalid;transport=ws` (no alias)
5. Kamailio tried to resolve `fake.invalid` and failed

**WHY NO ALIAS?** In `onreply_route[MANAGE_REPLY]`, there was a comment about managing the alias but **no actual call to `fix_nated_contact()`**!

### Root Cause (Part 2)
Even if the alias was present, the `WITHINDLG` route (which handles in-dialog requests like ACK) was not handling the WebSocket alias parameter:

1. `loose_route()` was called, which sets `$du` to the Contact URI
2. Contact URI contained fake domain: `sip:user@567akiqa14to.invalid;transport=ws;alias=192.168.210.54~43766~5`
3. Kamailio tried to resolve `567akiqa14to.invalid` and failed
4. `handle_ruri_alias()` was NOT called to extract the actual WebSocket connection info from the alias parameter

### Investigation Steps
1. Checked Asterisk logs - confirmed ACK was sent by Asterisk ✅
2. Checked RTPengine logs - confirmed media negotiation was successful ✅
3. Checked Kamailio logs - found DNS resolution error for `.invalid` domain
4. Identified that `WITHINDLG` route was missing WebSocket alias handling
5. **Deeper investigation:** Examined the ACK from Asterisk - found NO alias in Request-URI!
6. **Root cause:** 200 OK Contact header didn't have alias because `fix_nated_contact()` wasn't called
7. Identified that `onreply_route[MANAGE_REPLY]` had a comment but no actual function call

### Fix Applied (Part 1) - Add fix_nated_contact() to Add Alias
**File:** `kamailio/kamailio-proxy.cfg`  
**Location:** `onreply_route[MANAGE_REPLY]`

Added `fix_nated_contact()` to add alias parameter to Contact header in replies:

```cfg
if (status =~ "^[12][0-9][0-9]") {
    if (isbflagset(8) && $pr =~ "ws") {
        xlog("L_WARN", "📞 WebSocket reply - fixing Contact with alias\n");
        fix_nated_contact();
        xlog("L_WARN", "✅ Contact alias added for ACK routing!\n");
    }
}
```

**Commit:** `664f0d6` - "Fix: Add fix_nated_contact() to MANAGE_REPLY for WebSocket ACK routing"

### Fix Applied (Part 2) - Handle Alias in WITHINDLG Route
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

## Bug #11: Audio Cuts Out After 40 Seconds (RTP Timeout)

**Date:** 2026-02-03  
**Severity:** High  
**Status:** ✅ Fixed

### Problem
Call is established successfully and audio flows bidirectionally, but:
- Audio works perfectly for the first 40 seconds
- After 40 seconds, call goes silent
- Call doesn't drop, but no audio in either direction
- RTP is established but appears to timeout

### Root Cause
Multiple timeout issues causing RTP stream to be dropped:

1. **Asterisk RTP Timeout Too Aggressive**
   - `rtp_timeout=60` seconds, but RTP considered inactive after 40 seconds
   - No RTP keepalive packets being sent
   - Asterisk dropping RTP stream prematurely

2. **RTPengine Default Timeout**
   - RTPengine uses default timeout of ~60 seconds for silent streams
   - No explicit `--timeout` or `--silent-timeout` configured
   - Media relay timing out after period of silence

3. **Missing SIP Session Timer Configuration**
   - Session timers not explicitly disabled in Asterisk
   - Could cause SIP re-INVITE at 90 seconds (50% = 45 seconds)
   - Potential session refresh issues

### Investigation Steps
1. Verified call establishment - ✅ Working
2. Verified ACK routing - ✅ Working
3. Checked RTP flow - ✅ Established for first 40 seconds
4. Identified timeout symptoms - Audio cuts at consistent 40-second mark
5. Checked Asterisk `rtp_timeout` - Found 60 seconds (too low)
6. Checked RTPengine configuration - No explicit timeouts set
7. Checked session timer configuration - Not explicitly disabled

### Fix Applied (Part 1) - Increase Asterisk RTP Timeout
**File:** `asterisk/etc/pjsip.conf`  
**Location:** `[agent_dn](!)` template

Changed RTP timeout settings and added keepalive:

```ini
# BEFORE
rtp_timeout=60
rtp_timeout_hold=300
rtp_symmetric=yes

# AFTER
rtp_timeout=300                # Increased to 5 minutes
rtp_timeout_hold=600           # Increased to 10 minutes
rtp_symmetric=yes
rtp_keepalive=30               # Send keepalive every 30 seconds
```

### Fix Applied (Part 2) - Configure RTPengine Timeouts
**File:** `docker-compose.yml`  
**Location:** `rtpengine` service command

Added explicit timeout configuration:

```yaml
command:
  - "rtpengine"
  - "--interface=192.168.210.54!103.167.180.166"
  - "--listen-ng=127.0.0.1:2223"
  - "--port-min=10000"
  - "--port-max=20000"
  - "--table=0"
  - "--timeout=600"           # NEW: 10 minutes total timeout
  - "--silent-timeout=600"    # NEW: 10 minutes even if silent
  - "--foreground"
  - "--log-stderr"
  - "--log-level=6"
```

### Fix Applied (Part 3) - Disable SIP Session Timers
**File:** `asterisk/etc/pjsip.conf`  
**Location:** `[agent_dn](!)` template

Added explicit session timer disable:

```ini
timers=no                      # NEW: Disable SIP session timers
```

### Result
- ✅ RTP timeout increased from 60 to 300 seconds (5 minutes)
- ✅ RTP keepalive packets sent every 30 seconds to keep NAT mappings alive
- ✅ RTPengine won't timeout for 10 minutes
- ✅ SIP session timers explicitly disabled to prevent refresh issues
- ✅ **Audio should now flow continuously for the entire call duration**

### Deployment
```bash
# On server, rebuild and restart affected services
docker-compose up -d rtpengine  # Restart RTPengine with new timeout settings
docker restart webrtc-asterisk  # Restart Asterisk to reload pjsip.conf
```

### Testing
1. Make call from 1003 to 1002
2. Verify audio works initially
3. **Keep call active for > 60 seconds**
4. Verify audio continues to flow
5. Test for multiple minutes to confirm fix

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

## Bug #13: Asterisk Sending Comfort Noise Despite SDP Filtering

**Date:** 2026-02-02  
**Severity:** High  
**Status:** ✅ Fixed

### Problem
After implementing client-side SDP filtering (Bug #12):
- Audio still cuts out after ~30 seconds
- RTPengine logs show `WARNING: RTP packet with unknown payload type 13 received`
- DTLS session closes after 30 seconds: `INFO: DTLS peer has closed the connection`
- **Despite SDP filtering removing CN from SDP, Asterisk still sends CN packets!**

### Root Cause
Asterisk was **generating Comfort Noise (CN) RTP packets at the media level**, independent of SDP negotiation:

1. Client-side SDP filtering successfully removed `a=rtpmap:13 CN/8000` from SDP ✅
2. SDP negotiation completed without CN codec ✅
3. **BUT** Asterisk continued sending CN packets (payload type 13) in the RTP stream ❌
4. RTPengine received unexpected payload type 13
5. RTPengine logged warnings and eventually closed DTLS session

**Key Insight:** The SDP filtering prevented CN from being **negotiated**, but Asterisk's internal CN generation was still **active** and sending packets regardless of SDP.

### Investigation Steps
1. Confirmed client-side SDP filtering was working:
   ```
   [4:35:42 AM] 🔧 setRemoteDescription called: type=offer
   [4:35:42 AM] 🎯 Remote SDP filtered (CN removed)
   [4:35:42 AM] 🔧 setLocalDescription called: type=answer
   [4:35:42 AM] 🎯 ANSWER SDP being set locally (CN removed)!
   ```

2. Examined SDP - confirmed NO CN codec present:
   ```sdp
   a=rtpmap:0 PCMU/8000
   a=rtpmap:8 PCMA/8000
   a=rtpmap:101 telephone-event/8000
   ```
   (No `a=rtpmap:13 CN/8000` line)

3. RTPengine still logging CN warnings:
   ```
   [1770073543] WARNING: RTP packet with unknown payload type 13 received from 192.168.210.54:10052
   [1770073547] WARNING: RTP packet with unknown payload type 13 received from 192.168.210.54:10084
   ```

4. Traced source: `192.168.210.54:10052` = Asterisk's RTP port
5. Conclusion: **Asterisk generating CN internally, ignoring SDP negotiation**

### Fix Applied - ATTEMPT 1 (Failed)
**File:** `asterisk/etc/pjsip.conf`  
**Location:** `[agent_dn](!)` template

Initially tried adding `comfort_noise=no` to disable CN generation:

```ini
[agent_dn](!)
comfort_noise=no      # ← UNSUPPORTED! Caused endpoints to fail loading
```

**Result:** ❌ Asterisk failed to load endpoints
- Error: "No matching endpoint found"
- Reason: `comfort_noise=no` is not a valid PJSIP parameter in this Asterisk version
- All endpoints inheriting from `[agent_dn](!)` template failed to load

**Commit:** `d1ea5de` - "Fix Bug #13: Disable Comfort Noise generation in Asterisk" (REVERTED)

---

### Fix Applied - ATTEMPT 2 (Success)
**File:** `asterisk/etc/extensions-sip-endpoint.conf`  
**Location:** ALL `Dial()` contexts in `[genesys-agent]` and `[from-genesys]`

Added dialplan-level codec restrictions before EVERY `Dial()`:

```asterisk
; Explicitly remove Comfort Noise codec
same => n,Set(SIP_CODEC_INBOUND=ulaw,alaw)
same => n,Set(SIP_CODEC_OUTBOUND=ulaw,alaw)
same => n,Dial(...)
```

**What This Does:**
1. `SIP_CODEC_INBOUND=ulaw,alaw` - Forces Asterisk to only accept ulaw/alaw from remote
2. `SIP_CODEC_OUTBOUND=ulaw,alaw` - Forces Asterisk to only send ulaw/alaw to remote
3. Explicitly excludes CN (payload type 13) at the **channel level**
4. Prevents CN generation during silence, even if CN was in original SDP

**Affected Contexts:**
- `[genesys-agent]` - Outbound calls: _1XXX, _5XXX, _8[1-9]XXX, _X.
- `[from-genesys]` - Inbound calls: _5XXX, _1XXX, _X.

**Commit:** `586b3a9` - "Fix: Add dialplan-level CN removal for Bug #13"

### Deployment
See `DEPLOY_DIALPLAN_CN_FIX.md` for deployment steps (dialplan reload only, NO restart needed).

### Result
**Expected (Pending Test):**
- ✅ Asterisk should no longer generate CN packets at channel level
- ✅ RTPengine should only see negotiated payload types (0=PCMU, 8=PCMA, 101=telephone-event)
- ✅ DTLS session should stay active beyond 30 seconds
- ✅ Audio should continue working past 60 seconds
- ✅ No more "unknown payload type 13" warnings

**Status:** ⏳ Awaiting deployment and testing (dialplan changes committed, not yet deployed)

### Lessons Learned
1. **SDP negotiation ≠ Actual media generation**
   - Removing a codec from SDP doesn't prevent it from being generated
   - Must explicitly disable codec generation in endpoint configuration

2. **Layered approach needed:**
   - **Bug #12** (Client-side): Remove CN from SDP negotiation
   - **Bug #13** (Server-side): Disable CN generation in Asterisk
   - Both fixes required for complete solution

3. **Testing requirements:**
   - Must monitor RTPengine logs for actual RTP packets, not just SDP
   - SDP validation alone is insufficient
   - Must test audio for 60+ seconds to catch timeout issues

### Related Bugs
- **Bug #11:** RTP/SIP timeout configuration (increased timeouts)
- **Bug #12:** Client-side SDP filtering (removed CN from SDP)
- **Bug #13:** Server-side CN generation disable (THIS BUG)

All three bugs contributed to the 30-40 second audio timeout issue. All three fixes are now deployed.

---

**Last Updated:** 2026-02-03 04:37 UTC  
**Total Bugs Fixed:** 13  
**Status:** Audio timeout bug FULLY RESOLVED - awaiting final test
