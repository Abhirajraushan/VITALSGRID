# VITALSGRID: Air-Gapped Edge AI SCADA Control Hub & Industrial Wearable Surveillance Architecture

> **Compliance:** DGMS (Directorate General of Mines Safety) & Factories Act 1948 Compliant  
> **Target Environment:** Critical Industrial Infrastructure (Thermal Power Plants, Underground Mines, High-Voltage Substations)  
> **Security Standard:** IEC 62443 Industrial Cybersecurity (Air-Gapped Intranet Architecture, Zero Cloud WAN Telemetry Leakage)

---

## 1. Executive Summary

VITALSGRID is an air-gapped, cloud-independent industrial safety platform designed for extreme operational environments where cloud internet connectivity is strictly forbidden due to cyber-physical security protocols. 

The architecture pairs an embedded wearable sensor node (Nordic Semiconductor nRF5340 dual-core System-on-Chip) with an on-device TinyML inference engine. Continuous multi-modal sensor fusion processes electrocardiogram (ECG) bio-potentials, Heart Rate Variability (HRV), skin temperature, micro-environmental VOC gas exposure, and 6-axis kinematic inertial motion data directly on the micro-controller. 

In the event of physical distress, heatstroke onset, or toxic atmospheric surges, the system executes sub-50ms local anomaly detection, fires 880Hz local haptic audio alarms, and broadcasts long-range offline distress beacons (BLE 5.2 / LoRa mesh) to the plant-level SCADA intranet command hub.

---

## 2. System Architecture & Telemetry Loop

```
+-----------------------------------------------------------------------------------+
|                            TI-AFE4900 / ST LSM6DSOX                               |
|                  Continuous Bio-Potential & IMU Kinematics                        |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                        Nordic nRF5340 Dual-Core SoC                               |
|   App Core (128MHz ARM Cortex-M33): Quantized TFLite Micro (34KB Arena)           |
|   Net Core: BLE 5.2 / LoRa Physical Layer Encrypted Payload                       |
+-----------------------------------------------------------------------------------+
                                         |
                                         v  (Offline Intranet Mesh Payload)
+-----------------------------------------------------------------------------------+
|                       Air-Gapped SCADA Control Hub                                |
|   Node.js Intranet Server + Real-time WebSockets Gateway                          |
|   Supervisor Dashboard, Facility Risk Map, Roster Priority Queue                  |
+-----------------------------------------------------------------------------------+
                                         |
                                         v  (Statutory Escalation Workflow)
+-----------------------------------------------------------------------------------+
|                       DGMS Statutory Audit Form IV                                |
|   Automated Incident Logging, Rapid Response Dispatch & Siren Relay               |
+-----------------------------------------------------------------------------------+
```

---

## 3. Key Technological Innovations

- **Deterministic Edge Inference:** Runs a quantized 8-bit integer (INT8) TensorFlow Lite for Microcontrollers model within a 34KB tensor arena, achieving an average inference latency of less than 50 milliseconds.
- **Air-Gapped Telemetry Integrity:** Operates 100% offline over local industrial intranet gateways. Zero raw physiological payload is transmitted outside the physical perimeter.
- **Dynamic SCADA Risk Quantification:** Computes enterprise financial risk mitigation in real time using automated risk weighting formulas based on critical and warning hazard levels across active plant zones.
- **DGMS Statutory Incident Automation:** Generates Mines Act 1952 compliant Form IV accident investigation documentation for statutory safety audit compliance.

---

## 4. Repository Structure

```
VITALSGRID/
├── firmware/
│   └── nrf5340_vitalsgrid.cpp     # Zephyr RTOS C++ Firmware & TFLite Arena
├── src/
│   ├── App.jsx                     # SCADA Control Hub Main Component
│   ├── HardwareStudio.jsx          # Wokwi Hardware-in-the-Loop Testbench
│   ├── SecurityPanel.jsx           # Air-Gapped OT Security & Encryption Panel
│   ├── IncidentReport.jsx          # DGMS Audit Form IV Generator
│   ├── Login.jsx                   # Operator Authentication Gateway
│   └── riskEngine.js               # Industrial Risk Calculation Engine
├── server.js                       # SCADA Intranet Gateway & WebSocket Server
├── start-server.js                 # Server Production Entry Point
├── hardware_sim.py                 # Python Telemetry Simulator
├── risk_policy.json                # Shared Industrial Safety Policy Thresholds
├── Dockerfile                      # Industrial Container Specification
├── docker-compose.yml              # Multi-Container Deployment Manifest
└── README.md                       # Project Documentation
```

---

## 5. Local Installation & Deployment Guide

### Prerequisites

- Node.js (v18.0.0 or higher)
- Python (v3.9 or higher)
- Git

### Quick Start (Production Execution)

1. Clone the repository:
   ```bash
   git clone https://github.com/Abhirajraushan/VITALSGRID.git
   cd VITALSGRID
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Launch the SCADA Control Hub:
   ```bash
   node start-server.js
   ```

4. Access the SCADA Dashboard in your browser:
   `http://localhost:8080`

---

## 6. System Verification Endpoints

The SCADA backend hub provides system diagnostics via local HTTP endpoints:

- **Health Status:** `GET http://localhost:8080/health`
- **System Telemetry:** `GET http://localhost:8080/status`
- **Active Alerts List:** `GET http://localhost:8080/api/alerts`
- **Safety Policy Specs:** `GET http://localhost:8080/api/risk-policy`

---

## 7. Authors & Engineering Credits

- **Abhiraj Raushan** — Lead Systems Architect & Software Engineer
- **Satyapriya Sinha** — Co-Lead & Firmware Systems Engineer

---

*VITALSGRID Industrial SCADA Control Hub • Air-Gapped Edge AI Platform*
