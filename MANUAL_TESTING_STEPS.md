# Manual Testing Steps (No Copy-Paste Required)

## Step 1: Get Workspace Session ID

### Method A: Using Browser Developer Tools (F12)

1. In WWE, press **F12** to open Developer Tools
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Click **Cookies** on the left
4. Find **WORKSPACE-SESSIONID**
5. Click the value and it will be highlighted
6. **Right-click → Copy** (this usually works even when paste is disabled)

### Method B: Using Network Tab

1. In WWE, press **F12**
2. Go to **Network** tab
3. Make any action in WWE (click something)
4. Click on any request
5. Look at **Request Headers**
6. Find **Cookie:** header
7. Look for `WORKSPACE-SESSIONID=...` value

## Step 2: Register DN Using Postman/curl

### Using Postman:

1. Open Postman (or download from postman.com)
2. Create new POST request
3. URL: `https://127.0.0.1:8000/RegisterDn`
4. Headers:
   - Key: `Content-Type`, Value: `application/json`
5. Body (select "raw" and "JSON"):
```json
{
  "users": ["1000"],
  "addresses": ["1000"],
  "workspaceSessionId": "PASTE_SESSION_ID_HERE"
}
```
6. Click **Send**

### Using curl (Windows PowerShell):

```powershell
$sessionId = "PASTE_SESSION_ID_HERE"
$dn = "1000"

$body = @{
    users = @($dn)
    addresses = @($dn)
    workspaceSessionId = $sessionId
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://127.0.0.1:8000/RegisterDn" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -SkipCertificateCheck
```

### Using curl (Linux/Mac or Git Bash):

```bash
SESSION_ID="PASTE_SESSION_ID_HERE"
DN="1000"

curl -k -X POST https://127.0.0.1:8000/RegisterDn \
  -H "Content-Type: application/json" \
  -d "{\"users\":[\"$DN\"],\"addresses\":[\"$DN\"],\"workspaceSessionId\":\"$SESSION_ID\"}"
```

## Step 3: Verify Registration

Open in browser: `https://127.0.0.1:8000/GetStatus`

Should see:
```json
{
  "registered": true,
  "dn": "1000",
  ...
}
```

## Step 4: Make Test Call

1. From another DN (e.g., 1003), call your DN (1000)
2. Call should ring in browser
3. Accept button should appear in WWE
4. Click Accept
5. ✅ Call should connect within 2 seconds!

## Troubleshooting

### Can't access localhost:8000

**Windows**: Add exception for self-signed certificate

1. In browser, go to: `https://127.0.0.1:8000/Ping`
2. Click **Advanced**
3. Click **Proceed to 127.0.0.1 (unsafe)**
4. Now the API is accessible

### Session ID not found

Make sure you're logged into WWE at `http://192.168.210.54:8090`

### Registration fails

1. Check webrtc-gateway-bridge is running:
```bash
cd webrtc-gateway-bridge
npm start
```

2. Check logs in console for errors

### Call doesn't answer

Check webrtc-gateway-bridge console for these logs:
```
[Workspace] ✅ Connected to Workspace API
[Workspace] 📞 Call ringing: ...
[Workspace] 🎯 Call answered in WWE: ...
[Workspace] ✅ Answer command sent
```

If you see "Connected" but no "Call ringing", the Workspace connection might be using wrong session ID.

## Alternative: Using Browser URL Bar

You can also test with GET requests in the URL bar:

1. **Check Status**: 
   ```
   https://127.0.0.1:8000/GetStatus
   ```

2. **Ping Test**:
   ```
   https://127.0.0.1:8000/Ping
   ```

3. **Get DN**:
   ```
   https://127.0.0.1:8000/GetDn
   ```

For POST requests like RegisterDn, you'll need Postman or curl.
