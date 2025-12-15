#!/usr/bin/env python3
"""
Dynamic DN Registration Monitor for Asterisk-Genesys Integration

Monitors WebRTC client registrations via Asterisk AMI and dynamically
registers/unregisters DNs to Genesys SIP Server.

Architecture:
- Listens to Asterisk AMI events (PeerStatus, ContactStatus)
- When WebRTC client registers DN → Registers DN to Genesys via AMI
- When WebRTC client unregisters → Unregisters DN from Genesys
"""

import asyncio
import logging
import os
import re
import sys
from typing import Dict, Set
import signal

try:
    from panoramisk import Manager
except ImportError:
    print("ERROR: panoramisk library not found!")
    print("Install with: pip install panoramisk")
    sys.exit(1)

# Configuration from environment variables
ASTERISK_HOST = os.getenv('ASTERISK_HOST', 'webrtc-asterisk')
ASTERISK_AMI_PORT = int(os.getenv('ASTERISK_AMI_PORT', '5038'))
ASTERISK_AMI_USER = os.getenv('ASTERISK_AMI_USER', 'admin')
ASTERISK_AMI_SECRET = os.getenv('ASTERISK_AMI_SECRET', 'admin123')

GENESYS_SIP_HOST = os.getenv('GENESYS_SIP_HOST', '192.168.210.81')
GENESYS_SIP_PORT = os.getenv('GENESYS_SIP_PORT', '5060')

# DN range to monitor (5001-5020 by default)
DN_RANGE_START = int(os.getenv('DN_RANGE_START', '5001'))
DN_RANGE_END = int(os.getenv('DN_RANGE_END', '5020'))

LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

# Setup logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('RegistrationMonitor')

class RegistrationMonitor:
    """Monitors WebRTC client registrations and manages Genesys registrations"""
    
    def __init__(self):
        self.ami_client = None
        self.registered_dns: Set[str] = set()  # Track currently registered DNs
        self.running = False
        
    async def connect(self):
        """Connect to Asterisk AMI"""
        logger.info(f"Connecting to Asterisk AMI at {ASTERISK_HOST}:{ASTERISK_AMI_PORT}")
        
        try:
            self.ami_client = Manager(
                host=ASTERISK_HOST,
                port=ASTERISK_AMI_PORT,
                username=ASTERISK_AMI_USER,
                secret=ASTERISK_AMI_SECRET
            )
            
            await self.ami_client.connect()
            logger.info("✅ Connected to Asterisk AMI")
            
            # Register event handlers
            self.ami_client.register_event('ContactStatusDetail', self.handle_contact_status_detail)
            self.ami_client.register_event('PeerStatus', self.handle_peer_status)
            self.ami_client.register_event('DeviceStateChange', self.handle_device_state)
            
            # Query initial registration status
            await self.query_initial_registrations()
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to Asterisk AMI: {e}")
            return False
    
    async def query_initial_registrations(self):
        """Query current registration status on startup"""
        logger.info("Querying initial registration status...")
        
        try:
            # Query all PJSIP contacts
            response = await self.ami_client.send_action({
                'Action': 'PJSIPShowContacts'
            })
            
            logger.info("Initial registration query completed")
            
        except Exception as e:
            logger.warning(f"Failed to query initial registrations: {e}")
    
    def is_monitored_dn(self, dn: str) -> bool:
        """Check if DN is in monitored range"""
        try:
            dn_num = int(dn)
            return DN_RANGE_START <= dn_num <= DN_RANGE_END
        except (ValueError, TypeError):
            return False
    
    async def handle_contact_status_detail(self, event, **kwargs):
        """Handle ContactStatusDetail event (PJSIP)"""
        aor = event.get('AOR', '')
        uri = event.get('URI', '')
        status = event.get('Status', '')
        
        # Extract DN from AOR
        dn = aor.split('/')[0] if '/' in aor else aor
        
        if not self.is_monitored_dn(dn):
            return
        
        logger.debug(f"ContactStatusDetail: DN={dn}, Status={status}, URI={uri}")
        
        if status in ['Created', 'Reachable', 'NonQualified']:
            # Client registered
            await self.register_to_genesys(dn)
        elif status in ['Removed', 'Unreachable']:
            # Client unregistered
            await self.unregister_from_genesys(dn)
    
    async def handle_peer_status(self, event, **kwargs):
        """Handle PeerStatus event"""
        peer = event.get('Peer', '')
        peer_status = event.get('PeerStatus', '')
        
        # Extract DN from peer (format: PJSIP/5001)
        match = re.match(r'PJSIP/(\d+)', peer)
        if not match:
            return
        
        dn = match.group(1)
        
        if not self.is_monitored_dn(dn):
            return
        
        logger.debug(f"PeerStatus: DN={dn}, Status={peer_status}")
        
        if peer_status in ['Registered', 'Reachable']:
            await self.register_to_genesys(dn)
        elif peer_status in ['Unregistered', 'Unreachable', 'Rejected']:
            await self.unregister_from_genesys(dn)
    
    async def handle_device_state(self, event, **kwargs):
        """Handle DeviceStateChange event"""
        device = event.get('Device', '')
        state = event.get('State', '')
        
        # Extract DN from device (format: PJSIP/5001)
        match = re.match(r'PJSIP/(\d+)', device)
        if not match:
            return
        
        dn = match.group(1)
        
        if not self.is_monitored_dn(dn):
            return
        
        logger.debug(f"DeviceStateChange: DN={dn}, State={state}")
        
        # NOT_INUSE = Available (registered)
        # UNAVAILABLE = Not registered
        if state == 'NOT_INUSE':
            # Device is available, but we need to check if it's actually registered
            # This event fires even when device is just idle, not necessarily registered
            pass
        elif state == 'UNAVAILABLE':
            await self.unregister_from_genesys(dn)
    
    async def register_to_genesys(self, dn: str):
        """Register DN to Genesys SIP Server via AMI PJSIP command"""
        if dn in self.registered_dns:
            logger.debug(f"DN {dn} already registered to Genesys, skipping")
            return
        
        logger.info(f"🔵 Registering DN {dn} to Genesys SIP Server...")
        
        try:
            # Create registration dynamically using PJSIP wizard
            # Note: This requires the registration to be pre-configured in pjsip.conf
            # but we'll set it to retry_interval=0 and trigger it manually
            
            # Send a custom AMI command to trigger registration
            reg_name = f"genesys_reg_{dn}"
            
            # Method 1: Use PJSIPUnregister to clear, then re-register
            # This forces a new REGISTER to be sent
            try:
                await self.ami_client.send_action({
                    'Action': 'PJSIPUnregister',
                    'Registration': reg_name
                })
                await asyncio.sleep(0.1)
            except:
                pass  # Ignore if not registered
            
            # Trigger registration
            response = await self.ami_client.send_action({
                'Action': 'PJSIPRegister',
                'Registration': reg_name
            })
            
            if response.success:
                self.registered_dns.add(dn)
                logger.info(f"✅ DN {dn} registered to Genesys successfully")
            else:
                logger.warning(f"⚠️  DN {dn} registration response: {response}")
            
        except Exception as e:
            logger.error(f"❌ Failed to register DN {dn} to Genesys: {e}")
    
    async def unregister_from_genesys(self, dn: str):
        """Unregister DN from Genesys SIP Server"""
        if dn not in self.registered_dns:
            logger.debug(f"DN {dn} not registered to Genesys, skipping unregister")
            return
        
        logger.info(f"🔴 Unregistering DN {dn} from Genesys SIP Server...")
        
        try:
            reg_name = f"genesys_reg_{dn}"
            
            # Send unregister command
            response = await self.ami_client.send_action({
                'Action': 'PJSIPUnregister',
                'Registration': reg_name
            })
            
            if response.success:
                self.registered_dns.discard(dn)
                logger.info(f"✅ DN {dn} unregistered from Genesys successfully")
            else:
                logger.warning(f"⚠️  DN {dn} unregistration response: {response}")
            
        except Exception as e:
            logger.error(f"❌ Failed to unregister DN {dn} from Genesys: {e}")
    
    async def run(self):
        """Main run loop"""
        self.running = True
        
        while self.running:
            if not self.ami_client or not self.ami_client.protocol:
                logger.warning("AMI connection lost, reconnecting...")
                await asyncio.sleep(5)
                
                if not await self.connect():
                    logger.error("Reconnection failed, retrying in 10s...")
                    await asyncio.sleep(10)
                    continue
            
            # Keep running
            await asyncio.sleep(1)
    
    async def stop(self):
        """Stop the monitor"""
        logger.info("Stopping registration monitor...")
        self.running = False
        
        # Unregister all DNs from Genesys
        for dn in list(self.registered_dns):
            await self.unregister_from_genesys(dn)
        
        if self.ami_client:
            await self.ami_client.disconnect()
        
        logger.info("Registration monitor stopped")

# Global monitor instance
monitor = None

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"Received signal {signum}, shutting down...")
    if monitor:
        asyncio.create_task(monitor.stop())

async def main():
    """Main entry point"""
    global monitor
    
    logger.info("=" * 60)
    logger.info("Asterisk-Genesys Dynamic Registration Monitor")
    logger.info("=" * 60)
    logger.info(f"Asterisk AMI: {ASTERISK_HOST}:{ASTERISK_AMI_PORT}")
    logger.info(f"Genesys SIP: {GENESYS_SIP_HOST}:{GENESYS_SIP_PORT}")
    logger.info(f"Monitoring DNs: {DN_RANGE_START}-{DN_RANGE_END}")
    logger.info("=" * 60)
    
    # Setup signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    monitor = RegistrationMonitor()
    
    if not await monitor.connect():
        logger.error("Failed to connect to Asterisk AMI, exiting")
        sys.exit(1)
    
    try:
        await monitor.run()
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received")
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
    finally:
        await monitor.stop()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass

