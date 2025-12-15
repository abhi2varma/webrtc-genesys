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
    
    try:
        manager = Manager(
            host=ASTERISK_HOST,
            port=ASTERISK_AMI_PORT,
            username=ASTERISK_AMI_USER,
            secret=ASTERISK_AMI_SECRET
        )
        
        await manager.connect()
        
        # Register event listeners to collect data
        contact_events = []
        registration_events = []
        
        def handle_contact_event(manager, event):
            if event.get('Event') == 'ContactStatusDetail':
                contact_events.append(event)
        
        def handle_registration_event(manager, event):
            if event.get('Event') == 'OutboundRegistrationDetail':
                registration_events.append(event)
        
        # Register listeners
        manager.register_event('ContactStatusDetail', handle_contact_event)
        manager.register_event('OutboundRegistrationDetail', handle_registration_event)
        
        # Send actions and wait for responses
        await manager.send_action({'Action': 'PJSIPShowContacts'})
        await asyncio.sleep(0.5)  # Wait for events to arrive
        
        await manager.send_action({'Action': 'PJSIPShowRegistrationsOutbound'})
        await asyncio.sleep(0.5)  # Wait for events to arrive
        
        # Process contact events
        for event in contact_events:
            aor = event.get('AOR', '')
            uri = event.get('URI', '')
            status = event.get('Status', '')
            
            # Extract DN from AOR
            dn = aor.split('/')[0] if '/' in aor else aor
            
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
        for event in registration_events:
            reg_name = event.get('ObjectName', '')
            status = event.get('Status', '')
            server_uri = event.get('ServerURI', '')
            client_uri = event.get('ClientURI', '')
            
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
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    result = loop.run_until_complete(get_registrations())
    loop.close()
    return jsonify(result)

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)

