# Public IP Support for Workspace API Integration

## Overview

The Workspace API integration now supports **both local and public IP addresses** for accessing Genesys Workspace Web Edition (WWE).

## Supported URLs

### Local Access
- **WWE URL**: `http://192.168.210.54:8090`
- **Workspace API**: `ws://192.168.210.54:8090/api/v2/me/calls`
- **Cookie Domain**: `http://192.168.210.54:8090`

### Public Access
- **WWE URL**: `https://103.167.180.166:8443`
- **Workspace API**: `wss://103.167.180.166:8443/api/v2/me/calls`
- **Cookie Domain**: `https://103.167.180.166:8443`

## How It Works

### 1. Chrome Extension Auto-Detection

The Chrome extension (`popup.js`) automatically detects which URL you're using:

```javascript
async function getSessionId() {
  // Tries both URLs
  const urlsToCheck = [
    'https://103.167.180.166:8443',  // Public IP
    'http://192.168.210.54:8090'     // Local IP
  ];
  
  // Tries both cookie names
  const cookieNames = ['JSESSIONID', 'WORKSPACE-SESSIONID'];
  
  // Returns session ID from whichever URL/cookie combination works
}
```

### 2. Bridge Server URL Mapping

The `webrtc-gateway-bridge` (`main.js`) maps request origins to Workspace API URLs:

```javascript
app.post('/InitWorkspace', async (req, res) => {
  const origin = req.headers.origin || req.headers.referer;
  
  // Auto-detect Workspace API URL based on origin
  let workspaceApiUrl = workspaceSessionId 
    ? 'http://192.168.210.54:8090'  // Default
    : 'http://192.168.210.54:8090';
  
  if (origin && origin.includes('103.167.180.166')) {
    workspaceApiUrl = 'https://103.167.180.166:8443';
  }
  
  // Initialize WorkspaceClient with detected URL
  workspaceClient.init(workspaceSessionId, workspaceApiUrl);
});
```

## Usage

### For End Users

**No configuration needed!** The extension automatically:

1. Detects which WWE URL you're logged into
2. Retrieves the correct session cookie
3. Connects to the matching Workspace API URL

### Testing Both URLs

1. **Test with Local IP**:
   ```
   1. Open: http://192.168.210.54:8090
   2. Login to WWE
   3. Use Chrome extension to register DN
   ```

2. **Test with Public IP**:
   ```
   1. Open: https://103.167.180.166:8443
   2. Login to WWE
   3. Use Chrome extension to register DN
   ```

## Technical Details

### Session Cookie

- **Cookie Name**: `JSESSIONID` (primary) or `WORKSPACE-SESSIONID` (fallback)
- **Domain**: Matches the WWE URL domain
- **Secure**: Yes for HTTPS (public IP), No for HTTP (local IP)

### WebSocket Connections

- **Local**: `ws://` (unencrypted)
- **Public**: `wss://` (encrypted)

Both are supported by the `ws` npm package in `workspace-client.js`.

### CORS Configuration

The `webrtc-gateway-bridge` allows both origins:

```javascript
const allowedOrigins = [
  'http://192.168.210.54:8090',
  'https://103.167.180.166:8443'
];
```

## Benefits

1. **Flexibility**: Works from internal network or internet
2. **No Manual Config**: Automatic URL detection
3. **Secure**: Uses HTTPS/WSS for public access
4. **Seamless**: Same user experience for both URLs

## Files Modified

1. **`webrtc-gateway-bridge/chrome-extension/popup.js`**
   - Added `getSessionId()` helper that checks both URLs
   - Added initial WWE session detection on popup load
   - Auto-detects Workspace API URL from current tab

2. **`webrtc-gateway-bridge/chrome-extension/manifest.json`**
   - Added `https://103.167.180.166:8443/*` to `host_permissions`

3. **`webrtc-gateway-bridge/src/main.js`**
   - Added origin-based Workspace API URL detection
   - Updated CORS to allow public IP origin

4. **`webrtc-gateway-bridge/chrome-extension/README.md`**
   - Updated usage instructions for both URLs
   - Added troubleshooting for session detection

## Troubleshooting

### Extension shows "Please login to WWE first"

**Solution**: 
1. Make sure you have an active WWE tab open
2. Ensure you're logged in (see your agent status in WWE)
3. Try reloading the extension: `chrome://extensions/` → Reload

### Wrong Workspace API URL detected

**Solution**:
The URL is auto-detected from your current tab. Make sure:
1. Your active tab is the WWE page
2. The WWE URL matches one of the supported URLs

### Session cookie not found

**Possible causes**:
1. Not logged into WWE
2. Session expired
3. Using a different browser/profile

**Solution**: Re-login to WWE in the same browser profile

## Future Enhancements

Potential improvements:
1. Support for custom Workspace API URLs via config
2. Multi-tenant support (multiple Genesys servers)
3. Session refresh/reauth logic
4. Health check for Workspace API connectivity
