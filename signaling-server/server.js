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

// Make WebSocket available globally for JsSIP
global.WebSocket = WebSocket;

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
    
    if (!sdp) {
        return sendError(ws, 'Missing SDP', msgId);
    }
    
    const ua = sipUAs.get(dn);
    if (!ua || !ua.isConnected()) {
        return sendError(ws, 'SIP UA not connected', msgId);
    }
    
    console.log(`[CALL] Initiating call from ${dn} to ${to}, callId: ${callId}`);
    
    // Generate SIP identifiers
    const sipCallId = `${callId}-${Date.now()}`;
    const fromTag = Math.random().toString(36).substring(2, 12);
    const branch = `z9hG4bK${Math.random().toString(36).substring(2, 12)}`;
    
    // Get via and contact from UA
    let via, contact;
    try {
        via = ua._transport._via_host;
        contact = ua._contact.toString();
        console.log(`[CALL] Via: ${via}, Contact: ${contact}`);
    } catch (error) {
        console.error(`[CALL] Failed to get UA properties:`, error);
        return sendError(ws, `Failed to get UA properties: ${error.message}`, msgId);
    }
    
    // Build SIP INVITE message
    const invite = [
        `INVITE sip:${to}@${SIP_DOMAIN} SIP/2.0`,
        `Via: SIP/2.0/WS ${via};branch=${branch}`,
        `Max-Forwards: 69`,
        `To: <sip:${to}@${SIP_DOMAIN}>`,
        `From: "${dn}" <sip:${dn}@${SIP_DOMAIN}>;tag=${fromTag}`,
        `Call-ID: ${sipCallId}`,
        `CSeq: 1 INVITE`,
        `Contact: ${contact}`,
        `Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY`,
        `Supported: path,gruu,outbound`,
        `User-Agent: Custom-WebRTC-Gateway`,
        `Content-Type: application/sdp`,
        `Content-Length: ${sdp.length}`,
        ``,
        sdp
    ].join('\r\n');
    
    // Store call session info
    activeCalls.set(callId, {
        sipCallId,
        fromTag,
        branch,
        dn,
        to,
        ws,
        msgId,
        cseq: 1,
        direction: 'outgoing'
    });
    
    // Hook into UA's transport to intercept SIP responses
    const transport = ua._transport;
    const originalHandler = transport._onMessage;
    
    transport._onMessage = function(e) {
        const message = e.data;
        
        // Check if this message is for our call
        if (message.includes(sipCallId)) {
            handleSIPResponse(message, callId, ws, msgId);
        }
        
        // Call original handler
        if (originalHandler) {
            originalHandler.call(transport, e);
        }
    };
    
    // Send INVITE
    try {
        transport.send(invite);
        console.log(`[SIP] Sent INVITE for call ${callId} (SIP Call-ID: ${sipCallId})`);
    } catch (error) {
        console.error(`[SIP] Failed to send INVITE:`, error);
        sendError(ws, `Failed to send INVITE: ${error.message}`, msgId);
        activeCalls.delete(callId);
    }
}

/**
 * Handle SIP responses for our manual INVITE
 */
function handleSIPResponse(sipMessage, callId, ws, msgId) {
    const call = activeCalls.get(callId);
    if (!call) return;
    
    // Parse SIP status line
    const statusMatch = sipMessage.match(/^SIP\/2\.0 (\d+) (.+)/m);
    if (!statusMatch) return;
    
    const statusCode = parseInt(statusMatch[1]);
    const statusText = statusMatch[2].trim();
    
    console.log(`[SIP] Call ${callId} received: ${statusCode} ${statusText}`);
    
    if (statusCode >= 100 && statusCode < 200) {
        // 1xx Provisional responses
        if (statusCode === 180 || statusCode === 183) {
            sendMessage(ws, {
                type: 'callProgress',
                payload: {
                    callId,
                    state: 'ringing'
                },
                id: msgId
            });
        }
    } else if (statusCode === 200) {
        // 200 OK - Call answered
        // Extract SDP from response
        const sdpMatch = sipMessage.match(/Content-Type: application\/sdp\r?\n\r?\n([\s\S]+)$/m);
        if (sdpMatch) {
            const answerSdp = sdpMatch[1].trim();
            console.log(`[CALL] ${callId} - Answered`);
            
            sendMessage(ws, {
                type: 'callAccepted',
                payload: {
                    callId,
                    sdp: answerSdp
                },
                id: msgId
            });
            
            // Send ACK
            const ua = sipUAs.get(call.dn);
            if (ua) {
                const ack = [
                    `ACK sip:${call.to}@${SIP_DOMAIN} SIP/2.0`,
                    `Via: SIP/2.0/WS ${ua._transport._via_host};branch=${call.branch}`,
                    `Max-Forwards: 69`,
                    `To: <sip:${call.to}@${SIP_DOMAIN}>`,
                    `From: "${call.dn}" <sip:${call.dn}@${SIP_DOMAIN}>;tag=${call.fromTag}`,
                    `Call-ID: ${call.sipCallId}`,
                    `CSeq: 1 ACK`,
                    `Content-Length: 0`,
                    ``,
                    ``
                ].join('\r\n');
                
                ua._transport.send(ack);
                console.log(`[SIP] Sent ACK for call ${callId}`);
            }
        }
    } else if (statusCode >= 300) {
        // Error responses
        console.error(`[CALL] ${callId} - Failed: ${statusCode} ${statusText}`);
        sendMessage(ws, {
            type: 'callEnded',
            payload: {
                callId,
                reason: statusText,
                code: statusCode
            },
            id: msgId
        });
        activeCalls.delete(callId);
    }
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
    
    // Send BYE if call is active
    if (call.sipCallId) {
        const ua = sipUAs.get(call.dn);
        if (ua && ua.isConnected()) {
            const bye = [
                `BYE sip:${call.to}@${SIP_DOMAIN} SIP/2.0`,
                `Via: SIP/2.0/WS ${ua._transport._via_host};branch=${call.branch}`,
                `Max-Forwards: 69`,
                `To: <sip:${call.to}@${SIP_DOMAIN}>`,
                `From: "${call.dn}" <sip:${call.dn}@${SIP_DOMAIN}>;tag=${call.fromTag}`,
                `Call-ID: ${call.sipCallId}`,
                `CSeq: ${call.cseq + 1} BYE`,
                `Content-Length: 0`,
                ``,
                ``
            ].join('\r\n');
            
            try {
                ua._transport.send(bye);
                console.log(`[SIP] Sent BYE for call ${callId}`);
            } catch (error) {
                console.error(`[SIP] Failed to send BYE:`, error);
            }
        }
    }
    
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

