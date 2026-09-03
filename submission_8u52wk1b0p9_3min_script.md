# VITALSGRID 3-Minute Submission Video & Live Demo Guide

**Presenters:** Satyapriya Sinha (0:00 - 1:00) & Abhiraj Raushan (1:00 - 3:00)

---

## PART 1: 0:00 - 1:00 | Satyapriya Sinha: Conceptual Deck & Architecture Pitch

**Screen:** Share PowerPoint (`submission_8u52wk1b0p9.pptx` or `.pdf`)

### 0:00 - 0:18 | Title & Problem Statement (Slides 1–3)
> "Hello everyone. I am Satyapriya Sinha, and together with my teammate Abhiraj Raushan, we are presenting **VITALSGRID**: Air-Gapped Edge AI Wearables for Occupational Health in Critical Infrastructure. Our mission is to protect industrial personnel in extreme environments—where cloud internet protocols are strictly forbidden."

### 0:18 - 0:38 | Wearable Sensor Fusion & Risk Vectors (Slides 4–7)
> "In thermal power plants, underground mines, and substations, workers face lethal hazards like heatstroke, toxic gas, and sudden cardiac stress. Standard smartwatches fail here—they rely on cloud APIs and fragile optical PPG sensors. VITALSGRID fuses continuous ECG, HRV, skin temperature, micro-environmental humidity, gas exposure, and 6-axis IMU movement directly at the edge."

### 0:38 - 0:52 | Zero-Trust Air-Gapped Security (Slides 8–12)
> "Our architecture is 100% air-gapped by design. Real-time inference runs locally on the Nordic nRF5340 dual-core MCU using TensorFlow Lite for Microcontrollers. Zero raw vitals leak outside. If an anomaly is detected, the device triggers local haptics and broadcasts an offline BLE/LoRa distress packet to the local SCADA hub."

### 0:52 - 1:00 | Speaker Handoff to Live Prototype
> "This is our original VITALSGRID vision and safety architecture. My teammate Abhiraj Raushan will now share his browser and demonstrate our live working prototype."

---

## PART 2: 1:00 - 3:00 | Abhiraj Raushan: Live Browser Walkthrough (`http://localhost:8080`)

**Screen:** Share Browser displaying `http://localhost:8080`

### 1:00 - 1:20 | SCADA Dashboard & Worker Telemetry Roster
- **Action on Screen:** Stay on `📊 Dashboard Overview` tab. Point cursor to Worker Roster & Facility Map.
> "Thank you, Satyapriya! I am now opening our live SCADA Control Hub running locally at `localhost:8080`. The supervisor gets a real-time facility map, worker risk roster, and physiological anomaly trends—completely offline without any external WAN connection."

### 1:20 - 1:45 | Wokwi Hardware Studio & Oscilloscope Bio-Signals
- **Action on Screen:** Click tab `⚡ Wokwi Hardware Studio`. Show nRF5340 MCU schematic & live ECG/IMU wave.
> "Navigating to our Hardware Studio, we simulate the physical wearable node. Here is the nRF5340 dual-core PCB schematic, connecting the TI ECG Analog Front End, ST IMU, and local transducers. The dual bio-signal oscilloscopes display raw ECG voltage waveforms and accelerometer kinematics in real time."

### 1:45 - 2:05 | Firmware IDE, TinyML Inference & Wokwi Sensor Trace
- **Action on Screen:** Scroll down slightly in Hardware Studio to reveal Firmware IDE & Wokwi Console log.
> "Below, our Firmware IDE displays the Zephyr RTOS execution environment and INT8 quantized TinyML model inference. The live Wokwi sensor trace confirms real-time model loading, local matrix multiplication, sub-50ms inference latency, and distress beacon readiness."

### 2:05 - 2:35 | Emergency Scenario Trigger & Local Distress Alarm (Heatstroke Test)
- **Action on Screen:** Under Simulation Scenarios, click **`🔥 Heatstroke`**. Watch status flip to **CRITICAL** (73%+ Risk Score), red flashing indicator, 880Hz audio alarm, and LoRa packet broadcast.
> "Now let's test a live emergency. I click the **Heatstroke** scenario. Immediately, elevated core temperature, dropping HRV, and high heat index are detected. The local TinyML engine instantly escalates the risk status to **CRITICAL with a 73% anomaly score**."
> "Notice the wearable unit: the local haptic motor fires, the 880Hz audio buzzer sounds, and the UART console logs an offline LoRa distress transmission for WORKER_001."

### 2:35 - 3:00 | Emergency SOS Dispatch & DGMS Statutory Compliance Audit
- **Action on Screen:** Click back to `📊 Dashboard Overview` -> Click **`📜 DGMS Audit Form IV`** / **`🚨 Emergency SOS`**.
> "Back on the supervisor dashboard, clicking **Emergency SOS** triggers the automated ambulance hotline and plant siren dispatch. The supervisor can instantly generate the **DGMS Audit Form IV** for regulatory safety compliance."
> "VITALSGRID detects locally, alerts immediately, and safeguards every worker in critical infrastructure. Thank you!"

---

## Recording Summary Checklist

| Time Range | Presenter | Mode | Primary Focus / Action |
| :--- | :--- | :--- | :--- |
| **0:00 - 1:00** | Satyapriya Sinha | Presentation Slides | Original idea, OT security barrier, Edge AI & sensor fusion architecture. |
| **1:00 - 1:20** | Abhiraj Raushan | Browser `localhost:8080` | SCADA Dashboard Overview, worker roster, risk trends. |
| **1:20 - 1:45** | Abhiraj Raushan | Browser `localhost:8080` | `⚡ Wokwi Hardware Studio` tab, nRF5340 PCB schematic, ECG & IMU oscilloscopes. |
| **1:45 - 2:05** | Abhiraj Raushan | Browser `localhost:8080` | Firmware IDE, TinyML INT8 model trace, Wokwi console log. |
| **2:05 - 2:35** | Abhiraj Raushan | Browser `localhost:8080` | Click **`🔥 Heatstroke`** button, show CRITICAL alert, 73% risk score, 880Hz siren & LoRa packet. |
| **2:35 - 3:00** | Abhiraj Raushan | Browser `localhost:8080` | Click **`🚨 Emergency SOS`** & **`📜 DGMS Audit Form IV`**, conclude pitch. |
