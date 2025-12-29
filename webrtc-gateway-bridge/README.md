# WebRTC Gateway Bridge

Local Windows service that bridges Genesys WWE with WebRTC Gateway.

## Installation

### For End Users

1. Download `WebRTC-Gateway-Bridge-Setup.exe`
2. Run installer (requires Administrator rights)
3. The service will start automatically
4. WWE will detect the WebRTC endpoint

### For Developers

```bash
# Install dependencies
cd webrtc-gateway-bridge
npm install

# Run in development mode
npm run dev

# Build installer
npm run build:win
```

## Configuration

Configuration is stored in:
```
%APPDATA%\webrtc-gateway-bridge\config.json
```

Default configuration:
```json
{
  "gatewayUrl": "https://192.168.210.54:8443",
  "iframeUrl": "https://192.168.210.54:8443/wwe-webrtc-gateway.html",
  "sipServer": "wss://192.168.210.54:8443/ws"
}
```

## Usage

### System Tray

Right-click the system tray icon for options:
- Open Dashboard
- Show Window
- Settings
- View Logs
- Quit

### Dashboard

Access the dashboard at:
```
https://127.0.0.1:8000/dashboard
```

## API Endpoints

The bridge exposes WWE-compatible REST APIs:

- `POST /RegisterDn` - Register agent DN
- `POST /UnregisterDn` - Unregister agent
- `GET /GetIsEndpointActive` - Check registration status
- `POST /MakeCall` - Initiate call
- `POST /HangUp` - End call
- `POST /AnswerCall` - Answer incoming call
- `POST /Hold` - Hold call
- `POST /Retrieve` - Retrieve call
- `GET /Ping` - Keep-alive check

## Logging

Logs are written to:
```
%APPDATA%\webrtc-gateway-bridge\bridge.log
```

View logs from System Tray → View Logs

## Troubleshooting

### WWE doesn't detect endpoint

1. Check if service is running:
   ```
   https://127.0.0.1:8000/health
   ```

2. Check logs for errors

3. Restart the service from System Tray

### SSL Certificate issues

The bridge uses a self-signed certificate. If browsers show warnings:

1. Open `https://127.0.0.1:8000/` in browser
2. Accept the certificate warning
3. WWE should now work

### Registration fails

1. Check WebRTC Gateway is accessible:
   ```
   https://192.168.210.54:8443/wwe-webrtc-gateway.html
   ```

2. Verify credentials in config

3. Check logs for detailed error messages

## Architecture

```
WWE → HTTPS API (localhost:8000) → Bridge Service → Hidden iframe → WebRTC Gateway
```

See `WWE_WEBRTC_BRIDGE_ARCHITECTURE.md` for details.

## License

MIT

