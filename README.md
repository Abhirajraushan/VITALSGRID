# VitalsGrid - Industrial Worker Monitoring System

A complete offline industrial monitoring system for detecting worker collapse using advanced sensor fusion and anomaly detection. Designed for low-light environments without internet connectivity.

## Quick Start

### Step 1: Install Dependencies
```bash
pip install websockets
npm install
```

### Step 2: Run the app

For a one-click Windows launch, double-click `run-vitalsgrid.bat`. It opens the browser-ready production dashboard on `http://localhost:8080` and uses Docker Compose when Docker Desktop is installed. Running it again is safe: the launcher reuses an already healthy hub instead of creating a second listener.

To run manually:

```powershell
npm start
```

### Step 3: Run the hardware simulator

In a second terminal, use the Windows launcher `run-vitalsgrid-simulator.bat`, or run this PowerShell command:

```powershell
py -3.11 .\hardware_sim.py
```

Do not quote the interpreter path by itself in PowerShell. If you need the full path, use the call operator:

```powershell
& "C:\Users\Abhiraj Raushan\AppData\Local\Microsoft\WindowsApps\python3.11.exe" .\hardware_sim.py
```

### Manual development mode

**Terminal 1 - Backend Hub:**
```bash
node server.js
```

**Terminal 2 - React Dashboard:**
```bash
npm run dev
```

**Terminal 3 - Hardware Simulator:**
```bash
py -3.11 hardware_sim.py
```

## What You'll See

- **0-30 seconds**: normal raw sensor packets are sent to the hub
- **30+ seconds**: the simulator enters a high-stress scenario and the hub calculates the CRITICAL state
- Dashboard card flashes with glow effect

## Architecture

```
Hardware Simulator (Python)
    ↓
    ├─ Generates: Temperature, HRV, Jerk
    ├─ Calculates: Anomaly Score
    └─ Sends via WebSocket to Backend
    
Backend Hub (Node.js)
    ↓
    ├─ Receives MCU data
    ├─ Caches latest status
    └─ Broadcasts to all React clients
    
React Dashboard (Frontend)
    ↓
    ├─ Real-time worker grid
    ├─ Color-coded alerts
    └─ Auto-reconnect WebSocket
```

## Key Features

✅ **Local sensor fusion**: heat, HRV fatigue, cardiac stress, toxic exposure, motion, and skin temperature are calculated by the hub  
✅ **Shared risk policy**: thresholds are defined in `risk_policy.json`, not embedded in the CSV  
✅ **Offline Operation**: No cloud dependencies  
✅ **Real-time Alerts**: Critical status detection  
✅ **Low-Light UI**: Dark theme optimized for industrial control rooms  
✅ **Auto-reconnect**: WebSocket resilience  
✅ **Scalable**: Multiple workers support  

## Configuration

### Change Risk Policy
Edit `risk_policy.json`:
```json
{
    "warningThreshold": 0.5,
    "criticalThreshold": 0.75,
    "heatIndexCriticalC": 39,
    "gasCriticalPpm": 55,
    "spo2CriticalPct": 92
}
```

### Change WebSocket Port
Edit both files:
- `server.js` line ~150
- `src/App.jsx` line ~41
```javascript
ws://localhost:8080  // Change 8080 to your port
```

## Files

```
C:\Hackculture_project\
├── hardware_sim.py       # Python MCU simulator
├── server.js             # Node.js WebSocket hub
├── risk_policy.json      # Shared safety thresholds
├── run-vitalsgrid.bat    # One-click app launcher
├── run-vitalsgrid-simulator.bat # One-click simulator launcher
├── package.json          # Dependencies
├── src/
│   ├── App.jsx           # React component
│   ├── App.css           # Dashboard styling
│   └── index.js          # Entry point
├── public/
│   └── index.html        # HTML template
└── README.md             # This file
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Connection refused" | Start `node server.js` first |
| "Port already in use" | Change port in server.js and App.jsx |
| Blank React dashboard | Check browser console (F12) |
| No worker data | Ensure Python simulator is running |

## Health Checks

```bash
# Backend status
curl http://localhost:8080/health

# See all workers
curl http://localhost:8080/status
```

---

**VitalsGrid v1.0** • Offline Industrial Monitoring • HackCulture Project
