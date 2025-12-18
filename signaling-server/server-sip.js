#!/usr/bin/env node

/**
 * WebRTC Gateway Service - Node.js SIP Implementation
 * 
 * Uses native Node.js 'sip' package for proper server-side SIP
 * - No browser dependencies
 * - Full SIP digest authentication support
 * - Clean REST API for WWE integration
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const sip = require('sip');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Configuration
const HTTP_PORT = process.env.HTTP_PORT || 8084;
const SIP_SERVER = process.env.SIP_SERVER || '192.168.210.54';
const SIP_PORT = process.env.SIP_PORT || 5060;
const SIP_DOMAIN = process.env.SIP_DOMAIN || SIP_SERVER;

// Express app
const app = express();
const httpServer = http.createServer(app);

// Body parsers
app.use(express.json());
app.use(express.text());

// In-memory storage
const sessions = new Map(); // agentId -> { dn, password, registrationState, callId, contactUri, localPort }
const activeCalls = new Map(); // callId -> { agentId, destination, dialog, sdpOffer, state }
const pendingMessages = new Map(); // agentId -> [{ type, sdp, from, callId }]

// SIP User Agent Configuration
const sipStack = {
    localPort: 5071,  // Local SIP port for our gateway (avoiding conflict with Asterisk 5070)
    hostname: SIP_SERVER,
    publicAddress: SIP_SERVER
};

console.log(`
============================================================
WebRTC Gateway Service (Native SIP)
============================================================
HTTP API Port: ${HTTP_PORT}
SIP Server: ${SIP_SERVER}:${SIP_PORT}
Local SIP Port: ${sipStack.localPort}
============================================================
`);

// ==================================================
// SIP DIGEST AUTHENTICATION
// ==================================================

function calculateDigestResponse(username, password, realm, nonce, method, uri, qop, nc, cnonce) {
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

function parseAuthHeader(header) {
    const auth = {};
    const regex = /(\w+)=("([^"]+)"|([^,\s]+))/g;
    let match;
    while ((match = regex.exec(header)) !== null) {
        auth[match[1]] = match[3] || match[4];
    }
    return auth;
}

function buildAuthorizationHeader(username, password, method, uri, authChallenge) {
    const nc = '00000001';
    const cnonce = crypto.randomBytes(8).toString('hex');
    
    const response = calculateDigestResponse(
        username,
        password,
        authChallenge.realm,
        authChallenge.nonce,
        method,
        uri,
        authChallenge.qop,
        nc,
        cnonce
    );
    
    let authHeader = `Digest username="${username}", realm="${authChallenge.realm}", nonce="${authChallenge.nonce}", uri="${uri}", response="${response}", algorithm=MD5`;
    
    if (authChallenge.opaque) {
        authHeader += `, opaque="${authChallenge.opaque}"`;
    }
    
    if (authChallenge.qop) {
        authHeader += `, qop=${authChallenge.qop}, nc=${nc}, cnonce="${cnonce}"`;
    }
    
    return authHeader;
}

// ==================================================
// SIP MESSAGE HANDLING
// ==================================================

// Start SIP listener
sip.start({ port: sipStack.localPort, hostname: sipStack.hostname }, (request) => {
    console.log(`[SIP] Received ${request.method} from ${request.headers.from.uri}`);
    
    if (request.method === 'INVITE') {
        handleIncomingSIPInvite(request);
    } else if (request.method === 'BYE') {
        handleIncomingSIPBye(request);
    } else if (request.method === 'ACK') {
        // ACK is part of three-way handshake, no response needed
        console.log(`[SIP] ACK received for call`);
    } else {
        // Send 405 Method Not Allowed for unsupported methods
        sip.send(sip.makeResponse(request, 405, 'Method Not Allowed'));
    }
});

function handleIncomingSIPInvite(request) {
    // Extract SDP offer from incoming INVITE
    const sdpOffer = request.content;
    const fromUri = request.headers.from.uri;
    const toUri = request.headers.to.uri;
    
    console.log(`[CALL] Incoming call from ${fromUri} to ${toUri}`);
    
    // Find which agent this call is for (by DN)
    const toDn = toUri.split('@')[0].replace('sip:', '');
    let targetAgent = null;
    
    for (const [agentId, session] of sessions.entries()) {
        if (session.dn === toDn) {
            targetAgent = agentId;
            break;
        }
    }
    
    if (!targetAgent) {
        console.error(`[CALL] No agent registered for DN ${toDn}`);
        sip.send(sip.makeResponse(request, 404, 'Not Found'));
        return;
    }
    
    // Queue the offer for the agent to poll
    const callId = `call-${Date.now()}`;
    const messages = pendingMessages.get(targetAgent) || [];
    messages.push({
        type: 'OFFER',
        sdp: sdpOffer,
        from: fromUri,
        callId
    });
    pendingMessages.set(targetAgent, messages);
    
    // Store call state (we'll send 180 Ringing for now)
    activeCalls.set(callId, {
        agentId: targetAgent,
        direction: 'incoming',
        sipRequest: request,
        state: 'ringing'
    });
    
    // Send 180 Ringing
    sip.send(sip.makeResponse(request, 180, 'Ringing'));
    
    console.log(`[CALL] Call ${callId} queued for agent ${targetAgent}`);
}

function handleIncomingSIPBye(request) {
    console.log(`[SIP] BYE received, ending call`);
    sip.send(sip.makeResponse(request, 200, 'OK'));
}

// ==================================================
// REST API ENDPOINTS
// ==================================================

/**
 * SIGN IN - Register agent
 */
app.get('/api/webrtc/sign_in', (req, res) => {
    const { id, dn, password } = req.query;
    
    if (!id || !dn || !password) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    console.log(`[SIGN-IN] Agent ${id} (DN: ${dn})`);
    
    // Store session
    sessions.set(id, {
        dn,
        password,
        registrationState: 'registered',
        registeredAt: Date.now()
    });
    
    res.send('OK');
});

/**
 * PLACE CALL - Send SDP offer, initiate outbound call
 */
app.post('/api/webrtc/message', async (req, res) => {
    const { from, to } = req.query;
    const sdpOffer = req.body;
    
    if (!from || !to) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    
    const session = sessions.get(from);
    if (!session) {
        return res.status(404).json({ error: 'Agent not signed in' });
    }
    
    console.log(`[CALL] Agent ${from} calling ${to}`);
    
    const callId = `call-${Date.now()}`;
    const fromUri = `sip:${session.dn}@${SIP_DOMAIN}`;
    const toUri = `sip:${to}@${SIP_DOMAIN}`;
    
    // Build INVITE request
    const invite = {
        method: 'INVITE',
        uri: toUri,
        headers: {
            to: { uri: toUri },
            from: { uri: fromUri, params: { tag: crypto.randomBytes(8).toString('hex') } },
            'call-id': callId,
            cseq: { seq: 1, method: 'INVITE' },
            contact: [{ uri: `sip:${session.dn}@${sipStack.publicAddress}:${sipStack.localPort}` }],
            'content-type': 'application/sdp',
            'user-agent': 'WebRTC-Gateway/1.0'
        },
        content: sdpOffer
    };
    
    // Store call state
    activeCalls.set(callId, {
        agentId: from,
        destination: to,
        direction: 'outgoing',
        sdpOffer,
        state: 'calling',
        invite,
        cseq: 1
    });
    
    // Send INVITE (this will handle authentication automatically)
    try {
        await sendSIPRequest(invite, session);
        res.send('OK');
    } catch (error) {
        console.error(`[CALL] Failed to send INVITE:`, error);
        activeCalls.delete(callId);
        res.status(500).json({ error: error.message });
    }
});

async function sendSIPRequest(request, session, authChallenge = null) {
    return new Promise((resolve, reject) => {
        // Add authorization if we have auth challenge
        if (authChallenge) {
            const uri = typeof request.uri === 'string' ? request.uri : request.uri.uri || request.uri;
            const authHeader = buildAuthorizationHeader(
                session.dn,
                session.password,
                request.method,
                uri,
                authChallenge
            );
            request.headers.authorization = authHeader;
            request.headers.cseq.seq++;
        }
        
        console.log(`[SIP] Sending ${request.method} to ${SIP_SERVER}:${SIP_PORT}`);
        
        sip.send(request, (response) => {
            console.log(`[SIP] Received ${response.status} ${response.reason}`);
            
            if (response.status === 401 || response.status === 407) {
                // Authentication challenge
                const authHeaderName = response.status === 401 ? 'www-authenticate' : 'proxy-authenticate';
                const authHeader = response.headers[authHeaderName];
                
                if (!authHeader) {
                    return reject(new Error('No auth challenge in 401/407 response'));
                }
                
                const challenge = parseAuthHeader(authHeader);
                console.log(`[AUTH] Received challenge, realm: ${challenge.realm}`);
                
                // Resend with authentication
                sendSIPRequest(request, session, challenge)
                    .then(resolve)
                    .catch(reject);
                    
            } else if (response.status >= 200 && response.status < 300) {
                // Success
                handleSuccessResponse(response, request);
                resolve(response);
                
            } else if (response.status >= 100 && response.status < 200) {
                // Provisional response
                console.log(`[CALL] ${response.status} ${response.reason}`);
                
            } else {
                // Error
                reject(new Error(`${response.status} ${response.reason}`));
            }
        });
    });
}

function handleSuccessResponse(response, request) {
    const callId = request.headers['call-id'];
    const call = activeCalls.get(callId);
    
    if (!call) return;
    
    if (request.method === 'INVITE' && response.status === 200) {
        // Call answered - extract SDP answer
        const sdpAnswer = response.content;
        console.log(`[CALL] Call ${callId} answered`);
        
        // Queue answer for agent
        const messages = pendingMessages.get(call.agentId) || [];
        messages.push({
            type: 'ANSWER',
            sdp: sdpAnswer,
            callId
        });
        pendingMessages.set(call.agentId, messages);
        
        // Send ACK
        const ack = {
            method: 'ACK',
            uri: request.uri,
            headers: {
                to: response.headers.to,
                from: request.headers.from,
                'call-id': callId,
                cseq: { seq: request.headers.cseq.seq, method: 'ACK' },
                via: request.headers.via
            }
        };
        
        sip.send(ack);
        console.log(`[SIP] Sent ACK for call ${callId}`);
        
        call.state = 'active';
        call.dialog = {
            localTag: request.headers.from.params.tag,
            remoteTag: response.headers.to.params.tag,
            callId: callId
        };
    }
}

/**
 * POLL FOR MESSAGES - Get SDP answer
 */
app.get('/api/webrtc/message', (req, res) => {
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({ error: 'Missing "id" parameter' });
    }
    
    const messages = pendingMessages.get(id) || [];
    
    if (messages.length > 0) {
        const message = messages.shift();
        pendingMessages.set(id, messages);
        
        // Return SDP in body
        res.type('text/plain').send(message.sdp);
    } else {
        res.status(204).end();
    }
});

/**
 * SIGN OUT
 */
app.get('/api/webrtc/sign_out', (req, res) => {
    const { id } = req.query;
    
    if (id) {
        console.log(`[SIGN-OUT] Agent ${id}`);
        sessions.delete(id);
        pendingMessages.delete(id);
    }
    
    res.send('OK');
});

/**
 * HEALTH CHECK
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'webrtc-gateway',
        version: '2.0.0',
        implementation: 'native-sip',
        uptime: process.uptime(),
        registered_agents: sessions.size,
        active_calls: activeCalls.size
    });
});

/**
 * GET AGENTS
 */
app.get('/api/agents', (req, res) => {
    const agents = [];
    for (const [id, session] of sessions.entries()) {
        agents.push({
            id,
            dn: session.dn,
            registered_at: session.registeredAt
        });
    }
    res.json({ agents, count: agents.length });
});

/**
 * GET ACTIVE CALLS
 */
app.get('/api/calls/active', (req, res) => {
    const calls = [];
    for (const [callId, call] of activeCalls.entries()) {
        calls.push({
            call_id: callId,
            agent_id: call.agentId,
            direction: call.direction,
            state: call.state
        });
    }
    res.json({ calls, count: calls.length });
});

// ==================================================
// START SERVER
// ==================================================

httpServer.listen(HTTP_PORT, () => {
    console.log(`[HTTP] WebRTC Gateway API listening on port ${HTTP_PORT}`);
    console.log(`
✅ WebRTC Gateway Service started successfully!

API Endpoints:
  GET  /api/webrtc/sign_in?id=<agentId>&dn=<dn>&password=<password>
  POST /api/webrtc/message?from=<agentId>&to=<destination>  (Body: SDP offer)
  GET  /api/webrtc/message?id=<agentId>  (Poll for SDP answer)
  GET  /api/webrtc/sign_out?id=<agentId>
  GET  /api/health
  GET  /api/agents
  GET  /api/calls/active
`);
});

