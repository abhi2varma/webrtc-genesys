#!/usr/bin/env python3
"""
Genesys SIP Server Log Parser
Extracts and analyzes REGISTER messages and endpoint registrations
"""

import re
import sys
from datetime import datetime
from collections import defaultdict
from pathlib import Path
import glob

class SIPLogParser:
    def __init__(self, log_file):
        self.log_file = log_file
        self.registrations = {}  # DN -> registration info
        self.events = []  # Timeline of events
        self.failed_registrations = []
        
    def parse(self):
        """Parse the SIP log file"""
        print(f"\n[*] Parsing: {self.log_file}")
        print(f"File size: {Path(self.log_file).stat().st_size / (1024*1024):.2f} MB")
        
        with open(self.log_file, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        print(f"Total lines: {len(lines):,}\n")
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Look for REGISTER messages (incoming)
            if 'SIPTR: Received' in line and i + 1 < len(lines):
                if 'REGISTER' in lines[i+1]:
                    i = self._parse_register_message(lines, i)
                    continue
            
            # Look for 200 OK responses (successful registration)
            if 'Sending' in line and i + 1 < len(lines):
                if 'SIP/2.0 200 OK' in lines[i+1]:
                    i = self._parse_200_ok_message(lines, i)
                    continue
            
            # Look for failed registrations
            if 'SIP/2.0 401' in line or 'SIP/2.0 403' in line or 'SIP/2.0 4' in line:
                self._parse_failure(lines, i)
            
            i += 1
    
    def _parse_register_message(self, lines, start_idx):
        """Parse a REGISTER request"""
        timestamp_match = re.search(r'(\d{2}:\d{2}:\d{2}\.\d{3})', lines[start_idx])
        timestamp = timestamp_match.group(1) if timestamp_match else "Unknown"
        
        # Extract source IP
        source_match = re.search(r'from ([\d\.]+):(\d+)', lines[start_idx])
        source_ip = source_match.group(1) if source_match else "Unknown"
        source_port = source_match.group(2) if source_match else "Unknown"
        
        # Parse SIP headers
        dn = None
        contact = None
        expires = None
        call_id = None
        cseq = None
        
        idx = start_idx + 2
        while idx < len(lines) and idx < start_idx + 20:
            line = lines[idx].strip()
            
            if not line or line.startswith('22:') or line.startswith('23:'):
                break
            
            # Extract DN from From or To header
            if line.startswith('From:') or line.startswith('To:'):
                dn_match = re.search(r'sip:(\w+)@', line)
                if dn_match and not dn:
                    dn = dn_match.group(1)
            
            # Extract Contact
            if line.startswith('Contact:'):
                contact_match = re.search(r'<sip:(.+?)>', line)
                if contact_match:
                    contact = contact_match.group(1)
            
            # Extract Expires
            if line.startswith('Expires:'):
                expires_match = re.search(r'Expires:\s*(\d+)', line)
                if expires_match:
                    expires = int(expires_match.group(1))
            
            # Extract Call-ID
            if line.startswith('Call-ID:'):
                call_id = line.split(':', 1)[1].strip()
            
            # Extract CSeq
            if line.startswith('CSeq:'):
                cseq_match = re.search(r'(\d+)\s+REGISTER', line)
                if cseq_match:
                    cseq = int(cseq_match.group(1))
            
            idx += 1
        
        if dn:
            event = {
                'timestamp': timestamp,
                'type': 'REGISTER_REQUEST',
                'dn': dn,
                'source_ip': source_ip,
                'source_port': source_port,
                'contact': contact,
                'expires': expires,
                'call_id': call_id,
                'cseq': cseq
            }
            self.events.append(event)
        
        return idx
    
    def _parse_200_ok_message(self, lines, start_idx):
        """Parse a 200 OK response"""
        timestamp_match = re.search(r'(\d{2}:\d{2}:\d{2}\.\d{3})', lines[start_idx])
        timestamp = timestamp_match.group(1) if timestamp_match else "Unknown"
        
        # Extract destination IP
        dest_match = re.search(r'to ([\d\.]+):(\d+)', lines[start_idx])
        dest_ip = dest_match.group(1) if dest_match else "Unknown"
        dest_port = dest_match.group(2) if dest_match else "Unknown"
        
        # Parse SIP headers
        dn = None
        contact = None
        expires = None
        call_id = None
        cseq = None
        
        idx = start_idx + 2
        while idx < len(lines) and idx < start_idx + 20:
            line = lines[idx].strip()
            
            if not line or line.startswith('22:') or line.startswith('23:'):
                break
            
            # Extract DN from From or To header
            if line.startswith('From:') or line.startswith('To:'):
                dn_match = re.search(r'sip:(\w+)@', line)
                if dn_match and not dn:
                    dn = dn_match.group(1)
            
            # Extract Contact with expires
            if line.startswith('Contact:'):
                contact_match = re.search(r'<sip:(.+?)>', line)
                if contact_match:
                    contact = contact_match.group(1)
                expires_match = re.search(r'expires=(\d+)', line)
                if expires_match:
                    expires = int(expires_match.group(1))
            
            # Extract Expires header
            if line.startswith('Expires:') and not expires:
                expires_match = re.search(r'Expires:\s*(\d+)', line)
                if expires_match:
                    expires = int(expires_match.group(1))
            
            # Extract Call-ID
            if line.startswith('Call-ID:'):
                call_id = line.split(':', 1)[1].strip()
            
            # Extract CSeq
            if line.startswith('CSeq:'):
                cseq_match = re.search(r'(\d+)\s+REGISTER', line)
                if cseq_match:
                    cseq = int(cseq_match.group(1))
            
            idx += 1
        
        if dn:
            # Update registrations table
            if expires and expires > 0:
                self.registrations[dn] = {
                    'status': 'Registered',
                    'contact': contact,
                    'expires': expires,
                    'last_updated': timestamp,
                    'dest_ip': dest_ip,
                    'dest_port': dest_port,
                    'call_id': call_id
                }
            else:
                # Unregistration (expires=0)
                if dn in self.registrations:
                    del self.registrations[dn]
            
            event = {
                'timestamp': timestamp,
                'type': '200_OK' if expires and expires > 0 else 'UNREGISTER_OK',
                'dn': dn,
                'contact': contact,
                'expires': expires,
                'dest_ip': dest_ip,
                'dest_port': dest_port,
                'call_id': call_id,
                'cseq': cseq
            }
            self.events.append(event)
        
        return idx
    
    def _parse_failure(self, lines, idx):
        """Parse failed registration attempts"""
        line = lines[idx]
        timestamp_match = re.search(r'(\d{2}:\d{2}:\d{2}\.\d{3})', line)
        timestamp = timestamp_match.group(1) if timestamp_match else "Unknown"
        
        # Get status code
        status_match = re.search(r'SIP/2.0 (\d+) (.+)', line)
        if status_match:
            status_code = status_match.group(1)
            status_text = status_match.group(2).strip()
            
            self.failed_registrations.append({
                'timestamp': timestamp,
                'status_code': status_code,
                'status_text': status_text,
                'line': line.strip()
            })
    
    def print_summary(self):
        """Print summary report"""
        print("\n" + "="*80)
        print("[*] GENESYS SIP SERVER - REGISTRATION SUMMARY")
        print("="*80)
        
        print(f"\n[+] Currently Registered Endpoints: {len(self.registrations)}")
        print("-" * 80)
        
        if self.registrations:
            print(f"{'DN':<15} {'Status':<12} {'Contact':<30} {'Expires':<10} {'Last Updated'}")
            print("-" * 80)
            
            for dn in sorted(self.registrations.keys()):
                info = self.registrations[dn]
                print(f"{dn:<15} {info['status']:<12} {info['contact']:<30} {info['expires']:<10} {info['last_updated']}")
        else:
            print("No registered endpoints found.")
        
        print(f"\n[*] Total Registration Events: {len([e for e in self.events if e['type'] == 'REGISTER_REQUEST'])}")
        print(f"[+] Successful Registrations: {len([e for e in self.events if e['type'] == '200_OK'])}")
        print(f"[~] Unregistrations: {len([e for e in self.events if e['type'] == 'UNREGISTER_OK'])}")
        print(f"[-] Failed Attempts: {len(self.failed_registrations)}")
        
        # Show unique DNs that registered
        registered_dns = set(e['dn'] for e in self.events if e['type'] in ['REGISTER_REQUEST', '200_OK'])
        print(f"\n[*] Unique DNs Seen: {len(registered_dns)}")
        if registered_dns:
            print(f"DNs: {', '.join(sorted(registered_dns))}")
        
        # Show source IPs
        source_ips = set(e.get('source_ip') for e in self.events if e.get('source_ip') and e.get('source_ip') != 'Unknown')
        if source_ips:
            print(f"\n[*] Source IPs: {', '.join(sorted(source_ips))}")
    
    def print_timeline(self, limit=20):
        """Print recent registration events"""
        print(f"\n[*] Recent Registration Events (last {limit}):")
        print("-" * 120)
        print(f"{'Time':<15} {'Event':<20} {'DN':<10} {'Contact':<30} {'Expires':<10}")
        print("-" * 120)
        
        for event in self.events[-limit:]:
            event_type = event['type'].replace('_', ' ')
            dn = event.get('dn', 'N/A')
            contact = event.get('contact', 'N/A')
            expires = event.get('expires', 'N/A')
            
            print(f"{event['timestamp']:<15} {event_type:<20} {dn:<10} {contact:<30} {str(expires):<10}")
    
    def print_failed_registrations(self, limit=10):
        """Print failed registration attempts"""
        if not self.failed_registrations:
            return
        
        print(f"\n[-] Failed Registration Attempts (last {limit}):")
        print("-" * 120)
        
        for failure in self.failed_registrations[-limit:]:
            print(f"{failure['timestamp']} - {failure['status_code']} {failure['status_text']}")
    
    def export_json(self, output_file='sip-registrations.json'):
        """Export registrations to JSON"""
        import json
        
        data = {
            'timestamp': datetime.now().isoformat(),
            'log_file': str(self.log_file),
            'registered_endpoints': self.registrations,
            'events': self.events,
            'summary': {
                'total_registered': len(self.registrations),
                'total_events': len(self.events),
                'failed_registrations': len(self.failed_registrations)
            }
        }
        
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"\n[+] Exported to: {output_file}")

def find_latest_log(pattern='SIP_P-001.*.log'):
    """Find the latest SIP log file"""
    log_files = glob.glob(pattern)
    if not log_files:
        return None
    
    # Sort by modification time, most recent first
    log_files.sort(key=lambda x: Path(x).stat().st_mtime, reverse=True)
    return log_files[0]

def main():
    # Find latest log file
    if len(sys.argv) > 1:
        log_file = sys.argv[1]
    else:
        log_file = find_latest_log('SIP_P-001.*.log')
    
    if not log_file or not Path(log_file).exists():
        print("[-] Error: No SIP log file found!")
        print("Usage: python sip-log-parser.py [log_file]")
        print("Or place SIP_P-001.*.log in current directory")
        sys.exit(1)
    
    # Parse the log
    parser = SIPLogParser(log_file)
    parser.parse()
    
    # Print reports
    parser.print_summary()
    parser.print_timeline(limit=20)
    parser.print_failed_registrations(limit=10)
    
    # Export to JSON
    parser.export_json()
    
    print("\n[+] Parsing complete!")

if __name__ == '__main__':
    main()
