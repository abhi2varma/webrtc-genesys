const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Store = require('electron-store');
const winston = require('winston');
const selfsigned = require('selfsigned');
const WorkspaceClient = require('./workspace-client');

// Disable certificate verification for self-signed certs
app.commandLine.appendSwitch('ignore-certificate-errors');

// Configuration
const store = new Store();
const config = {
  bridge: {
    host: '127.0.0.1',
    port: 8000
  },
  gateway: {
    // Use public IP for WSS connection
    // Port 8443 is HTTPS with WSS WebSocket (nginx proxy)
    // Port 8089 is Asterisk direct WSS (bypasses Kamailio to avoid proxy loop)
    url: store.get('gatewayUrl', 'https://103.167.180.166:8443'),
    iframeUrl: store.get('iframeUrl', 'https://103.167.180.166:8443/wwe-webrtc-gateway.html'),
    sipServer: store.get('sipServer', 'wss://103.167.180.166:8443/ws')  // Now proxies to Asterisk:8089
  },
  wwe: {
    allowedOrigins: [
      'http://192.168.210.54:8090', 
      'https://192.168.210.54:8090',
      'https://192.168.210.54:8443',  // WWE via HTTPS proxy (local)
      'http://103.167.180.166:8090', 
      'https://103.167.180.166:8090',
      'https://103.167.180.166:8443',  // WWE via HTTPS proxy (public .166)
      'https://103.167.180.160:8443'  // WWE via HTTPS proxy (public .160)
    ]
  }
};

// Logger
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
    // Temporarily disabled File transport due to EPERM error
    // TODO: Fix file permissions or use a different log location
    /*
    ,new winston.transports.File({ 
      filename: path.join(app.getPath('userData'), 'bridge.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
    */
  ]
});

// Global references
let mainWindow = null;
let tray = null;
let httpsServer = null;
let workspaceClient = null;
let webrtcStatus = {
  registered: false,
  dn: null,
  callActive: false,
  callDestination: null,
  incomingCall: null,  // Store incoming call details
  callerId: null
};

// Create HTTPS certificate
function createCertificate() {
  const certPath = path.join(app.getPath('userData'), 'cert.pem');
  const keyPath = path.join(app.getPath('userData'), 'key.pem');
  
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    logger.info('Using existing SSL certificate');
    return {
      cert: fs.readFileSync(certPath, 'utf8'),
      key: fs.readFileSync(keyPath, 'utf8')
    };
  }
  
  logger.info('Generating self-signed SSL certificate');
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const pems = selfsigned.generate(attrs, {
    keySize: 2048,
    days: 365,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'basicConstraints',
        cA: true
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true,
        codeSigning: true,
        timeStamping: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          {
            type: 2, // DNS
            value: 'localhost'
          },
          {
            type: 7, // IP
            ip: '127.0.0.1'
          }
        ]
      }
    ]
  });
  
  fs.writeFileSync(certPath, pems.cert);
  fs.writeFileSync(keyPath, pems.private);
  
  return {
    cert: pems.cert,
    key: pems.private
  };
}

// Create hidden window with WebRTC iframe
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true, // Show for debugging
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false // Allow self-signed certificates
    }
  });

  // Open DevTools for debugging
  mainWindow.webContents.openDevTools();

  // Ignore certificate errors for the gateway URL
  mainWindow.webContents.session.setCertificateVerifyProc((request, callback) => {
    callback(0); // 0 means accept the certificate
  });

  // Clear all cache to ensure fresh load from server
  mainWindow.webContents.session.clearCache().then(() => {
    logger.info('Session cache cleared');
    
    // Add cache-busting parameter to force reload from server
    const cacheBustUrl = `${config.gateway.iframeUrl}?v=${Date.now()}`;
    mainWindow.loadURL(cacheBustUrl);
  });
  
  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('WebRTC gateway loaded successfully');
    
    // Inject initialization script to set up message communication
    mainWindow.webContents.executeJavaScript(`
      (function() {
        console.log('[Bridge] Setting up WebRTC gateway communication');
        
        // Override postMessage listener to handle commands from Electron
        window.addEventListener('message', function(event) {
          console.log('[Bridge] Received message in gateway:', event.data);
          
          // Forward to the actual gateway message handler if it exists
          if (window.handleWebRTCCommand) {
            window.handleWebRTCCommand(event.data);
          }
        });
        
        // Set up event forwarding back to Electron
        window.sendEventToElectron = function(eventData) {
          console.log('[Bridge] Sending event to Electron:', eventData);
          // This will be intercepted by the preload script
          window.postMessage({ event: eventData }, '*');
        };
        
        console.log('[Bridge] WebRTC gateway communication ready');
      })();
    `).catch(err => {
      logger.error('Failed to inject initialization script:', err);
    });
  });
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logger.error('Failed to load WebRTC gateway:', { errorCode, errorDescription });
  });
  
  // Handle messages from iframe
  mainWindow.webContents.on('ipc-message', (event, channel, ...args) => {
    if (channel === 'webrtc-event') {
      handleWebRTCEvent(args[0]);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  logger.info('WebRTC iframe window created');
}

// Handle events from WebRTC iframe
function handleWebRTCEvent(event) {
  logger.info('WebRTC event received:', event);
  
  switch (event.event) {
    case 'registered':
      webrtcStatus.registered = true;
      webrtcStatus.dn = event.data?.dn || event.dn;
      logger.info(`DN registered: ${webrtcStatus.dn}`);
      updateTrayTooltip();
      break;
    
    case 'unregistered':
      webrtcStatus.registered = false;
      webrtcStatus.dn = null;
      updateTrayTooltip();
      break;
    
    case 'incoming_call':
      // Store incoming call details for WWE to retrieve
      webrtcStatus.incomingCall = {
        callerId: event.data?.callerId || event.data?.from || 'Unknown',
        timestamp: Date.now(),
        session: event.data?.session
      };
      webrtcStatus.callerId = webrtcStatus.incomingCall.callerId;
      logger.info('📞 Incoming call from:', webrtcStatus.callerId);
      updateTrayTooltip();
      break;
    
    case 'call_progress':
      // Call is ringing
      logger.info('Call progress - ringing');
      break;
    
    case 'call_accepted':
    case 'call_confirmed':
      webrtcStatus.callActive = true;
      webrtcStatus.incomingCall = null; // Clear incoming call state
      updateTrayTooltip();
      break;
    
    case 'call_ended':
    case 'call_failed':
      webrtcStatus.callActive = false;
      webrtcStatus.callDestination = null;
      webrtcStatus.incomingCall = null;
      webrtcStatus.callerId = null;
      updateTrayTooltip();
      break;
  }
}

// Send command to WebRTC iframe
function sendWebRTCCommand(command, data) {
  if (!mainWindow) {
    logger.error('Cannot send command: mainWindow is null');
    return Promise.reject(new Error('WebRTC window not initialized'));
  }
  
  return new Promise((resolve, reject) => {
    const message = {
      command: command,
      data: data
    };
    
    logger.info('Sending WebRTC command:', message);
    
    // Send via postMessage to the loaded page
    // The gateway HTML listens for postMessage events
    mainWindow.webContents.executeJavaScript(`
      (function() {
        console.log('[Bridge] Sending command:', ${JSON.stringify(JSON.stringify(message))});
        window.postMessage(${JSON.stringify(message)}, '*');
        return true;
      })();
    `).then(() => {
      logger.info('Command sent to WebRTC gateway');
      resolve({ success: true });
    }).catch((err) => {
      logger.error('Failed to send command:', err);
      reject(err);
    });
  });
}

// Setup Workspace API event handlers
function setupWorkspaceEventHandlers() {
  if (!workspaceClient) return;
  
  logger.info('[Workspace] Setting up event handlers');
  
  // Handle call answered from WWE
  workspaceClient.on('call-answered', async (callData) => {
    logger.info('[Workspace] 🎯 Call answered in WWE:', callData);
    
    try {
      // Send answer command to WebRTC gateway
      await sendWebRTCCommand('answer_call', {
        callId: callData.callId,
        callUuid: callData.callUuid,
        dnis: callData.dnis
      });
      
      logger.info('[Workspace] ✅ Answer command sent to WebRTC gateway');
      webrtcStatus.callActive = true;
      
    } catch (error) {
      logger.error('[Workspace] ❌ Failed to answer call:', error);
    }
  });
  
  // Handle incoming call
  workspaceClient.on('call-ringing', (callData) => {
    logger.info('[Workspace] 📞 Call ringing:', callData);
    webrtcStatus.incomingCall = callData;
    webrtcStatus.callerId = callData.participants?.[0]?.phoneNumber;
  });
  
  // Handle call released
  workspaceClient.on('call-released', (callData) => {
    logger.info('[Workspace] Call released:', callData.callId);
    webrtcStatus.callActive = false;
    webrtcStatus.incomingCall = null;
    webrtcStatus.callerId = null;
  });
  
  // Handle connection status
  workspaceClient.on('connected', () => {
    logger.info('[Workspace] ✅ Connected to Workspace API');
  });
  
  workspaceClient.on('disconnected', () => {
    logger.warn('[Workspace] ⚠️ Disconnected from Workspace API');
  });
  
  workspaceClient.on('reconnect-failed', () => {
    logger.error('[Workspace] ❌ Failed to reconnect to Workspace API');
  });
  
  workspaceClient.on('error', (error) => {
    logger.error('[Workspace] Error:', error);
  });
}

// Create Express REST API server
function createAPIServer() {
  const app = express();
  
  // Middleware
  app.use(cors({
    origin: config.wwe.allowedOrigins,
    credentials: true
  }));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  
  // Logging middleware
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      body: req.body,
      query: req.query
    });
    next();
  });
  
  // ===== WWE-COMPATIBLE API ENDPOINTS =====
  
  // Get DN SIP (check if DN is registered)
  app.get('/GetDnSIP', (req, res) => {
    logger.info('GetDnSIP called');
    res.json({
      get_DnSIPResult: webrtcStatus.dn || ''
    });
  });
  
  // Initialize Workspace API connection
  app.post('/InitWorkspace', async (req, res) => {
    try {
      const { sessionId, workspaceUrl } = req.body;
      logger.info('InitWorkspace called', { sessionId: sessionId ? '***' : null, workspaceUrl });
      
      if (!sessionId) {
        return res.status(400).json({ error: 'No session ID provided' });
      }
      
      // Initialize Workspace client
      if (!workspaceClient) {
        // Support both local and public IPs
        const defaultUrl = workspaceUrl || 
                          process.env.WORKSPACE_URL || 
                          'ws://192.168.210.54:8090';
        
        workspaceClient = new WorkspaceClient({
          workspaceUrl: defaultUrl
        });
        
        // Setup event handlers
        setupWorkspaceEventHandlers();
      }
      
      // Connect with session ID
      workspaceClient.connect(sessionId);
      
      res.json({ success: true });
    } catch (error) {
      logger.error('InitWorkspace error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Register DN (sign in)
  app.post('/RegisterDn', async (req, res) => {
    try {
      const { addresses, users, workspaceSessionId } = req.body;
      logger.info('RegisterDn called', { addresses, users });
      
      const dn = users && users[0];
      if (!dn) {
        return res.status(400).json({ error: 'No DN provided' });
      }
      
      // Store DN for auto-registration
      store.set('userDn', dn);
      
      // Get password from config or prompt
      const password = store.get('agentPassword', 'Genesys2024!WebRTC');
      
      await sendWebRTCCommand('sign_in', {
        agentId: dn,
        dn: dn,
        password: password,
        sipServer: config.gateway.sipServer
      });
      
      webrtcStatus.dn = dn;
      
      // Initialize Workspace API connection if session ID provided
      if (workspaceSessionId) {
        logger.info('Initializing Workspace API connection...');
        if (!workspaceClient) {
          // Try to detect the correct Workspace URL
          // Use environment variable or default to local IP
          const workspaceUrl = process.env.WORKSPACE_URL || 'ws://192.168.210.54:8090';
          workspaceClient = new WorkspaceClient({
            workspaceUrl: workspaceUrl
          });
          setupWorkspaceEventHandlers();
        }
        workspaceClient.connect(workspaceSessionId);
      }
      
      // Wait for registration to propagate to Genesys T-Server
      // This ensures WWE gets the DN status AFTER T-Server sees it
      logger.info(`Waiting for DN ${dn} registration to reach T-Server...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      res.json({
        RegisterDnResult: true
      });
    } catch (error) {
      logger.error('RegisterDn error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Unregister DN (sign out)
  app.post('/UnregisterDn', async (req, res) => {
    try {
      logger.info('UnregisterDn called');
      
      await sendWebRTCCommand('sign_out', {});
      
      webrtcStatus.registered = false;
      webrtcStatus.dn = null;
      
      // Disconnect Workspace client
      if (workspaceClient) {
        workspaceClient.disconnect();
        workspaceClient = null;
      }
      
      res.json({
        UnregisterDnResult: true
      });
    } catch (error) {
      logger.error('UnregisterDn error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Set options
  app.post('/SetOptions', (req, res) => {
    logger.info('SetOptions called', req.body);
    // Store options if needed
    res.json({});
  });
  
  // Get endpoint active status
  // This should return TRUE if the endpoint is ready/available, not if it's registered
  app.get('/GetIsEndpointActive', (req, res) => {
    logger.info('GetIsEndpointActive called');
    res.json({
      get_IsEndpointActiveResult: true  // Always true = endpoint is available
    });
  });
  
  // Set SIP endpoint parameters
  app.post('/SetSIPEndpointParameters', (req, res) => {
    logger.info('SetSIPEndpointParameters called', req.body);
    res.json({});
  });
  
  // Get SIP endpoint parameters
  // WWE calls this during session start - trigger auto-registration
  app.get('/GetSIPEndpointParameters', async (req, res) => {
    logger.info('GetSIPEndpointParameters called');
    
    // If we have a DN but aren't registered, trigger registration
    const userDn = store.get('userDn');
    if (userDn && !webrtcStatus.registered) {
      logger.info(`Auto-registering DN ${userDn} for WWE session`);
      const password = store.get('agentPassword', 'Genesys2024!WebRTC');
      
      try {
        await sendWebRTCCommand('sign_in', {
          agentId: userDn,
          dn: userDn,
          password: password,
          sipServer: config.gateway.sipServer
        });
        
        // Give it a moment to register
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        logger.error('Auto-registration failed:', error);
      }
    }
    
    res.json({
      get_SIPEndpointParametersResult: [
        { Key: 'IsPingMandatory', Value: false },
        { Key: 'Status', Value: webrtcStatus.registered ? 'Registered' : 'Unregistered' },
        { Key: 'EndpointStatus', Value: 'EndpointStatus_Ready' }
      ]
    });
  });
  
  // Make call
  app.post('/MakeCall', async (req, res) => {
    try {
      const { destination } = req.body;
      logger.info('MakeCall called', { destination });
      
      await sendWebRTCCommand('make_call', { destination });
      
      webrtcStatus.callDestination = destination;
      
      res.json({
        MakeCallResult: true
      });
    } catch (error) {
      logger.error('MakeCall error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Hangup call
  app.post('/HangUp', async (req, res) => {
    try {
      logger.info('HangUp called');
      
      await sendWebRTCCommand('hangup', {});
      
      res.json({
        HangUpResult: true
      });
    } catch (error) {
      logger.error('HangUp error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Answer call
  app.post('/AnswerCall', async (req, res) => {
    try {
      logger.info('AnswerCall called');
      
      await sendWebRTCCommand('answer_call', {});
      
      res.json({
        AnswerCallResult: true
      });
    } catch (error) {
      logger.error('AnswerCall error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Auto-answer API endpoint (triggered by AMI NOTIFY handler)
  app.post('/auto-answer/:dn', async (req, res) => {
    try {
      const dn = req.params.dn;
      const callId = req.body?.call_id || 'unknown';
      
      logger.info(`🎯 AUTO-ANSWER TRIGGERED: DN ${dn}, Call-ID: ${callId}`);
      
      // Check if there's an incoming call
      if (webrtcStatus.incomingCall) {
        logger.info('Auto-answering incoming call via WebRTC gateway');
        
        // Send answer command to WebRTC gateway
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.executeJavaScript(`
            (function() {
              if (window.gateway && window.gateway.currentSession) {
                if (!window.gateway.currentSession.isEstablished()) {
                  window.gateway.log('🎯 AUTO-ANSWER: Answering call via AMI trigger', 'success');
                  window.gateway.currentSession.answer({
                    mediaConstraints: { audio: true, video: false }
                  });
                  return { success: true, message: 'Call auto-answered' };
                } else {
                  return { success: false, message: 'Call already established' };
                }
              } else {
                return { success: false, message: 'No active session' };
              }
            })();
          `).then(result => {
            logger.info('Auto-answer result:', result);
          }).catch(error => {
            logger.error('Auto-answer execution error:', error);
          });
          
          res.json({ success: true, message: 'Auto-answer command sent' });
        } else {
          res.status(500).json({ success: false, error: 'Bridge window not available' });
        }
      } else {
        logger.warn('Auto-answer triggered but no incoming call detected');
        res.status(404).json({ success: false, error: 'No incoming call' });
      }
    } catch (error) {
      logger.error('Auto-answer error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Get incoming call status - WWE polls this to detect incoming calls
  app.get('/GetIncomingCall', (req, res) => {
    logger.info('GetIncomingCall called');
    
    if (webrtcStatus.incomingCall) {
      // Return incoming call details
      res.json({
        hasIncomingCall: true,
        callerId: webrtcStatus.incomingCall.callerId,
        timestamp: webrtcStatus.incomingCall.timestamp
      });
    } else {
      // No incoming call
      res.json({
        hasIncomingCall: false
      });
    }
  });
  
  // Get call status - WWE can use this to check current call state
  app.get('/GetCallStatus', (req, res) => {
    logger.info('GetCallStatus called');
    
    res.json({
      registered: webrtcStatus.registered,
      dn: webrtcStatus.dn,
      callActive: webrtcStatus.callActive,
      hasIncomingCall: !!webrtcStatus.incomingCall,
      callerId: webrtcStatus.callerId
    });
  });
  
  // Hold call (mute)
  app.post('/Hold', async (req, res) => {
    try {
      logger.info('Hold called');
      
      await sendWebRTCCommand('set_mute', { muted: true });
      
      res.json({
        HoldResult: true
      });
    } catch (error) {
      logger.error('Hold error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Retrieve call (unmute)
  app.post('/Retrieve', async (req, res) => {
    try {
      logger.info('Retrieve called');
      
      await sendWebRTCCommand('set_mute', { muted: false });
      
      res.json({
        RetrieveResult: true
      });
    } catch (error) {
      logger.error('Retrieve error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Ping (keep-alive)
  app.get('/Ping', (req, res) => {
    logger.debug('Ping');
    res.json({ pong: true });
  });
  
  // Set ping period
  app.post('/SetPingPeriod', (req, res) => {
    logger.info('SetPingPeriod called', req.body);
    res.json({});
  });
  
  // Dashboard UI
  app.get('/dashboard', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WebRTC Gateway Bridge</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
          .card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .status { font-size: 24px; font-weight: bold; }
          .online { color: #4CAF50; }
          .offline { color: #f44336; }
          .info { display: flex; justify-content: space-between; margin: 10px 0; }
        </style>
      </head>
      <body>
        <h1>WebRTC Gateway Bridge Dashboard</h1>
        <div class="card">
          <div class="status ${webrtcStatus.registered ? 'online' : 'offline'}">
            ${webrtcStatus.registered ? '● Online' : '● Offline'}
          </div>
          <div class="info">
            <span>DN:</span>
            <strong>${webrtcStatus.dn || 'Not registered'}</strong>
          </div>
          <div class="info">
            <span>Call Active:</span>
            <strong>${webrtcStatus.callActive ? 'Yes' : 'No'}</strong>
          </div>
          ${webrtcStatus.callDestination ? `
          <div class="info">
            <span>Destination:</span>
            <strong>${webrtcStatus.callDestination}</strong>
          </div>
          ` : ''}
          <div class="info">
            <span>Gateway:</span>
            <strong>${config.gateway.url}</strong>
          </div>
        </div>
        <div class="card">
          <h3>Configuration</h3>
          <div class="info">
            <span>Bridge URL:</span>
            <strong>https://${config.bridge.host}:${config.bridge.port}</strong>
          </div>
          <div class="info">
            <span>SIP Server:</span>
            <strong>${config.gateway.sipServer}</strong>
          </div>
        </div>
      </body>
      </html>
    `);
  });
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      registered: webrtcStatus.registered,
      dn: webrtcStatus.dn,
      callActive: webrtcStatus.callActive
    });
  });
  
  // Start HTTPS server
  const credentials = createCertificate();
  httpsServer = https.createServer(credentials, app);
  
  httpsServer.listen(config.bridge.port, config.bridge.host, () => {
    logger.info(`Bridge API server listening on https://${config.bridge.host}:${config.bridge.port}`);
    logger.info(`Dashboard available at https://${config.bridge.host}:${config.bridge.port}/dashboard`);
  });
}

// Create system tray
function createTray() {
  tray = new Tray(path.join(__dirname, '../assets/icon.png'));
  
  updateTrayMenu();
  updateTrayTooltip();
  
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

function updateTrayMenu() {
  if (!tray) {
    logger.warn('Tray not initialized yet');
    return;
  }
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Status: ${webrtcStatus.registered ? 'Online' : 'Offline'}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      click: () => {
        require('electron').shell.openExternal(`https://127.0.0.1:${config.bridge.port}/dashboard`);
      }
    },
    {
      label: 'Show Window',
      click: () => {
        mainWindow.show();
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        // Open settings window (to be implemented)
      }
    },
    {
      label: 'View Logs',
      click: () => {
        require('electron').shell.openPath(path.join(app.getPath('userData'), 'bridge.log'));
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

function updateTrayTooltip() {
  if (!tray) {
    logger.warn('Tray not initialized yet');
    return;
  }
  
  let tooltip = 'WebRTC Gateway Bridge\n';
  tooltip += `Status: ${webrtcStatus.registered ? 'Online' : 'Offline'}`;
  
  if (webrtcStatus.dn) {
    tooltip += `\nDN: ${webrtcStatus.dn}`;
  }
  
  if (webrtcStatus.callActive) {
    tooltip += `\nCall: Active`;
    if (webrtcStatus.callDestination) {
      tooltip += ` (${webrtcStatus.callDestination})`;
    }
  }
  
  tray.setToolTip(tooltip);
  updateTrayMenu();
}

// App lifecycle
app.on('ready', () => {
  logger.info('WebRTC Gateway Bridge starting...');
  
  // Set up IPC listeners for communication from the preload script
  ipcMain.on('webrtc-event', (event, data) => {
    handleWebRTCEvent(data);
  });
  
  createWindow();
  createAPIServer();
  createTray();
  
  logger.info('Bridge is ready');
});

app.on('window-all-closed', () => {
  // Keep app running in system tray
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  logger.info('Bridge shutting down...');
  
  if (httpsServer) {
    httpsServer.close();
  }
});

// Handle errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection:', reason);
});

