#!/usr/bin/env python3
"""
Registration Dashboard API
Provides REST endpoint for active registrations
"""

from flask import Flask, jsonify
from flask_cors import CORS
import asyncio
import os
from panoramisk import Manager
import logging

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

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
            print(f"  Event type: {event.get('Event')}")
            if event.get('Event') == 'ContactList':
                contact_events.append(event)
                print(f"  Added contact for Endpoint: {event.get('Endpoint')}")
        
        print(f"Total contacts collected: {len(contact_events)}")
        
        # Query registrations - iterate response directly  
        print("Sending PJSIPShowRegistrationsOutbound action...")
        registration_response = await manager.send_action({'Action': 'PJSIPShowRegistrationsOutbound'})
        
        registration_events = []
        print(f"Iterating registration response...")
        for event in registration_response:
            print(f"  Event type: {event.get('Event')}")
            if event.get('Event') == 'OutboundRegistrationDetail':
                registration_events.append(event)
                print(f"  Added registration for: {event.get('ObjectName')}")
        
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

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)

