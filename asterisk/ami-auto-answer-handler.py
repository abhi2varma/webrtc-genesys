#!/usr/bin/env python3
"""
Genesys Auto-Answer Handler for Asterisk
Monitors AMI for SIP NOTIFY events with "Event: talk" and triggers auto-answer via Bridge API
"""

import asyncio
import re
import logging
import os
import sys
from datetime import datetime
import aiohttp
from panoramisk import Manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Configuration from environment variables
ASTERISK_HOST = os.getenv('ASTERISK_HOST', '127.0.0.1')
ASTERISK_AMI_PORT = int(os.getenv('ASTERISK_AMI_PORT', 5038))
ASTERISK_AMI_USER = os.getenv('ASTERISK_AMI_USER', 'admin')
ASTERISK_AMI_SECRET = os.getenv('ASTERISK_AMI_SECRET', 'admin123')
BRIDGE_API_URL = os.getenv('BRIDGE_API_URL', 'http://192.168.210.54:8000')
GENESYS_SIP_HOST = os.getenv('GENESYS_SIP_HOST', '192.168.210.81')

class AutoAnswerHandler:
    def __init__(self):
        self.manager = None
        self.pending_calls = {}  # channel -> DN mapping
        
    async def connect(self):
        """Connect to Asterisk AMI"""
        try:
            logger.info(f"Connecting to Asterisk AMI at {ASTERISK_HOST}:{ASTERISK_AMI_PORT}")
            self.manager = Manager(
                host=ASTERISK_HOST,
                port=ASTERISK_AMI_PORT,
                username=ASTERISK_AMI_USER,
                secret=ASTERISK_AMI_SECRET,
                ping_delay=10,
                ping_tries=3
            )
            
            # Register event handlers
            self.manager.register_event('*', self.handle_event)
            
            await self.manager.connect()
            logger.info("✅ Connected to Asterisk AMI successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to Asterisk AMI: {e}")
            raise
    
    async def handle_event(self, manager, event):
        """Handle all AMI events"""
        event_type = event.get('Event')
        
        # Log all events for debugging (can be removed in production)
        if event_type not in ['RTCPSent', 'RTCPReceived', 'ContactStatus']:
            logger.debug(f"AMI Event: {event_type}")
        
        # Track new channels from Genesys
        if event_type == 'Newchannel':
            await self.handle_newchannel(event)
        
        # Detect SIP NOTIFY messages
        elif event_type == 'SIPMessageReceived':
            await self.handle_sip_message(event)
            
        # Alternative: RTCPReceived might contain NOTIFY info
        elif event_type == 'RTCPReceived':
            await self.handle_rtcp(event)
    
    async def handle_newchannel(self, event):
        """Track new channels to map channel -> DN"""
        channel = event.get('Channel', '')
        caller_id = event.get('CallerIDNum', '')
        exten = event.get('Exten', '')
        context = event.get('Context', '')
        
        # Only track channels from Genesys (from-genesys context)
        if context == 'from-genesys' and exten and exten.isdigit():
            self.pending_calls[channel] = exten
            logger.info(f"📞 New call tracked: Channel={channel}, DN={exten}, From={caller_id}")
    
    async def handle_sip_message(self, event):
        """Handle SIP messages received by Asterisk"""
        content = event.get('Content', '')
        
        # Check if this is a NOTIFY with Event: talk
        if 'NOTIFY' in content and 'Event: talk' in content:
            logger.info(f"🔔 NOTIFY Event: talk received!")
            logger.debug(f"Full content: {content}")
            
            # Extract Call-ID to find the channel
            call_id_match = re.search(r'Call-ID:\s*([^\r\n]+)', content)
            if call_id_match:
                call_id = call_id_match.group(1).strip()
                await self.trigger_auto_answer_by_callid(call_id, content)
    
    async def handle_rtcp(self, event):
        """Handle RTCP events (alternative detection method)"""
        # Some Asterisk versions might expose NOTIFY here
        content = str(event)
        if 'Event: talk' in content or 'event=talk' in content:
            logger.info(f"🔔 Event: talk detected in RTCP!")
            # Try to extract channel info
            channel = event.get('Channel')
            if channel:
                await self.trigger_auto_answer(channel)
    
    async def trigger_auto_answer_by_callid(self, call_id, content):
        """Trigger auto-answer by finding channel with matching Call-ID"""
        try:
            # Get active channels
            response = await self.manager.send_action({
                'Action': 'CoreShowChannels'
            })
            
            # Find channel matching this Call-ID or DN
            # Extract DN from NOTIFY To header
            to_match = re.search(r'To:\s*<?sip:(\d+)@', content)
            if to_match:
                dn = to_match.group(1)
                logger.info(f"🎯 Auto-answer target DN: {dn}")
                
                # Find channel for this DN
                for channel, tracked_dn in self.pending_calls.items():
                    if tracked_dn == dn:
                        await self.trigger_auto_answer(channel, dn)
                        return
                
                # If not in pending_calls, try direct trigger
                await self.trigger_auto_answer_direct(dn)
        
        except Exception as e:
            logger.error(f"❌ Error triggering auto-answer by Call-ID: {e}")
    
    async def trigger_auto_answer(self, channel, dn=None):
        """Trigger auto-answer for a specific channel"""
        if not dn:
            dn = self.pending_calls.get(channel)
        
        if dn:
            logger.info(f"🎯 Triggering auto-answer for DN={dn}, Channel={channel}")
            await self.trigger_auto_answer_direct(dn)
        else:
            logger.warning(f"⚠️ Cannot trigger auto-answer: DN not found for channel {channel}")
    
    async def trigger_auto_answer_direct(self, dn):
        """Trigger auto-answer via Bridge API"""
        try:
            url = f"{BRIDGE_API_URL}/answer/{dn}"
            logger.info(f"📡 Calling Bridge API: {url}")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, timeout=5) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"✅ Auto-answer triggered successfully: {result}")
                    else:
                        text = await response.text()
                        logger.error(f"❌ Bridge API error ({response.status}): {text}")
        
        except asyncio.TimeoutError:
            logger.error(f"❌ Bridge API timeout for DN {dn}")
        except Exception as e:
            logger.error(f"❌ Failed to call Bridge API: {e}")
    
    async def monitor_sip_notify_via_log(self):
        """
        Alternative: Monitor Asterisk full log for NOTIFY messages
        This is a fallback if AMI events don't capture NOTIFY
        """
        log_file = '/var/log/asterisk/full'
        if not os.path.exists(log_file):
            logger.warning(f"Log file {log_file} not found, skipping log monitoring")
            return
        
        logger.info(f"📋 Starting log file monitoring: {log_file}")
        
        try:
            # Open log file and seek to end
            with open(log_file, 'r') as f:
                f.seek(0, 2)  # Seek to end
                
                while True:
                    line = f.readline()
                    if not line:
                        await asyncio.sleep(0.1)
                        continue
                    
                    # Look for NOTIFY with Event: talk
                    if 'NOTIFY' in line and 'Event: talk' in line:
                        logger.info(f"🔔 NOTIFY Event: talk detected in log!")
                        # Try to extract DN from subsequent lines
                        # This is a simplified approach
        
        except Exception as e:
            logger.error(f"❌ Error monitoring log file: {e}")
    
    async def run(self):
        """Main run loop"""
        await self.connect()
        
        logger.info("👀 Monitoring for NOTIFY Event: talk messages...")
        logger.info(f"🌐 Bridge API: {BRIDGE_API_URL}")
        logger.info(f"📍 Genesys SIP: {GENESYS_SIP_HOST}")
        logger.info("")
        logger.info("Ready to handle auto-answer requests from Genesys!")
        
        # Keep the connection alive
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("🛑 Shutting down...")
        finally:
            if self.manager:
                await self.manager.close()


async def main():
    """Main entry point"""
    logger.info("=" * 60)
    logger.info("  Genesys Auto-Answer Handler for Asterisk")
    logger.info("=" * 60)
    logger.info("")
    
    handler = AutoAnswerHandler()
    
    try:
        await handler.run()
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Interrupted by user")
        sys.exit(0)
