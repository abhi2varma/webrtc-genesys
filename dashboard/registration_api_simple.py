#!/usr/bin/env python3
"""
Simple Registration Dashboard API using CLI commands
"""

from flask import Flask, jsonify
from flask_cors import CORS
import subprocess
import re

app = Flask(__name__)
CORS(app)

def parse_contacts():
    """Get WebRTC client registrations using CLI"""
    contacts = []
    
    try:
        # Execute asterisk CLI command
        result = subprocess.run(
            ['docker', 'exec', 'webrtc-asterisk', 'asterisk', '-rx', 'pjsip show contacts'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        # Parse output
        lines = result.stdout.split('\n')
        for line in lines:
            # Look for lines like: Contact:  5001/sip:xyz@10.8.0.5:8901  Unknown  nan
            if 'Contact:' in line and '/sip:' in line:
                parts = line.split()
                if len(parts) >= 2:
                    contact_info = parts[1]  # 5001/sip:xyz@10.8.0.5:8901
                    
                    # Extract DN
                    if '/' in contact_info:
                        dn = contact_info.split('/')[0]
                        
                        # Extract URI
                        if 'sip:' in contact_info:
                            uri = contact_info.split('/')[1] if '/' in contact_info else ''
                            
                            # Extract IP and port from URI
                            ip = ''
                            port = ''
                            if '@' in uri:
                                addr_part = uri.split('@')[1].split(';')[0]
                                if ':' in addr_part:
                                    ip, port = addr_part.split(':')
                                else:
                                    ip = addr_part
                            
                            # Get status
                            status = 'Unknown'
                            if len(parts) >= 3:
                                status = parts[2]
                            
                            if dn.startswith('500'):  # Only DNs 5001-5020
                                contacts.append({
                                    'dn': dn,
                                    'ip': ip,
                                    'port': port,
                                    'status': 'Online' if status != 'Unavailable' else 'Offline',
                                    'uri': uri
                                })
    
    except Exception as e:
        print(f"Error parsing contacts: {e}")
    
    return contacts

def parse_registrations():
    """Get Genesys registrations using CLI"""
    registrations = []
    
    try:
        result = subprocess.run(
            ['docker', 'exec', 'webrtc-asterisk', 'asterisk', '-rx', 'pjsip show registrations'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        # Parse output
        lines = result.stdout.split('\n')
        for line in lines:
            # Look for lines like: genesys_reg_5001/sip:192.168.210.81:5060  genesys_auth  Registered
            if 'genesys_reg_' in line:
                parts = line.split()
                if len(parts) >= 3:
                    reg_info = parts[0]  # genesys_reg_5001/sip:192.168.210.81:5060
                    status = parts[2]    # Registered or Unregistered
                    
                    # Extract DN
                    if 'genesys_reg_' in reg_info:
                        dn = reg_info.split('/')[0].replace('genesys_reg_', '')
                        
                        # Extract server URI
                        server_uri = ''
                        if '/' in reg_info:
                            server_uri = reg_info.split('/')[1]
                        
                        registrations.append({
                            'dn': dn,
                            'status': status,
                            'server_uri': server_uri,
                            'client_uri': f'sip:{dn}@192.168.210.81'
                        })
    
    except Exception as e:
        print(f"Error parsing registrations: {e}")
    
    return registrations

@app.route('/api/registrations', methods=['GET'])
def registrations():
    """Get current registrations"""
    try:
        contacts = parse_contacts()
        genesys_regs = parse_registrations()
        
        return jsonify({
            'success': True,
            'contacts': contacts,
            'genesys_registrations': genesys_regs
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)

