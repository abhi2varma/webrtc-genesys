#!/usr/bin/env python3
"""
SIP NOTIFY Parser - Extracts Genesys CallUUID from NOTIFY messages
Reads tcpdump output and forwards CallUUID to WebRTC bridge
"""

import re
import sys
import requests
import urllib3
from datetime import datetime

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BRIDGE_API_URL = 'https://127.0.0.1:8000'

# ANSI colors
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'


def log(message, color=RESET):
    """Print colored log message"""
    timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]
    print(f"{color}[{timestamp}] {message}{RESET}", flush=True)


def extract_call_info(sip_message):
    """Extract DN, Call-ID, and CallUUID from SIP NOTIFY message"""
    # Extract To header for DN
    to_match = re.search(r'To:.*<sip:(\d+)@', sip_message, re.IGNORECASE)
    dn = to_match.group(1) if to_match else None
    
    # Extract Call-ID
    call_id_match = re.search(r'Call-ID:\s*(\S+)', sip_message, re.IGNORECASE)
    call_id = call_id_match.group(1) if call_id_match else None
    
    # Extract X-Genesys-CallUUID
    call_uuid_match = re.search(r'X-Genesys-CallUUID:\s*(\S+)', sip_message, re.IGNORECASE)
    call_uuid = call_uuid_match.group(1) if call_uuid_match else None
    
    # Extract Event header
    event_match = re.search(r'Event:\s*(\w+)', sip_message, re.IGNORECASE)
    event = event_match.group(1) if event_match else None
    
    return dn, call_id, call_uuid, event


def notify_bridge(dn, call_id, call_uuid, event):
    """Send CallUUID to WebRTC bridge"""
    try:
        response = requests.post(
            f'{BRIDGE_API_URL}/genesys-call-notify',
            json={
                'dn': dn,
                'call_id': call_id,
                'call_uuid': call_uuid,
                'event': event
            },
            verify=False,
            timeout=2
        )
        
        if response.status_code == 200:
            log(f"✅ Bridge notified: DN={dn}, CallUUID={call_uuid}", GREEN)
        else:
            log(f"❌ Bridge returned HTTP {response.status_code}", RED)
            
    except requests.exceptions.ConnectionError:
        log("❌ Bridge not running on port 8000", RED)
    except Exception as e:
        log(f"❌ Error notifying bridge: {e}", RED)


def main():
    log("SIP NOTIFY Parser started", BLUE)
    log("Listening for NOTIFY messages on stdin (from tcpdump)...", BLUE)
    log("", RESET)
    
    buffer = []
    in_notify = False
    
    try:
        for line in sys.stdin:
            line = line.strip()
            
            # Detect start of NOTIFY message
            if 'NOTIFY ' in line and 'SIP/2.0' in line:
                in_notify = True
                buffer = [line]
                log(f"📩 NOTIFY detected", YELLOW)
                continue
            
            # Collect message lines
            if in_notify:
                buffer.append(line)
                
                # End of SIP headers (empty line) or content
                if line == '' or len(buffer) > 30:
                    in_notify = False
                    
                    # Parse the complete message
                    sip_message = '\n'.join(buffer)
                    dn, call_id, call_uuid, event = extract_call_info(sip_message)
                    
                    if dn and call_uuid:
                        log(f"  DN: {dn}", YELLOW)
                        log(f"  Call-ID: {call_id}", YELLOW)
                        log(f"  CallUUID: {call_uuid}", GREEN)
                        log(f"  Event: {event}", YELLOW)
                        
                        # Notify bridge
                        notify_bridge(dn, call_id, call_uuid, event)
                    else:
                        log("  ⚠️  Missing DN or CallUUID", YELLOW)
                    
                    log("", RESET)
                    buffer = []
                    
    except KeyboardInterrupt:
        log("\nShutting down...", YELLOW)
    except Exception as e:
        log(f"Error: {e}", RED)
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
