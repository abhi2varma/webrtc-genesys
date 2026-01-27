#!/usr/bin/env python3
"""
AMI NOTIFY Handler - Auto-Answer Trigger
Monitors Asterisk AMI for NOTIFY messages with Event: talk
and triggers auto-answer via webrtc-gateway-bridge API
"""

import asyncio
import aiohttp
import re
import sys
from typing import Dict, Optional

# Configuration
AMI_HOST = '127.0.0.1'
AMI_PORT = 5038
AMI_USER = 'admin'
AMI_SECRET = 'admin123'

BRIDGE_API_URL = 'https://127.0.0.1:8000'

# ANSI colors
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'


class NotifyHandler:
    def __init__(self):
        self.reader = None
        self.writer = None
        self.session = None
        
    async def connect_ami(self):
        """Connect to Asterisk AMI"""
        print(f"{BLUE}Connecting to Asterisk AMI at {AMI_HOST}:{AMI_PORT}...{RESET}")
        
        self.reader, self.writer = await asyncio.open_connection(AMI_HOST, AMI_PORT)
        
        # Read welcome message
        welcome = await self.reader.read(1024)
        print(f"{GREEN}AMI Connected: {welcome.decode().strip()}{RESET}")
        
        # Login
        login_msg = (
            f"Action: Login\r\n"
            f"Username: {AMI_USER}\r\n"
            f"Secret: {AMI_SECRET}\r\n"
            f"\r\n"
        )
        self.writer.write(login_msg.encode())
        await self.writer.drain()
        
        # Read login response
        response = await self._read_ami_response()
        if 'Success' in response:
            print(f"{GREEN}✅ AMI Login successful{RESET}")
        else:
            print(f"{RED}❌ AMI Login failed: {response}{RESET}")
            sys.exit(1)
    
    async def _read_ami_response(self) -> str:
        """Read a complete AMI response"""
        response = []
        while True:
            line = await self.reader.readline()
            if not line:
                break
            line = line.decode().strip()
            response.append(line)
            if line == '':  # Empty line indicates end of response
                break
        return '\n'.join(response)
    
    async def monitor_events(self):
        """Monitor AMI events for NOTIFY messages"""
        print(f"{BLUE}🔍 Monitoring for NOTIFY events...{RESET}")
        
        # Create HTTP session for bridge API calls
        connector = aiohttp.TCPConnector(ssl=False)  # Ignore SSL verification
        self.session = aiohttp.ClientSession(connector=connector)
        
        try:
            while True:
                line = await self.reader.readline()
                if not line:
                    print(f"{RED}AMI connection closed{RESET}")
                    break
                    
                line = line.decode().strip()
                
                # Look for NOTIFY-related events
                if 'RequestReceived' in line or 'NOTIFY' in line:
                    # Read the complete event
                    event = await self._read_ami_event(line)
                    await self.handle_notify_event(event)
                    
        finally:
            await self.session.close()
    
    async def _read_ami_event(self, first_line: str) -> Dict[str, str]:
        """Read a complete AMI event"""
        event = {'_first': first_line}
        
        while True:
            line = await self.reader.readline()
            if not line:
                break
            line = line.decode().strip()
            
            if line == '':  # Empty line indicates end of event
                break
                
            # Parse key: value
            if ': ' in line:
                key, value = line.split(': ', 1)
                event[key] = value
        
        return event
    
    async def handle_notify_event(self, event: Dict[str, str]):
        """Handle NOTIFY event and trigger auto-answer if needed"""
        # Check if this is a NOTIFY with Event: talk
        request_method = event.get('RequestMethod', '')
        
        if request_method == 'NOTIFY':
            # Extract details
            channel = event.get('Channel', '')
            endpoint = event.get('Endpoint', '')
            
            # Parse the actual SIP message to find Event header
            # This is a simplified check - in production, parse the full SIP message
            print(f"{YELLOW}📩 NOTIFY received on channel: {channel}{RESET}")
            print(f"{YELLOW}   Full event: {event}{RESET}")
            
            # Trigger auto-answer
            # Extract DN from channel name (e.g., PJSIP/1002-0000000d -> 1002)
            dn = self._extract_dn(channel)
            if dn:
                await self.trigger_auto_answer(dn, event.get('CallID', 'unknown'))
    
    def _extract_dn(self, channel: str) -> Optional[str]:
        """Extract DN from channel name"""
        # Pattern: PJSIP/1002-0000000d
        match = re.search(r'PJSIP/(\d+)-', channel)
        if match:
            return match.group(1)
        return None
    
    async def trigger_auto_answer(self, dn: str, call_id: str):
        """Trigger auto-answer via bridge API"""
        print(f"{GREEN}🎯 AUTO-ANSWER TRIGGER: DN {dn}, Call-ID: {call_id}{RESET}")
        
        try:
            url = f"{BRIDGE_API_URL}/auto-answer/{dn}"
            async with self.session.post(url, json={'call_id': call_id}) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    print(f"{GREEN}✅ Auto-answer triggered successfully: {result}{RESET}")
                else:
                    print(f"{RED}❌ Auto-answer failed: HTTP {resp.status}{RESET}")
        except Exception as e:
            print(f"{RED}❌ Error triggering auto-answer: {e}{RESET}")


async def main():
    handler = NotifyHandler()
    
    try:
        await handler.connect_ami()
        await handler.monitor_events()
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Shutting down...{RESET}")
    except Exception as e:
        print(f"{RED}Error: {e}{RESET}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    asyncio.run(main())
