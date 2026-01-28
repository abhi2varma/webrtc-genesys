# Environment Configuration

## Workspace API URL Configuration

The webrtc-gateway-bridge can connect to Workspace API using different URLs depending on your setup.

### Default URLs:
- **Local IP**: `ws://192.168.210.54:8090` (internal network)
- **Public IP**: `ws://103.167.180.166:8443` (external access)

### Option 1: Set Environment Variable

**Windows PowerShell**:
```powershell
$env:WORKSPACE_URL = "ws://103.167.180.166:8443"
cd webrtc-gateway-bridge
npm start
```

**Linux/Mac**:
```bash
export WORKSPACE_URL="ws://103.167.180.166:8443"
cd webrtc-gateway-bridge
npm start
```

### Option 2: Specify in API Call

When calling RegisterDn or InitWorkspace, include the workspaceUrl:

**Using Extension** (auto-detects from current page)

**Using Postman**:
```json
{
  "users": ["1000"],
  "addresses": ["1000"],
  "workspaceSessionId": "your-session-id",
  "workspaceUrl": "ws://103.167.180.166:8443"
}
```

**Using PowerShell**:
```powershell
$body = @{
    users = @("1000")
    addresses = @("1000")
    workspaceSessionId = "your-session-id"
    workspaceUrl = "ws://103.167.180.166:8443"
} | ConvertTo-Json
```

### Option 3: Auto-Detection (Chrome Extension)

The Chrome extension automatically detects which URL you're using:
- If on `103.167.180.166:8443` → Uses public IP WebSocket
- If on `192.168.210.54:8090` → Uses local IP WebSocket

### Supported URLs:

#### Local Network:
- `ws://192.168.210.54:8090` (HTTP)
- `wss://192.168.210.54:8090` (HTTPS)

#### Public Access:
- `ws://103.167.180.166:8443` (HTTP)
- `wss://103.167.180.166:8443` (HTTPS)

### URL Format:

```
ws://HOST:PORT     - WebSocket (unencrypted)
wss://HOST:PORT    - WebSocket Secure (encrypted)
```

**Note**: WWE typically uses HTTP/WS, not HTTPS/WSS for Workspace API.

### Testing Connection:

Check which URL to use:
```bash
# Test local
curl http://192.168.210.54:8090/api/v2/status

# Test public
curl http://103.167.180.166:8443/api/v2/status
```

Use whichever responds successfully.

### Troubleshooting:

**Connection fails with "ECONNREFUSED"**:
- Wrong URL or port
- Workspace API not running
- Firewall blocking connection

**Connection fails with "Invalid session"**:
- Session ID expired
- Wrong cookie (use JSESSIONID for public IP)
- Need to re-login to WWE

**Extension can't find session**:
- Make sure you're on the WWE page
- Cookie might be JSESSIONID instead of WORKSPACE-SESSIONID
- Check DevTools → Application → Cookies

### Public IP Configuration:

For external access (103.167.180.166):
1. WWE must be accessible at: `https://103.167.180.166:8443`
2. Workspace API typically on same host/port
3. WebSocket upgrade must be supported by proxy/server
4. Session cookies must be shared between HTTP and WS connections

### Network Flow:

```
Chrome Extension → Detects current WWE URL
                ↓
     Gets session cookie (JSESSIONID)
                ↓
     Sends to webrtc-gateway-bridge
                ↓
     Bridge connects to Workspace API WebSocket
                ↓
     Uses same HOST as WWE page
```

### Best Practice:

Let the extension auto-detect the URL based on where WWE is loaded. The extension will:
1. Check current page URL
2. Extract host:port
3. Use matching WebSocket URL
4. Find correct session cookie

This ensures configuration-free operation! ✅
