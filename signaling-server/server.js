#!/usr/bin/env node

/**
 * WebRTC Gateway Service
 * 
 * Based on the architecture diagram:
 * - WWE Agents communicate via REST API (HTTP)
 * - Service translates REST → SIP
 * - Handles SDP offer/answer exchange
 * - Manages authentication with Asterisk
 */

require('dotenv').config();
const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const JsSIP = require('jssip');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Make WebSocket available globally for JsSIP
global.WebSocket = WebSocket;

// Configuration
const HTTP_PORT = process.env.HTTP_PORT || 8082;
const SIP_SERVER = process.env.SIP_SERVER || '192.168.210.54';
const SIP_PORT = process.env.SIP_PORT || 5060;
const SIP_WS_SERVER = process.env.SIP_WS_SERVER || `ws://${SIP_SERVER}:8080`;
const SIP_DOMAIN = process.env.SIP_DOMAIN || SIP_SERVER;

// Logging
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
JsSIP.debug.enable(LOG_LEVEL === 'debug' ? 'JsSIP:*' : 'JsSIP:ERROR');

console.log('='.repeat(60));
console.log('WebRTC Gateway Service');
console.log('='.repeat(60));
console.log(`HTTP API Port: ${HTTP_PORT}`);
console.log(`SIP Server: ${SIP_SERVER}:${SIP_PORT}`);
console.log(`SIP WebSocket: ${SIP_WS_SERVER}`);
console.log('='.repeat(60));

// Store active sessions
const sessions = new Map();        // User sessions by agentId
const pendingMessages = new Map(); // Pending SDP answers for polling
const sipUAs = new Map();          // JsSIP User Agents by agentId
const activeCalls = new Map();     // Active calls by callId


/**
 * HTTP REST API Server (WWE Integration)
 */
const app = express();
app.use(express.json());
app.use(express.text()); // For SDP content-type: text/plain

// ==================================================
// AGENT SIGN-IN (Register with SIP)
// ==================================================
app.get('/api/webrtc/sign_in', (req, res) => {
    const { id, dn, password } = req.query;
    
    if (!id || !dn || !password) {
        return res.status(400).json({ error: 'Missing id, dn, or password' });
    }
    
    console.log(`[SIGN-IN] Agent ${id} (DN: ${dn})`);
    
    // Create JsSIP User Agent
    const socket = new JsSIP.WebSocketInterface(SIP_WS_SERVER);
    const configuration = {
        sockets: [socket],
        uri: `sip:${dn}@${SIP_DOMAIN}`,
        password: password,
        display_name: id,
        register: true,
        session_timers: false
    };
    
    const ua = new JsSIP.UA(configuration);
    
    // UA Events
    ua.on('connected', () => {
        console.log(`[SIP] UA connected for agent ${id}`);
    });
    
    ua.on('registered', () => {
        console.log(`[SIP] Agent ${id} registered successfully`);
        
        sessions.set(id, {
            dn,
            registeredAt: Date.now(),
            ua
        });
        sipUAs.set(id, ua);
        pendingMessages.set(id, []);
        
        res.status(200).send('OK');
    });
    
    ua.on('registrationFailed', (e) => {
        console.error(`[SIP] Registration failed for agent ${id}:`, e.cause);
        res.status(401).json({ error: `Registration failed: ${e.cause}` });
    });
    
    ua.on('unregistered', () => {
        console.log(`[SIP] Agent ${id} unregistered`);
        sessions.delete(id);
        sipUAs.delete(id);
        pendingMessages.delete(id);
    });
    
    // Handle incoming calls
    ua.on('newRTCSession', (e) => {
        const session = e.session;
        
        if (session.direction === 'incoming') {
            handleIncomingCall(id, session);
        }
    });
    
    // Start the UA
    ua.start();
});

/**
 * Handle incoming SIP call
 */
function handleIncomingCall(agentId, session) {
    const callId = uuidv4();
    const remoteIdentity = session.remote_identity.uri.user;
    
    console.log(`[CALL] Incoming call for agent ${agentId} from ${remoteIdentity}`);
    
    // Get SDP offer from incoming INVITE
    const offer = session.connection.remoteDescription.sdp;
    
    // Store call session
    activeCalls.set(callId, {
        session,
        agentId,
        remote: remoteIdentity,
        direction: 'incoming'
    });
    
    // Queue ROAP message for agent to poll
    const messages = pendingMessages.get(agentId) || [];
    messages.push({
        type: 'OFFER',
        sdp: offer,
        from: remoteIdentity,
        callId
    });
    pendingMessages.set(agentId, messages);
    
    // Session events
    session.on('accepted', () => {
        console.log(`[CALL] Call ${callId} accepted`);
    });
    
    session.on('ended', () => {
        console.log(`[CALL] Call ${callId} ended`);
        activeCalls.delete(callId);
    });
    
    session.on('failed', (e) => {
        console.log(`[CALL] Call ${callId} failed:`, e.cause);
        activeCalls.delete(callId);
    });
}

// ==================================================
// PLACE CALL (Send SDP Offer)
// ==================================================
app.post('/api/webrtc/message', (req, res) => {
    const { from, to } = req.query;
    const sdpOffer = req.body; // ROAP content (SDP offer)
    
    if (!from) {
        return res.status(400).json({ error: 'Missing "from" parameter' });
    }
    
    if (!to) {
        return res.status(400).json({ error: 'Missing "to" parameter' });
    }
    
    if (!sdpOffer || typeof sdpOffer !== 'string') {
        return res.status(400).json({ error: 'Missing SDP offer in body' });
    }
    
    console.log(`[CALL] Agent ${from} calling ${to}`);
    
    const session = sessions.get(from);
    if (!session) {
        return res.status(404).json({ error: 'Agent not signed in' });
    }
    
    const ua = session.ua;
    if (!ua || !ua.isConnected()) {
        return res.status(503).json({ error: 'SIP UA not connected' });
    }
    
    const callId = `call-${Date.now()}`;
    const dn = session.dn;
    
    // Generate SIP identifiers
    const sipCallId = `${callId}-${Date.now()}`;
    const fromTag = Math.random().toString(36).substring(2, 12);
    const branch = `z9hG4bK${Math.random().toString(36).substring(2, 12)}`;
    
    // Get via and contact from UA
    let via, contact;
    try {
        via = ua._configuration.via_host || ua._configuration.uri._host;
        contact = ua._contact.toString();
        console.log(`[CALL] Via: ${via}, Contact: ${contact}`);
    } catch (error) {
        console.error(`[CALL] Failed to get UA properties:`, error);
        return res.status(500).json({ error: `Failed to get UA properties: ${error.message}` });
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
        `User-Agent: WebRTC-Gateway/1.0`,
        `Content-Type: application/sdp`,
        `Content-Length: ${sdpOffer.length}`,
        ``,
        sdpOffer
    ].join('\r\n');
    
    // Store call session info
    const callInfo = {
        sipCallId,
        fromTag,
        branch,
        agentId: from,
        dn,
        to,
        cseq: 1,
        direction: 'outgoing',
        ua,
        sdpOffer  // Store the SDP offer for re-sending with auth
    };
    
    activeCalls.set(callId, callInfo);
    
    // Store password in session for auth (already stored in sessions Map)
    // session.password is available from sign-in
    
    // Hook into UA's transport to intercept SIP responses
    // Use addEventListener instead of overriding _onMessage
    const transport = ua._transport;
    
    // Create a handler for this specific call
    const responseHandler = function(e) {
        if (typeof e.data === 'string') {
            const message = e.data;
            
            // Check if this message is for our call
            if (message.includes(sipCallId)) {
                console.log(`[SIP] Received message for call ${callId}`);
                handleSIPResponse(message, callId, from);
            }
        }
    };
    
    // Store handler reference so we can remove it later
    callInfo.responseHandler = responseHandler;
    
    // Debug: Log transport properties
    console.log(`[DEBUG] Transport properties:`, Object.keys(transport));
    console.log(`[DEBUG] Has _ws:`, !!transport._ws);
    console.log(`[DEBUG] Has ws:`, !!transport.ws);
    console.log(`[DEBUG] Has socket:`, !!transport.socket);
    console.log(`[DEBUG] Has _socket:`, !!transport._socket);
    
    // Listen to WebSocket messages - try different property names
    let wsSocket = transport._ws || transport.ws || transport.socket || transport._socket;
    
    if (wsSocket && typeof wsSocket.addEventListener === 'function') {
        wsSocket.addEventListener('message', responseHandler);
        console.log(`[SIP] Attached response handler for call ${callId}`);
    } else if (wsSocket && typeof wsSocket.on === 'function') {
        // Try Node.js EventEmitter style
        wsSocket.on('message', responseHandler);
        console.log(`[SIP] Attached response handler (EventEmitter) for call ${callId}`);
    } else {
        console.error(`[SIP] Cannot attach handler - WebSocket not available or not compatible`);
        console.error(`[DEBUG] wsSocket type:`, typeof wsSocket);
    }
    
    // Send INVITE
    try {
        console.log(`[SIP] Sending INVITE for call ${callId}`);
        transport.send(invite);
        res.status(200).send('OK');
    } catch (error) {
        console.error(`[SIP] Failed to send INVITE:`, error);
        activeCalls.delete(callId);
        res.status(500).json({ error: `Failed to send INVITE: ${error.message}` });
    }
});

/**
 * Calculate SIP Digest Authentication Response
 */
function calculateDigestResponse(username, password, realm, nonce, method, uri, qop, nc, cnonce, algorithm = 'MD5') {
    const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
    const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');
    
    let response;
    if (qop === 'auth' || qop === 'auth-int') {
        response = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
    } else {
        response = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
    }
    
    return response;
}

/**
 * Parse WWW-Authenticate header
 */
function parseWWWAuthenticate(header) {
    const auth = {};
    const matches = header.match(/(\w+)="?([^",]+)"?/g);
    if (matches) {
        matches.forEach(match => {
            const [key, value] = match.split('=');
            auth[key] = value.replace(/"/g, '');
        });
    }
    return auth;
}

/**
 * Handle SIP responses for manual INVITE
 */
function handleSIPResponse(sipMessage, callId, agentId) {
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
        console.log(`[CALL] Call ${callId} - ${statusText}`);
    } else if (statusCode === 200) {
        // 200 OK - Call answered
        // Extract SDP from response
        const sdpMatch = sipMessage.match(/Content-Type: application\/sdp\r?\n\r?\n([\s\S]+)$/m);
        if (sdpMatch) {
            const answerSdp = sdpMatch[1].trim();
            console.log(`[CALL] Call ${callId} answered, queuing SDP answer`);
            
            // Queue answer for agent to poll
            const messages = pendingMessages.get(agentId) || [];
            messages.push({
                type: 'ANSWER',
                sdp: answerSdp,
                callId
            });
            pendingMessages.set(agentId, messages);
            
            // Send ACK
            const ua = call.ua;
            if (ua) {
                const via = ua._configuration.via_host || ua._configuration.uri._host;
                const ack = [
                    `ACK sip:${call.to}@${SIP_DOMAIN} SIP/2.0`,
                    `Via: SIP/2.0/WS ${via};branch=${call.branch}`,
                    `Max-Forwards: 69`,
                    `To: <sip:${call.to}@${SIP_DOMAIN}>`,
                    `From: "${call.dn}" <sip:${call.dn}@${SIP_DOMAIN}>;tag=${call.fromTag}`,
                    `Call-ID: ${call.sipCallId}`,
                    `CSeq: 1 ACK`,
                    `Content-Length: 0`,
                    ``,
                    ``
                ].join('\r\n');
                
                try {
                    ua._transport.send(ack);
                    console.log(`[SIP] Sent ACK for call ${callId}`);
                } catch (error) {
                    console.error(`[SIP] Failed to send ACK:`, error);
                }
            }
        }
    } else if (statusCode === 401 || statusCode === 407) {
        // Authentication required
        console.log(`[CALL] Call ${callId} requires authentication`);
        
        // Parse WWW-Authenticate header
        const wwwAuthMatch = sipMessage.match(/WWW-Authenticate: (.+)/);
        if (!wwwAuthMatch) {
            console.error(`[CALL] No WWW-Authenticate header found`);
            activeCalls.delete(callId);
            return;
        }
        
        const authParams = parseWWWAuthenticate(wwwAuthMatch[1]);
        console.log(`[AUTH] Challenge:`, authParams);
        
        // Get session info
        const session = sessions.get(agentId);
        if (!session) {
            console.error(`[AUTH] No session for agent ${agentId}`);
            activeCalls.delete(callId);
            return;
        }
        
        // Calculate response
        const nc = '00000001';
        const cnonce = Math.random().toString(36).substring(2, 12);
        const uri = `sip:${call.to}@${SIP_DOMAIN}`;
        
        const response = calculateDigestResponse(
            call.dn,
            session.password,
            authParams.realm,
            authParams.nonce,
            'INVITE',
            uri,
            authParams.qop,
            nc,
            cnonce,
            authParams.algorithm
        );
        
        // Build Authorization header
        let authHeader = `Digest username="${call.dn}", realm="${authParams.realm}", nonce="${authParams.nonce}", uri="${uri}", response="${response}", algorithm=${authParams.algorithm || 'MD5'}`;
        
        if (authParams.opaque) {
            authHeader += `, opaque="${authParams.opaque}"`;
        }
        
        if (authParams.qop) {
            authHeader += `, qop=${authParams.qop}, nc=${nc}, cnonce="${cnonce}"`;
        }
        
        // Increment CSeq
        call.cseq++;
        
        // Get SDP from original call (we need to retrieve the original SDP offer)
        const sdpMatch = sipMessage.match(/Content-Type: application\/sdp\r?\n\r?\n([\s\S]+)$/m);
        let originalSdp = '';
        
        // If we don't have the original SDP in the response, we need to get it from storage
        // For now, let's store it in the call object when we first create the INVITE
        if (call.sdpOffer) {
            originalSdp = call.sdpOffer;
        } else {
            console.error(`[AUTH] No SDP offer stored for call ${callId}`);
            activeCalls.delete(callId);
            return;
        }
        
        // Build authenticated INVITE
        const ua = call.ua;
        const via = ua._configuration.via_host || ua._configuration.uri._host;
        const newBranch = `z9hG4bK${Math.random().toString(36).substring(2, 12)}`;
        
        const authInvite = [
            `INVITE ${uri} SIP/2.0`,
            `Via: SIP/2.0/WS ${via};branch=${newBranch}`,
            `Max-Forwards: 69`,
            `To: <${uri}>`,
            `From: "${call.dn}" <sip:${call.dn}@${SIP_DOMAIN}>;tag=${call.fromTag}`,
            `Call-ID: ${call.sipCallId}`,
            `CSeq: ${call.cseq} INVITE`,
            `Contact: ${ua._contact.toString()}`,
            `Authorization: ${authHeader}`,
            `Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY`,
            `Supported: path,gruu,outbound`,
            `User-Agent: WebRTC-Gateway/1.0`,
            `Content-Type: application/sdp`,
            `Content-Length: ${originalSdp.length}`,
            ``,
            originalSdp
        ].join('\r\n');
        
        // Update call with new branch
        call.branch = newBranch;
        activeCalls.set(callId, call);
        
        // Send authenticated INVITE
        try {
            console.log(`[AUTH] Sending authenticated INVITE for call ${callId}`);
            ua._transport.send(authInvite);
        } catch (error) {
            console.error(`[AUTH] Failed to send authenticated INVITE:`, error);
            activeCalls.delete(callId);
        }
    } else if (statusCode >= 300) {
        // Error responses
        console.error(`[CALL] Call ${callId} failed: ${statusCode} ${statusText}`);
        activeCalls.delete(callId);
    }
}

// ==================================================
// POLL FOR MESSAGES (Get SDP Answer)
// ==================================================
app.get('/api/webrtc/message', (req, res) => {
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({ error: 'Missing "id" parameter' });
    }
    
    const messages = pendingMessages.get(id) || [];
    
    if (messages.length === 0) {
        // No messages, long-poll or return empty
        return res.status(204).send('');
    }
    
    // Return first message (ROAP content)
    const message = messages.shift();
    pendingMessages.set(id, messages);
    
    console.log(`[POLL] Agent ${id} received ${message.type} for call ${message.callId}`);
    
    // Return SDP as text/plain (ROAP content)
    res.status(200)
        .type('text/plain')
        .send(message.sdp);
});

// ==================================================
// SIGN OUT
// ==================================================
app.get('/api/webrtc/sign_out', (req, res) => {
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({ error: 'Missing "id" parameter' });
    }
    
    console.log(`[SIGN-OUT] Agent ${id}`);
    
    const ua = sipUAs.get(id);
    if (ua) {
        ua.unregister();
        ua.stop();
    }
    
    sessions.delete(id);
    sipUAs.delete(id);
    pendingMessages.delete(id);
    
    res.status(200).send('OK');
});

// ==================================================
// HEALTH CHECK
// ==================================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'webrtc-gateway',
        version: '1.0.0',
        uptime: process.uptime(),
        registered_agents: sessions.size,
        active_calls: activeCalls.size
    });
});

// ==================================================
// STATUS ENDPOINTS
// ==================================================
app.get('/api/agents', (req, res) => {
    const agents = Array.from(sessions.entries()).map(([id, session]) => ({
        id,
        dn: session.dn,
        registered_at: session.registeredAt
    }));
    
    res.json({ agents, count: agents.length });
});

app.get('/api/calls/active', (req, res) => {
    const calls = Array.from(activeCalls.entries()).map(([callId, call]) => ({
        call_id: callId,
        agent_id: call.agentId,
        remote: call.remote,
        direction: call.direction
    }));
    
    res.json({ calls, count: calls.length });
});

const server = http.createServer(app);
server.listen(HTTP_PORT, () => {
    console.log(`[HTTP] WebRTC Gateway API listening on port ${HTTP_PORT}`);
    console.log('\n✅ WebRTC Gateway Service started successfully!\n');
    console.log('API Endpoints:');
    console.log(`  GET  /api/webrtc/sign_in?id=<agentId>&dn=<dn>&password=<password>`);
    console.log(`  POST /api/webrtc/message?from=<agentId>&to=<destination>  (Body: SDP offer)`);
    console.log(`  GET  /api/webrtc/message?id=<agentId>  (Poll for SDP answer)`);
    console.log(`  GET  /api/webrtc/sign_out?id=<agentId>`);
    console.log(`  GET  /api/health`);
    console.log(`  GET  /api/agents`);
    console.log(`  GET  /api/calls/active`);
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[SHUTDOWN] Received SIGTERM, closing connections...');
    server.close();
    
    // Stop all UAs
    sipUAs.forEach(ua => ua.stop());
    
    process.exit(0);
});

