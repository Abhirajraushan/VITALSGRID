# ⚡ VitalsGrid Hardware & Tinkercad / Wokwi Simulator Guide

> **Intrinsically Safe Air-Gapped Healthcare Wearable for 50 Hz Power Grids & High-Voltage SCADA Substations**

---

## 🛠️ 1. Real Hardware Component Specifications

| Module | Component | Interface | Purpose |
| :--- | :--- | :--- | :--- |
| **MCU** | **Nordic nRF5340** | Dual ARM Cortex-M33 @ 128MHz | Runs TensorFlow Lite for Microcontrollers (TFLM) Edge AI model locally. |
| **ECG / HRV** | **TI AFE4900** | SPI / I2C | Ultra-low-power continuous bio-potential front end for Cardiac Stress & HRV. |
| **IMU / Jerk** | **ST LSM6DSOX** | I2C (`0x6A`) | 6-axis accelerometer/gyroscope detecting kinematic motion jerk & fall impact. |
| **Environment** | **Sensirion SGP40 + HTS221** | I2C (`0x59`) | VOC toxic gas detection (SF6 leak, H2S) + Ambient Temperature & Humidity. |
| **Mesh Radio** | **Semtech SX1262 LoRa + BLE 5.2** | SPI | Offline 868MHz / 915MHz air-gapped emergency distress beacon broadcast. |
| **Alarm Output** | **ERM Micro Haptic Motor + Piezo** | PWM (`Pin P0.28`) | Immediate sub-second localized tactile & audio alert to prevent collapse. |

---

## 🔌 2. Tinkercad / Wokwi Interactive Circuit Schematic

If testing on **Wokwi** or **Tinkercad Circuits** (using Arduino UNO / ESP32 / nRF52840 MCU equivalent):

```
                       +-----------------------------------+
                       |    Nordic nRF5340 MCU (3.3V)      |
                       +-----------------------------------+
                                   |       |       |
           +-----------------------+       |       +-----------------------+
           | I2C (SDA:P0.11 / SCL:P0.12)   | SPI   | PWM (P0.28)           |
           v                               v       v                       v
 +-------------------+           +--------------+ +------------------+ +---------------+
 | ST LSM6DSOX IMU   |           | TI AFE4900   | | SX1262 LoRa      | | Piezo Alarm   |
 | (Accelerom / Jerk)|           | (ECG / HRV)  | | Transceiver      | | Haptic Motor  |
 +-------------------+           +--------------+ +------------------+ +---------------+
```

---

## 🧪 3. How Judges Can Test Without Physical Hardware

We have built **3 ways** to test and evaluate VitalsGrid without physical hardware:

1. **Embedded Web Interactive Hardware Workbench (Recommended)**:
   - Launch the app (`http://localhost:8080`).
   - Click the **"🛠️ Hardware Studio"** tab.
   - Adjust live sliders for **Heart Rate, HRV, Skin Temp, Gas Leak (PPM), and Motion Jerk**.
   - Watch the **nRF5340 MCU pins blink**, **Tensor Arena memory dynamically allocate**, **TinyML fusion math compute**, and **Web Audio Piezo Warning sound in real-time!**

2. **Python Hardware Simulator (`hardware_sim.py`)**:
   - Run `python hardware_sim.py --interactive` or `python hardware_sim.py --workers 4`.
   - Sends real-time WebSocket telemetry payloads directly to the Node.js server.

3. **Wokwi Online MCU Simulator**:
   - Copy `firmware/nrf5340_vitalsgrid.cpp` into Wokwi (ESP32 / Arduino C++ project) with potentiometer inputs for ECG & Temperature.

---

## 🔒 4. Air-Gapped Zero-Trust Architecture Proof

```
┌──────────────────────────────┐       LoRa / BLE Distress Beacon      ┌──────────────────────────────┐
│ VitalsGrid Wearable Node     │ ────────────────────────────────────► │ Local Proxmox Virtual Hub    │
│  - nRF5340 Dual-Core MCU     │       (Sub-1-Second Latency)         │  - Node.js Ingestion Engine  │
│  - On-Device TinyML Fusion   │                                       │  - Air-Gapped React Console  │
└──────────────────────────────┘                                       └──────────────────────────────┘
               │                                                                      │
               ▼                                                                      ▼
    Zero External Internet                                                 Zero External Cloud Path
     (SCADA OT Compliant)                                                   (Intranet Only)
```
