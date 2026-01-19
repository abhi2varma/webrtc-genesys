# SIP Registration Dashboard - Windows Installation

## 📋 Quick Setup on Server 81 (Windows)

### **Step 1: Install Python** (if not already installed)

Download and install Python from: https://www.python.org/downloads/

**During installation:**
- ✅ Check "Add Python to PATH"
- ✅ Install for all users

### **Step 2: Copy Files to Server 81**

Create folder: `D:\sip-dashboard`

Copy these files:
- `sip-dashboard-windows.py`
- `start-dashboard.bat`

### **Step 3: Run the Dashboard**

Double-click: `start-dashboard.bat`

Or via command prompt:
```cmd
cd D:\sip-dashboard
start-dashboard.bat
```

### **Step 4: Access Dashboard**

Open browser:
- http://localhost:5000
- http://192.168.210.81:5000

---

## 🔧 Configuration

The dashboard automatically monitors: `D:\gcti_logs\SIP_P`

To change the log path, edit `start-dashboard.bat`:
```batch
set LOG_PATH=D:\your\custom\path
```

---

## 🚀 Run as Windows Service (Optional)

### Using NSSM (Non-Sucking Service Manager):

1. Download NSSM: https://nssm.cc/download
2. Extract to `C:\nssm`
3. Run as Administrator:

```cmd
cd C:\nssm\win64
nssm install SIPDashboard "D:\sip-dashboard\venv\Scripts\python.exe" "D:\sip-dashboard\sip-dashboard-windows.py"
nssm set SIPDashboard AppDirectory "D:\sip-dashboard"
nssm set SIPDashboard AppEnvironmentExtra "LOG_PATH=D:\gcti_logs\SIP_P"
nssm set SIPDashboard Start SERVICE_AUTO_START
nssm start SIPDashboard
```

---

## 🔍 Troubleshooting

### Issue: Python not found
**Solution:** Add Python to PATH or reinstall with "Add to PATH" checked

### Issue: Port 5000 in use
**Solution:** Edit `sip-dashboard-windows.py` line at the end:
```python
app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)
```

### Issue: Can't access from other machines
**Solution:** Check Windows Firewall:
```cmd
netsh advfirewall firewall add rule name="SIP Dashboard" dir=in action=allow protocol=TCP localport=5000
```

---

## ✅ Verify It's Working

1. Open http://localhost:5000
2. Check for "● LIVE" indicator (green)
3. Stats should show numbers if logs exist
4. Recent events should populate

---

## 📊 Features

- Real-time monitoring (2-second refresh)
- Beautiful web dashboard
- Auto-detects latest log files
- No network mount needed - reads local D: drive
- Accessible from network
- Lightweight - Python Flask app

---

## 🛑 Stop Dashboard

Press `Ctrl+C` in the command window

Or if running as service:
```cmd
nssm stop SIPDashboard
```

---

## 📝 Files Needed

```
D:\sip-dashboard\
├── sip-dashboard-windows.py    (Main application)
├── start-dashboard.bat         (Launcher script)
└── venv\                       (Created automatically)
```

---

## 🌐 Access URLs

- **Local:** http://localhost:5000
- **Network:** http://192.168.210.81:5000
- **Health:** http://192.168.210.81:5000/api/health
- **Stats:** http://192.168.210.81:5000/api/stats
