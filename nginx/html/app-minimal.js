// Minimal WebRTC Client using JsSIP
class MinimalWebRTCClient {
    constructor() {
        this.ua = null;
        this.session = null;
        this.isMuted = false;
        this.isOnHold = false;
        
        this.initElements();
        this.attachListeners();
        this.log('Client initialized');
    }

    initElements() {
        this.sipServer = document.getElementById('sipServer');
        this.sipUsername = document.getElementById('sipUsername');
        this.sipPassword = document.getElementById('sipPassword');
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.connectionStatus = document.getElementById('connectionStatus');
        
        this.phoneNumber = document.getElementById('phoneNumber');
        this.callBtn = document.getElementById('callBtn');
        this.hangupBtn = document.getElementById('hangupBtn');
        this.muteBtn = document.getElementById('muteBtn');
        this.holdBtn = document.getElementById('holdBtn');
        this.callStatus = document.getElementById('callStatus');
        
        this.remoteAudio = document.getElementById('remoteAudio');
        this.debugLog = document.getElementById('debugLog');
    }

    attachListeners() {
        this.connectBtn.addEventListener('click', () => this.connect());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.callBtn.addEventListener('click', () => this.makeCall());
        this.hangupBtn.addEventListener('click', () => this.hangup());
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        this.holdBtn.addEventListener('click', () => this.toggleHold());
        
        // Dialpad
        document.querySelectorAll('.dialpad-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const digit = btn.dataset.digit;
                this.phoneNumber.value += digit;
                if (this.session && this.session.isEstablished()) {
                    this.session.sendDTMF(digit);
                    this.log('DTMF: ' + digit);
                }
            });
        });
        
        // Enter to call
        this.phoneNumber.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.callBtn.disabled) {
                this.makeCall();
            }
        });
    }

    log(message) {
        const time = new Date().toLocaleTimeString();
        this.debugLog.innerHTML += `[${time}] ${message}<br>`;
        this.debugLog.scrollTop = this.debugLog.scrollHeight;
        console.log(message);
    }

    connect() {
        const server = this.sipServer.value.trim();
        const username = this.sipUsername.value.trim();
        const password = this.sipPassword.value.trim();

        if (!server || !username || !password) {
            alert('Please fill all fields');
            return;
        }

        this.log(`Connecting to ${server} as ${username}...`);

        const socket = new JsSIP.WebSocketInterface(server);
        
        const configuration = {
            sockets: [socket],
            uri: `sip:${username}@192.168.210.54`,
            password: password,
            display_name: username,
            register: true,
            session_timers: false,
            use_preloaded_route: false,
            connection_recovery_min_interval: 2,
            connection_recovery_max_interval: 30
        };

        this.ua = new JsSIP.UA(configuration);

        this.ua.on('connected', () => {
            this.log('WebSocket connected');
        });

        this.ua.on('disconnected', () => {
            this.log('WebSocket disconnected');
            this.updateConnectionStatus(false);
        });

        this.ua.on('registered', () => {
            this.log('Registered successfully');
            this.updateConnectionStatus(true);
        });

        this.ua.on('unregistered', () => {
            this.log('Unregistered');
            this.updateConnectionStatus(false);
        });

        this.ua.on('registrationFailed', (e) => {
            this.log('Registration failed: ' + e.cause);
            this.updateConnectionStatus(false);
        });

        this.ua.on('newRTCSession', (e) => {
            const session = e.session;
            
            if (session.direction === 'incoming') {
                this.log('Incoming call from: ' + session.remote_identity.uri.user);
                this.handleIncomingCall(session);
            }
        });

        this.ua.start();
    }

    disconnect() {
        if (this.session) {
            this.session.terminate();
        }
        if (this.ua) {
            this.ua.stop();
            this.ua = null;
        }
        this.log('Disconnected');
        this.updateConnectionStatus(false);
    }

    updateConnectionStatus(connected) {
        if (connected) {
            this.connectionStatus.textContent = 'Status: Connected & Registered';
            this.connectBtn.disabled = true;
            this.disconnectBtn.disabled = false;
            this.callBtn.disabled = false;
        } else {
            this.connectionStatus.textContent = 'Status: Disconnected';
            this.connectBtn.disabled = false;
            this.disconnectBtn.disabled = true;
            this.callBtn.disabled = true;
        }
    }

    makeCall() {
        const number = this.phoneNumber.value.trim();
        if (!number) {
            alert('Enter a phone number');
            return;
        }

        this.log(`Calling ${number}...`);

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
            },
            rtcOfferConstraints: {
                offerToReceiveAudio: true,
                offerToReceiveVideo: false
            }
        };

        this.session = this.ua.call(`sip:${number}@192.168.210.54`, options);
        this.setupSessionHandlers(this.session);
    }

    handleIncomingCall(session) {
        this.session = session;
        this.setupSessionHandlers(session);
        
        if (confirm('Incoming call. Answer?')) {
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
        } else {
            session.terminate();
        }
    }

    setupSessionHandlers(session) {
        session.on('sending', (e) => {
            this.log('Sending INVITE...');
            this.callStatus.textContent = 'Status: Connecting...';
        });

        session.on('progress', (e) => {
            this.log('Call in progress...');
            this.callStatus.textContent = 'Status: Ringing...';
            
            // Handle early media
            if (e.response && e.response.body) {
                this.log('Early media available');
            }
        });

        session.on('accepted', () => {
            this.log('Call accepted');
            this.callStatus.textContent = 'Status: In call';
            this.callBtn.disabled = true;
            this.hangupBtn.disabled = false;
            this.muteBtn.disabled = false;
            this.holdBtn.disabled = false;
        });

        session.on('confirmed', () => {
            this.log('Call confirmed');
        });

        session.on('ended', () => {
            this.log('Call ended');
            this.endCall();
        });

        session.on('failed', (e) => {
            this.log('Call failed: ' + e.cause);
            this.endCall();
        });

        session.on('peerconnection', (e) => {
            const pc = e.peerconnection;
            
            // Log ICE gathering state changes
            pc.addEventListener('icegatheringstatechange', () => {
                this.log('ICE gathering state: ' + pc.iceGatheringState);
            });
            
            // Log ICE connection state changes
            pc.addEventListener('iceconnectionstatechange', () => {
                this.log('ICE connection state: ' + pc.iceConnectionState);
            });
            
            pc.ontrack = (event) => {
                this.log('Remote stream received');
                this.remoteAudio.srcObject = event.streams[0];
            };
        });
    }

    hangup() {
        if (this.session) {
            this.session.terminate();
        }
    }

    endCall() {
        this.callStatus.textContent = 'Status: No active call';
        this.callBtn.disabled = false;
        this.hangupBtn.disabled = true;
        this.muteBtn.disabled = true;
        this.holdBtn.disabled = true;
        this.isMuted = false;
        this.isOnHold = false;
        this.muteBtn.textContent = 'Mute';
        this.holdBtn.textContent = 'Hold';
        this.session = null;
    }

    toggleMute() {
        if (!this.session) return;
        
        if (this.isMuted) {
            this.session.unmute();
            this.muteBtn.textContent = 'Mute';
            this.log('Unmuted');
        } else {
            this.session.mute();
            this.muteBtn.textContent = 'Unmute';
            this.log('Muted');
        }
        this.isMuted = !this.isMuted;
    }

    toggleHold() {
        if (!this.session) return;
        
        if (this.isOnHold) {
            this.session.unhold();
            this.holdBtn.textContent = 'Hold';
            this.log('Resumed');
        } else {
            this.session.hold();
            this.holdBtn.textContent = 'Resume';
            this.log('On hold');
        }
        this.isOnHold = !this.isOnHold;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    new MinimalWebRTCClient();
});

