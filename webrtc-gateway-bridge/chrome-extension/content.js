// Content script - injected into WWE pages
// Can communicate with the extension popup

console.log('[WWE Integration Helper] Content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSessionId') {
    // Get session ID from cookie
    const sessionId = document.cookie
      .split('; ')
      .find(row => row.startsWith('WORKSPACE-SESSIONID='))
      ?.split('=')[1];
    
    sendResponse({ sessionId: sessionId });
  }
  
  return true; // Keep channel open for async response
});

// Optional: Add visual indicator that extension is active
const indicator = document.createElement('div');
indicator.id = 'wwe-integration-indicator';
indicator.textContent = '🚀 Integration Helper Active';
indicator.style.cssText = `
  position: fixed;
  bottom: 10px;
  right: 10px;
  background: #007bff;
  color: white;
  padding: 8px 12px;
  border-radius: 5px;
  font-size: 12px;
  z-index: 10000;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
`;

// Add indicator after page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(indicator);
    
    // Remove after 3 seconds
    setTimeout(() => {
      indicator.style.opacity = '0';
      indicator.style.transition = 'opacity 0.5s';
      setTimeout(() => indicator.remove(), 500);
    }, 3000);
  });
} else {
  document.body.appendChild(indicator);
  setTimeout(() => {
    indicator.style.opacity = '0';
    indicator.style.transition = 'opacity 0.5s';
    setTimeout(() => indicator.remove(), 500);
  }, 3000);
}
