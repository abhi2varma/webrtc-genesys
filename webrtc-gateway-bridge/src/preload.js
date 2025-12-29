const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  send: (channel, data) => {
    // whitelist channels
    let validChannels = ['webrtc-command'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    let validChannels = ['webrtc-event'];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender` 
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});

// Expose a function to the page context for sending events to Electron
contextBridge.exposeInMainWorld('electronBridge', {
  sendEvent: (eventData) => {
    console.log('[Preload] Forwarding event to main process:', eventData);
    ipcRenderer.send('webrtc-event', eventData);
  }
});

// Also listen for postMessage events as a fallback
window.addEventListener('message', (event) => {
  // Check if message is from our WebRTC gateway
  if (event.data && event.data.event) {
    console.log('[Preload] Received postMessage event:', event.data);
    ipcRenderer.send('webrtc-event', event.data);
  }
});

