# Deployment Verification Checklist

## 🎯 CentOS Deployment - Post-Deployment Testing

---

## 1. Verify Files on CentOS Server

SSH to the server and check:

```bash
ssh -p 69 Gencct@192.168.210.54

# Check project directory
cd /opt/gcti_apps/webrtc-genesys

# Verify CometD libraries exist
ls -la nginx/html/lib/
# Should show:
# - cometd.js
# - jquery.cometd.js
# - README.md

# Check file sizes
du -h nginx/html/lib/cometd.js
# Should be ~100K+

# Verify updated files
ls -la nginx/html/app.js nginx/html/index.html
```

---

## 2. Restart Nginx Container

```bash
cd /opt/gcti_apps/webrtc-genesys

# Restart Nginx to load new files
docker-compose restart nginx

# Check Nginx status
docker-compose ps nginx

# Check Nginx logs
docker logs webrtc-nginx --tail 50
```

**Expected output:**
```
webrtc-nginx is up (healthy)
```

---

## 3. Test WebRTC Client Access

### From Browser on Your Windows Machine

Open: **http://192.168.210.54**

**Expected:**
- ✅ Page loads
- ✅ No JavaScript errors in console (F12)
- ✅ CometD library loads (check Sources tab)

---

## 4. Test CometD Library Loading

Open browser console (F12) and type:

```javascript
typeof org
```

**Expected output:**
```javascript
"object"
```

```javascript
typeof org.cometd
```

**Expected output:**
```javascript
"object"
```

```javascript
typeof org.cometd.CometD
```

**Expected output:**
```javascript
"function"
```

If any return `"undefined"`, the CometD library didn't load!

---

## 5. Test SIP Connection

### Connect to Asterisk

**Settings:**
```
SIP Server: ws://192.168.210.54:8088/ws
Username: 5001
Password: 5001
```

Click **"Connect"**

**Expected console output:**
```
WebSocket connected
Successfully registered
Status: Connected
```

---

## 6. Test GWS CometD Connection

### Connect to GWS

**Settings:**
```
GWS URL: http://192.168.210.54:8090
Username: (leave blank or use GWS username)
Password: (leave blank or use GWS password)
```

Click **"Connect GWS"**

**Expected console output:**
```
Initializing CometD connection...
Using Basic Auth for user: xxx (if credentials provided)
Connecting to http://192.168.210.54:8090/genesys/cometd...
✅ GWS CometD connected! ClientID: <some-id>
CometD connection established
✅ Subscribed to /v2/me/calls
✅ Subscribed to /v2/me/state
✅ Subscribed to /v2/me/interactions
```

---

## 7. Troubleshooting

### Issue 1: CometD Library Not Found (404)

**Error in console:**
```
GET http://192.168.210.54/lib/cometd.js 404 (Not Found)
```

**Fix:**
```bash
# On CentOS server
cd /opt/gcti_apps/webrtc-genesys
ls -la nginx/html/lib/

# If files missing, copy from gws folder or re-pull from git
git pull origin main

# Restart Nginx
docker-compose restart nginx
```

---

### Issue 2: "CometD library not loaded"

**Error in console:**
```
CometD library not loaded
```

**Fix:**
Check browser console (F12 → Console):
```javascript
console.log(typeof org);  // Should be "object"
```

If "undefined", check:
1. `lib/cometd.js` exists on server
2. No 404 error in Network tab
3. Script loads before `app.js`

---

### Issue 3: CometD Handshake Failed

**Error in console:**
```
❌ GWS CometD handshake failed: Unknown error
```

**Common Causes:**

#### A. GWS Not Running

```bash
# Check if GWS is accessible
curl -I http://192.168.210.54:8090/ui/ad/v1/index.html

# Should return: HTTP/1.1 200 OK
```

If not accessible:
- GWS might be down
- Port 8090 not open
- Check GWS server: `192.168.210.54` vs `192.168.18.109`

#### B. Wrong CometD Path

**Check URL in browser console:**
```
Connecting to http://192.168.210.54:8090/genesys/cometd...
```

Must be `/genesys/cometd` (not `/cometd`)

#### C. CORS Error

**Error in console:**
```
Access to fetch at 'http://192.168.210.54:8090/genesys/cometd' 
from origin 'http://192.168.210.54' has been blocked by CORS policy
```

**Fix:** Update GWS `application.yaml`:
```yaml
crossOriginSettings:
  allowedOrigins: http://192.168.210.54
  allowCredentials: true
```

#### D. Authentication Required

**Error:**
```
403 Forbidden
```

**Options:**

**1. Login to GWS First:**
```
1. Open: http://192.168.210.54:8090/ui/ad/v1/index.html
2. Login with agent credentials
3. Then connect CometD (will use session cookie)
```

**2. Or Provide Credentials:**
```
GWS Username: your-agent-username
GWS Password: your-agent-password
```

---

### Issue 4: Subscriptions Fail

**Error in console:**
```
❌ Failed to subscribe to /v2/me/calls
```

**Cause:** Not authenticated or no active agent session

**Fix:**
1. Login to GWS first
2. Ensure agent is logged into Genesys
3. Check DN is configured

---

### Issue 5: No Events Received

**Subscriptions show successful but no events:**

**Check:**
```bash
# On CentOS, check Asterisk logs
docker logs -f webrtc-asterisk | grep 5001

# Should show registration
```

**Possible issues:**
1. Agent not logged into Genesys
2. DN 5001 not mapped to agent
3. T-Server not connected to GWS
4. Wrong channel names

---

## 8. Test Call Flow with CometD

### Complete Flow Test

**1. Open Two Browser Tabs:**
- Tab 1: WebRTC Client (`http://192.168.210.54`)
- Tab 2: GWS Agent Desktop (`http://192.168.210.54:8090/ui/ad/v1/index.html`)

**2. In WebRTC Client (Tab 1):**
```
✅ Connect SIP (5001)
✅ Connect GWS
```

**3. In GWS (Tab 2):**
```
✅ Login as agent
✅ Go Ready
```

**4. Make a Test Call:**

From another phone/DN, call **5001**

**Expected in WebRTC Client Console:**
```
📞 Call event received
Call event data: {...}
📞 Call State: Ringing | From: <caller> | To: 5001
```

**Expected in WebRTC Client UI:**
```
Call Status: "Incoming call from <caller>"
```

**5. Answer the Call:**

Click "Answer" in WebRTC client

**Expected in Console:**
```
📞 Call State: Established | From: <caller> | To: 5001
Call Status: "Call connected: <caller> ↔ 5001"
```

**6. End the Call:**

Hang up from GWS or other side

**Expected in Console:**
```
📞 Call State: Released
Call ended by Genesys
Auto-hanging up WebRTC session
Call terminated
```

---

## 9. Monitor CometD Connection

### Watch for Long-Polling Activity

**Browser Network Tab (F12 → Network):**

You should see:
```
POST /genesys/cometd    (Pending...)
```

This is the **long-polling connection** - it stays open for up to 60 seconds waiting for events.

When an event occurs:
1. Connection completes with response
2. New connection immediately opens
3. Repeat

**Normal pattern:**
```
POST /genesys/cometd  [completed 200]  (1 event received)
POST /genesys/cometd  [pending...]     (waiting for next event)
```

---

## 10. Verify Asterisk Connection

### Check Asterisk Sees DN Registration

```bash
# On CentOS server
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoints"

# Should show 5001 as online
```

**Expected:**
```
Endpoint:  5001                                          
...
DeviceState: Not in use
Status: Available
```

---

## 11. Check Docker Containers

```bash
# All containers should be running
docker-compose ps

# Check resource usage
docker stats --no-stream

# Check Nginx specifically
docker logs webrtc-nginx --tail 20
```

---

## 12. Performance Check

### Check Browser Performance

**F12 → Performance tab:**
- Page load time should be < 3 seconds
- No memory leaks
- CometD reconnections are minimal

### Check Server Load

```bash
# On CentOS
top

# Check CPU/Memory usage of Docker containers
docker stats
```

---

## ✅ Success Criteria

All these should work:

- [ ] WebRTC client loads at `http://192.168.210.54`
- [ ] CometD library loads (no 404 errors)
- [ ] `typeof org.cometd.CometD === "function"`
- [ ] SIP connects successfully
- [ ] GWS CometD handshake succeeds
- [ ] Subscribed to 3 channels successfully
- [ ] Test call generates CometD events
- [ ] Console shows call state changes
- [ ] Auto-hangup works when Genesys ends call
- [ ] No JavaScript errors in console
- [ ] Long-polling connections visible in Network tab

---

## 🐛 If Something Fails

### Quick Debug Commands

```bash
# 1. Check files exist
ls -la /opt/gcti_apps/webrtc-genesys/nginx/html/lib/

# 2. Check Nginx container
docker logs webrtc-nginx --tail 50

# 3. Test file access
curl -I http://192.168.210.54/lib/cometd.js
# Should return: 200 OK

# 4. Check GWS accessibility
curl -I http://192.168.210.54:8090/genesys/cometd
# Should return: 405 Method Not Allowed (POST required)

# 5. Restart all services
docker-compose restart

# 6. Check Asterisk status
docker exec -it webrtc-asterisk asterisk -rx "core show version"
```

---

## 📊 Next Steps After Verification

Once everything is working:

1. **Test with Multiple Agents:**
   - Connect with DN 5002, 5003, etc.
   - Test simultaneous calls

2. **Test Advanced Features:**
   - Hold/Resume from GWS
   - Transfer from GWS
   - Conference calls

3. **Monitor for 24 Hours:**
   - Check for connection drops
   - Monitor memory leaks
   - Check Asterisk stability

4. **Production Readiness:**
   - Enable SSL/HTTPS
   - Configure CSRF protection
   - Restrict CORS origins
   - Set up monitoring/alerts

---

## 📞 Support

If issues persist, collect:
1. Browser console logs (F12 → Console)
2. Network tab screenshots (F12 → Network)
3. Docker logs: `docker logs webrtc-nginx`
4. Asterisk logs: `docker logs webrtc-asterisk`

---

**Document created:** DEPLOYMENT_VERIFICATION.md
**Status:** Ready for testing! 🚀

