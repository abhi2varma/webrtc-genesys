/**
 * Workspace API Client - Handles WebSocket connection to Genesys Workspace
 * Listens for call events and triggers SIP actions when calls are answered
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class WorkspaceClient extends EventEmitter {
  constructor(config) {
    super();
    this.workspaceUrl = config.workspaceUrl || 'ws://192.168.210.54:8090';
    this.sessionId = null;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.activeCalls = new Map(); // callId -> call state
    this.connected = false;
    this.authenticated = false;
  }

  /**
   * Initialize connection with session ID from WWE login
   * @param {string} sessionId - Workspace session ID (WORKSPACE-SESSIONID cookie)
   */
  connect(sessionId) {
    this.sessionId = sessionId;
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[Workspace] Already connected');
      return;
    }

    console.log('[Workspace] Connecting to Workspace API:', this.workspaceUrl);
    
    try {
      // Connect to calls WebSocket endpoint
      const wsUrl = `${this.workspaceUrl}/api/v2/me/calls`;
      
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Cookie': `WORKSPACE-SESSIONID=${this.sessionId}`,
          'Origin': 'http://192.168.210.54:8090'
        },
        rejectUnauthorized: false // For self-signed certs
      });

      this.ws.on('open', () => this.onOpen());
      this.ws.on('message', (data) => this.onMessage(data));
      this.ws.on('error', (error) => this.onError(error));
      this.ws.on('close', (code, reason) => this.onClose(code, reason));
      
    } catch (error) {
      console.error('[Workspace] Connection error:', error);
      this.scheduleReconnect();
    }
  }

  onOpen() {
    console.log('[Workspace] ✅ Connected to Workspace API');
    this.connected = true;
    this.reconnectAttempts = 0;
    this.emit('connected');
  }

  onMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      
      console.log('[Workspace] Event received:', {
        type: message.messageType || message.notificationType,
        callId: message.call?.id,
        state: message.call?.state
      });

      // Handle different message types
      if (message.notificationType === 'StatusChange') {
        this.handleCallStatusChange(message);
      } else if (message.messageType === 'CallStateChangeMessage') {
        this.handleCallStateChange(message);
      } else if (message.messageType === 'ErrorMessage') {
        this.handleError(message);
      }
      
    } catch (error) {
      console.error('[Workspace] Error parsing message:', error);
    }
  }

  /**
   * Handle call status change (from WebSocket)
   */
  handleCallStatusChange(message) {
    const call = message.call;
    if (!call) return;

    const callId = call.id || call.callUuid;
    const previousState = this.activeCalls.get(callId);
    const newState = call.state;

    console.log('[Workspace] Call status change:', {
      callId,
      previousState,
      newState,
      dnis: call.dnis
    });

    // Store current state
    this.activeCalls.set(callId, newState);

    // Detect answer event: Ringing → Talking
    if (previousState === 'Ringing' && newState === 'Talking') {
      console.log('[Workspace] 🎯 ANSWER DETECTED for call:', callId);
      this.emit('call-answered', {
        callId: callId,
        callUuid: call.callUuid,
        dnis: call.dnis,
        connId: call.connId,
        call: call
      });
    }
    // Detect new incoming call
    else if (newState === 'Ringing' && !previousState) {
      console.log('[Workspace] 📞 Incoming call detected:', callId);
      this.emit('call-ringing', {
        callId: callId,
        callUuid: call.callUuid,
        dnis: call.dnis,
        participants: call.participants,
        call: call
      });
    }
    // Detect call release
    else if (newState === 'Released') {
      console.log('[Workspace] Call released:', callId);
      this.activeCalls.delete(callId);
      this.emit('call-released', {
        callId: callId,
        call: call
      });
    }
  }

  /**
   * Handle call state change (alternative format)
   */
  handleCallStateChange(message) {
    const callId = message.call?.id;
    if (!callId) return;

    // Similar to handleCallStatusChange
    this.handleCallStatusChange({
      notificationType: 'StatusChange',
      call: message.call
    });
  }

  /**
   * Handle error messages
   */
  handleError(message) {
    console.error('[Workspace] Error from Workspace API:', message.errorMessage);
    this.emit('error', message);
  }

  onError(error) {
    console.error('[Workspace] WebSocket error:', error.message);
    this.emit('ws-error', error);
  }

  onClose(code, reason) {
    console.log('[Workspace] Connection closed:', code, reason.toString());
    this.connected = false;
    this.activeCalls.clear();
    this.emit('disconnected');

    // Auto-reconnect if not a normal closure
    if (code !== 1000) {
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Workspace] Max reconnection attempts reached');
      this.emit('reconnect-failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`[Workspace] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (this.sessionId) {
        this.connect(this.sessionId);
      }
    }, delay);
  }

  /**
   * Get current call state
   */
  getCallState(callId) {
    return this.activeCalls.get(callId);
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect from Workspace API
   */
  disconnect() {
    if (this.ws) {
      console.log('[Workspace] Disconnecting...');
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }
    this.connected = false;
    this.activeCalls.clear();
  }
}

module.exports = WorkspaceClient;
