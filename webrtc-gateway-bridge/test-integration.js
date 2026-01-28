// WWE Integration Test Script
// Run this in WWE browser console after logging in

(async function() {
  console.log('🚀 Starting WWE + webrtc-gateway-bridge integration test...');
  
  // Step 1: Get Workspace session ID
  console.log('\n📋 Step 1: Getting Workspace session ID...');
  const sessionId = document.cookie
    .split('; ')
    .find(row => row.startsWith('WORKSPACE-SESSIONID='))
    ?.split('=')[1];
  
  if (!sessionId) {
    console.error('❌ ERROR: WORKSPACE-SESSIONID cookie not found!');
    console.log('Make sure you are logged into WWE.');
    return;
  }
  
  console.log('✅ Session ID found:', sessionId.substring(0, 20) + '...');
  
  // Step 2: Get DN from WWE
  console.log('\n📋 Step 2: Getting DN from WWE configuration...');
  const dnElement = document.querySelector('[data-dn]') || 
                    document.querySelector('.dn-display') ||
                    document.querySelector('.phone-number');
  
  let dn = prompt('Enter your DN (e.g., 1000):', '1000');
  
  if (!dn) {
    console.error('❌ ERROR: No DN provided!');
    return;
  }
  
  console.log('✅ DN:', dn);
  
  // Step 3: Register DN with Workspace session
  console.log('\n📋 Step 3: Registering DN with webrtc-gateway-bridge...');
  
  try {
    const registerResponse = await fetch('https://127.0.0.1:8000/RegisterDn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        users: [dn],
        addresses: [dn],
        workspaceSessionId: sessionId
      })
    });
    
    if (!registerResponse.ok) {
      throw new Error(`HTTP ${registerResponse.status}: ${registerResponse.statusText}`);
    }
    
    const registerData = await registerResponse.json();
    console.log('✅ Registration response:', registerData);
    
  } catch (error) {
    console.error('❌ ERROR: Registration failed:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Make sure webrtc-gateway-bridge is running');
    console.log('2. Check that you\'ve accepted the self-signed certificate at https://127.0.0.1:8000');
    console.log('3. Verify the bridge is listening on port 8000');
    return;
  }
  
  // Step 4: Verify status
  console.log('\n📋 Step 4: Verifying registration status...');
  
  try {
    const statusResponse = await fetch('https://127.0.0.1:8000/GetStatus');
    const statusData = await statusResponse.json();
    
    console.log('✅ Status:', statusData);
    
    if (statusData.registered && statusData.dn === dn) {
      console.log('✅ DN is registered!');
    } else {
      console.warn('⚠️ DN registration status unclear');
    }
    
  } catch (error) {
    console.warn('⚠️ Could not verify status:', error.message);
  }
  
  // Success message
  console.log('\n✅ ═══════════════════════════════════════════════════');
  console.log('✅ Integration setup complete!');
  console.log('✅ ═══════════════════════════════════════════════════');
  console.log('\n📞 Next steps:');
  console.log('1. Open webrtc-gateway-bridge console to see logs');
  console.log('2. Make a test call from another DN to:', dn);
  console.log('3. You should see:');
  console.log('   - Phone rings in browser');
  console.log('   - Accept button appears in WWE');
  console.log('   - Click Accept');
  console.log('   - Call should connect within 2 seconds!');
  console.log('\n🔍 Expected logs in webrtc-gateway-bridge:');
  console.log('   [Workspace] ✅ Connected to Workspace API');
  console.log('   [Workspace] 📞 Call ringing: ...');
  console.log('   [Workspace] 🎯 Call answered in WWE: ...');
  console.log('   [Workspace] ✅ Answer command sent to WebRTC gateway');
  console.log('\n💡 Troubleshooting:');
  console.log('   - If Accept button doesn\'t appear: Check WWE is receiving call from T-Server');
  console.log('   - If call times out: Check workspace-client.js logs for connection issues');
  console.log('   - If no 200 OK: Check WebRTC gateway is loaded and responding');
  
})();
