// WebRTC SIP Client using JsSIP
class WebRTCClient {
    constructor() {
        this.ua = null;
        this.session = null;
        this.isMuted = false;
        this.isOnHold = false;
        this.callLog = [];
        this.cometd = null;
        this.gwsConnected = false;
        
        this.initializeElements();
        this.attachEventListeners();
        this.addDebugMessage('Application initialized', 'info');
    }

    initializeElements() {
        // Connection elements
        this.sipServer = document.getElementById('sipServer');
        this.sipUsername = document.getElementById('sipUsername');
        this.sipPassword = document.getElementById('sipPassword');
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.connectionStatus = document.getElementById('connectionStatus');

        // Call control elements
        this.phoneNumber = document.getElementById('phoneNumber');
        this.callBtn = document.getElementById('callBtn');
        this.hangupBtn = document.getElementById('hangupBtn');
        this.callStatus = document.getElementById('callStatus');

        // Audio control elements
        this.muteBtn = document.getElementById('muteBtn');
        this.holdBtn = document.getElementById('holdBtn');
        this.transferBtn = document.getElementById('transferBtn');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');

        // Audio elements
        this.remoteAudio = document.getElementById('remoteAudio');
        this.localAudio = document.getElementById('localAudio');
        this.ringbackTone = document.getElementById('ringbackTone');

        // Debug elements
        this.debugConsole = document.getElementById('debugConsole');
        this.clearDebugBtn = document.getElementById('clearDebugBtn');
        this.autoScrollDebug = document.getElementById('autoScrollDebug');

        // Call log
        this.callLogElement = document.getElementById('callLog');

        // GWS elements
        this.gwsUrl = document.getElementById('gwsUrl');
        this.gwsUsername = document.getElementById('gwsUsername');
        this.gwsPassword = document.getElementById('gwsPassword');
        this.gwsChannel = document.getElementById('gwsChannel');
        this.useGwsForDial = document.getElementById('useGwsForDial');
        this.gwsConnectBtn = document.getElementById('gwsConnectBtn');
        this.gwsDisconnectBtn = document.getElementById('gwsDisconnectBtn');
        this.gwsStatus = document.getElementById('gwsStatus');
    }

    attachEventListeners() {
        // Connection buttons
        this.connectBtn.addEventListener('click', () => this.connect());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());

        // Call control buttons
        this.callBtn.addEventListener('click', () => this.makeCall());
        this.hangupBtn.addEventListener('click', () => this.hangUp());

        // Audio control buttons
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        this.holdBtn.addEventListener('click', () => this.toggleHold());
        this.transferBtn.addEventListener('click', () => this.transferCall());

        // Volume control
        this.volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            this.remoteAudio.volume = volume;
            this.volumeValue.textContent = e.target.value + '%';
        });

        // Dialpad
        document.querySelectorAll('.dialpad-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const digit = e.currentTarget.dataset.digit;
                this.phoneNumber.value += digit;
                if (this.session) {
                    this.sendDTMF(digit);
                }
            });
        });

        // Phone number input - Enter to call
        this.phoneNumber.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.callBtn.disabled === false) {
                this.makeCall();
            }
        });

        // Debug console controls
        this.clearDebugBtn.addEventListener('click', () => this.clearDebug());

        // GWS buttons
        this.gwsConnectBtn.addEventListener('click', () => this.connectGws());
        this.gwsDisconnectBtn.addEventListener('click', () => this.disconnectGws());
    }

    connect() {
        const server = this.sipServer.value;
        const username = this.sipUsername.value;
        const password = this.sipPassword.value;

        if (!server || !username || !password) {
            this.addDebugMessage('Please fill in all connection fields', 'error');
            return;
        }

        this.addDebugMessage(`Connecting to ${server} as ${username}...`, 'info');

        const socket = new JsSIP.WebSocketInterface(server);
        
        const configuration = {
            sockets: [socket],
            uri: `sip:${username}@${server.replace(/^wss?:\/\//, '').split('/')[0]}`,
            password: password,
            display_name: username,
            register: true,
            session_timers: false,
            use_preloaded_route: false
        };

        this.ua = new JsSIP.UA(configuration);

        // User Agent events
        this.ua.on('connected', (e) => {
            this.addDebugMessage('WebSocket connected', 'success');
        });

        this.ua.on('disconnected', (e) => {
            this.addDebugMessage('WebSocket disconnected', 'warning');
            this.updateConnectionStatus('disconnected');
        });

        this.ua.on('registered', (e) => {
            this.addDebugMessage('Successfully registered', 'success');
            this.updateConnectionStatus('connected');
            this.connectBtn.disabled = true;
            this.disconnectBtn.disabled = false;
            this.callBtn.disabled = false;
        });

        this.ua.on('unregistered', (e) => {
            this.addDebugMessage('Unregistered', 'warning');
            this.updateConnectionStatus('disconnected');
            this.connectBtn.disabled = false;
            this.disconnectBtn.disabled = true;
            this.callBtn.disabled = true;
        });

        this.ua.on('registrationFailed', (e) => {
            this.addDebugMessage(`Registration failed: ${e.cause}`, 'error');
            this.updateConnectionStatus('disconnected');
        });

        this.ua.on('newRTCSession', (e) => {
            const session = e.session;
            
            if (session.direction === 'incoming') {
                this.addDebugMessage(`Incoming call from ${session.remote_identity.uri.user}`, 'info');
                this.handleIncomingCall(session);
            }
        });

        this.ua.start();
    }

    disconnect() {
        if (this.ua) {
            this.ua.stop();
            this.ua = null;
            this.addDebugMessage('Disconnected from server', 'info');
            this.updateConnectionStatus('disconnected');
            this.connectBtn.disabled = false;
            this.disconnectBtn.disabled = true;
            this.callBtn.disabled = true;
        }
    }

    makeCall() {
        const number = this.phoneNumber.value.trim();
        
        if (!number) {
            this.addDebugMessage('Please enter a phone number', 'error');
            return;
        }

        if (this.useGwsForDial && this.useGwsForDial.checked && this.gwsConnected) {
            this.addDebugMessage(`Requesting GWS to make call to ${number}...`, 'info');
            this.gwsMakeCall(number).catch(err => {
                this.addDebugMessage(`GWS dial failed: ${err}`, 'error');
            });
            return;
        }

        const eventHandlers = {
            'progress': (e) => {
                this.addDebugMessage('Call is in progress...', 'info');
                this.ringbackTone.play();
                this.updateCallStatus('Calling...');
            },
            'failed': (e) => {
                this.addDebugMessage(`Call failed: ${e.cause}`, 'error');
                this.ringbackTone.pause();
                this.ringbackTone.currentTime = 0;
                this.updateCallStatus('Call failed');
                this.resetCallButtons();
                this.addToCallLog(number, 'failed', 0);
            },
            'ended': (e) => {
                this.addDebugMessage('Call ended', 'info');
                this.ringbackTone.pause();
                this.ringbackTone.currentTime = 0;
                this.updateCallStatus('Call ended');
                this.resetCallButtons();
            },
            'confirmed': (e) => {
                this.addDebugMessage('Call confirmed and established', 'success');
                this.ringbackTone.pause();
                this.ringbackTone.currentTime = 0;
                this.updateCallStatus(`In call with ${number}`);
            }
        };

        const options = {
            eventHandlers: eventHandlers,
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

        this.addDebugMessage(`Calling ${number}...`, 'info');
        this.session = this.ua.call(`sip:${number}@${this.sipServer.value.replace(/^wss?:\/\//, '').split('/')[0]}`, options);
        
        this.session.on('peerconnection', (e) => {
            const peerconnection = e.peerconnection;
            
            peerconnection.addEventListener('addstream', (e) => {
                this.remoteAudio.srcObject = e.stream;
                this.addDebugMessage('Remote audio stream added', 'success');
            });

            peerconnection.addEventListener('track', (e) => {
                if (e.streams && e.streams[0]) {
                    this.remoteAudio.srcObject = e.streams[0];
                    this.addDebugMessage('Remote audio track added', 'success');
                }
            });
        });

        const callStartTime = Date.now();
        this.session.on('ended', () => {
            const duration = Math.floor((Date.now() - callStartTime) / 1000);
            this.addToCallLog(number, 'outgoing', duration);
            this.session = null;
        });

        this.callBtn.disabled = true;
        this.hangupBtn.disabled = false;
        this.muteBtn.disabled = false;
        this.holdBtn.disabled = false;
        this.transferBtn.disabled = false;
    }

    hangUp() {
        if (this.session) {
            this.session.terminate();
            this.addDebugMessage('Call terminated', 'info');
            this.updateCallStatus('Call ended');
            this.resetCallButtons();
        }
    }

    // =========================
    // GWS (CometD/REST) section
    // =========================
    connectGws() {
        const baseUrl = (this.gwsUrl?.value || '').replace(/\/$/, '');
        if (!baseUrl) {
            this.addDebugMessage('GWS URL is required', 'error');
            return;
        }

        if (typeof org === 'undefined' || !org.cometd || !org.cometd.CometD) {
            this.addDebugMessage('CometD library not loaded', 'error');
            return;
        }

        const cometd = new org.cometd.CometD();
        const headers = {};
        const user = this.gwsUsername?.value || '';
        const pass = this.gwsPassword?.value || '';
        if (user && pass) {
            const token = btoa(`${user}:${pass}`);
            headers['Authorization'] = `Basic ${token}`;
        }

        cometd.configure({
            url: baseUrl + '/cometd',
            logLevel: 'warn',
            requestHeaders: headers
        });

        cometd.handshake((h) => {
            if (h.successful) {
                this.addDebugMessage('GWS CometD connected', 'success');
                this.updateGwsStatus('connected');
                this.cometd = cometd;
                this.gwsConnected = true;
                this.gwsConnectBtn.disabled = true;
                this.gwsDisconnectBtn.disabled = false;
                // Subscribe to configured channel
                const channel = this.gwsChannel?.value || '/user/agent/events';
                cometd.subscribe(channel, (message) => this.handleGwsEvent(message));
            } else {
                this.addDebugMessage('GWS CometD handshake failed', 'error');
                this.updateGwsStatus('disconnected');
            }
        });
    }

    disconnectGws() {
        if (this.cometd) {
            this.cometd.disconnect();
            this.cometd = null;
        }
        this.gwsConnected = false;
        this.gwsConnectBtn.disabled = false;
        this.gwsDisconnectBtn.disabled = true;
        this.updateGwsStatus('disconnected');
        this.addDebugMessage('Disconnected from GWS', 'info');
    }

    updateGwsStatus(status) {
        if (!this.gwsStatus) return;
        const statusDot = this.gwsStatus.querySelector('.status-dot');
        const statusText = this.gwsStatus.querySelector('.status-text');
        statusDot.className = 'status-dot ' + status;
        statusText.textContent = status === 'connected' ? 'Connected' : 'Disconnected';
    }

    async gwsMakeCall(number) {
        const baseUrl = (this.gwsUrl?.value || '').replace(/\/$/, '');
        const url = baseUrl + '/api/v2/me/calls';
        const user = this.gwsUsername?.value || '';
        const pass = this.gwsPassword?.value || '';
        const headers = { 'Content-Type': 'application/json' };
        if (user && pass) {
            headers['Authorization'] = `Basic ${btoa(`${user}:${pass}`)}`;
        }
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ destination: number })
        });
        if (!res.ok) throw `HTTP ${res.status}`;
        this.addDebugMessage('GWS accepted dial request', 'success');
    }

    handleGwsEvent(message) {
        try {
            const data = message.data || {};
            const type = (data.type || data.eventType || '').toUpperCase();
            this.addDebugMessage(`GWS event: ${type}`, 'info');

            switch (type) {
                case 'RINGING':
                case 'EVENTRINGING':
                    // Let SIP incoming handler prompt user; nothing to do here
                    break;
                case 'ANSWER':
                case 'EVENTESTABLISHED':
                    // If we have a pending session and it's not confirmed yet, nothing to force here
                    break;
                case 'HOLD':
                    if (this.session && !this.isOnHold) this.toggleHold();
                    break;
                case 'RESUME':
                    if (this.session && this.isOnHold) this.toggleHold();
                    break;
                case 'TRANSFER':
                    if (this.session && data.target) {
                        this.session.refer(`sip:${data.target}@${this.sipServer.value.replace(/^wss?:\/\//, '').split('/')[0]}`);
                        this.addDebugMessage(`GWS requested transfer to ${data.target}`, 'info');
                    }
                    break;
                case 'RELEASE':
                case 'HANGUP':
                    if (this.session) this.hangUp();
                    break;
                default:
                    // Unhandled event types are logged only
                    break;
            }
        } catch (e) {
            this.addDebugMessage(`Error handling GWS event: ${e}`, 'error');
        }
    }

    handleIncomingCall(session) {
        this.session = session;
        const caller = session.remote_identity.uri.user;

        if (confirm(`Incoming call from ${caller}. Accept?`)) {
            const options = {
                mediaConstraints: {
                    audio: true,
                    video: false
                },
                pcConfig: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' }
                    ]
                }
            };

            session.answer(options);
            
            session.on('peerconnection', (e) => {
                const peerconnection = e.peerconnection;
                
                peerconnection.addEventListener('addstream', (e) => {
                    this.remoteAudio.srcObject = e.stream;
                });

                peerconnection.addEventListener('track', (e) => {
                    if (e.streams && e.streams[0]) {
                        this.remoteAudio.srcObject = e.streams[0];
                    }
                });
            });

            const callStartTime = Date.now();
            session.on('ended', () => {
                const duration = Math.floor((Date.now() - callStartTime) / 1000);
                this.addToCallLog(caller, 'incoming', duration);
                this.resetCallButtons();
            });

            this.callBtn.disabled = true;
            this.hangupBtn.disabled = false;
            this.muteBtn.disabled = false;
            this.holdBtn.disabled = false;
            this.updateCallStatus(`In call with ${caller}`);
        } else {
            session.terminate();
            this.addToCallLog(caller, 'missed', 0);
        }
    }

    toggleMute() {
        if (this.session) {
            if (this.isMuted) {
                this.session.unmute();
                this.muteBtn.textContent = '🎤 Mute';
                this.addDebugMessage('Microphone unmuted', 'info');
            } else {
                this.session.mute();
                this.muteBtn.textContent = '🎤 Unmute';
                this.addDebugMessage('Microphone muted', 'info');
            }
            this.isMuted = !this.isMuted;
        }
    }

    toggleHold() {
        if (this.session) {
            if (this.isOnHold) {
                this.session.unhold();
                this.holdBtn.textContent = '⏸️ Hold';
                this.updateCallStatus('Call resumed');
                this.addDebugMessage('Call resumed', 'info');
            } else {
                this.session.hold();
                this.holdBtn.textContent = '▶️ Resume';
                this.updateCallStatus('Call on hold');
                this.addDebugMessage('Call on hold', 'info');
            }
            this.isOnHold = !this.isOnHold;
        }
    }

    transferCall() {
        if (this.session) {
            const target = prompt('Enter transfer destination:');
            if (target) {
                this.session.refer(`sip:${target}@${this.sipServer.value.replace(/^wss?:\/\//, '').split('/')[0]}`);
                this.addDebugMessage(`Transferring call to ${target}`, 'info');
            }
        }
    }

    sendDTMF(digit) {
        if (this.session) {
            this.session.sendDTMF(digit);
            this.addDebugMessage(`Sent DTMF: ${digit}`, 'info');
        }
    }

    updateConnectionStatus(status) {
        const statusDot = this.connectionStatus.querySelector('.status-dot');
        const statusText = this.connectionStatus.querySelector('.status-text');
        
        statusDot.className = 'status-dot ' + status;
        
        if (status === 'connected') {
            statusText.textContent = 'Connected';
        } else if (status === 'calling') {
            statusText.textContent = 'Calling...';
        } else {
            statusText.textContent = 'Disconnected';
        }
    }

    updateCallStatus(message) {
        this.callStatus.textContent = message;
    }

    resetCallButtons() {
        this.callBtn.disabled = false;
        this.hangupBtn.disabled = true;
        this.muteBtn.disabled = true;
        this.holdBtn.disabled = true;
        this.transferBtn.disabled = true;
        this.isMuted = false;
        this.isOnHold = false;
        this.muteBtn.textContent = '🎤 Mute';
        this.holdBtn.textContent = '⏸️ Hold';
    }

    addToCallLog(number, type, duration) {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        const durationString = this.formatDuration(duration);
        
        const entry = {
            number: number,
            type: type,
            time: timeString,
            duration: durationString
        };
        
        this.callLog.unshift(entry);
        this.renderCallLog();
    }

    renderCallLog() {
        if (this.callLog.length === 0) {
            this.callLogElement.innerHTML = '<p class="empty-state">No calls yet</p>';
            return;
        }
        
        let html = '';
        this.callLog.forEach(entry => {
            const icon = entry.type === 'outgoing' ? '📞' : 
                        entry.type === 'incoming' ? '📲' : '❌';
            
            html += `
                <div class="call-log-entry ${entry.type}">
                    <div>${icon} ${entry.number}</div>
                    <div class="call-log-time">${entry.time} - ${entry.duration}</div>
                </div>
            `;
        });
        
        this.callLogElement.innerHTML = html;
    }

    formatDuration(seconds) {
        if (seconds === 0) return 'Not answered';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    }
}

// Initialize the client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.webrtcClient = new WebRTCClient();
});




