// Chrome Extension Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');
  const dnInput = document.getElementById('dn');
  const registerBtn = document.getElementById('registerBtn');
  const statusBtn = document.getElementById('statusBtn');
  const testBtn = document.getElementById('testBtn');
  const listCookiesBtn = document.getElementById('listCookiesBtn');
  
  // Check if bridge is accessible
  try {
    const response = await fetch('https://127.0.0.1:8000/Ping');
    statusDiv.textContent = '✅ Bridge is running\n\nChecking WWE session...';
    statusDiv.className = 'status success';
    
    // Check for WWE session
    const sessionId = await getSessionId();
    if (sessionId) {
      statusDiv.textContent = '✅ Bridge is running\n✅ WWE session detected\n\nReady to register DN!';
      statusDiv.className = 'status success';
    } else {
      statusDiv.textContent = '✅ Bridge is running\n⚠️ Please login to WWE first\n\n(Open WWE in a tab, then try again)';
      statusDiv.className = 'status';
      registerBtn.disabled = true;
    }
  } catch (error) {
    statusDiv.textContent = '❌ Cannot reach bridge at 127.0.0.1:8000';
    statusDiv.className = 'status error';
    registerBtn.disabled = true;
  }
  
  // Helper function to get session ID from WWE cookies
  async function getSessionId() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab URL:', tab?.url);
      
      if (!tab || !tab.url) {
        console.error('No active tab found');
        return null;
      }
      
      // Extract the exact URL from the current tab
      const url = new URL(tab.url);
      const baseUrl = url.origin; // e.g., "https://103.167.180.166:8443"
      
      console.log('Checking cookies for:', baseUrl);
      
      // List of cookie names to check (including Bayeux-related)
      const cookieNames = ['JSESSIONID', 'BAYEUX_BROWSER', 'WORKSPACE-SESSIONID', 'WORKSPACE_SESSIONID'];
      
      // Try each cookie name with the exact base URL
      for (const cookieName of cookieNames) {
        console.log(`Checking for ${cookieName}...`);
        try {
          const cookie = await chrome.cookies.get({ 
            url: baseUrl,
            name: cookieName 
          });
          if (cookie && cookie.value) {
            console.log(`✅ Found ${cookieName}:`, cookie.value.substring(0, 30) + '...');
            return cookie.value;
          } else {
            console.log(`❌ ${cookieName} not found`);
          }
        } catch (cookieError) {
          console.error(`Error getting ${cookieName}:`, cookieError);
        }
      }
      
      // Also try the fallback URLs if current tab is not WWE
      if (!baseUrl.includes('103.167.180.166') && !baseUrl.includes('192.168.210.54')) {
        console.log('Current tab is not WWE, trying fallback URLs...');
        const fallbackUrls = [
          'https://103.167.180.166:8443',
          'http://192.168.210.54:8090'
        ];
        
        for (const fallbackUrl of fallbackUrls) {
          for (const cookieName of cookieNames) {
            const cookie = await chrome.cookies.get({ url: fallbackUrl, name: cookieName });
            if (cookie && cookie.value) {
              console.log(`✅ Found ${cookieName} at ${fallbackUrl}`);
              return cookie.value;
            }
          }
        }
      }
      
      console.error('❌ No session cookie found');
      return null;
    } catch (error) {
      console.error('Error getting session ID:', error);
      return null;
    }
  }
  
  // Register DN button
  registerBtn.addEventListener('click', async () => {
    const dn = dnInput.value.trim();
    if (!dn) {
      alert('Please enter a DN');
      return;
    }
    
    statusDiv.textContent = 'Getting session ID...';
    statusDiv.className = 'status';
    registerBtn.disabled = true;
    
    try {
      // Get session ID using shared helper
      const sessionId = await getSessionId();
      
      if (!sessionId) {
        throw new Error('Not logged in to WWE. Please login first.');
      }
      
      // Get active tab to detect WWE URL
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Detect Workspace URL from current page
      let workspaceUrl = 'wss://103.167.180.166:8443'; // default to public IP
      
      if (tab && tab.url) {
        if (tab.url.includes('103.167.180.166')) {
          workspaceUrl = 'wss://103.167.180.166:8443'; // Use secure WebSocket for public IP
        } else if (tab.url.includes('103.167.180.160')) {
          workspaceUrl = 'wss://103.167.180.160:8443'; // Use secure WebSocket
        } else if (tab.url.includes('192.168.210.54') && tab.url.includes('https')) {
          workspaceUrl = 'wss://192.168.210.54:8090'; // Use secure WebSocket if HTTPS
        } else if (tab.url.includes('192.168.210.54')) {
          workspaceUrl = 'ws://192.168.210.54:8090'; // Use HTTP WebSocket for local HTTP
        }
      }
      
      statusDiv.textContent = `Registering DN with Workspace at ${workspaceUrl}...`;
      
      // Register DN with detected workspace URL
      const response = await fetch('https://127.0.0.1:8000/RegisterDn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          users: [dn],
          addresses: [dn],
          workspaceSessionId: sessionId,
          workspaceUrl: workspaceUrl
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      statusDiv.textContent = `✅ Successfully registered DN ${dn}!\n\nNow make a test call and click Accept in WWE.`;
      statusDiv.className = 'status success';
      
    } catch (error) {
      statusDiv.textContent = `❌ Error: ${error.message}`;
      statusDiv.className = 'status error';
    } finally {
      registerBtn.disabled = false;
    }
  });
  
  // Check status button
  statusBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('https://127.0.0.1:8000/GetStatus');
      const data = await response.json();
      
      statusDiv.textContent = `Status:\n` +
        `Registered: ${data.registered}\n` +
        `DN: ${data.dn || 'None'}\n` +
        `Call Active: ${data.callActive}`;
      statusDiv.className = data.registered ? 'status success' : 'status';
      
    } catch (error) {
      statusDiv.textContent = `❌ Error: ${error.message}`;
      statusDiv.className = 'status error';
    }
  });
  
  // Test button - show session ID
  testBtn.addEventListener('click', async () => {
    try {
      const sessionId = await getSessionId();
      
      if (!sessionId) {
        alert('❌ Not logged in to WWE');
        return;
      }
      
      alert(`✅ Session ID Found:\n${sessionId.substring(0, 50)}...`);
      
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  });
  
  // List all cookies button - for debugging
  listCookiesBtn.addEventListener('click', async () => {
    try {
      const urlsToCheck = [
        'https://103.167.180.166:8443',
        'http://192.168.210.54:8090'
      ];
      
      const cookieNames = ['JSESSIONID', 'BAYEUX_BROWSER', 'WORKSPACE-SESSIONID', 'WORKSPACE_SESSIONID'];
      
      let allCookies = '';
      
      for (const url of urlsToCheck) {
        allCookies += `\n📍 ${url}\n`;
        let found = false;
        
        for (const cookieName of cookieNames) {
          const cookie = await chrome.cookies.get({ url, name: cookieName });
          if (cookie) {
            allCookies += `  ✅ ${cookie.name}: ${cookie.value.substring(0, 30)}...\n`;
            found = true;
          }
        }
        
        if (!found) {
          allCookies += `  (no cookies found)\n`;
        }
      }
      
      alert(`WWE Cookies Found:${allCookies}`);
      
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  });
});
