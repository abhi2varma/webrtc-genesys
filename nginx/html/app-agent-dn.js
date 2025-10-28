// Genesys Agent WebRTC Client - SIP Endpoint Model
// All call control via Genesys Workspace Web Edition

class GenesysAgentClient {
    constructor() {
        this.ua = null;
        this.session = null;
        this.callStartTime = null;
        this.durationInterval = null;
        
        this.initializeElements();
        this.attachEventListeners();
        this.addDebugMessage('Agent WebRTC Client initialized', 'info');
        this.addDebugMessage('Use Genesys Workspace for all call controls', 'warning');
    }

    initializeElements() {
        // Connection elements
        this.sipServer = document.getElementById('sipServer');
        this.agentDN = document.getElementById('agentDN');
        this.agentPassword = document.getElementById('agentPassword');
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.connectionStatus = document.getElementById('connectionStatus');

        // Audio elements
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        this.remoteAudio = document.getElementById('remoteAudio');
        this.localAudio = document.getElementById('localAudio');
        this.ringbackTone = document.getElementById('ringbackTone');
        this.testTone = document.getElementById('testTone');

        // Status elements
        this.regStatus = document.getElementById('regStatus');
        this.callState = document.getElementById('callState');
        this.currentCall = document.getElementById('currentCall');
        this.callDuration = document.getElementById('callDuration');

        // Debug elements
        this.debugConsole = document.getElementById('debugConsole');
        this.clearDebugBtn = document.getElementById('clearDebugBtn');
        this.autoScrollDebug = document.getElementById('autoScrollDebug');
    }

    attachEventListeners() {
        // Connection buttons
        this.connectBtn.addEventListener('click', () => this.registerEndpoint());
        this.disconnectBtn.addEventListener('click', () => this.unregisterEndpoint());

        // Workspace button
        document.getElementById('openWorkspaceBtn').addEventListener('click', () => {
            const workspaceURL = prompt('Enter Genesys Workspace URL:', 'https://workspace.genesys.com');
            if (workspaceURL) {
                window.open(workspaceURL, 'GenesysWorkspace');
            }
        });

        // Audio controls
        this.volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            this.remoteAudio.volume = volume;
            this.volumeValue.textContent = e.target.value + '%';
        });

        document.getElementById('testAudioBtn').addEventListener('click', () => this.testAudio());
        document.getElementById('selectMicBtn').addEventListener('click', () => this.selectMicrophone());

        // Debug console
        this.clearDebugBtn.addEventListener('click', () => this.clearDebug());
    }

    async registerEndpoint() {
        const server = this.sipServer.value;
        const dn = this.agentDN.value;
        const password = this.agentPassword.value;

        if (!server || !dn || !password) {
            this.addDebugMessage('Please fill in all connection fields', 'error');
            alert('Please enter Agent DN and Password');
            return;
        }

        this.addDebugMessage(`Registering Agent DN ${dn} to ${server}...`, 'info');

        try {
            const socket = new JsSIP.WebSocketInterface(server);
            
            // Extract domain from server URL
            const domain = server.replace(/^wss?:\/\//, '').split(':')[0].split('/')[0];
            
            const configuration = {
                sockets: [socket],
                uri: `sip:${dn}@${domain}`,
                password: password,
                display_name: `Agent ${dn}`,
                register: true,
                session_timers: false,
                use_preloaded_route: false,
                register_expires: 600
            };

            this.ua = new JsSIP.UA(configuration);

            // User Agent events
            this.ua.on('connected', (e) => {
                this.addDebugMessage('WebSocket connected to gateway', 'success');
            });

            this.ua.on('disconnected', (e) => {
                this.addDebugMessage('WebSocket disconnected', 'warning');
                this.updateRegistrationStatus('disconnected');
            });

            this.ua.on('registered', (e) => {
                this.addDebugMessage(`Agent DN ${dn} successfully registered`, 'success');
                this.addDebugMessage('You can now login to Genesys Workspace and set Ready', 'info');
                this.updateRegistrationStatus('registered', dn);
                this.connectBtn.disabled = true;
                this.disconnectBtn.disabled = false;
            });

            this.ua.on('unregistered', (e) => {
                this.addDebugMessage('Agent DN unregistered', 'warning');
                this.updateRegistrationStatus('unregistered');
                this.connectBtn.disabled = false;
                this.disconnectBtn.disabled = true;
            });

            this.ua.on('registrationFailed', (e) => {
                this.addDebugMessage(`Registration failed: ${e.cause}`, 'error');
                this.updateRegistrationStatus('failed');
                alert(`Registration failed: ${e.cause}\n\nPlease check your credentials.`);
            });

            this.ua.on('newRTCSession', (e) => {
                const session = e.session;
                
                if (session.direction === 'incoming') {
                    this.addDebugMessage(`Incoming call from ${session.remote_identity.uri.user}`, 'info');
                    this.handleIncomingCall(session);
                } else {
                    this.addDebugMessage(`Outbound call to ${session.remote_identity.uri.user}`, 'info');
                    this.handleOutboundCall(session);
                }
            });

            this.ua.start();
        } catch (error) {
            this.addDebugMessage(`Error: ${error.message}`, 'error');
            alert(`Connection error: ${error.message}`);
        }
    }

    unregisterEndpoint() {
        if (this.ua) {
            this.ua.stop();
            this.ua = null;
            this.addDebugMessage('Agent DN unregistered from gateway', 'info');
            this.updateRegistrationStatus('unregistered');
            this.connectBtn.disabled = false;
            this.disconnectBtn.disabled = true;
        }
    }

    handleIncomingCall(session) {
        this.session = session;
        this.callStartTime = Date.now();
        
        const caller = session.remote_identity.uri.user;
        this.updateCallStatus('ringing', `From: ${caller}`);
        
        this.addDebugMessage('⚠️ IMPORTANT: Answer this call in Genesys Workspace!', 'warning');
        this.addDebugMessage('Do NOT use browser controls - use Workspace buttons', 'warning');

        // Auto-answer after short delay (Workspace controls the actual answer)
        setTimeout(() => {
            const options = {
                mediaConstraints: {
                    audio: true,
                    video: false
                },
                pcConfig: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            };

            session.answer(options);
            this.addDebugMessage('Call auto-answered (audio connected)', 'success');
        }, 1000);

        // Setup session event handlers
        this.setupSessionHandlers(session);
    }

    handleOutboundCall(session) {
        this.session = session;
        this.callStartTime = Date.now();
        
        const called = session.remote_identity.uri.user;
        this.updateCallStatus('calling', `To: ${called}`);
        
        this.addDebugMessage('Outbound call initiated from Genesys Workspace', 'info');
        
        // Setup session event handlers
        this.setupSessionHandlers(session);
    }

    setupSessionHandlers(session) {
        session.on('progress', (e) => {
            this.addDebugMessage('Call is in progress...', 'info');
            this.ringbackTone.play();
        });

        session.on('accepted', (e) => {
            this.addDebugMessage('Call accepted', 'success');
            this.ringbackTone.pause();
            this.ringbackTone.currentTime = 0;
            this.updateCallStatus('connected', this.getCurrentCallInfo());
            this.startDurationTimer();
        });

        session.on('confirmed', (e) => {
            this.addDebugMessage('Call confirmed and established', 'success');
            this.updateCallStatus('connected', this.getCurrentCallInfo());
        });

        session.on('ended', (e) => {
            this.addDebugMessage('Call ended', 'info');
            this.ringbackTone.pause();
            this.ringbackTone.currentTime = 0;
            this.updateCallStatus('idle', 'None');
            this.stopDurationTimer();
            this.session = null;
        });

        session.on('failed', (e) => {
            this.addDebugMessage(`Call failed: ${e.cause}`, 'error');
            this.ringbackTone.pause();
            this.ringbackTone.currentTime = 0;
            this.updateCallStatus('failed', 'None');
            this.stopDurationTimer();
            this.session = null;
        });

        // Setup media
        session.on('peerconnection', (e) => {
            const peerconnection = e.peerconnection;
            
            peerconnection.addEventListener('addstream', (e) => {
                this.remoteAudio.srcObject = e.stream;
                this.addDebugMessage('Remote audio stream connected', 'success');
            });

            peerconnection.addEventListener('track', (e) => {
                if (e.streams && e.streams[0]) {
                    this.remoteAudio.srcObject = e.streams[0];
                    this.addDebugMessage('Remote audio track connected', 'success');
                }
            });
        });
    }

    updateRegistrationStatus(status, dn = '') {
        const statusDot = this.connectionStatus.querySelector('.status-dot');
        const statusText = this.connectionStatus.querySelector('.status-text');
        
        statusDot.className = 'status-dot';
        
        switch(status) {
            case 'registered':
                statusDot.classList.add('connected');
                statusText.textContent = `Registered (DN: ${dn})`;
                this.regStatus.textContent = `Registered as ${dn}`;
                this.regStatus.style.color = '#10b981';
                break;
            case 'disconnected':
            case 'unregistered':
                statusDot.classList.add('disconnected');
                statusText.textContent = 'Not Registered';
                this.regStatus.textContent = 'Not Registered';
                this.regStatus.style.color = '#64748b';
                break;
            case 'failed':
                statusDot.classList.add('disconnected');
                statusText.textContent = 'Registration Failed';
                this.regStatus.textContent = 'Registration Failed';
                this.regStatus.style.color = '#ef4444';
                break;
        }
    }

    updateCallStatus(state, info) {
        this.callState.textContent = state.charAt(0).toUpperCase() + state.slice(1);
        this.currentCall.textContent = info;
        
        switch(state) {
            case 'connected':
                this.callState.style.color = '#10b981';
                break;
            case 'ringing':
            case 'calling':
                this.callState.style.color = '#f59e0b';
                break;
            case 'idle':
                this.callState.style.color = '#64748b';
                break;
            case 'failed':
                this.callState.style.color = '#ef4444';
                break;
        }
    }

    getCurrentCallInfo() {
        if (!this.session) return 'None';
        
        const remote = this.session.remote_identity.uri.user;
        const direction = this.session.direction === 'incoming' ? 'From' : 'To';
        return `${direction}: ${remote}`;
    }

    startDurationTimer() {
        this.stopDurationTimer();
        this.durationInterval = setInterval(() => {
            if (this.callStartTime) {
                const duration = Math.floor((Date.now() - this.callStartTime) / 1000);
                const hours = Math.floor(duration / 3600);
                const minutes = Math.floor((duration % 3600) / 60);
                const seconds = duration % 60;
                
                this.callDuration.textContent = 
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    stopDurationTimer() {
        if (this.durationInterval) {
            clearInterval(this.durationInterval);
            this.durationInterval = null;
        }
        this.callDuration.textContent = '00:00:00';
        this.callStartTime = null;
    }

    async testAudio() {
        try {
            // Test microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.addDebugMessage('Microphone access OK', 'success');
            
            // Test speaker
            this.testTone.play();
            this.addDebugMessage('Playing test tone - can you hear it?', 'info');
            
            // Stop test stream
            stream.getTracks().forEach(track => track.stop());
        } catch (error) {
            this.addDebugMessage(`Audio test failed: ${error.message}`, 'error');
            alert(`Audio test failed: ${error.message}`);
        }
    }

    async selectMicrophone() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            
            if (audioInputs.length === 0) {
                this.addDebugMessage('No microphones found', 'error');
                return;
            }
            
            let deviceList = 'Available microphones:\n\n';
            audioInputs.forEach((device, index) => {
                deviceList += `${index + 1}. ${device.label || `Microphone ${index + 1}`}\n`;
            });
            
            this.addDebugMessage(`Found ${audioInputs.length} microphone(s)`, 'info');
            alert(deviceList + '\nNote: Microphone selection requires browser settings');
        } catch (error) {
            this.addDebugMessage(`Error listing devices: ${error.message}`, 'error');
        }
    }

    addDebugMessage(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `debug-${type}`;
        entry.textContent = `[${timestamp}] ${message}`;
        
        this.debugConsole.appendChild(entry);
        
        if (this.autoScrollDebug.checked) {
            this.debugConsole.scrollTop = this.debugConsole.scrollHeight;
        }
    }

    clearDebug() {
        this.debugConsole.innerHTML = '';
        this.addDebugMessage('Debug console cleared', 'info');
    }
}

// Initialize the client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.genesysAgent = new GenesysAgentClient();
    
    // Show welcome message
    console.log('%c Genesys Agent WebRTC Client ', 'background: #2563eb; color: white; font-size: 16px; padding: 10px;');
    console.log('Use Genesys Workspace Web Edition for all call controls');
    console.log('This client handles audio only');
});




