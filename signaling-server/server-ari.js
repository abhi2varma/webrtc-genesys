#!/usr/bin/env node

/**
 * WebRTC Gateway Service - Asterisk ARI Implementation
 * 
 * Uses Asterisk REST Interface (ARI) for clean SIP integration
 * - No manual SIP handling
 * - Asterisk handles all authentication
 * - WebSocket for real-time events
 * - Simple REST API for WWE
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Configuration
const HTTP_PORT = process.env.HTTP_PORT || 8084;
const ASTERISK_HOST = process.env.ASTERISK_HOST || '192.168.210.54';
const ASTERISK_ARI_PORT = process.env.ASTERISK_ARI_PORT || 8088;
const ASTERISK_ARI_USER = process.env.ASTERISK_ARI_USER || 'asterisk';
const ASTERISK_ARI_PASSWORD = process.env.ASTERISK_ARI_PASSWORD || 'asterisk';
const ARI_BASE_URL = `http://${ASTERISK_HOST}:${ASTERISK_ARI_PORT}/ari`;

// Express app
const app = express();
const httpServer = http.createServer(app);

// Body parsers
app.use(express.json());
app.use(express.text());

// In-memory storage
const sessions = new Map(); // agentId -> { dn, password, registeredAt }
const activeCalls = new Map(); // callId -> { agentId, channelId, destination, sdpOffer, state, bridgeId }
const pendingMessages = new Map(); // agentId -> [{ type, sdp, from, callId }]

console.log(`
============================================================
WebRTC Gateway Service (Asterisk ARI)
============================================================
HTTP API Port: ${HTTP_PORT}
Asterisk ARI: ${ASTERISK_HOST}:${ASTERISK_ARI_PORT}
============================================================
`);

// ==================================================
// ASTERISK ARI CONNECTION
// ==================================================

let ariWs = null;
let reconnectTimer = null;

function connectARI() {
    const wsUrl = `ws://${ASTERISK_HOST}:${ASTERISK_ARI_PORT}/ari/events?app=webrtc-gateway&api_key=${ASTERISK_ARI_USER}:${ASTERISK_ARI_PASSWORD}`;
    
    console.log('[ARI] Connecting to Asterisk ARI WebSocket...');
    
    ariWs = new WebSocket(wsUrl);
    
    ariWs.on('open', () => {
        console.log('[ARI] ✅ Connected to Asterisk ARI');
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    });
    
    ariWs.on('message', (data) => {
        try {
            const event = JSON.parse(data.toString());
            handleARIEvent(event);
        } catch (error) {
            console.error('[ARI] Failed to parse event:', error);
        }
    });
    
    ariWs.on('error', (error) => {
        console.error('[ARI] WebSocket error:', error.message);
    });
    
    ariWs.on('close', () => {
        console.log('[ARI] Disconnected from Asterisk ARI, reconnecting in 5s...');
        ariWs = null;
        reconnectTimer = setTimeout(connectARI, 5000);
    });
}

function handleARIEvent(event) {
    console.log(`[ARI] Event: ${event.type}`);
    
    switch (event.type) {
        case 'StasisStart':
            handleStasisStart(event);
            break;
        case 'StasisEnd':
            handleStasisEnd(event);
            break;
        case 'ChannelStateChange':
            handleChannelStateChange(event);
            break;
        case 'ChannelDestroyed':
            handleChannelDestroyed(event);
            break;
        default:
            // Log other events for debugging
            console.log(`[ARI] Unhandled event type: ${event.type}`);
    }
}

function handleStasisStart(event) {
    const channel = event.channel;
    console.log(`[ARI] Channel ${channel.id} entered Stasis app`);
    
    // Check if this is one of our outbound calls
    for (const [callId, call] of activeCalls.entries()) {
        if (call.channelId === channel.id) {
            console.log(`[CALL] Outbound call ${callId} channel started`);
            call.state = 'ringing';
            return;
        }
    }
    
    // Otherwise it's an inbound call
    const callerNum = channel.caller.number;
    const dialedNum = channel.dialplan.exten;
    
    console.log(`[CALL] Inbound call from ${callerNum} to ${dialedNum}`);
    
    // Find agent by DN
    let targetAgent = null;
    for (const [agentId, session] of sessions.entries()) {
        if (session.dn === dialedNum) {
            targetAgent = agentId;
            break;
        }
    }
    
    if (!targetAgent) {
        console.error(`[CALL] No agent registered for DN ${dialedNum}`);
        // Hangup the channel
        ariRequest('DELETE', `/channels/${channel.id}`).catch(err => {});
        return;
    }
    
    const callId = `call-${Date.now()}`;
    
    // Store call
    activeCalls.set(callId, {
        agentId: targetAgent,
        channelId: channel.id,
        direction: 'incoming',
        state: 'ringing'
    });
    
    // Ring the agent (queue OFFER)
    const messages = pendingMessages.get(targetAgent) || [];
    messages.push({
        type: 'OFFER',
        callId,
        from: callerNum
    });
    pendingMessages.set(targetAgent, messages);
    
    // Answer the channel and create bridge
    answerAndBridge(callId, channel.id);
}

function handleStasisEnd(event) {
    const channel = event.channel;
    console.log(`[ARI] Channel ${channel.id} left Stasis app`);
}

function handleChannelStateChange(event) {
    const channel = event.channel;
    console.log(`[ARI] Channel ${channel.id} state: ${channel.state}`);
    
    // Find call by channel ID
    for (const [callId, call] of activeCalls.entries()) {
        if (call.channelId === channel.id) {
            if (channel.state === 'Up') {
                console.log(`[CALL] Call ${callId} answered`);
                call.state = 'active';
                
                // Queue ANSWER message
                const messages = pendingMessages.get(call.agentId) || [];
                messages.push({
                    type: 'ANSWER',
                    callId,
                    sdp: 'dummy-sdp' // ARI handles media automatically
                });
                pendingMessages.set(call.agentId, messages);
            }
            break;
        }
    }
}

function handleChannelDestroyed(event) {
    const channel = event.channel;
    console.log(`[ARI] Channel ${channel.id} destroyed`);
    
    // Clean up call
    for (const [callId, call] of activeCalls.entries()) {
        if (call.channelId === channel.id) {
            console.log(`[CALL] Call ${callId} ended`);
            activeCalls.delete(callId);
            break;
        }
    }
}

async function answerAndBridge(callId, channelId) {
    try {
        // Answer the channel
        await ariRequest('POST', `/channels/${channelId}/answer`);
        console.log(`[ARI] Answered channel ${channelId}`);
        
        // Create a bridge
        const bridge = await ariRequest('POST', '/bridges', {
            type: 'mixing',
            name: `bridge-${callId}`
        });
        
        const call = activeCalls.get(callId);
        if (call) {
            call.bridgeId = bridge.id;
        }
        
        // Add channel to bridge
        await ariRequest('POST', `/bridges/${bridge.id}/addChannel`, {
            channel: channelId
        });
        
        console.log(`[ARI] Channel ${channelId} added to bridge ${bridge.id}`);
    } catch (error) {
        console.error(`[ARI] Failed to answer and bridge:`, error.message);
    }
}

// ==================================================
// ASTERISK ARI HTTP REQUESTS
// ==================================================

async function ariRequest(method, path, data = null) {
    const url = `${ARI_BASE_URL}${path}`;
    const auth = {
        username: ASTERISK_ARI_USER,
        password: ASTERISK_ARI_PASSWORD
    };
    
    try {
        const config = {
            method,
            url,
            auth,
            params: method === 'GET' || method === 'DELETE' ? data : undefined,
            data: method === 'POST' || method === 'PUT' ? data : undefined
        };
        
        const response = await axios(config);
        return response.data;
    } catch (error) {
        if (error.response) {
            throw new Error(`ARI ${error.response.status}: ${error.response.data.message || error.response.statusText}`);
        }
        throw error;
    }
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
        registeredAt: Date.now()
    });
    
    res.send('OK');
});

/**
 * PLACE CALL - Originate outbound call via Asterisk
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
    
    console.log(`[CALL] Agent ${from} (DN ${session.dn}) calling ${to}`);
    
    const callId = `call-${Date.now()}`;
    const channelId = `webrtc-${uuidv4()}`;
    
    try {
        // Originate call via ARI
        // endpoint: PJSIP/destination
        // app: webrtc-gateway (our Stasis app)
        // callerId: caller ID to present
        const originateData = {
            endpoint: `PJSIP/${to}`,
            app: 'webrtc-gateway',
            appArgs: `callId=${callId}`,
            callerId: `${session.dn}`,
            channelId: channelId,
            timeout: 30
        };
        
        const channel = await ariRequest('POST', '/channels', originateData);
        
        console.log(`[CALL] Originated channel ${channel.id} for call ${callId}`);
        
        // Store call
        activeCalls.set(callId, {
            agentId: from,
            channelId: channel.id,
            destination: to,
            direction: 'outgoing',
            sdpOffer,
            state: 'calling'
        });
        
        res.send('OK');
    } catch (error) {
        console.error(`[CALL] Failed to originate:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POLL FOR MESSAGES - Get SDP answer or incoming call
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
        
        // Return message as JSON
        res.json(message);
    } else {
        res.status(204).end();
    }
});

/**
 * ANSWER CALL - Agent answers incoming call
 */
app.post('/api/webrtc/answer', async (req, res) => {
    const { callId } = req.query;
    const sdpAnswer = req.body;
    
    const call = activeCalls.get(callId);
    if (!call) {
        return res.status(404).json({ error: 'Call not found' });
    }
    
    console.log(`[CALL] Agent answering call ${callId}`);
    
    // With ARI, the call is already answered and bridged
    // The SDP is handled by Asterisk automatically
    call.state = 'active';
    
    res.send('OK');
});

/**
 * HANGUP CALL
 */
app.post('/api/webrtc/hangup', async (req, res) => {
    const { callId } = req.query;
    
    const call = activeCalls.get(callId);
    if (!call) {
        return res.status(404).json({ error: 'Call not found' });
    }
    
    console.log(`[CALL] Hanging up call ${callId}`);
    
    try {
        // Hangup the channel
        await ariRequest('DELETE', `/channels/${call.channelId}`);
        
        // Destroy bridge if exists
        if (call.bridgeId) {
            await ariRequest('DELETE', `/bridges/${call.bridgeId}`).catch(() => {});
        }
        
        activeCalls.delete(callId);
        res.send('OK');
    } catch (error) {
        console.error(`[CALL] Failed to hangup:`, error.message);
        res.status(500).json({ error: error.message });
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
        version: '3.0.0',
        implementation: 'asterisk-ari',
        uptime: process.uptime(),
        registered_agents: sessions.size,
        active_calls: activeCalls.size,
        ari_connected: ariWs && ariWs.readyState === WebSocket.OPEN
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
            state: call.state,
            channel_id: call.channelId
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
  POST /api/webrtc/answer?callId=<callId>  (Body: SDP answer)
  POST /api/webrtc/hangup?callId=<callId>
  GET  /api/webrtc/sign_out?id=<agentId>
  GET  /api/health
  GET  /api/agents
  GET  /api/calls/active
`);
    
    // Connect to Asterisk ARI
    connectARI();
});

