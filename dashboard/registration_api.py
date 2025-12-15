#!/usr/bin/env python3
"""
Registration Dashboard API
Provides REST endpoint for active registrations
"""

from flask import Flask, jsonify
from flask_cors import CORS
import asyncio
import os
import sys
import subprocess
import re
from panoramisk import Manager
import logging
from logging.handlers import RotatingFileHandler

# Setup logging to file and console
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Create logs directory if it doesn't exist
os.makedirs('/app/logs', exist_ok=True)

# File handler with rotation (10MB max, keep 3 files)
file_handler = RotatingFileHandler(
    '/app/logs/dashboard_api.log',
    maxBytes=10*1024*1024,  # 10MB
    backupCount=3
)
file_handler.setLevel(logging.DEBUG)
file_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(file_formatter)

# Console handler
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(console_formatter)

# Add handlers to logger
logger.addHandler(file_handler)
logger.addHandler(console_handler)

app = Flask(__name__)
CORS(app)

ASTERISK_HOST = os.getenv('ASTERISK_HOST', '127.0.0.1')
ASTERISK_AMI_PORT = int(os.getenv('ASTERISK_AMI_PORT', '5038'))
ASTERISK_AMI_USER = os.getenv('ASTERISK_AMI_USER', 'admin')
ASTERISK_AMI_SECRET = os.getenv('ASTERISK_AMI_SECRET', 'admin123')

async def get_registrations():
    """Get all active registrations from Asterisk"""
    contacts = []
    registrations = []
    
    print(f"Connecting to AMI: {ASTERISK_HOST}:{ASTERISK_AMI_PORT}")
    
    try:
        manager = Manager(
            host=ASTERISK_HOST,
            port=ASTERISK_AMI_PORT,
            username=ASTERISK_AMI_USER,
            secret=ASTERISK_AMI_SECRET
        )
        
        await manager.connect()
        print("Connected to AMI!")
        
        # Query contacts - iterate response directly
        print("Sending PJSIPShowContacts action...")
        contact_response = await manager.send_action({'Action': 'PJSIPShowContacts'})
        
        contact_events = []
        print(f"Iterating contact response...")
        for event in contact_response:
            # Convert panoramisk Message objects to dict
            if hasattr(event, 'items'):
                event_dict = dict(event.items())
            else:
                print(f"  Skipping non-dict event: {type(event)}")
                continue
            
            print(f"  Event type: {event_dict.get('Event')}")
            if event_dict.get('Event') == 'ContactList':
                contact_events.append(event_dict)
                print(f"  Added contact for Endpoint: {event_dict.get('Endpoint')}")
        
        print(f"Total contacts collected: {len(contact_events)}")
        
        # Query registrations - iterate response directly  
        print("Sending PJSIPShowRegistrationsOutbound action...")
        registration_response = await manager.send_action({'Action': 'PJSIPShowRegistrationsOutbound'})
        
        registration_events = []
        print(f"Iterating registration response...")
        for event in registration_response:
            # Convert panoramisk Message objects to dict
            if hasattr(event, 'items'):
                event_dict = dict(event.items())
            else:
                print(f"  Skipping non-dict event: {type(event)}")
                continue
            
            print(f"  Event type: {event_dict.get('Event')}")
            if event_dict.get('Event') == 'OutboundRegistrationDetail':
                registration_events.append(event_dict)
                print(f"  Added registration for: {event_dict.get('ObjectName')}")
        
        print(f"Total registrations collected: {len(registration_events)}")
        
        # Process contact events
        print(f"Processing {len(contact_events)} contact events...")
        for event in contact_events:
            endpoint = event.get('Endpoint', '')  # Changed from AOR
            uri = event.get('Uri', '')  # Capital U in Uri
            status = event.get('Status', '')
            print(f"  Contact: Endpoint={endpoint}, URI={uri}, Status={status}")
            
            # DN is the endpoint name
            dn = endpoint
            
            # Extract IP and port from URI
            ip = ''
            port = ''
            if 'sip:' in uri:
                # Format: sip:user@ip:port;params
                parts = uri.split('@')
                if len(parts) > 1:
                    ip_port = parts[1].split(';')[0].split(':')
                    ip = ip_port[0] if len(ip_port) > 0 else ''
                    port = ip_port[1] if len(ip_port) > 1 else ''
            
            if dn and dn.startswith('500'):  # Only show 5001-5020
                contacts.append({
                    'dn': dn,
                    'ip': ip,
                    'port': port,
                    'status': status,
                    'uri': uri
                })
        
        # Process registration events
        print(f"Processing {len(registration_events)} registration events...")
        for event in registration_events:
            reg_name = event.get('ObjectName', '')
            status = event.get('Status', '')
            server_uri = event.get('ServerURI', '')
            client_uri = event.get('ClientURI', '')
            print(f"  Registration: Name={reg_name}, Status={status}")
            
            # Extract DN from registration name
            if 'genesys_reg_' in reg_name:
                dn = reg_name.replace('genesys_reg_', '')
                
                registrations.append({
                    'dn': dn,
                    'status': status,
                    'server_uri': server_uri,
                    'client_uri': client_uri
                })
        
        return {
            'success': True,
            'contacts': contacts,
            'genesys_registrations': registrations
        }
        
    except Exception as e:
        import traceback
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }

@app.route('/api/registrations', methods=['GET'])
def registrations():
    """Get current registrations"""
    print("=" * 60)
    print("API REQUEST: /api/registrations")
    print("=" * 60)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    result = loop.run_until_complete(get_registrations())
    print(f"RESULT: {result}")
    print("=" * 60)
    loop.close()
    return jsonify(result)

def get_kamailio_status():
    """Get Kamailio dispatcher status"""
    try:
        # Check if Kamailio container is running
        result = subprocess.run(
            ['docker', 'ps', '--filter', 'name=webrtc-kamailio', '--format', '{{.Status}}'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        container_status = result.stdout.strip() if result.returncode == 0 else 'Not found'
        is_running = 'Up' in container_status
        
        dispatchers = []
        
        if is_running:
            # Read dispatcher list file from container using docker exec
            try:
                cat_result = subprocess.run(
                    ['docker', 'exec', 'webrtc-kamailio', 'cat', '/etc/kamailio/dispatcher.list'],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                
                if cat_result.returncode == 0:
                    dispatcher_content = cat_result.stdout
                else:
                    dispatcher_content = ''
            except:
                dispatcher_content = ''
            
            if dispatcher_content:
                for line in dispatcher_content.splitlines():
                        line = line.strip()
                        # Skip comments and empty lines
                        if not line or line.startswith('#'):
                            continue
                        
                        # Parse: setid destination flags priority attributes
                        parts = line.split()
                        if len(parts) >= 2:
                            setid = parts[0]
                            destination = parts[1]
                            flags = parts[2] if len(parts) > 2 else '0'
                            
                            # Extract IP from SIP URI
                            ip_match = re.search(r'sip:([^:]+):?(\d+)?', destination)
                            if ip_match:
                                ip = ip_match.group(1)
                                port = ip_match.group(2) or '5060'
                                
                                # Check if this destination is healthy by looking at recent logs
                                try:
                                    log_result = subprocess.run(
                                        ['docker', 'logs', '--tail', '100', 'webrtc-kamailio'],
                                        capture_output=True,
                                        text=True,
                                        timeout=5
                                    )
                                    
                                    # Look for recent OPTIONS to this IP and 200 OK responses
                                    options_sent = ip in log_result.stdout
                                    ok_received = '200 OK' in log_result.stdout and ip in log_result.stdout
                                    
                                    health_status = 'Healthy' if ok_received else ('Checking' if options_sent else 'Unknown')
                                except:
                                    health_status = 'Unknown'
                                
                                dispatchers.append({
                                    'setid': setid,
                                    'destination': destination,
                                    'ip': ip,
                                    'port': port,
                                    'flags': flags,
                                    'health': health_status
                                })
        
        return {
            'success': True,
            'kamailio_running': is_running,
            'container_status': container_status,
            'dispatchers': dispatchers,
            'dispatcher_count': len(dispatchers)
        }
        
    except Exception as e:
        import traceback
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }

@app.route('/api/kamailio', methods=['GET'])
def kamailio_status():
    """Get Kamailio status"""
    logger.info("API REQUEST: /api/kamailio")
    result = get_kamailio_status()
    logger.info(f"Kamailio status: {result}")
    return jsonify(result)

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)

