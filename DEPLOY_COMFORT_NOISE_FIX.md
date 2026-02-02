# Deploy Comfort Noise Fix (Bug #13)

## Problem
Audio cuts out after ~30 seconds because Asterisk is sending Comfort Noise (CN) RTP packets (payload type 13) even though CN is not negotiated in the SDP. This causes RTPengine to log warnings and eventually close the DTLS session.

## Root Cause
Asterisk was generating CN packets at the RTP level, independent of SDP negotiation. Even with client-side SDP filtering, Asterisk continued sending CN packets.

## Solution
Added `comfort_noise=no` to the `[agent_dn](!)` template in Asterisk's `pjsip.conf` to explicitly disable CN generation.

---

## Deployment Steps

### 1. Pull Latest Code
```bash
cd /opt/gcti_apps/webrtc-genesys
git pull origin main
```

### 2. Verify Changes
```bash
grep -A6 "\[agent_dn\](!)"|  head -7
```

**Expected output:**
```
[agent_dn](!)
type=endpoint
transport=transport-ws
context=genesys-agent
disallow=all
allow=ulaw,alaw
comfort_noise=no
```

### 3. Restart Asterisk
```bash
docker restart webrtc-asterisk
```

### 4. Verify Asterisk Started Successfully
```bash
docker logs --tail 20 webrtc-asterisk | grep -E "Asterisk.*Ready|started"
```

**Expected:** Log line showing "Asterisk Ready" or similar

---

## Testing

### 1. On Client (Windows):
Restart Electron with clean cache (already running with latest HTML from previous fix).

### 2. Make Test Call:
- Sign in DN 1002 in Electron
- Call 1002 from 1003 (Genesys SIP Endpoint)
- Keep call active for 60+ seconds

### 3. Monitor RTPengine (on server):
```bash
docker logs -f --tail 20 webrtc-rtpengine | grep -E "unknown payload|DTLS peer has closed"
```

**Expected Results:**
- ✅ **NO** "RTP packet with unknown payload type 13" warnings
- ✅ **NO** "DTLS peer has closed the connection" messages after 30 seconds
- ✅ Audio continues working beyond 60 seconds

---

## Rollback (if needed)
```bash
cd /opt/gcti_apps/webrtc-genesys
git revert HEAD
docker restart webrtc-asterisk
```

---

## Related Fixes
- **Bug #12**: Client-side SDP filtering to remove CN from SDP (nginx/html/wwe-webrtc-gateway.html)
- **Bug #11**: RTP/RTPengine timeout configuration (asterisk/etc/pjsip.conf, docker-compose.yml)

---

## Verification Commands

### Check if CN is being sent:
```bash
docker logs --since 2m webrtc-rtpengine | grep "unknown payload type 13"
```

**Expected:** No output (no CN packets detected)

### Check DTLS status:
```bash
docker logs --since 2m webrtc-rtpengine | grep -E "DTLS.*negotiated|DTLS peer has closed"
```

**Expected:** Only "DTLS-SRTP successfully negotiated" messages, no "peer has closed" messages

---

## Notes
- This fix is **server-side only** (Asterisk configuration)
- No Electron restart required if already running latest HTML
- Works in conjunction with client-side SDP filtering (Bug #12 fix)
- CN generation disabled at source (Asterisk) prevents any CN packets from being sent

---

**Status:** Ready for deployment  
**Impact:** Low (configuration change only, no code changes)  
**Dependencies:** None (independent of Bug #12 fix)
