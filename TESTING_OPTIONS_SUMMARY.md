# Testing Options Summary - WWE Integration (Copy-Paste Disabled)

Since copy-paste is disabled in your environment, here are **4 different ways** to test the WWE + webrtc-gateway-bridge integration:

## Option 1: Chrome Extension (Recommended) ⭐

**Best for**: Easy point-and-click testing

### Setup:
1. Load extension from: `webrtc-gateway-bridge/chrome-extension/`
2. Chrome → `chrome://extensions/` → Enable Developer Mode → Load unpacked
3. Select the `chrome-extension` folder

### Usage:
1. Login to WWE
2. Click extension icon
3. Enter DN
4. Click "Register DN"
5. Done! ✅

**Pros**: 
- ✅ No typing needed
- ✅ Visual interface
- ✅ Shows status

**See**: `chrome-extension/README.md` for full instructions

---

## Option 2: Postman API Testing

**Best for**: API testing and debugging

### Setup:
1. Download Postman: https://www.postman.com/downloads/
2. Install and open

### Get Session ID:
1. In WWE, press F12
2. Application tab → Cookies → Find WORKSPACE-SESSIONID
3. Right-click value → Copy

### Register DN:
1. New POST request
2. URL: `https://127.0.0.1:8000/RegisterDn`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "users": ["1000"],
  "addresses": ["1000"],
  "workspaceSessionId": "PASTE_SESSION_ID_HERE"
}
```
5. Click Send

**Pros**:
- ✅ Professional tool
- ✅ Save requests
- ✅ Good for debugging

**See**: `MANUAL_TESTING_STEPS.md` for details

---

## Option 3: PowerShell Script

**Best for**: Windows command-line users

### Get Session ID:
Manual steps in `MANUAL_TESTING_STEPS.md`

### Run Script:
```powershell
$sessionId = "YOUR_SESSION_ID_HERE"
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

**Pros**:
- ✅ Scriptable
- ✅ Can automate
- ✅ Built into Windows

---

## Option 4: Bookmarklet (Drag-and-Drop)

**Best for**: Quick testing without extensions

### Setup:
1. Open `webrtc-gateway-bridge/test-integration.html` in browser
2. Drag the blue button to bookmarks bar

### Usage:
1. Login to WWE
2. Click the bookmark
3. Enter DN when prompted
4. Done! ✅

**Pros**:
- ✅ No extension needed
- ✅ Works in any browser
- ✅ One-click after setup

**Note**: Bookmarks bar must be visible (Ctrl+Shift+B)

---

## Comparison Table

| Method | Difficulty | Features | Best For |
|--------|-----------|----------|----------|
| Chrome Extension | ⭐ Easy | Full UI, Status checks | Most users |
| Postman | ⭐⭐ Medium | Advanced testing, Saves requests | Developers |
| PowerShell | ⭐⭐ Medium | Scriptable, Automated | IT/DevOps |
| Bookmarklet | ⭐ Easy | Quick, No install | Quick tests |

---

## Quick Decision Guide

**Choose Chrome Extension if**:
- ✅ You use Chrome
- ✅ You want an easy GUI
- ✅ You'll test frequently

**Choose Postman if**:
- ✅ You're a developer
- ✅ You need to debug API calls
- ✅ You want to save test configurations

**Choose PowerShell if**:
- ✅ You're comfortable with command line
- ✅ You want to script/automate
- ✅ You need to test multiple DNs

**Choose Bookmarklet if**:
- ✅ You can't install extensions
- ✅ You need a quick one-time test
- ✅ You want the simplest option

---

## All Files Created

```
webrtc-gateway-bridge/
├── src/
│   ├── workspace-client.js          ← NEW: Workspace API client
│   └── main.js                       ← MODIFIED: Integration code
├── chrome-extension/                 ← NEW: Chrome extension
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   ├── content.js
│   └── README.md
├── test-integration.html             ← NEW: Bookmarklet page
├── test-integration.js               ← NEW: Console script (reference)
└── MANUAL_TESTING_STEPS.md           ← NEW: Manual steps guide

Documentation/
├── WORKSPACE_API_INTEGRATION_GUIDE.md    ← Complete guide
├── WORKSPACE_INTEGRATION_SUMMARY.md      ← Implementation summary
├── ANSWER_TIMEOUT_ISSUE.md               ← Root cause analysis
├── CORRECTED_AUTO_ANSWER_ANALYSIS.md     ← Auto-answer analysis
└── TESTING_OPTIONS_SUMMARY.md            ← This file
```

---

## Common Steps (All Methods)

### 1. Start webrtc-gateway-bridge
```bash
cd webrtc-gateway-bridge
npm install ws  # First time only
npm start
```

### 2. Accept Self-Signed Certificate
- Visit: `https://127.0.0.1:8000/Ping`
- Click: Advanced → Proceed

### 3. Login to WWE
- Visit: `http://192.168.210.54:8090`
- Login with your credentials

### 4. Use One of the 4 Methods Above

### 5. Verify Registration
- Browser: `https://127.0.0.1:8000/GetStatus`
- Should show: `"registered": true, "dn": "1000"`

### 6. Test Call
- Call from another DN (e.g., 1003)
- Click Accept in WWE
- ✅ Call should connect within 2 seconds!

---

## Expected Logs (Success)

In webrtc-gateway-bridge console:
```
[Workspace] Connecting to Workspace API...
[Workspace] ✅ Connected to Workspace API
[Workspace] 📞 Call ringing: UIVB8J6...
[Workspace] 🎯 Call answered in WWE: UIVB8J6...
[Workspace] ✅ Answer command sent to WebRTC gateway
```

---

## Need Help?

1. **Extension issues**: See `chrome-extension/README.md`
2. **Manual steps**: See `MANUAL_TESTING_STEPS.md`
3. **Complete guide**: See `WORKSPACE_API_INTEGRATION_GUIDE.md`
4. **Architecture**: See `WORKSPACE_INTEGRATION_SUMMARY.md`
5. **Root cause**: See `ANSWER_TIMEOUT_ISSUE.md`

---

## Quick Links

- Chrome extensions: `chrome://extensions/`
- Bridge ping: `https://127.0.0.1:8000/Ping`
- Bridge status: `https://127.0.0.1:8000/GetStatus`
- WWE login: `http://192.168.210.54:8090`

---

## Support Checklist

If something doesn't work:

- [ ] webrtc-gateway-bridge is running
- [ ] Visited https://127.0.0.1:8000/Ping and accepted certificate
- [ ] Logged into WWE at http://192.168.210.54:8090
- [ ] Got correct Workspace session ID
- [ ] DN is valid (e.g., 1000-5020)
- [ ] Registration returned success
- [ ] Workspace connection established (check logs)

---

**Ready to test!** Choose your preferred method above and follow the steps. 🚀
