#!/usr/bin/env node

/**
 * Test WWE Client
 * 
 * Simulates WWE making REST API calls to the WebRTC Gateway
 */

const http = require('http');

const GATEWAY_HOST = process.env.GATEWAY_HOST || 'localhost';
const GATEWAY_PORT = process.env.GATEWAY_PORT || 8082;
const AGENT_ID = process.env.AGENT_ID || 'test-agent-001';
const AGENT_DN = process.env.AGENT_DN || '5001';
const AGENT_PASSWORD = process.env.AGENT_PASSWORD || 'Genesys2024!WebRTC';
const DESTINATION = process.env.DESTINATION || '1003';

console.log('='.repeat(60));
console.log('WWE Test Client');
console.log('='.repeat(60));
console.log(`Gateway: ${GATEWAY_HOST}:${GATEWAY_PORT}`);
console.log(`Agent ID: ${AGENT_ID}`);
console.log(`Agent DN: ${AGENT_DN}`);
console.log(`Destination: ${DESTINATION}`);
console.log('='.repeat(60));

/**
 * Make HTTP request
 */
function makeRequest(method, path, body, contentType) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: GATEWAY_HOST,
            port: GATEWAY_PORT,
            path: path,
            method: method,
            headers: {}
        };
        
        if (body) {
            options.headers['Content-Type'] = contentType || 'text/plain';
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        
        req.on('error', reject);
        
        if (body) {
            req.write(body);
        }
        
        req.end();
    });
}

/**
 * Step 1: Sign In
 */
async function signIn() {
    console.log('\n[1] Signing in...');
    
    const path = `/api/webrtc/sign_in?id=${AGENT_ID}&dn=${AGENT_DN}&password=${encodeURIComponent(AGENT_PASSWORD)}`;
    
    const response = await makeRequest('GET', path);
    
    if (response.status === 200) {
        console.log('✅ Sign-in successful');
        return true;
    } else {
        console.error('❌ Sign-in failed:', response.status, response.body);
        return false;
    }
}

/**
 * Step 2: Generate dummy SDP offer
 */
function generateDummySDP() {
    // This is a minimal SDP for testing
    // In real WWE, this would come from RTCPeerConnection.createOffer()
    return `v=0
o=- 1234567890 1234567890 IN IP4 127.0.0.1
s=-
c=IN IP4 127.0.0.1
t=0 0
m=audio 9 UDP/TLS/RTP/SAVPF 0 8 9
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:9 G722/8000
a=sendrecv
a=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00
a=setup:actpass
a=ice-ufrag:TEST
a=ice-pwd:TESTPASSWORD123456789012
`;
}

/**
 * Step 3: Place Call
 */
async function placeCall() {
    console.log(`\n[2] Placing call to ${DESTINATION}...`);
    
    const sdpOffer = generateDummySDP();
    const path = `/api/webrtc/message?from=${AGENT_ID}&to=${DESTINATION}`;
    
    const response = await makeRequest('POST', path, sdpOffer, 'text/plain');
    
    if (response.status === 200) {
        console.log('✅ Call initiated');
        return true;
    } else {
        console.error('❌ Call initiation failed:', response.status, response.body);
        return false;
    }
}

/**
 * Step 4: Poll for Answer
 */
async function pollForAnswer(maxAttempts = 30) {
    console.log('\n[3] Polling for SDP answer...');
    
    for (let i = 0; i < maxAttempts; i++) {
        const path = `/api/webrtc/message?id=${AGENT_ID}`;
        const response = await makeRequest('GET', path);
        
        if (response.status === 200 && response.body) {
            console.log('✅ Received SDP answer:');
            console.log(response.body.substring(0, 200) + '...');
            return true;
        } else if (response.status === 204) {
            // No messages yet, continue polling
            process.stdout.write('.');
        } else {
            console.error('❌ Polling failed:', response.status);
            return false;
        }
        
        // Wait 1 second before next poll
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.error('\n❌ Timeout waiting for answer');
    return false;
}

/**
 * Step 5: Sign Out
 */
async function signOut() {
    console.log('\n[4] Signing out...');
    
    const path = `/api/webrtc/sign_out?id=${AGENT_ID}`;
    const response = await makeRequest('GET', path);
    
    if (response.status === 200) {
        console.log('✅ Signed out');
        return true;
    } else {
        console.error('❌ Sign-out failed:', response.status);
        return false;
    }
}

/**
 * Check Health
 */
async function checkHealth() {
    console.log('\n[0] Checking gateway health...');
    
    const response = await makeRequest('GET', '/api/health');
    
    if (response.status === 200) {
        const health = JSON.parse(response.body);
        console.log('✅ Gateway is healthy:');
        console.log(`   - Service: ${health.service}`);
        console.log(`   - Uptime: ${Math.floor(health.uptime)}s`);
        console.log(`   - Registered agents: ${health.registered_agents}`);
        console.log(`   - Active calls: ${health.active_calls}`);
        return true;
    } else {
        console.error('❌ Gateway health check failed');
        return false;
    }
}

/**
 * Main test flow
 */
async function main() {
    try {
        // Check health
        const healthy = await checkHealth();
        if (!healthy) {
            console.error('\n❌ Gateway is not healthy, exiting');
            process.exit(1);
        }
        
        // Sign in
        const signedIn = await signIn();
        if (!signedIn) {
            console.error('\n❌ Sign-in failed, exiting');
            process.exit(1);
        }
        
        // Wait a bit for registration to complete
        console.log('\nWaiting for registration to complete...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Place call
        const called = await placeCall();
        if (!called) {
            await signOut();
            process.exit(1);
        }
        
        // Poll for answer
        const answered = await pollForAnswer();
        if (!answered) {
            await signOut();
            process.exit(1);
        }
        
        // Keep call active for a few seconds
        console.log('\nCall is active, waiting 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Sign out (this will also end the call)
        await signOut();
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Test completed successfully!');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
main();

