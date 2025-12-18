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
    
    if (!sdpOffer) {
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
    
    // Initiate SIP call
    try {
        const rtcSession = ua.call(`sip:${to}@${SIP_DOMAIN}`, {
            mediaConstraints: { audio: true, video: false },
            rtcOfferConstraints: {
                offerToReceiveAudio: true,
                offerToReceiveVideo: false
            }
        });
        
        // Override the SDP offer with the one from WWE
        rtcSession.connection.setLocalDescription({
            type: 'offer',
            sdp: sdpOffer
        });
        
        // Store call
        activeCalls.set(callId, {
            session: rtcSession,
            agentId: from,
            remote: to,
            direction: 'outgoing'
        });
        
        // Handle call events
        rtcSession.on('accepted', () => {
            console.log(`[CALL] Call ${callId} accepted`);
            
            // Get SDP answer
            const answer = rtcSession.connection.remoteDescription.sdp;
            
            // Queue answer for agent to poll
            const messages = pendingMessages.get(from) || [];
            messages.push({
                type: 'ANSWER',
                sdp: answer,
                callId
            });
            pendingMessages.set(from, messages);
        });
        
        rtcSession.on('failed', (e) => {
            console.error(`[CALL] Call ${callId} failed:`, e.cause);
            activeCalls.delete(callId);
        });
        
        rtcSession.on('ended', () => {
            console.log(`[CALL] Call ${callId} ended`);
            activeCalls.delete(callId);
        });
        
        res.status(200).send('OK');
        
    } catch (error) {
        console.error(`[CALL] Failed to initiate call:`, error);
        res.status(500).json({ error: error.message });
    }
});

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

