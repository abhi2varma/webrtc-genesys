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

    // Helper function to remove Opus codec from SDP and force PCMU/PCMA
    removeOpusCodec(sdp) {
        const lines = sdp.split('\r\n');
        const filteredLines = [];
        const opusPayloadTypes = [];
        
        // First pass: identify Opus payload types
        for (let line of lines) {
            if (line.includes('opus/48000')) {
                const match = line.match(/rtpmap:(\d+)/);
                if (match) {
                    opusPayloadTypes.push(match[1]);
                    this.addDebugMessage(`Removing Opus payload type: ${match[1]}`, 'info');
                }
            }
        }
        
        // Second pass: filter out Opus-related lines
        for (let line of lines) {
            // Skip Opus rtpmap lines
            if (line.includes('opus/48000')) {
                continue;
            }
            
            // Skip Opus fmtp lines
            let skipLine = false;
            for (let pt of opusPayloadTypes) {
                if (line.includes(`fmtp:${pt}`) || line.includes(`rtcp-fb:${pt}`)) {
                    skipLine = true;
                    break;
                }
            }
            if (skipLine) continue;
            
            // Remove Opus from m=audio line
            if (line.startsWith('m=audio')) {
                for (let pt of opusPayloadTypes) {
                    line = line.replace(new RegExp(` ${pt}(?= |$)`, 'g'), '');
                }
                // Also remove RED and other high-bitrate codecs, keep only PCMU(0), PCMA(8), G722(9), telephone-event
                line = line.replace(/\s+\d{3}/g, ''); // Remove 3-digit payload types (111, 110, 126, etc)
                line = line.replace(/\s+63/g, ''); // Remove RED
                line = line.replace(/\s+13/g, ''); // Remove CN
            }
            
            filteredLines.push(line);
        }
        
        const modifiedSdp = filteredLines.join('\r\n');
        this.addDebugMessage('SDP modified: Forced PCMU/PCMA codecs', 'success');
        return modifiedSdp;
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
                    { urls: 'stun:192.168.210.54:3478' },
                    { 
                        urls: 'turn:192.168.210.54:3478',
                        username: 'webrtc',
                        credential: 'Genesys2024!SecureTurn'
                    }
                ]
            },
            // Add SDP modifier to force PCMU/PCMA
            rtcOfferConstraints: {
                offerToReceiveAudio: true,
                offerToReceiveVideo: false
            }
        };

        this.addDebugMessage(`Calling ${number}... (PCMU/PCMA only)`, 'info');
        this.session = this.ua.call(`sip:${number}@${this.sipServer.value.replace(/^wss?:\/\//, '').split('/')[0]}`, options);
        
        this.session.on('peerconnection', (e) => {
            const peerconnection = e.peerconnection;
            
            // Intercept SDP to remove Opus
            const origCreateOffer = peerconnection.createOffer.bind(peerconnection);
            peerconnection.createOffer = (options) => {
                return origCreateOffer(options).then((offer) => {
                    offer.sdp = this.removeOpusCodec(offer.sdp);
                    return offer;
                });
            };
            
            const origCreateAnswer = peerconnection.createAnswer.bind(peerconnection);
            peerconnection.createAnswer = (options) => {
                return origCreateAnswer(options).then((answer) => {
                    answer.sdp = this.removeOpusCodec(answer.sdp);
                    return answer;
                });
            };
            
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

        this.addDebugMessage('Initializing CometD connection...', 'info');
        const cometd = new org.cometd.CometD();
        
        // Configure connection
        const headers = {};
        const user = this.gwsUsername?.value || '';
        const pass = this.gwsPassword?.value || '';
        if (user && pass) {
            const token = btoa(`${user}:${pass}`);
            headers['Authorization'] = `Basic ${token}`;
            this.addDebugMessage(`Using Basic Auth for user: ${user}`, 'info');
        }

        cometd.configure({
            url: baseUrl + '/genesys/cometd',  // Correct GWS CometD path
            logLevel: 'info',
            requestHeaders: headers,
            maxConnections: 2,
            backoffIncrement: 1000,
            maxBackoff: 60000,
            maxNetworkDelay: 10000
        });

        // Add connection listeners
        cometd.addListener('/meta/connect', (message) => {
            if (message.successful) {
                this.addDebugMessage('CometD connection established', 'success');
            } else {
                this.addDebugMessage('CometD connection failed', 'warning');
            }
        });

        cometd.addListener('/meta/disconnect', (message) => {
            this.addDebugMessage('CometD disconnected', 'warning');
            this.updateGwsStatus('disconnected');
        });

        // Perform handshake
        this.addDebugMessage(`Connecting to ${baseUrl}/genesys/cometd...`, 'info');
        cometd.handshake((h) => {
            if (h.successful) {
                this.addDebugMessage(`✅ GWS CometD connected! ClientID: ${h.clientId}`, 'success');
                this.updateGwsStatus('connected');
                this.cometd = cometd;
                this.gwsConnected = true;
                this.gwsConnectBtn.disabled = true;
                this.gwsDisconnectBtn.disabled = false;
                
                // Subscribe to GWS CTI channels
                this.subscribeToGwsChannels(cometd);
            } else {
                this.addDebugMessage(`❌ GWS CometD handshake failed: ${h.error || 'Unknown error'}`, 'error');
                this.updateGwsStatus('disconnected');
                
                // Log more details for troubleshooting
                if (h.advice) {
                    this.addDebugMessage(`Server advice: ${JSON.stringify(h.advice)}`, 'warning');
                }
            }
        });
    }

    subscribeToGwsChannels(cometd) {
        // Subscribe to voice call events
        cometd.subscribe('/v2/me/calls', (message) => {
            this.addDebugMessage('📞 Call event received', 'info');
            this.handleGwsCallEvent(message);
        }, (subscribeReply) => {
            if (subscribeReply.successful) {
                this.addDebugMessage('✅ Subscribed to /v2/me/calls', 'success');
            } else {
                this.addDebugMessage('❌ Failed to subscribe to /v2/me/calls', 'error');
            }
        });

        // Subscribe to agent state events
        cometd.subscribe('/v2/me/state', (message) => {
            this.addDebugMessage('👤 Agent state event received', 'info');
            this.handleGwsStateEvent(message);
        }, (subscribeReply) => {
            if (subscribeReply.successful) {
                this.addDebugMessage('✅ Subscribed to /v2/me/state', 'success');
            } else {
                this.addDebugMessage('❌ Failed to subscribe to /v2/me/state', 'error');
            }
        });

        // Subscribe to multimedia interactions
        cometd.subscribe('/v2/me/interactions', (message) => {
            this.addDebugMessage('💬 Interaction event received', 'info');
            this.handleGwsInteractionEvent(message);
        }, (subscribeReply) => {
            if (subscribeReply.successful) {
                this.addDebugMessage('✅ Subscribed to /v2/me/interactions', 'success');
            } else {
                this.addDebugMessage('❌ Failed to subscribe to /v2/me/interactions', 'error');
            }
        });

        // Subscribe to custom channel if specified
        const customChannel = this.gwsChannel?.value;
        if (customChannel && customChannel !== '/v2/me/calls' && 
            customChannel !== '/v2/me/state' && customChannel !== '/v2/me/interactions') {
            cometd.subscribe(customChannel, (message) => {
                this.addDebugMessage(`📨 Custom channel event: ${customChannel}`, 'info');
                this.handleGwsEvent(message);
            }, (subscribeReply) => {
                if (subscribeReply.successful) {
                    this.addDebugMessage(`✅ Subscribed to ${customChannel}`, 'success');
                } else {
                    this.addDebugMessage(`❌ Failed to subscribe to ${customChannel}`, 'error');
                }
            });
        }
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

    handleGwsCallEvent(message) {
        try {
            const data = message.data || {};
            this.addDebugMessage(`Call event data: ${JSON.stringify(data)}`, 'info');
            
            const notificationType = data.notificationType || data.type || '';
            const call = data.call || data;
            
            switch (notificationType) {
                case 'StateChange':
                case 'EventRinging':
                    const callState = call.state || '';
                    const from = call.from || call.ani || call.caller || 'Unknown';
                    const to = call.to || call.dnis || call.called || 'Unknown';
                    
                    this.addDebugMessage(`📞 Call State: ${callState} | From: ${from} | To: ${to}`, 'success');
                    
                    if (callState === 'Ringing' || callState === 'Alerting') {
                        this.updateCallStatus(`Incoming call from ${from}`);
                        // WebRTC SIP client will handle the actual ring
                    } else if (callState === 'Established' || callState === 'Connected') {
                        this.updateCallStatus(`Call connected: ${from} ↔ ${to}`);
                    } else if (callState === 'Released' || callState === 'Disconnected') {
                        this.updateCallStatus('Call ended by Genesys');
                        // Optionally auto-hangup the WebRTC session
                        if (this.session) {
                            this.addDebugMessage('Auto-hanging up WebRTC session', 'info');
                            this.hangUp();
                        }
                    } else if (callState === 'Held' || callState === 'Hold') {
                        this.updateCallStatus('Call on hold (from Genesys)');
                        if (this.session && !this.isOnHold) {
                            this.toggleHold();
                        }
                    } else if (callState === 'Retrieved' || callState === 'Resume') {
                        this.updateCallStatus('Call resumed (from Genesys)');
                        if (this.session && this.isOnHold) {
                            this.toggleHold();
                        }
                    }
                    break;
                    
                case 'CallCreated':
                    this.addDebugMessage('📞 New call created in Genesys', 'info');
                    break;
                    
                case 'CallDeleted':
                    this.addDebugMessage('📞 Call deleted in Genesys', 'info');
                    break;
                    
                default:
                    this.addDebugMessage(`📞 Unhandled call event: ${notificationType}`, 'warning');
                    break;
            }
        } catch (e) {
            this.addDebugMessage(`Error handling call event: ${e}`, 'error');
        }
    }

    handleGwsStateEvent(message) {
        try {
            const data = message.data || {};
            this.addDebugMessage(`State event data: ${JSON.stringify(data)}`, 'info');
            
            const state = data.state || data.agentState || '';
            const reason = data.reason || data.reasonCode || '';
            
            this.addDebugMessage(`👤 Agent State: ${state}${reason ? ' (' + reason + ')' : ''}`, 'success');
            
            switch (state) {
                case 'Ready':
                case 'Available':
                    this.addDebugMessage('✅ Agent is Ready', 'success');
                    break;
                case 'NotReady':
                case 'Unavailable':
                    this.addDebugMessage('🔴 Agent is Not Ready', 'warning');
                    break;
                case 'AfterCallWork':
                case 'ACW':
                case 'Wrapup':
                    this.addDebugMessage('📝 Agent in After Call Work', 'info');
                    break;
                case 'LoggedOut':
                    this.addDebugMessage('👋 Agent logged out', 'warning');
                    break;
                default:
                    this.addDebugMessage(`👤 Agent state changed to: ${state}`, 'info');
                    break;
            }
        } catch (e) {
            this.addDebugMessage(`Error handling state event: ${e}`, 'error');
        }
    }

    handleGwsInteractionEvent(message) {
        try {
            const data = message.data || {};
            this.addDebugMessage(`Interaction event data: ${JSON.stringify(data)}`, 'info');
            
            const interactionType = data.type || data.mediaType || '';
            const state = data.state || '';
            
            this.addDebugMessage(`💬 ${interactionType} interaction: ${state}`, 'info');
        } catch (e) {
            this.addDebugMessage(`Error handling interaction event: ${e}`, 'error');
        }
    }

    handleGwsEvent(message) {
        try {
            const data = message.data || {};
            this.addDebugMessage(`Generic GWS event: ${JSON.stringify(data)}`, 'info');
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
                        { urls: 'stun:192.168.210.54:3478' },
                        { 
                            urls: 'turn:192.168.210.54:3478',
                            username: 'webrtc',
                            credential: 'Genesys2024!SecureTurn'
                        }
                    ]
                },
                rtcAnswerConstraints: {
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: false
                }
            };

            session.answer(options);
            
            session.on('peerconnection', (e) => {
                const peerconnection = e.peerconnection;
                
                // Intercept SDP to remove Opus for incoming calls
                const origCreateAnswer = peerconnection.createAnswer.bind(peerconnection);
                peerconnection.createAnswer = (options) => {
                    return origCreateAnswer(options).then((answer) => {
                        answer.sdp = this.removeOpusCodec(answer.sdp);
                        return answer;
                    });
                };
                
                peerconnection.addEventListener('addstream', (e) => {
                    this.remoteAudio.srcObject = e.stream;
                    this.addDebugMessage('Remote audio stream added (incoming)', 'success');
                });

                peerconnection.addEventListener('track', (e) => {
                    if (e.streams && e.streams[0]) {
                        this.remoteAudio.srcObject = e.streams[0];
                        this.addDebugMessage('Remote audio track added (incoming)', 'success');
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
            this.addDebugMessage('Incoming call answered (PCMU/PCMA only)', 'info');
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




