#!/usr/bin/env python3
"""
Real-time SIP Registration Dashboard
Web-based monitoring for Genesys SIP Server
"""

from flask import Flask, jsonify, render_template_string
from flask_cors import CORS
import re
import glob
from datetime import datetime
from pathlib import Path
import threading
import time

app = Flask(__name__)
CORS(app)

# Global state
current_registrations = {}
events_history = []
stats = {
    'total_requests': 0,
    'successful_registrations': 0,
    'unregistrations': 0,
    'failed_attempts': 0,
    'unique_dns': set()
}
last_parsed_line = 0
current_log_file = None

def find_latest_log(pattern='SIP_P-001.*.log'):
    """Find the latest SIP log file"""
    log_files = glob.glob(pattern)
    if not log_files:
        return None
    log_files.sort(key=lambda x: Path(x).stat().st_mtime, reverse=True)
    return log_files[0]

def parse_register_block(lines, start_idx):
    """Parse a REGISTER request and response"""
    timestamp_match = re.search(r'(\d{2}:\d{2}:\d{2}\.\d{3})', lines[start_idx])
    timestamp = timestamp_match.group(1) if timestamp_match else "Unknown"
    
    # Parse direction
    if 'Received' in lines[start_idx]:
        direction = 'Incoming'
        ip_match = re.search(r'from ([\d\.]+):(\d+)', lines[start_idx])
    else:
        direction = 'Outgoing'
        ip_match = re.search(r'to ([\d\.]+):(\d+)', lines[start_idx])
    
    source_ip = ip_match.group(1) if ip_match else "Unknown"
    
    # Extract SIP headers
    dn = None
    contact = None
    expires = None
    status = None
    
    for i in range(start_idx, min(start_idx + 25, len(lines))):
        line = lines[i].strip()
        
        if not line or (line.startswith('22:') or line.startswith('23:') or line.startswith('00:')):
            if i > start_idx + 5:
                break
        
        # Check for response status
        if 'SIP/2.0 200 OK' in line:
            status = '200 OK'
        elif 'SIP/2.0' in line and status is None:
            status_match = re.search(r'SIP/2.0 (\d+) (.+)', line)
            if status_match:
                status = f"{status_match.group(1)} {status_match.group(2).strip()}"
        
        # Extract DN
        if (line.startswith('From:') or line.startswith('To:')) and not dn:
            dn_match = re.search(r'sip:(\w+)@', line)
            if dn_match:
                dn = dn_match.group(1)
        
        # Extract Contact
        if line.startswith('Contact:'):
            contact_match = re.search(r'<sip:(.+?)>', line)
            if contact_match:
                contact = contact_match.group(1)
            expires_match = re.search(r'expires=(\d+)', line)
            if expires_match:
                expires = int(expires_match.group(1))
        
        # Extract Expires header
        if line.startswith('Expires:'):
            expires_match = re.search(r'Expires:\s*(\d+)', line)
            if expires_match and expires is None:
                expires = int(expires_match.group(1))
    
    return {
        'timestamp': timestamp,
        'dn': dn,
        'contact': contact,
        'expires': expires,
        'source_ip': source_ip,
        'direction': direction,
        'status': status
    }

def monitor_log_file():
    """Monitor log file for changes"""
    global current_registrations, events_history, stats, last_parsed_line, current_log_file
    
    while True:
        try:
            # Find latest log file
            log_file = find_latest_log()
            
            if not log_file or not Path(log_file).exists():
                time.sleep(5)
                continue
            
            # If log file changed, reset parsing
            if log_file != current_log_file:
                print(f"[*] Monitoring new log file: {log_file}")
                current_log_file = log_file
                last_parsed_line = 0
            
            # Read file
            with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            # Parse new lines
            i = last_parsed_line
            while i < len(lines):
                line = lines[i]
                
                # Look for REGISTER messages
                if ('SIPTR: Received' in line or 'Sending' in line) and i + 1 < len(lines):
                    if 'REGISTER' in lines[i+1] or 'SIP/2.0 200 OK' in lines[i+1]:
                        result = parse_register_block(lines, i)
                        
                        if result['dn']:
                            # Update stats
                            stats['unique_dns'].add(result['dn'])
                            
                            if 'REGISTER' in lines[i+1]:
                                stats['total_requests'] += 1
                            
                            if result['status'] == '200 OK':
                                if result['expires'] and result['expires'] > 0:
                                    stats['successful_registrations'] += 1
                                    # Update current registrations
                                    current_registrations[result['dn']] = {
                                        'contact': result['contact'],
                                        'expires': result['expires'],
                                        'last_updated': result['timestamp'],
                                        'source_ip': result['source_ip'],
                                        'status': 'Registered'
                                    }
                                else:
                                    stats['unregistrations'] += 1
                                    # Remove from registrations
                                    if result['dn'] in current_registrations:
                                        del current_registrations[result['dn']]
                            
                            elif result['status'] and '200' not in result['status']:
                                stats['failed_attempts'] += 1
                            
                            # Add to events history (keep last 100)
                            events_history.append(result)
                            if len(events_history) > 100:
                                events_history.pop(0)
                
                i += 1
            
            last_parsed_line = len(lines)
            
        except Exception as e:
            print(f"[!] Error monitoring log: {e}")
        
        time.sleep(2)  # Check every 2 seconds

# Start monitoring thread
monitor_thread = threading.Thread(target=monitor_log_file, daemon=True)
monitor_thread.start()

# API Endpoints
@app.route('/')
def index():
    """Serve the dashboard HTML"""
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/registrations')
def get_registrations():
    """Get current registrations"""
    return jsonify({
        'registrations': current_registrations,
        'count': len(current_registrations),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/events')
def get_events():
    """Get recent events"""
    return jsonify({
        'events': events_history[-50:],  # Last 50 events
        'count': len(events_history),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/stats')
def get_stats():
    """Get statistics"""
    return jsonify({
        'total_requests': stats['total_requests'],
        'successful_registrations': stats['successful_registrations'],
        'unregistrations': stats['unregistrations'],
        'failed_attempts': stats['failed_attempts'],
        'unique_dns': len(stats['unique_dns']),
        'currently_registered': len(current_registrations),
        'timestamp': datetime.now().isoformat()
    })

# HTML Template
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SIP Registration Dashboard - Real-time Monitor</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }
        
        header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .live-indicator {
            display: inline-block;
            background: #4CAF50;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            text-align: center;
            transition: transform 0.3s;
        }
        
        .stat-card:hover {
            transform: translateY(-5px);
        }
        
        .stat-value {
            font-size: 3em;
            font-weight: bold;
            color: #667eea;
            margin: 10px 0;
        }
        
        .stat-label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .main-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        
        .panel {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        
        .panel h2 {
            color: #667eea;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #667eea;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        th {
            background: #f5f5f5;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #333;
            border-bottom: 2px solid #667eea;
        }
        
        td {
            padding: 12px;
            border-bottom: 1px solid #eee;
        }
        
        tr:hover {
            background: #f9f9f9;
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: 600;
        }
        
        .status-registered {
            background: #4CAF50;
            color: white;
        }
        
        .status-unregistered {
            background: #f44336;
            color: white;
        }
        
        .status-ok {
            background: #4CAF50;
            color: white;
        }
        
        .status-error {
            background: #f44336;
            color: white;
        }
        
        .events-list {
            max-height: 500px;
            overflow-y: auto;
        }
        
        .event-item {
            padding: 15px;
            border-left: 4px solid #667eea;
            margin-bottom: 10px;
            background: #f9f9f9;
            border-radius: 4px;
        }
        
        .event-time {
            font-weight: 600;
            color: #667eea;
            margin-bottom: 5px;
        }
        
        .event-details {
            color: #666;
            font-size: 0.9em;
        }
        
        .no-data {
            text-align: center;
            padding: 40px;
            color: #999;
            font-style: italic;
        }
        
        @media (max-width: 768px) {
            .main-content {
                grid-template-columns: 1fr;
            }
            
            .stats-grid {
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🌐 SIP Registration Dashboard</h1>
            <p>Genesys SIP Server - Real-time Monitor</p>
            <span class="live-indicator">● LIVE</span>
        </header>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Currently Registered</div>
                <div class="stat-value" id="stat-registered">0</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Requests</div>
                <div class="stat-value" id="stat-requests">0</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Successful</div>
                <div class="stat-value" id="stat-success">0</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Failed</div>
                <div class="stat-value" id="stat-failed">0</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Unique DNs</div>
                <div class="stat-value" id="stat-unique">0</div>
            </div>
        </div>
        
        <div class="main-content">
            <div class="panel">
                <h2>📞 Registered Endpoints</h2>
                <table id="registrations-table">
                    <thead>
                        <tr>
                            <th>DN</th>
                            <th>Contact</th>
                            <th>Expires</th>
                            <th>Last Updated</th>
                        </tr>
                    </thead>
                    <tbody id="registrations-body">
                        <tr><td colspan="4" class="no-data">Loading...</td></tr>
                    </tbody>
                </table>
            </div>
            
            <div class="panel">
                <h2>📋 Recent Events</h2>
                <div class="events-list" id="events-list">
                    <div class="no-data">Loading...</div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // Fetch and update data
        async function updateDashboard() {
            try {
                // Fetch stats
                const statsRes = await fetch('/api/stats');
                const stats = await statsRes.json();
                
                document.getElementById('stat-registered').textContent = stats.currently_registered;
                document.getElementById('stat-requests').textContent = stats.total_requests;
                document.getElementById('stat-success').textContent = stats.successful_registrations;
                document.getElementById('stat-failed').textContent = stats.failed_attempts;
                document.getElementById('stat-unique').textContent = stats.unique_dns;
                
                // Fetch registrations
                const regRes = await fetch('/api/registrations');
                const regData = await regRes.json();
                
                const tbody = document.getElementById('registrations-body');
                if (Object.keys(regData.registrations).length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="no-data">No registered endpoints</td></tr>';
                } else {
                    tbody.innerHTML = '';
                    Object.entries(regData.registrations).forEach(([dn, info]) => {
                        const row = tbody.insertRow();
                        row.innerHTML = `
                            <td><strong>${dn}</strong></td>
                            <td>${info.contact || 'N/A'}</td>
                            <td>${info.expires || 'N/A'}s</td>
                            <td>${info.last_updated || 'N/A'}</td>
                        `;
                    });
                }
                
                // Fetch events
                const eventsRes = await fetch('/api/events');
                const eventsData = await eventsRes.json();
                
                const eventsList = document.getElementById('events-list');
                if (eventsData.events.length === 0) {
                    eventsList.innerHTML = '<div class="no-data">No events yet</div>';
                } else {
                    eventsList.innerHTML = '';
                    eventsData.events.reverse().forEach(event => {
                        const eventDiv = document.createElement('div');
                        eventDiv.className = 'event-item';
                        
                        let statusBadge = '';
                        if (event.status) {
                            const statusClass = event.status === '200 OK' ? 'status-ok' : 'status-error';
                            statusBadge = `<span class="status-badge ${statusClass}">${event.status}</span>`;
                        }
                        
                        eventDiv.innerHTML = `
                            <div class="event-time">${event.timestamp} - DN: ${event.dn}</div>
                            <div class="event-details">
                                ${statusBadge}
                                Contact: ${event.contact || 'N/A'} | 
                                Expires: ${event.expires !== null ? event.expires + 's' : 'N/A'} | 
                                From: ${event.source_ip}
                            </div>
                        `;
                        eventsList.appendChild(eventDiv);
                    });
                }
                
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        }
        
        // Update every 2 seconds
        updateDashboard();
        setInterval(updateDashboard, 2000);
    </script>
</body>
</html>
'''

if __name__ == '__main__':
    print("\n" + "="*60)
    print("  SIP REGISTRATION DASHBOARD - Real-time Monitor")
    print("="*60)
    print("\n[*] Starting web server...")
    print("[*] Dashboard URL: http://localhost:5000")
    print("[*] Monitoring SIP log files...")
    print("\n[!] Press Ctrl+C to stop\n")
    
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
