#!/usr/bin/env node

/**
 * Custom WebRTC Signaling Server
 * 
 * Bridges between:
 * - Browser (Custom JSON WebSocket protocol)
 * - Asterisk/Kamailio (SIP)
 * - Genesys (WWE REST API)
 */

require('dotenv').config();
const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const JsSIP = require('jssip');
const { v4: uuidv4 } = require('uuid');

// Configuration
const WS_PORT = process.env.WS_PORT || 8081;
const HTTP_PORT = process.env.HTTP_PORT || 8082;
const SIP_SERVER = process.env.SIP_SERVER || '192.168.210.54';
const SIP_PORT = process.env.SIP_PORT || 5060;
const SIP_WS_SERVER = process.env.SIP_WS_SERVER || `ws://${SIP_SERVER}:8080`;
const SIP_DOMAIN = process.env.SIP_DOMAIN || SIP_SERVER;

// Logging
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
JsSIP.debug.enable(LOG_LEVEL === 'debug' ? 'JsSIP:*' : 'JsSIP:ERROR');

console.log('='.repeat(60));
console.log('WebRTC Custom Signaling Server');
console.log('='.repeat(60));
console.log(`WebSocket Port: ${WS_PORT}`);
console.log(`HTTP API Port: ${HTTP_PORT}`);
console.log(`SIP Server: ${SIP_SERVER}:${SIP_PORT}`);
console.log(`SIP WebSocket: ${SIP_WS_SERVER}`);
console.log('='.repeat(60));

// Store active connections and sessions
const clients = new Map(); // WebSocket connections by DN
const sipUAs = new Map();  // JsSIP User Agents by DN
const activeCalls = new Map(); // Active calls by callId

/**
 * WebSocket Server for Browser Connections
 */
const wss = new WebSocket.Server({ port: WS_PORT });

wss.on('connection', (ws, req) => {
    const clientId = uuidv4();
    console.log(`[WS] New connection: ${clientId} from ${req.socket.remoteAddress}`);
    
    ws.clientId = clientId;
    ws.isAlive = true;
    
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleWebSocketMessage(ws, message);
        } catch (error) {
            console.error('[WS] Failed to parse message:', error);
            sendError(ws, 'Invalid JSON', null);
        }
    });
    
    ws.on('close', () => {
        console.log(`[WS] Connection closed: ${clientId}`);
        handleDisconnect(ws);
    });
    
    ws.on('error', (error) => {
        console.error(`[WS] Error on connection ${clientId}:`, error);
    });
});

// Heartbeat to detect broken connections
const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log(`[WS] Terminating dead connection: ${ws.clientId}`);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => {
    clearInterval(heartbeat);
});

/**
 * Handle incoming WebSocket messages
 */
function handleWebSocketMessage(ws, message) {
    const { type, payload, id } = message;
    
    console.log(`[WS] Received: ${type}`, payload);
    
    switch (type) {
        case 'register':
            handleRegister(ws, payload, id);
            break;
        case 'unregister':
            handleUnregister(ws, payload, id);
            break;
        case 'call':
            handleCall(ws, payload, id);
            break;
        case 'answer':
            handleAnswer(ws, payload, id);
            break;
        case 'hangup':
            handleHangup(ws, payload, id);
            break;
        case 'dtmf':
            handleDTMF(ws, payload, id);
            break;
        case 'iceCandidate':
            // ICE candidates are handled peer-to-peer through SDP
            console.log(`[ICE] Candidate received for call ${payload.callId}`);
            break;
        default:
            console.warn(`[WS] Unknown message type: ${type}`);
            sendError(ws, `Unknown message type: ${type}`, id);
    }
}

/**
 * REGISTER: Register DN with SIP server
 */
function handleRegister(ws, payload, msgId) {
    const { dn, password, displayName } = payload;
    
    if (!dn || !password) {
        return sendError(ws, 'Missing DN or password', msgId);
    }
    
    console.log(`[REGISTER] DN ${dn} - ${displayName || 'Anonymous'}`);
    
    // Create JsSIP User Agent
    const socket = new JsSIP.WebSocketInterface(SIP_WS_SERVER);
    const configuration = {
        sockets: [socket],
        uri: `sip:${dn}@${SIP_DOMAIN}`,
        password: password,
        display_name: displayName || dn,
        register: true,
        session_timers: false
    };
    
    const ua = new JsSIP.UA(configuration);
    
    // UA Events
    ua.on('connected', () => {
        console.log(`[SIP] UA connected for DN ${dn}`);
    });
    
    ua.on('disconnected', () => {
        console.log(`[SIP] UA disconnected for DN ${dn}`);
    });
    
    ua.on('registered', () => {
        console.log(`[SIP] DN ${dn} registered successfully`);
        ws.dn = dn;
        clients.set(dn, ws);
        sipUAs.set(dn, ua);
        
        sendMessage(ws, {
            type: 'registered',
            payload: {
                dn: dn,
                expires: 3600,
                server: SIP_SERVER
            },
            id: msgId
        });
    });
    
    ua.on('registrationFailed', (e) => {
        console.error(`[SIP] Registration failed for DN ${dn}:`, e.cause);
        sendError(ws, `Registration failed: ${e.cause}`, msgId);
    });
    
    ua.on('unregistered', () => {
        console.log(`[SIP] DN ${dn} unregistered`);
        clients.delete(dn);
        sipUAs.delete(dn);
    });
    
    // Incoming call handler
    ua.on('newRTCSession', (e) => {
        const session = e.session;
        
        if (session.direction === 'incoming') {
            handleIncomingCall(ws, session, dn);
        }
    });
    
    // Start the UA
    ua.start();
}

/**
 * Handle incoming SIP call
 */
function handleIncomingCall(ws, session, dn) {
    const callId = uuidv4();
    const remoteIdentity = session.remote_identity.uri.user;
    
    console.log(`[CALL] Incoming call for DN ${dn} from ${remoteIdentity}, callId: ${callId}`);
    
    // Store session
    activeCalls.set(callId, {
        session: session,
        dn: dn,
        remote: remoteIdentity,
        direction: 'incoming'
    });
    
    // Notify client of incoming call
    sendMessage(ws, {
        type: 'incomingCall',
        payload: {
            callId: callId,
            from: remoteIdentity,
            to: dn
        }
    });
    
    // Session events
    session.on('accepted', () => {
        console.log(`[CALL] Call ${callId} accepted`);
        sendMessage(ws, {
            type: 'callAccepted',
            payload: {
                callId: callId,
                sdp: session.connection.remoteDescription.sdp
            }
        });
    });
    
    session.on('ended', () => {
        console.log(`[CALL] Call ${callId} ended`);
        activeCalls.delete(callId);
        sendMessage(ws, {
            type: 'callEnded',
            payload: {
                callId: callId,
                reason: 'ended'
            }
        });
    });
    
    session.on('failed', (e) => {
        console.log(`[CALL] Call ${callId} failed:`, e.cause);
        activeCalls.delete(callId);
        sendMessage(ws, {
            type: 'callEnded',
            payload: {
                callId: callId,
                reason: e.cause
            }
        });
    });
}

/**
 * CALL: Initiate outbound call
 */
function handleCall(ws, payload, msgId) {
    const { to, callId, sdp } = payload;
    const dn = ws.dn;
    
    if (!dn) {
        return sendError(ws, 'Not registered', msgId);
    }
    
    if (!to) {
        return sendError(ws, 'Missing destination', msgId);
    }
    
    const ua = sipUAs.get(dn);
    if (!ua) {
        return sendError(ws, 'SIP UA not found', msgId);
    }
    
    console.log(`[CALL] Initiating call from ${dn} to ${to}, callId: ${callId}`);
    
    // Call options
    const options = {
        mediaConstraints: {
            audio: true,
            video: false
        },
        pcConfig: {
            iceServers: []
        },
        eventHandlers: {
            progress: (e) => {
                console.log(`[CALL] ${callId} - Ringing`);
                sendMessage(ws, {
                    type: 'callProgress',
                    payload: {
                        callId: callId,
                        state: 'ringing'
                    },
                    id: msgId
                });
            },
            accepted: (e) => {
                console.log(`[CALL] ${callId} - Accepted`);
                const session = e.sender || e.session;
                sendMessage(ws, {
                    type: 'callAccepted',
                    payload: {
                        callId: callId,
                        sdp: session.connection.remoteDescription.sdp
                    },
                    id: msgId
                });
            },
            ended: (e) => {
                console.log(`[CALL] ${callId} - Ended`);
                activeCalls.delete(callId);
                sendMessage(ws, {
                    type: 'callEnded',
                    payload: {
                        callId: callId,
                        reason: 'ended'
                    },
                    id: msgId
                });
            },
            failed: (e) => {
                console.error(`[CALL] ${callId} - Failed:`, e.cause);
                activeCalls.delete(callId);
                sendMessage(ws, {
                    type: 'callEnded',
                    payload: {
                        callId: callId,
                        reason: e.cause,
                        code: e.message ? e.message.status_code : 500
                    },
                    id: msgId
                });
            }
        }
    };
    
    // Make the call
    const session = ua.call(`sip:${to}@${SIP_DOMAIN}`, options);
    
    // Store session
    activeCalls.set(callId, {
        session: session,
        dn: dn,
        remote: to,
        direction: 'outgoing'
    });
}

/**
 * HANGUP: End call
 */
function handleHangup(ws, payload, msgId) {
    const { callId, reason } = payload;
    
    const call = activeCalls.get(callId);
    if (!call) {
        return sendError(ws, 'Call not found', msgId);
    }
    
    console.log(`[CALL] Hanging up ${callId}, reason: ${reason || 'user_initiated'}`);
    
    call.session.terminate();
    activeCalls.delete(callId);
}

/**
 * DTMF: Send DTMF digit
 */
function handleDTMF(ws, payload, msgId) {
    const { callId, digit } = payload;
    
    const call = activeCalls.get(callId);
    if (!call) {
        return sendError(ws, 'Call not found', msgId);
    }
    
    console.log(`[DTMF] Sending ${digit} for call ${callId}`);
    
    call.session.sendDTMF(digit);
}

/**
 * UNREGISTER: Unregister DN
 */
function handleUnregister(ws, payload, msgId) {
    const dn = ws.dn;
    
    if (!dn) {
        return sendError(ws, 'Not registered', msgId);
    }
    
    const ua = sipUAs.get(dn);
    if (ua) {
        ua.unregister();
        ua.stop();
    }
    
    clients.delete(dn);
    sipUAs.delete(dn);
    ws.dn = null;
    
    console.log(`[UNREGISTER] DN ${dn} unregistered`);
}

/**
 * Handle client disconnect
 */
function handleDisconnect(ws) {
    const dn = ws.dn;
    
    if (dn) {
        const ua = sipUAs.get(dn);
        if (ua) {
            ua.stop();
        }
        clients.delete(dn);
        sipUAs.delete(dn);
        console.log(`[DISCONNECT] DN ${dn} disconnected and cleaned up`);
    }
}

/**
 * Send message to WebSocket client
 */
function sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

/**
 * Send error to WebSocket client
 */
function sendError(ws, errorMessage, msgId) {
    sendMessage(ws, {
        type: 'error',
        payload: {
            message: errorMessage,
            code: 400
        },
        id: msgId
    });
}

/**
 * HTTP REST API Server
 */
const app = express();
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'custom-signaling-server',
        version: '1.0.0',
        uptime: process.uptime(),
        connections: wss.clients.size,
        registered: sipUAs.size,
        active_calls: activeCalls.size
    });
});

// Get DN info
app.get('/api/dn/:dn', (req, res) => {
    const dn = req.params.dn;
    const isRegistered = sipUAs.has(dn);
    
    res.json({
        dn: dn,
        status: isRegistered ? 'registered' : 'offline',
        sip_uri: `sip:${dn}@${SIP_DOMAIN}`
    });
});

// List registered DNs
app.get('/api/dn/list', (req, res) => {
    const dns = Array.from(sipUAs.keys()).map(dn => ({
        dn: dn,
        sip_uri: `sip:${dn}@${SIP_DOMAIN}`,
        status: 'registered'
    }));
    
    res.json({ dns: dns, count: dns.length });
});

// Active calls
app.get('/api/calls/active', (req, res) => {
    const calls = Array.from(activeCalls.entries()).map(([callId, call]) => ({
        call_id: callId,
        dn: call.dn,
        remote: call.remote,
        direction: call.direction
    }));
    
    res.json({ calls: calls, count: calls.length });
});

// Genesys status (placeholder)
app.get('/api/genesys/status', (req, res) => {
    res.json({
        connected: true,
        server: process.env.GENESYS_HOST || '192.168.210.81',
        service: 'wwe',
        status: 'active'
    });
});

const server = http.createServer(app);
server.listen(HTTP_PORT, () => {
    console.log(`[HTTP] REST API listening on port ${HTTP_PORT}`);
});

console.log('\n✅ Custom Signaling Server started successfully!\n');

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[SHUTDOWN] Received SIGTERM, closing connections...');
    wss.close();
    server.close();
    process.exit(0);
});

