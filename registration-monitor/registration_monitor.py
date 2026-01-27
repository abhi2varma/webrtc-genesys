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
import time
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

# POC: Specific DNs with registration objects configured
# Only these DNs will be unregistered on startup
CONFIGURED_DNS = os.getenv('CONFIGURED_DNS', '1002,1003,5001,5002,5003,5004,5005').split(',')

LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

# Setup logging to file and console
from logging.handlers import RotatingFileHandler
import time

# Custom formatter that uses local time
class LocalTimeFormatter(logging.Formatter):
    def formatTime(self, record, datefmt=None):
        """Override to use local time instead of UTC"""
        ct = self.converter(record.created)
        if datefmt:
            s = time.strftime(datefmt, ct)
        else:
            t = time.strftime("%Y-%m-%d %H:%M:%S", ct)
            s = "%s,%03d" % (t, record.msecs)
        return s
    
    converter = time.localtime  # Use local time

logger = logging.getLogger('RegistrationMonitor')
logger.setLevel(getattr(logging, LOG_LEVEL))

# Create logs directory if it doesn't exist
os.makedirs('/app/logs', exist_ok=True)

# File handler with rotation (10MB max, keep 3 files)
file_handler = RotatingFileHandler(
    '/app/logs/registration_monitor.log',
    maxBytes=10*1024*1024,  # 10MB
    backupCount=3
)
file_handler.setLevel(getattr(logging, LOG_LEVEL))
file_formatter = LocalTimeFormatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(file_formatter)

# Console handler
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(getattr(logging, LOG_LEVEL))
console_formatter = LocalTimeFormatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(console_formatter)

# Add handlers to logger
logger.addHandler(file_handler)
logger.addHandler(console_handler)

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
        """Query current registration status on startup and unregister all DNs"""
        logger.info("Querying initial registration status...")
        
        try:
            # Query all PJSIP contacts
            response = await self.ami_client.send_action({
                'Action': 'PJSIPShowContacts'
            })
            
            logger.info("Initial registration query completed")
            
        except Exception as e:
            logger.warning(f"Failed to query initial registrations: {e}")
        
        # Unregister configured DNs on startup to ensure clean state
        # Only unregister DNs that have registration objects in pjsip.conf
        logger.info(f"🧹 Unregistering configured DNs from Genesys on startup: {', '.join(CONFIGURED_DNS)}")
        for dn in CONFIGURED_DNS:
            dn = dn.strip()  # Remove any whitespace
            try:
                await self.unregister_from_genesys(dn, force=True)
            except Exception as e:
                logger.debug(f"Failed to unregister DN {dn} on startup (may not be registered): {e}")
    
    def is_monitored_dn(self, dn: str) -> bool:
        """Check if DN is in monitored range"""
        try:
            dn_num = int(dn)
            return DN_RANGE_START <= dn_num <= DN_RANGE_END
        except (ValueError, TypeError):
            return False
    
    async def handle_contact_status_detail(self, manager, event):
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
    
    async def handle_peer_status(self, manager, event):
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
    
    async def handle_device_state(self, manager, event):
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
    
    async def create_registration_object(self, dn: str):
        """Dynamically create registration object in pjsip.conf via AMI UpdateConfig"""
        registration_name = f"genesys_reg_{dn}"
        
        logger.info(f"📝 Creating registration object [{registration_name}] dynamically")
        
        try:
            # Add registration object to pjsip.conf using UpdateConfig
            config_updates = [
                ('Action', 'UpdateConfig'),
                ('SrcFilename', 'pjsip.conf'),
                ('DstFilename', 'pjsip.conf'),
                ('Action-000000', 'NewCat'),
                ('Cat-000000', registration_name),
                ('Action-000001', 'Append'),
                ('Cat-000001', registration_name),
                ('Var-000001', 'type'),
                ('Value-000001', 'registration'),
                ('Action-000002', 'Append'),
                ('Cat-000002', registration_name),
                ('Var-000002', 'transport'),
                ('Value-000002', 'transport-udp-dn'),
                ('Action-000003', 'Append'),
                ('Cat-000003', registration_name),
                ('Var-000003', 'outbound_auth'),
                ('Value-000003', 'genesys_auth'),
                ('Action-000004', 'Append'),
                ('Cat-000004', registration_name),
                ('Var-000004', 'server_uri'),
                ('Value-000004', f'sip:{GENESYS_SIP_HOST}'),
                ('Action-000005', 'Append'),
                ('Cat-000005', registration_name),
                ('Var-000005', 'client_uri'),
                ('Value-000005', f'sip:{dn}@{GENESYS_SIP_HOST}'),
                ('Action-000006', 'Append'),
                ('Cat-000006', registration_name),
                ('Var-000006', 'contact_user'),
                ('Value-000006', dn),
                ('Action-000007', 'Append'),
                ('Cat-000007', registration_name),
                ('Var-000007', 'retry_interval'),
                ('Value-000007', '0'),
                ('Action-000008', 'Append'),
                ('Cat-000008', registration_name),
                ('Var-000008', 'expiration'),
                ('Value-000008', '3600'),
                ('Action-000009', 'Append'),
                ('Cat-000009', registration_name),
                ('Var-000009', 'max_retries'),
                ('Value-000009', '0'),
            ]
            
            # Convert to dict for AMI
            update_dict = dict(config_updates)
            response = await self.ami_client.send_action(update_dict)
            
            if response.success:
                logger.info(f"✅ Registration object [{registration_name}] created in pjsip.conf")
                
                # Reload PJSIP to pick up the new registration
                logger.info("🔄 Reloading PJSIP module...")
                reload_response = await self.ami_client.send_action({
                    'Action': 'Command',
                    'Command': 'module reload res_pjsip.so'
                })
                
                if reload_response.success:
                    logger.info("✅ PJSIP module reloaded")
                    await asyncio.sleep(2)  # Wait for reload to complete
                    return True
                else:
                    logger.warning(f"⚠️ PJSIP reload may have failed: {reload_response.message}")
                    return True  # Continue anyway
            else:
                logger.error(f"❌ Failed to create registration object: {response.message}")
                return False
        
        except Exception as e:
            logger.error(f"❌ Error creating registration object for DN {dn}: {e}")
            return False
    
    async def register_to_genesys(self, dn: str):
        """Register DN to Genesys SIP Server via AMI PJSIP command"""
        
        if dn in self.registered_dns:
            logger.debug(f"DN {dn} already registered to Genesys")
            return
        
        logger.info(f"🔵 Registering DN {dn} to Genesys SIP Server")
        
        try:
            # First, try to register (registration object might already exist)
            registration_name = f"genesys_reg_{dn}"
            
            response = await self.ami_client.send_action({
                'Action': 'PJSIPRegister',
                'Registration': registration_name
            })
            
            if response.success:
                logger.info(f"✅ DN {dn} registered to Genesys (registration: {registration_name})")
                self.registered_dns.add(dn)
            else:
                # Registration object doesn't exist, create it dynamically
                error_msg = response.message.lower() if hasattr(response, 'message') else str(response).lower()
                if 'unable to retrieve' in error_msg or 'not found' in error_msg:
                    logger.info(f"📝 Registration object [{registration_name}] not found, creating dynamically...")
                    
                    if await self.create_registration_object(dn):
                        # Retry registration after creating the object
                        retry_response = await self.ami_client.send_action({
                            'Action': 'PJSIPRegister',
                            'Registration': registration_name
                        })
                        
                        if retry_response.success:
                            logger.info(f"✅ DN {dn} registered to Genesys (registration: {registration_name})")
                            self.registered_dns.add(dn)
                        else:
                            logger.error(f"❌ Failed to register DN {dn} after creating object: {retry_response.message}")
                    else:
                        logger.error(f"❌ Could not create registration object for DN {dn}")
                else:
                    logger.error(f"❌ Failed to register DN {dn}: {response.message}")
        
        except Exception as e:
            logger.error(f"❌ Failed to register DN {dn}: {e}")
    
    async def unregister_from_genesys(self, dn: str, force: bool = False):
        """Unregister DN from Genesys SIP Server
        
        Args:
            dn: DN number to unregister
            force: If True, attempt unregister even if not tracked as registered (for startup cleanup)
        """
        
        if not force and dn not in self.registered_dns:
            logger.debug(f"DN {dn} not registered to Genesys")
            return
        
        logger.info(f"🔴 Unregistering DN {dn} from Genesys SIP Server")
        
        try:
            # Unregister via AMI
            registration_name = f"genesys_reg_{dn}"
            
            response = await self.ami_client.send_action({
                'Action': 'PJSIPUnregister',
                'Registration': registration_name
            })
            
            if response.success:
                logger.info(f"✅ DN {dn} unregistered from Genesys (registration: {registration_name})")
                self.registered_dns.discard(dn)
            else:
                logger.warning(f"⚠️ Failed to unregister DN {dn}: {response.message}")
                # Remove from tracking anyway
                self.registered_dns.discard(dn)
        
        except Exception as e:
            logger.warning(f"⚠️ Failed to unregister DN {dn}: {e}")
            # Remove from tracking anyway
            self.registered_dns.discard(dn)
    
    async def run(self):
        """Main run loop"""
        self.running = True
        
        while self.running:
            if not self.ami_client or not self.ami_client.protocol:
                logger.warning("AMI connection lost, reconnecting...")
                logger.info("🔄 Asterisk may have restarted, will cleanup DNs after reconnection")
                await asyncio.sleep(5)
                
                if not await self.connect():
                    logger.error("Reconnection failed, retrying in 10s...")
                    await asyncio.sleep(10)
                    continue
                else:
                    # Successfully reconnected - Asterisk likely restarted
                    logger.info("✅ Reconnected to Asterisk AMI")
                    logger.info(f"🧹 Cleaning up configured DNs after Asterisk restart: {', '.join(CONFIGURED_DNS)}")
                    
                    # Unregister only configured DNs to ensure clean state
                    for dn in CONFIGURED_DNS:
                        dn = dn.strip()
                        try:
                            await self.unregister_from_genesys(dn, force=True)
                        except Exception as e:
                            logger.debug(f"Failed to cleanup DN {dn} after reconnect: {e}")
                    
                    logger.info("✅ DN cleanup completed after Asterisk restart")
            
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
            try:
                await self.ami_client.close()
            except Exception as e:
                logger.debug(f"Error closing AMI connection: {e}")
        
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

