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
    activeCalls.set(callId, {
        sipCallId,
        fromTag,
        branch,
        agentId: from,
        dn,
        to,
        cseq: 1,
        direction: 'outgoing',
        ua
    });
    
    // Hook into UA's transport to intercept SIP responses
    const transport = ua._transport;
    const existingHandler = transport._onMessage;
    
    transport._onMessage = function(e) {
        const message = e.data;
        
        // Check if this message is for our call
        if (message.includes(sipCallId)) {
            handleSIPResponse(message, callId, from);
        }
        
        // Call original handler
        if (existingHandler) {
            existingHandler.call(transport, e);
        }
    };
    
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

