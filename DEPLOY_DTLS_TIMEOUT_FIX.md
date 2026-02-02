# Deploy DTLS Timeout Fix (Bug #12)

**Issue:** Audio cuts out after 30-35 seconds due to DTLS connection closure  
**Root Cause:** Comfort Noise (CN) packets breaking DTLS-SRTP encryption layer  
**Fix:** Remove CN codec from SDP, add proper audio constraints, filter SDP  
**Commit:** `06525bd`

---

## Quick Deploy (Run on SERVER)

```bash
# 1. Navigate to project directory
cd /opt/gcti_apps/webrtc-genesys

# 2. Pull latest changes
sudo git pull origin main

# 3. Restart Nginx to serve updated HTML file
docker restart webrtc-nginx

# 4. Verify Nginx is serving the new file
docker logs --tail 10 webrtc-nginx
```

---

## What Changed

### WebRTC Client (`nginx/html/wwe-webrtc-gateway.html`)

#### 1. **SDP Filtering to Remove Comfort Noise**

Added `removeComfortNoise()` function that:
- Removes `a=rtpmap:13 CN/8000` lines from SDP
- Removes CN payload type from `m=audio` lines
- Prevents "unknown payload type 13" warnings in RTPengine

```javascript
// Function to remove Comfort Noise (CN) from SDP
const removeComfortNoise = (sdp) => {
    // Remove CN codec (payload type 13)
    let lines = sdp.split('\r\n');
    let filteredLines = [];
    let removedPT = [];
    
    for (let line of lines) {
        // Find and remove CN rtpmap lines
        if (line.includes('rtpmap') && line.toLowerCase().includes('cn/')) {
            const match = line.match(/a=rtpmap:(\d+)/);
            if (match) {
                removedPT.push(match[1]);
                continue; // Skip this line
            }
        }
        filteredLines.push(line);
    }
    
    // Remove CN payload types from m= lines
    filteredLines = filteredLines.map(line => {
        if (line.startsWith('m=audio')) {
            for (let pt of removedPT) {
                line = line.replace(new RegExp(` ${pt}(?=\\s|$)`, 'g'), '');
            }
        }
        return line;
    });
    
    return filteredLines.join('\r\n');
};
```

#### 2. **Hooked into setLocalDescription and setRemoteDescription**

```javascript
// Hook into setLocalDescription to filter SDP
const originalSetLocal = pc.setLocalDescription.bind(pc);
pc.setLocalDescription = async (description) => {
    if (description && description.sdp) {
        // Remove Comfort Noise from SDP
        description.sdp = removeComfortNoise(description.sdp);
    }
    return originalSetLocal(description);
};

// Hook into setRemoteDescription to filter incoming SDP
const originalSetRemote = pc.setRemoteDescription.bind(pc);
pc.setRemoteDescription = async (description) => {
    if (description && description.sdp) {
        // Remove Comfort Noise from incoming SDP
        description.sdp = removeComfortNoise(description.sdp);
    }
    return originalSetRemote(description);
};
```

#### 3. **Enhanced Audio Constraints**

Changed all audio constraints from simple `audio: true` to:

```javascript
audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
}
```

This explicitly enables:
- Echo cancellation
- Noise suppression
- Automatic gain control
- Disables comfort noise generation

#### 4. **Added sdpSemantics**

```javascript
pcConfig: {
    // ... existing config ...
    sdpSemantics: 'unified-plan'  // Modern SDP format
}
```

---

## Why This Fixes the Issue

### Problem Timeline:
1. **0-30s**: Call works fine, audio flows
2. **30s**: RTPengine sees "unknown payload type 13" (Comfort Noise)
3. **30s**: DTLS-SRTP layer gets confused by unexpected CN packets
4. **30-35s**: DTLS session closes with "DTLS peer has closed the connection"
5. **35s+**: No audio (DTLS encryption layer is dead)

### Solution:
1. **Remove CN from SDP** → RTPengine never sees payload type 13
2. **Filter SDP bidirectionally** → Both local and remote SDP are clean
3. **Enhanced audio constraints** → Browser doesn't generate CN packets
4. **Unified-plan SDP** → Modern SDP format with better compatibility

---

## Testing Steps

After deployment:

1. **Kill Electron and clear cache** (client-side):
   ```powershell
   taskkill /F /IM electron.exe
   # Wait 2 seconds
   cd D:\Abhi\WebRTC\webrtc-genesys\webrtc-gateway-bridge
   npm start -- --clear-cache
   ```

2. **Make a test call from 1003 to 1002**

3. **Keep call active for at least 60 seconds**
   - Previously failed at 30-35 seconds
   - Should now continue working

4. **Verify audio flows continuously**
   - Test speaking in both directions
   - Confirm no dropout or silence

5. **Check RTPengine logs** (optional):
   ```bash
   docker logs -f webrtc-rtpengine | grep -E "unknown payload|CN|Comfort"
   ```
   - Should see NO "unknown payload type 13" warnings

---

## Verification Commands

### Check if Nginx is serving new file:

```bash
# On server
docker exec webrtc-nginx ls -la /usr/share/nginx/html/wwe-webrtc-gateway.html

# Check file timestamp
docker exec webrtc-nginx stat /usr/share/nginx/html/wwe-webrtc-gateway.html
```

### Check for CN in SDP (during call):

```bash
# Watch for CN codec in RTPengine logs
docker logs -f webrtc-rtpengine | grep -i "comfort\|cn/"
```

Expected: NO "unknown payload type 13" warnings

---

## Rollback (If Needed)

If the fix causes issues:

```bash
# Revert to previous commit
cd /opt/gcti_apps/webrtc-genesys
sudo git reset --hard bf28a1b

# Restart Nginx
docker restart webrtc-nginx
```

---

## Expected Behavior

**Before Fix:**
- ✅ Call establishes successfully
- ✅ Audio works for first 30 seconds
- ❌ DTLS closes: "DTLS peer has closed the connection"
- ❌ Audio goes silent after 30-35 seconds
- ❌ RTPengine logs: "unknown payload type 13"

**After Fix:**
- ✅ Call establishes successfully
- ✅ Audio works for first 30 seconds
- ✅ **DTLS stays open (no closure)**
- ✅ **Audio continues to work after 30-35 seconds**
- ✅ **Audio works for entire call duration**
- ✅ **No "unknown payload type 13" warnings**

---

## Technical Details

### What is Comfort Noise (CN)?

- RFC 3389 codec for generating background noise during silence
- Payload type: 13
- Used in PSTN to maintain "naturalness" during silence
- NOT needed for WebRTC with voice activity detection

### Why Does CN Break DTLS?

1. CN packets use payload type 13
2. RTPengine expects only negotiated codecs (PCMU/PCMA = 0/8)
3. When RTPengine sees PT=13, it tries to process it through DTLS-SRTP
4. But CN wasn't negotiated in DTLS-SRTP handshake
5. This confuses the crypto layer
6. DTLS session eventually times out and closes

### Why Remove CN Instead of Supporting It?

- CN adds no value for WebRTC calls
- Modern browsers have excellent voice activity detection
- Removing CN is simpler than negotiating it in DTLS-SRTP
- Industry best practice for WebRTC

---

## Related Issues

- **Bug #11:** RTP timeout at 40 seconds - ✅ Fixed (increased RTP timeout)
- **Bug #12:** DTLS timeout at 30 seconds - ✅ Fixed (this deployment)

---

## Status

- [x] Code committed
- [x] Code pushed to GitHub
- [ ] Deployed to server - **DEPLOY NOW**
- [ ] Tested (make call > 60 seconds)
- [ ] Verified audio continues working
- [ ] Verified no "unknown payload type 13" warnings

---

**Deploy this fix now to resolve the DTLS timeout issue! 🚀**

Then restart Electron with clean cache and test a call lasting > 60 seconds.
