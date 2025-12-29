const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const winston = require('winston');
const selfsigned = require('selfsigned');
const puppeteer = require('puppeteer');
const { WebSocketServer } = require('ws');

// Configuration
const config = {
  bridge: {
    host: process.env.BRIDGE_HOST || '0.0.0.0',
    port: parseInt(process.env.BRIDGE_PORT || '8000')
  },
  gateway: {
    url: process.env.GATEWAY_URL || 'https://192.168.210.54:8443',
    iframeUrl: process.env.IFRAME_URL || 'https://192.168.210.54:8443/wwe-webrtc-gateway.html',
    sipServer: process.env.SIP_SERVER || 'wss://192.168.210.54:8443/ws'
  },
  wwe: {
    allowedOrigins: (process.env.WWE_ORIGINS || 'http://192.168.210.54:8090,https://192.168.210.54:8090').split(',')
  },
  dataDir: process.env.DATA_DIR || '/var/lib/webrtc-bridge'
};

// Ensure data directory exists
if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

// Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
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
    }),
    new winston.transports.File({ 
      filename: path.join(config.dataDir, 'bridge.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

// WebRTC status
let webrtcStatus = {
  registered: false,
  dn: null,
  callActive: false,
  callDestination: null,
  lastEvent: null
};

// Puppeteer browser instance
let browser = null;
let page = null;

// Create HTTPS certificate
function createCertificate() {
  const certPath = path.join(config.dataDir, 'cert.pem');
  const keyPath = path.join(config.dataDir, 'key.pem');
  
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
        clientAuth: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
          { type: 7, ip: '192.168.210.54' }
        ]
      }
    ]
  });
  
  fs.writeFileSync(certPath, pems.cert);
  fs.writeFileSync(keyPath, pems.private);
  
  logger.info('SSL certificate created', { certPath, keyPath });
  
  return {
    cert: pems.cert,
    key: pems.private
  };
}

// Initialize headless browser with WebRTC iframe
async function initBrowser() {
  try {
    logger.info('Launching headless browser...');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--use-fake-ui-for-media-stream', // Auto-grant microphone permission
        '--use-fake-device-for-media-stream' // Use fake audio device
      ],
      ignoreHTTPSErrors: true
    });
    
    page = await browser.newPage();
    
    // Listen for console messages from the page
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Event:') || text.includes('PHASE')) {
        logger.debug('WebRTC Gateway:', text);
      }
    });
    
    // Listen for postMessage events from iframe
    await page.exposeFunction('handleWebRTCEvent', (event) => {
      handleWebRTCEvent(event);
    });
    
    // Inject message listener
    await page.evaluateOnNewDocument(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.event) {
          window.handleWebRTCEvent(event.data);
        }
      });
    });
    
    // Load WebRTC gateway page
    logger.info('Loading WebRTC gateway page...', { url: config.gateway.iframeUrl });
    await page.goto(config.gateway.iframeUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    logger.info('Browser initialized successfully');
    
  } catch (error) {
    logger.error('Failed to initialize browser:', error);
    throw error;
  }
}

// Handle events from WebRTC gateway
function handleWebRTCEvent(event) {
  logger.info('WebRTC event received:', event);
  
  webrtcStatus.lastEvent = event;
  
  switch (event.event) {
    case 'registered':
      webrtcStatus.registered = true;
      webrtcStatus.dn = event.dn;
      break;
    
    case 'unregistered':
    case 'signed_out':
      webrtcStatus.registered = false;
      webrtcStatus.dn = null;
      break;
    
    case 'call_accepted':
    case 'call_confirmed':
    case 'call_progress':
      webrtcStatus.callActive = true;
      break;
    
    case 'call_ended':
    case 'call_failed':
      webrtcStatus.callActive = false;
      webrtcStatus.callDestination = null;
      break;
  }
}

// Send command to WebRTC gateway via postMessage
async function sendWebRTCCommand(command, data = {}) {
  if (!page) {
    throw new Error('Browser not initialized');
  }
  
  const message = {
    command: command,
    ...data
  };
  
  logger.info('Sending WebRTC command:', message);
  
  try {
    await page.evaluate((msg) => {
      window.postMessage(msg, '*');
    }, message);
    
    return { success: true };
  } catch (error) {
    logger.error('Failed to send command:', error);
    throw error;
  }
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
      query: req.query,
      ip: req.ip
    });
    next();
  });
  
  // ===== WWE-COMPATIBLE API ENDPOINTS =====
  
  // Get DN SIP
  app.get('/GetDnSIP', (req, res) => {
    res.json({
      get_DnSIPResult: webrtcStatus.dn || ''
    });
  });
  
  // Register DN
  app.post('/RegisterDn', async (req, res) => {
    try {
      const { addresses, users } = req.body;
      logger.info('RegisterDn called', { addresses, users });
      
      const dn = users && users[0];
      if (!dn) {
        return res.status(400).json({ error: 'No DN provided' });
      }
      
      // Get password from environment or use default
      const password = process.env.AGENT_PASSWORD || 'Genesys2024!WebRTC';
      
      await sendWebRTCCommand('sign_in', {
        agentId: dn,
        dn: dn,
        password: password,
        sipServer: config.gateway.sipServer
      });
      
      // Wait a bit for registration
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      res.json({
        RegisterDnResult: true
      });
    } catch (error) {
      logger.error('RegisterDn error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Unregister DN
  app.post('/UnregisterDn', async (req, res) => {
    try {
      logger.info('UnregisterDn called');
      
      await sendWebRTCCommand('sign_out', {});
      
      webrtcStatus.registered = false;
      webrtcStatus.dn = null;
      
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
    res.json({});
  });
  
  // Get endpoint active status
  app.get('/GetIsEndpointActive', (req, res) => {
    res.json({
      get_IsEndpointActiveResult: webrtcStatus.registered
    });
  });
  
  // Set SIP endpoint parameters
  app.post('/SetSIPEndpointParameters', (req, res) => {
    logger.info('SetSIPEndpointParameters called', req.body);
    res.json({});
  });
  
  // Get SIP endpoint parameters
  app.get('/GetSIPEndpointParameters', (req, res) => {
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
  
  // Hold call
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
  
  // Retrieve call
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
  
  // Ping
  app.get('/Ping', (req, res) => {
    res.json({ pong: true, timestamp: Date.now() });
  });
  
  // Set ping period
  app.post('/SetPingPeriod', (req, res) => {
    logger.info('SetPingPeriod called', req.body);
    res.json({});
  });
  
  // Dashboard
  app.get('/dashboard', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WebRTC Gateway Bridge - Linux</title>
        <meta http-equiv="refresh" content="5">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
          .card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .status { font-size: 24px; font-weight: bold; }
          .online { color: #4CAF50; }
          .offline { color: #f44336; }
          .info { display: flex; justify-content: space-between; margin: 10px 0; padding: 5px 0; border-bottom: 1px solid #eee; }
          .info:last-child { border-bottom: none; }
          pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>🔊 WebRTC Gateway Bridge (Linux)</h1>
        <div class="card">
          <div class="status ${webrtcStatus.registered ? 'online' : 'offline'}">
            ${webrtcStatus.registered ? '● Online' : '● Offline'}
          </div>
          <div class="info">
            <span><strong>DN:</strong></span>
            <span>${webrtcStatus.dn || 'Not registered'}</span>
          </div>
          <div class="info">
            <span><strong>Call Active:</strong></span>
            <span>${webrtcStatus.callActive ? 'Yes' : 'No'}</span>
          </div>
          ${webrtcStatus.callDestination ? `
          <div class="info">
            <span><strong>Destination:</strong></span>
            <span>${webrtcStatus.callDestination}</span>
          </div>
          ` : ''}
          <div class="info">
            <span><strong>Gateway URL:</strong></span>
            <span>${config.gateway.url}</span>
          </div>
          <div class="info">
            <span><strong>SIP Server:</strong></span>
            <span>${config.gateway.sipServer}</span>
          </div>
        </div>
        
        <div class="card">
          <h3>Configuration</h3>
          <div class="info">
            <span><strong>Bridge URL:</strong></span>
            <span>https://${config.bridge.host}:${config.bridge.port}</span>
          </div>
          <div class="info">
            <span><strong>WWE Origins:</strong></span>
            <span>${config.wwe.allowedOrigins.join(', ')}</span>
          </div>
          <div class="info">
            <span><strong>Data Directory:</strong></span>
            <span>${config.dataDir}</span>
          </div>
        </div>
        
        ${webrtcStatus.lastEvent ? `
        <div class="card">
          <h3>Last Event</h3>
          <pre>${JSON.stringify(webrtcStatus.lastEvent, null, 2)}</pre>
        </div>
        ` : ''}
        
        <div class="card">
          <h3>Quick Links</h3>
          <a href="/health">Health Check</a> | 
          <a href="/logs">View Logs</a> | 
          <a href="https://${config.bridge.host}:8443">WebRTC Gateway</a>
        </div>
        
        <p style="text-align: center; color: #999; font-size: 12px;">
          Auto-refresh every 5 seconds | ${new Date().toLocaleString()}
        </p>
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
      callActive: webrtcStatus.callActive,
      browserRunning: browser !== null && page !== null,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });
  
  // View logs
  app.get('/logs', (req, res) => {
    try {
      const logFile = path.join(config.dataDir, 'bridge.log');
      if (fs.existsSync(logFile)) {
        const logs = fs.readFileSync(logFile, 'utf8')
          .split('\n')
          .filter(line => line.trim())
          .slice(-100); // Last 100 lines
        
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Bridge Logs</title>
            <style>
              body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
              pre { white-space: pre-wrap; word-wrap: break-word; }
              .error { color: #f48771; }
              .warn { color: #dcdcaa; }
              .info { color: #4fc1ff; }
            </style>
          </head>
          <body>
            <h2>WebRTC Bridge Logs (Last 100 lines)</h2>
            <pre>${logs.map(line => {
              if (line.includes('"level":"error"')) return `<span class="error">${line}</span>`;
              if (line.includes('"level":"warn"')) return `<span class="warn">${line}</span>`;
              if (line.includes('"level":"info"')) return `<span class="info">${line}</span>`;
              return line;
            }).join('\n')}</pre>
          </body>
          </html>
        `);
      } else {
        res.send('No logs found');
      }
    } catch (error) {
      res.status(500).send('Error reading logs: ' + error.message);
    }
  });
  
  // Start HTTPS server
  const credentials = createCertificate();
  const httpsServer = https.createServer(credentials, app);
  
  httpsServer.listen(config.bridge.port, config.bridge.host, () => {
    logger.info(`✅ Bridge API server listening on https://${config.bridge.host}:${config.bridge.port}`);
    logger.info(`📊 Dashboard: https://${config.bridge.host}:${config.bridge.port}/dashboard`);
    logger.info(`❤️  Health: https://${config.bridge.host}:${config.bridge.port}/health`);
  });
  
  return httpsServer;
}

// Main startup
async function main() {
  try {
    logger.info('🚀 WebRTC Gateway Bridge (Linux) starting...');
    logger.info('Configuration:', {
      bridgePort: config.bridge.port,
      gatewayUrl: config.gateway.url,
      sipServer: config.gateway.sipServer,
      dataDir: config.dataDir
    });
    
    // Initialize browser
    await initBrowser();
    
    // Start API server
    const server = createAPIServer();
    
    logger.info('✅ Bridge is ready!');
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      if (browser) {
        await browser.close();
      }
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      if (browser) {
        await browser.close();
      }
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
    
  } catch (error) {
    logger.error('Failed to start bridge:', error);
    process.exit(1);
  }
}

// Start the bridge
main();

