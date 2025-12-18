// Custom WebRTC Client - No JsSIP
// Direct WebSocket + WebRTC API

class WebRTCClient {
    constructor() {
        this.ws = null;
        this.pc = null;
        this.localStream = null;
        this.remoteStream = null;
        this.registered = false;
        this.inCall = false;
        this.callId = null;
        this.dn = null;
        this.muted = false;
        this.onHold = false;
        this.messageId = 0;
        
        // ICE configuration
        this.iceConfig = {
            iceServers: [
                {
                    urls: 'turn:192.168.210.54:3478',
                    username: 'webrtc',
                    credential: 'Genesys2024!SecureTurn'
                }
            ],
            iceCandidatePoolSize: 10
        };
        
        this.init();
    }
    
    init() {
        this.log('🚀 Initializing WebRTC Client (Custom Signaling)');
        this.connectWebSocket();
    }
    
    connectWebSocket() {
        const wsUrl = `wss://${window.location.hostname}:8443/signaling`; // Custom signaling via Nginx WSS proxy
        this.log(`🔌 Connecting to ${wsUrl}...`);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.log('✅ WebSocket connected');
            this.updateStatus('Connected (not registered)');
        };
        
        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            this.handleMessage(msg);
        };
        
        this.ws.onerror = (error) => {
            this.log(`❌ WebSocket error: ${error}`);
        };
        
        this.ws.onclose = () => {
            this.log('⚠️ WebSocket closed, reconnecting in 3s...');
            this.updateStatus('Disconnected');
            setTimeout(() => this.connectWebSocket(), 3000);
        };
    }
    
    sendMessage(type, payload) {
        const msg = {
            type: type,
            payload: payload,
            id: `msg-${++this.messageId}`
        };
        this.ws.send(JSON.stringify(msg));
        return msg.id;
    }
    
    handleMessage(msg) {
        this.log(`📨 Received: ${msg.type}`);
        
        switch(msg.type) {
            case 'registered':
                this.handleRegistered(msg.payload);
                break;
            case 'registrationFailed':
                this.handleRegistrationFailed(msg.payload);
                break;
            case 'callProgress':
                this.handleCallProgress(msg.payload);
                break;
            case 'callAccepted':
                this.handleCallAccepted(msg.payload);
                break;
            case 'callEnded':
                this.handleCallEnded(msg.payload);
                break;
            case 'incomingCall':
                this.handleIncomingCall(msg.payload);
                break;
            case 'iceCandidate':
                this.handleRemoteIceCandidate(msg.payload);
                break;
            case 'error':
                this.handleError(msg.payload);
                break;
            default:
                this.log(`⚠️ Unknown message type: ${msg.type}`);
        }
    }
    
    // Registration
    async register(dn, password) {
        this.dn = dn;
        this.log(`📝 Registering DN ${dn}...`);
        
        this.sendMessage('register', {
            dn: dn,
            password: password,
            displayName: `Agent ${dn}`
        });
    }
    
    handleRegistered(payload) {
        this.registered = true;
        this.log(`✅ Registered as ${payload.dn} (expires: ${payload.expires}s)`);
        this.updateStatus(`Registered: ${payload.dn}`);
        document.getElementById('callBtn').disabled = false;
    }
    
    handleRegistrationFailed(payload) {
        this.log(`❌ Registration failed: ${payload.reason} (code: ${payload.code})`);
        this.updateStatus('Registration failed');
    }
    
    unregister() {
        this.log('📤 Unregistering...');
        this.sendMessage('unregister', { dn: this.dn });
        this.registered = false;
        this.updateStatus('Unregistered');
        document.getElementById('callBtn').disabled = true;
    }
    
    // Call Control
    async call(destination) {
        if (!this.registered) {
            this.log('❌ Not registered');
            return;
        }
        
        this.log(`📞 Calling ${destination}...`);
        this.callId = `call-${Date.now()}`;
        
        // Create PeerConnection
        await this.createPeerConnection();
        
        // Get user media
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });
            
            this.localStream.getTracks().forEach(track => {
                this.pc.addTrack(track, this.localStream);
            });
            
            this.log('🎤 Microphone access granted');
        } catch (error) {
            this.log(`❌ Microphone error: ${error.message}`);
            return;
        }
        
        // Create SDP offer
        try {
            const offer = await this.pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false
            });
            
            await this.pc.setLocalDescription(offer);
            
            this.log('📤 Sending INVITE with SDP offer');
            
            this.sendMessage('call', {
                to: destination,
                callId: this.callId,
                sdp: offer.sdp
            });
            
            this.inCall = true;
            this.updateButtons(true);
            
        } catch (error) {
            this.log(`❌ Call failed: ${error.message}`);
        }
    }
    
    async createPeerConnection() {
        this.pc = new RTCPeerConnection(this.iceConfig);
        
        this.log('🔌 PeerConnection created');
        this.logNetworkDetails('📊 Configuration', this.iceConfig);
        
        // ICE gathering
        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.logIceCandidate(event.candidate);
                
                // Send candidate to server
                this.sendMessage('iceCandidate', {
                    callId: this.callId,
                    candidate: {
                        candidate: event.candidate.candidate,
                        sdpMid: event.candidate.sdpMid,
                        sdpMLineIndex: event.candidate.sdpMLineIndex
                    }
                });
            } else {
                this.log('✅ ICE gathering complete');
            }
        };
        
        // ICE connection state
        this.pc.oniceconnectionstatechange = () => {
            this.log(`🔍 ICE Connection: ${this.pc.iceConnectionState}`);
            if (this.pc.iceConnectionState === 'connected') {
                this.displaySelectedPath();
            }
        };
        
        // ICE gathering state
        this.pc.onicegatheringstatechange = () => {
            this.log(`🔍 ICE Gathering: ${this.pc.iceGatheringState}`);
        };
        
        // Signaling state
        this.pc.onsignalingstatechange = () => {
            this.log(`📡 Signaling: ${this.pc.signalingState}`);
        };
        
        // Remote stream
        this.pc.ontrack = (event) => {
            this.log('🎵 Remote audio stream received');
            const remoteAudio = document.getElementById('remoteAudio');
            remoteAudio.srcObject = event.streams[0];
            this.remoteStream = event.streams[0];
        };
    }
    
    handleCallProgress(payload) {
        this.log(`📞 Call ${payload.state}: ${payload.callId}`);
        this.updateStatus(`Call ${payload.state}`);
    }
    
    async handleCallAccepted(payload) {
        this.log(`✅ Call accepted`);
        
        // Set remote SDP
        try {
            const answer = new RTCSessionDescription({
                type: 'answer',
                sdp: payload.sdp
            });
            
            await this.pc.setRemoteDescription(answer);
            this.log('📥 Remote SDP set');
            this.updateStatus('In call');
            
        } catch (error) {
            this.log(`❌ Failed to set remote SDP: ${error.message}`);
        }
    }
    
    hangup() {
        this.log('📴 Hanging up...');
        
        this.sendMessage('hangup', {
            callId: this.callId,
            reason: 'user_hangup'
        });
        
        this.cleanup();
    }
    
    handleCallEnded(payload) {
        this.log(`📴 Call ended: ${payload.reason} (duration: ${payload.duration}s)`);
        this.cleanup();
    }
    
    cleanup() {
        // Stop local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        // Close peer connection
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }
        
        // Stop remote audio
        const remoteAudio = document.getElementById('remoteAudio');
        remoteAudio.srcObject = null;
        
        this.inCall = false;
        this.callId = null;
        this.muted = false;
        this.onHold = false;
        
        this.updateButtons(false);
        this.updateStatus(this.registered ? `Registered: ${this.dn}` : 'Not registered');
    }
    
    // Call features
    toggleMute() {
        if (!this.localStream) return;
        
        this.muted = !this.muted;
        this.localStream.getAudioTracks().forEach(track => {
            track.enabled = !this.muted;
        });
        
        this.log(this.muted ? '🔇 Muted' : '🔊 Unmuted');
        document.getElementById('muteBtn').textContent = this.muted ? 'Unmute' : 'Mute';
    }
    
    toggleHold() {
        this.onHold = !this.onHold;
        
        this.sendMessage('hold', {
            callId: this.callId,
            hold: this.onHold
        });
        
        this.log(this.onHold ? '⏸️ Call on hold' : '▶️ Call resumed');
        document.getElementById('holdBtn').textContent = this.onHold ? 'Resume' : 'Hold';
    }
    
    sendDTMF(digit) {
        if (!this.inCall) {
            this.log('⚠️ Not in call');
            return;
        }
        
        this.log(`🔢 DTMF: ${digit}`);
        
        this.sendMessage('dtmf', {
            callId: this.callId,
            digit: digit
        });
        
        // Also send via RTC
        if (this.pc) {
            const sender = this.pc.getSenders().find(s => s.track && s.track.kind === 'audio');
            if (sender && sender.dtmf) {
                sender.dtmf.insertDTMF(digit, 100, 70);
            }
        }
    }
    
    handleIncomingCall(payload) {
        this.log(`📞 Incoming call from ${payload.from} (${payload.displayName})`);
        // TODO: Implement answer UI
    }
    
    handleRemoteIceCandidate(payload) {
        if (!this.pc) return;
        
        const candidate = new RTCIceCandidate(payload.candidate);
        this.pc.addIceCandidate(candidate)
            .then(() => this.log('✅ Remote ICE candidate added'))
            .catch(e => this.log(`❌ Failed to add remote candidate: ${e.message}`));
    }
    
    handleError(payload) {
        this.log(`❌ Error: ${payload.message} (code: ${payload.code})`);
        if (payload.details) {
            this.log(`   Details: ${payload.details}`);
        }
    }
    
    // Network logging
    logIceCandidate(candidate) {
        const parts = candidate.candidate.split(' ');
        const type = parts[7];
        const ip = parts[4];
        const port = parts[5];
        const protocol = parts[2];
        const priority = parts[3];
        
        let emoji = '🏠';
        let typeLabel = 'HOST';
        
        if (type === 'srflx') {
            emoji = '🌐';
            typeLabel = 'SRFLX';
        } else if (type === 'relay') {
            emoji = '🔄';
            typeLabel = 'RELAY';
        }
        
        this.logNetworkDetails(`${emoji} Candidate [${typeLabel}]`, {
            ip: ip,
            port: port,
            protocol: protocol.toUpperCase(),
            priority: priority,
            type: type
        });
    }
    
    async displaySelectedPath() {
        if (!this.pc) return;
        
        const stats = await this.pc.getStats();
        let selectedPair = null;
        
        stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded') {
                selectedPair = report;
            }
        });
        
        if (!selectedPair) return;
        
        // Get local and remote candidates
        let localCandidate = null;
        let remoteCandidate = null;
        
        stats.forEach(report => {
            if (report.type === 'local-candidate' && report.id === selectedPair.localCandidateId) {
                localCandidate = report;
            }
            if (report.type === 'remote-candidate' && report.id === selectedPair.remoteCandidateId) {
                remoteCandidate = report;
            }
        });
        
        if (localCandidate && remoteCandidate) {
            this.logNetworkDetails('🎯 SELECTED NETWORK PATH', {
                local: `${localCandidate.candidateType} ${localCandidate.address}:${localCandidate.port} ${localCandidate.protocol}`,
                remote: `${remoteCandidate.candidateType} ${remoteCandidate.address}:${remoteCandidate.port} ${remoteCandidate.protocol}`,
                rtt: `${selectedPair.currentRoundTripTime ? (selectedPair.currentRoundTripTime * 1000).toFixed(2) : 'N/A'} ms`,
                bytesSent: selectedPair.bytesSent,
                bytesReceived: selectedPair.bytesReceived
            });
        }
    }
    
    // UI helpers
    updateStatus(status) {
        document.getElementById('status').textContent = `Status: ${status}`;
    }
    
    updateButtons(inCall) {
        document.getElementById('callBtn').disabled = inCall;
        document.getElementById('hangupBtn').disabled = !inCall;
        document.getElementById('muteBtn').disabled = !inCall;
        document.getElementById('holdBtn').disabled = !inCall;
    }
    
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logDiv = document.getElementById('log');
        logDiv.innerHTML += `[${timestamp}] ${message}<br>`;
        logDiv.scrollTop = logDiv.scrollHeight;
        console.log(`[${timestamp}] ${message}`);
    }
    
    logNetworkDetails(title, details) {
        const networkLog = document.getElementById('networkLog');
        let html = `<div style="border: 1px solid #ccc; padding: 10px; margin: 5px 0; background: #f9f9f9;">`;
        html += `<strong>${title}</strong><br>`;
        
        if (typeof details === 'object') {
            for (const [key, value] of Object.entries(details)) {
                html += `${key}: ${JSON.stringify(value)}<br>`;
            }
        } else {
            html += details;
        }
        
        html += `</div>`;
        networkLog.innerHTML += html;
        networkLog.scrollTop = networkLog.scrollHeight;
    }
}

// Global instance
let client;

// Initialize on load
window.addEventListener('load', () => {
    client = new WebRTCClient();
    
    // Register form
    document.getElementById('registerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const dn = document.getElementById('dn').value;
        const password = document.getElementById('password').value;
        client.register(dn, password);
    });
    
    // Unregister
    document.getElementById('unregisterBtn').addEventListener('click', () => {
        client.unregister();
    });
    
    // Call
    document.getElementById('callBtn').addEventListener('click', () => {
        const destination = document.getElementById('destination').value;
        client.call(destination);
    });
    
    // Hangup
    document.getElementById('hangupBtn').addEventListener('click', () => {
        client.hangup();
    });
    
    // Mute
    document.getElementById('muteBtn').addEventListener('click', () => {
        client.toggleMute();
    });
    
    // Hold
    document.getElementById('holdBtn').addEventListener('click', () => {
        client.toggleHold();
    });
});

// Global DTMF function
function sendDTMF(digit) {
    if (client) {
        client.sendDTMF(digit);
    }
}

