#!/usr/bin/env python3
"""
Test script to verify SIP NOTIFY parsing without WWE
Simulates a NOTIFY message and tests the extraction logic
"""

import asyncio
import aiohttp

# Sample NOTIFY message from your logs
SAMPLE_NOTIFY = """NOTIFY sip:192.168.210.54:5061 SIP/2.0
From: sip:1003@192.168.210.81:5060;tag=88170A6B-45A8-43AE-9D3C-97CE63DC2C9C-374
To: <sip:1002@192.168.210.81>;tag=b2cf6809-0aea-4f6b-8678-e6db4ba8a7fe
Call-ID: D6F9763C-E5D5-4C4B-97C3-C0725E0E2E17-84@192.168.210.81
CSeq: 2 NOTIFY
Content-Length: 0
Via: SIP/2.0/UDP 192.168.210.81:5060;branch=z9hG4bKF9D1A146-A651-43A6-8A12-32F3EB33637E-240
Contact: <sip:1003@192.168.210.81:5060>
Event: talk
Subscription-State: active
Max-Forwards: 70
X-Genesys-CallUUID: UIVB8J6JE91C53UIM3VI59VHQ400001T"""

BRIDGE_API_URL = 'https://127.0.0.1:8000'
NOTIFY_ENDPOINT = '/genesys-call-notify'

async def test_parsing():
    """Test NOTIFY message parsing"""
    import re
    
    print("=" * 60)
    print("Testing SIP NOTIFY Extraction (Without WWE)")
    print("=" * 60)
    print()
    
    lines = SAMPLE_NOTIFY.split('\n')
    
    is_notify = False
    event_header = None
    genesys_call_uuid = None
    to_header = None
    from_header = None
    
    print("📋 Parsing NOTIFY message...")
    print()
    
    for line in lines:
        if line.startswith('NOTIFY sip:'):
            is_notify = True
            print(f"  ✓ Found NOTIFY request")
        elif line.lower().startswith('event:'):
            event_header = line.split(':', 1)[1].strip()
            print(f"  ✓ Event: {event_header}")
        elif line.lower().startswith('x-genesys-calluuid:'):
            genesys_call_uuid = line.split(':', 1)[1].strip()
            print(f"  ✓ CallUUID: {genesys_call_uuid}")
        elif line.lower().startswith('to:'):
            to_header = line.split(':', 1)[1].strip()
            # Extract DN
            match = re.search(r'sip:(\d+)@', to_header)
            if match:
                dn = match.group(1)
                print(f"  ✓ To (DN): {dn}")
        elif line.lower().startswith('from:'):
            from_header = line.split(':', 1)[1].strip()
            match = re.search(r'sip:(\d+)@', from_header)
            if match:
                caller = match.group(1)
                print(f"  ✓ From (Caller): {caller}")
    
    print()
    
    if is_notify and event_header == 'talk' and genesys_call_uuid and to_header:
        match = re.search(r'sip:(\d+)@', to_header)
        if match:
            dn = match.group(1)
            print("✅ NOTIFY parsing successful!")
            print()
            print(f"  DN (called):  {dn}")
            print(f"  CallUUID:     {genesys_call_uuid}")
            print()
            
            # Test sending to bridge
            return dn, genesys_call_uuid
    
    print("❌ Failed to parse NOTIFY")
    return None, None

async def test_bridge_endpoint(dn, call_uuid):
    """Test sending to bridge endpoint"""
    url = f"{BRIDGE_API_URL}{NOTIFY_ENDPOINT}"
    payload = {"dn": dn, "call_uuid": call_uuid}
    
    print("=" * 60)
    print("Testing Bridge Endpoint")
    print("=" * 60)
    print()
    print(f"  URL:      {url}")
    print(f"  Payload:  {payload}")
    print()
    
    try:
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False)) as session:
            print("  Sending POST request...")
            async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=5)) as response:
                status = response.status
                body = await response.text()
                
                print(f"  Status:   {status}")
                print(f"  Response: {body}")
                print()
                
                if status == 200:
                    print("✅ Bridge accepted the CallUUID!")
                    print()
                    print("Expected bridge behavior:")
                    print("  1. Store CallUUID for DN 1002")
                    print("  2. When SIP call arrives, associate with CallUUID")
                    print("  3. Auto-answer call immediately")
                    print("  4. (WWE would query bridge for CallUUID)")
                else:
                    print(f"⚠️  Bridge returned status {status}")
                    print("   This might be normal if endpoint doesn't exist yet")
                
                return status == 200
    except aiohttp.ClientConnectorError:
        print("❌ Cannot connect to bridge!")
        print()
        print("   Bridge is not running at https://127.0.0.1:8000")
        print()
        print("   Start the bridge first:")
        print("     cd webrtc-gateway-bridge")
        print("     npm start")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

async def main():
    print()
    print("🧪 SIP NOTIFY Signaling Test (No WWE Required)")
    print()
    
    # Test parsing
    dn, call_uuid = await test_parsing()
    
    if dn and call_uuid:
        # Test bridge endpoint
        success = await test_bridge_endpoint(dn, call_uuid)
        
        print()
        print("=" * 60)
        print("Test Summary")
        print("=" * 60)
        print()
        
        if success:
            print("✅ All tests passed!")
            print()
            print("Next steps:")
            print("  1. Deploy the monitor: bash scripts/deploy-sip-monitor-simple.sh")
            print("  2. Make a test call: 1003 → 1002")
            print("  3. Watch monitor logs: tail -f /tmp/sip-notify-monitor.log")
            print("  4. Verify bridge receives CallUUID")
            print("  5. Confirm call auto-answers")
        else:
            print("⚠️  Bridge endpoint test failed")
            print()
            print("Make sure:")
            print("  1. Bridge is running (npm start)")
            print("  2. /genesys-call-notify endpoint exists in main.js")
            print("  3. Bridge is listening on port 8000")

if __name__ == '__main__':
    asyncio.run(main())
