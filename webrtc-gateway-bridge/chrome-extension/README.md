# Chrome Extension Installation Guide

## Overview
This Chrome extension helps test the WWE + webrtc-gateway-bridge integration without needing to copy-paste code into the browser console.

## Installation Steps

### 1. Prepare the Extension

The extension files are already created in:
```
webrtc-gateway-bridge/chrome-extension/
├── manifest.json
├── popup.html
├── popup.js
└── content.js
```

### 2. Create Extension Icons (Optional)

Create simple PNG icons or use these sizes:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

Or create a simple icon online at: https://www.favicon-generator.org/

Place the icons in the `chrome-extension` folder.

**Quick fix**: If you don't want to create icons, remove the `default_icon` section from `manifest.json`:

```json
  "action": {
    "default_popup": "popup.html"
  },
```

### 3. Load Extension in Chrome

1. Open Chrome
2. Go to: `chrome://extensions/`
3. Enable "**Developer mode**" (toggle in top right)
4. Click "**Load unpacked**"
5. Navigate to: `D:\Abhi\WebRTC\webrtc-genesys\webrtc-gateway-bridge\chrome-extension`
6. Click "**Select Folder**"

✅ Extension is now installed!

### 4. Using the Extension

#### Step 1: Start webrtc-gateway-bridge

```bash
cd D:\Abhi\WebRTC\webrtc-genesys\webrtc-gateway-bridge
npm start
```

#### Step 2: Login to WWE

Open WWE in any browser tab (works with both local and public IP):
- Local: `http://192.168.210.54:8090`
- Public: `https://103.167.180.166:8443`

Login with your credentials.

#### Step 3: Use Extension

1. Click the extension icon in Chrome toolbar (puzzle piece icon → WWE Integration Helper)
   
   You should see:
   - ✅ Bridge is running
   - ✅ WWE session detected
   
   ⚠️ If you see "Please login to WWE first", make sure you have an active WWE tab open and you're logged in.

2. Enter your DN in the "DN (Extension)" field (e.g., 1000)

3. Click "Register DN with Workspace"
   - The extension will auto-detect which WWE URL you're using
   - It will automatically register with the correct Workspace API
   - You should see: "✅ Successfully registered DN 1000!"

4. Make a test call to your DN from another extension

5. Click "Accept" in WWE when the call arrives
   - The call should now be answered properly!
   - The SIP 200 OK will be sent automatically

## Extension Features

### Register DN Button
- Automatically gets Workspace session ID from WWE cookies
- Sends registration request to webrtc-gateway-bridge
- No copy-paste needed!

### Check Status Button
- Shows current registration status
- Displays DN and call state

### Show Session ID Button
- Displays the Workspace session ID
- Useful for debugging

## Troubleshooting

### Extension not showing

1. Make sure Developer mode is enabled
2. Check chrome://extensions/ for any errors
3. Try reloading the extension (circular arrow icon)

### "Cannot reach bridge" error

1. Make sure webrtc-gateway-bridge is running
2. Visit `https://127.0.0.1:8000/Ping` in browser
3. Accept the self-signed certificate

### "Not logged in to WWE" error

1. Make sure you're logged into WWE
2. Try refreshing the WWE page
3. Check cookies in DevTools (F12 → Application → Cookies)

### Icons missing error

Either:
- Add simple PNG icons (16x16, 48x48, 128x128)
- Or remove the `default_icon` section from manifest.json

## Alternative: Use Without Installing

If you can't install extensions, use these alternatives:

### Option 1: Bookmarklet
Open `test-integration.html` in browser and drag the bookmark to your bookmarks bar

### Option 2: Postman
Use Postman to send API requests (see MANUAL_TESTING_STEPS.md)

### Option 3: curl
Use curl commands from PowerShell (see MANUAL_TESTING_STEPS.md)

## Updating the Extension

After making changes:

1. Go to `chrome://extensions/`
2. Find "WWE Integration Helper"
3. Click the reload icon (circular arrow)
4. Changes will take effect immediately

## Removing the Extension

1. Go to `chrome://extensions/`
2. Find "WWE Integration Helper"
3. Click "**Remove**"

## Security Note

The extension requests these permissions:
- **cookies**: To read WORKSPACE-SESSIONID
- **activeTab**: To inject content script
- **host_permissions**: To communicate with WWE and bridge

All data stays local - nothing is sent to external servers.

## Files Overview

```
chrome-extension/
├── manifest.json      # Extension configuration
├── popup.html         # UI for the extension popup
├── popup.js           # Logic for popup interactions
├── content.js         # Script injected into WWE pages
├── icon16.png         # Small icon (optional)
├── icon48.png         # Medium icon (optional)
└── icon128.png        # Large icon (optional)
```

## Support

If you encounter issues:
1. Check browser console (F12) for errors
2. Check extension console (chrome://extensions/ → Details → Inspect views: popup)
3. Verify webrtc-gateway-bridge is running and accessible
4. Check WWE is accessible and you're logged in
