import React, { useState, useEffect, useRef, useCallback } from "react";
import { calculateEdgeRisk, clamp } from "./riskEngine";

/* ─── Real-Time Animated ECG Oscilloscope Canvas ─── */
function LiveOscilloscope({ heartRate, hrv, noise50Hz, status }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const bufferRef = useRef(new Float32Array(600).fill(0));
  const phaseRef = useRef(0);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const buffer = bufferRef.current;

    const beatInterval = 60000 / Math.max(40, heartRate); // ms per beat
    const stressLevel = clamp((70 - hrv) / 50);



    function generateECGSample(t) {
      const beatPhase = (t % beatInterval) / beatInterval;
      let v = 0;

      // P-wave (0.0 - 0.12)
      if (beatPhase >= 0.0 && beatPhase < 0.12) {
        const p = (beatPhase - 0.06) / 0.06;
        v = 0.12 * Math.exp(-p * p * 8);
      }
      // QRS complex (0.15 - 0.22)
      else if (beatPhase >= 0.15 && beatPhase < 0.17) {
        v = -0.08 * ((beatPhase - 0.15) / 0.02);
      } else if (beatPhase >= 0.17 && beatPhase < 0.19) {
        v = -0.08 + (0.08 + 0.85 + stressLevel * 0.35) * ((beatPhase - 0.17) / 0.02);
      } else if (beatPhase >= 0.19 && beatPhase < 0.21) {
        v = (0.85 + stressLevel * 0.35) * (1 - (beatPhase - 0.19) / 0.02);
      } else if (beatPhase >= 0.21 && beatPhase < 0.23) {
        v = -0.18 * (1 - (beatPhase - 0.21) / 0.02);
      }
      // T-wave (0.30 - 0.45)
      else if (beatPhase >= 0.30 && beatPhase < 0.45) {
        const tw = (beatPhase - 0.375) / 0.075;
        v = 0.22 * Math.exp(-tw * tw * 6);
      }

      // Add realistic noise
      if (!noise50Hz) {
        v += Math.sin(t * 0.314) * 0.04; // 50Hz interference
        v += Math.sin(t * 0.628) * 0.02; // harmonics
      }
      v += (Math.random() - 0.5) * 0.015; // baseline wander

      return v;
    }

    function draw() {

      // Shift buffer left and add new samples
      const samplesPerFrame = 3;
      for (let s = 0; s < samplesPerFrame; s++) {
        for (let i = 0; i < buffer.length - 1; i++) {
          buffer[i] = buffer[i + 1];
        }
        phaseRef.current += 16 / samplesPerFrame;
        buffer[buffer.length - 1] = generateECGSample(phaseRef.current);
      }

      // Clear
      ctx.fillStyle = "#050b0e";
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = "rgba(88, 200, 246, 0.06)";
      ctx.lineWidth = 1;
      for (let y = 0; y < H; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }

      // Center line
      ctx.strokeStyle = "rgba(88, 200, 246, 0.12)";
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();

      // ECG waveform with gradient
      const gradient = ctx.createLinearGradient(0, 0, W, 0);
      gradient.addColorStop(0, "rgba(66, 214, 155, 0.3)");
      gradient.addColorStop(0.4, "#42d69b");
      gradient.addColorStop(0.7, status === "CRITICAL" ? "#ff5d6c" : "#f3b33d");
      gradient.addColorStop(1, status === "CRITICAL" ? "#ff5d6c" : "#58c8f6");

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();

      for (let i = 0; i < buffer.length; i++) {
        const x = (i / buffer.length) * W;
        const y = H / 2 - buffer[i] * H * 0.42;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Glow effect
      ctx.shadowColor = status === "CRITICAL" ? "#ff5d6c" : "#42d69b";
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Sweep line
      const sweepX = W - 4;
      ctx.strokeStyle = "rgba(88, 200, 246, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sweepX, 0);
      ctx.lineTo(sweepX, H);
      ctx.stroke();

      // Labels
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = status === "CRITICAL" ? "#ff5d6c" : "#42d69b";
      ctx.fillText(`♥ ${heartRate} BPM`, 8, 16);
      ctx.fillStyle = "#58c8f6";
      ctx.fillText(`HRV: ${hrv}ms`, 8, H - 8);
      ctx.fillStyle = "#a9b5ba";
      ctx.fillText("TI AFE4900 CH1 Bio-Potential", W - 220, 16);
      ctx.fillText(noise50Hz ? "50Hz NOTCH: ON" : "50Hz NOTCH: OFF", W - 135, H - 8);

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [heartRate, hrv, noise50Hz, status]);

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={140}
      style={{
        width: "100%",
        height: "140px",
        borderRadius: "6px",
        border: `1px solid ${status === "CRITICAL" ? "rgba(255,93,108,0.4)" : "rgba(88,200,246,0.2)"}`,
        display: "block",
      }}
    />
  );
}

/* ─── Real-Time Accelerometer Waveform Canvas ─── */
function LiveAccelerometer({ jerk, status }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const bufRef = useRef({ x: new Float32Array(300).fill(0), y: new Float32Array(300).fill(0), z: new Float32Array(300).fill(0) });
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const buf = bufRef.current;

    function draw() {
      tRef.current += 0.08;
      const t = tRef.current;
      const intensity = clamp(jerk / 5);

      // Generate accelerometer data
      for (let i = 0; i < buf.x.length - 1; i++) {
        buf.x[i] = buf.x[i + 1];
        buf.y[i] = buf.y[i + 1];
        buf.z[i] = buf.z[i + 1];
      }
      const n = buf.x.length - 1;
      buf.x[n] = Math.sin(t * 2.3) * intensity * 0.6 + (Math.random() - 0.5) * intensity * 0.3;
      buf.y[n] = Math.cos(t * 1.8) * intensity * 0.5 + (Math.random() - 0.5) * intensity * 0.25 + 0.98;
      buf.z[n] = Math.sin(t * 3.1 + 1.5) * intensity * 0.4 + (Math.random() - 0.5) * intensity * 0.2;

      // Occasional impact spike
      if (jerk > 3 && Math.random() < 0.02) {
        buf.x[n] += (Math.random() - 0.5) * 2;
        buf.y[n] += (Math.random() - 0.5) * 3;
        buf.z[n] += (Math.random() - 0.5) * 1.5;
      }

      ctx.fillStyle = "#050b0e";
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = "rgba(66, 214, 155, 0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();

      // Draw axes
      const axes = [
        { data: buf.x, color: "#ff5d6c", label: "X" },
        { data: buf.y, color: "#42d69b", label: "Y" },
        { data: buf.z, color: "#58c8f6", label: "Z" },
      ];
      axes.forEach(({ data, color }) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
          const x = (i / data.length) * W;
          const y = H / 2 - data[i] * H * 0.25;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      // Labels
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#ff5d6c";
      ctx.fillText("X", 6, 14);
      ctx.fillStyle = "#42d69b";
      ctx.fillText("Y", 20, 14);
      ctx.fillStyle = "#58c8f6";
      ctx.fillText("Z", 34, 14);
      ctx.fillStyle = "#a9b5ba";
      ctx.fillText(`LSM6DSOX 6-Axis IMU | Jerk: ${jerk.toFixed(2)} m/s³`, W - 260, 14);

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [jerk, status]);

  return (
    <canvas
      ref={canvasRef}
      width={500}
      height={80}
      style={{
        width: "100%",
        height: "80px",
        borderRadius: "6px",
        border: "1px solid rgba(66,214,155,0.2)",
        display: "block",
      }}
    />
  );
}

/* ─── Real-Time Serial Terminal Output ─── */
function LiveSerialTerminal({ heartRate, hrv, skinTemp, gasPpm, jerk, spo2, computedRisk, worker }) {
  const [lines, setLines] = useState([]);
  const termRef = useRef(null);
  const tickRef = useRef(0);
  const propsRef = useRef({ heartRate, hrv, skinTemp, gasPpm, jerk, spo2, computedRisk, worker });

  useEffect(() => {
    propsRef.current = { heartRate, hrv, skinTemp, gasPpm, jerk, spo2, computedRisk, worker };
  }, [heartRate, hrv, skinTemp, gasPpm, jerk, spo2, computedRisk, worker]);

  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current++;
      const tick = tickRef.current;
      const ts = new Date().toISOString().split("T")[1].split(".")[0];
      const p = propsRef.current;

      let newLines = [];

      if (tick === 1) {
        newLines = [
          `[${ts}] ═══════════════════════════════════════════════`,
          `[${ts}] VitalsGrid nRF5340 Edge AI Firmware v2.4.1`,
          `[${ts}] MCU: Nordic nRF5340 ARM Cortex-M33 @ 128MHz`,
          `[${ts}] RTOS: Zephyr v3.4.0  |  TFLite Micro: v2.14`,
          `[${ts}] Tensor Arena: 34816 bytes allocated`,
          `[${ts}] ═══════════════════════════════════════════════`,
          `[${ts}] [I2C] Probing bus 0... Found 3 devices`,
          `[${ts}] [I2C 0x3C] SSD1306 OLED Display .............. OK`,
          `[${ts}] [I2C 0x6A] ST LSM6DSOX Accelerometer ......... OK`,
          `[${ts}] [I2C 0x59] Sensirion SGP40 VOC Sensor ........ OK`,
          `[${ts}] [SPI] TI AFE4900 Bio-Potential AFE ............ OK`,
          `[${ts}] [SPI] Semtech SX1262 LoRa Transceiver ........ OK`,
          `[${ts}] [PWM] Haptic Motor + Piezo Buzzer (P0.28) .... OK`,
          `[${ts}] [BLE] Bluetooth 5.2 SoftDevice Enabled`,
          `[${ts}] [TFLite] Model loaded: anomaly_detect_int8.tflite`,
          `[${ts}] [TFLite] Input shape: [1,6]  Output shape: [1,3]`,
          `[${ts}] ───────────────────────────────────────────────`,
          `[${ts}] Starting 1Hz main sensing loop...`,
        ];
      } else {
        const cRisk = p.computedRisk || {};
        const score = ((cRisk.anomaly_score || 0) * 100).toFixed(1);
        const status = cRisk.status || "NORMAL";
        const flag = `0x${(cRisk.alert_flag || 0).toString(16).toUpperCase().padStart(4, "0")}`;
        const inferMs = cRisk.inference_ms?.toFixed(1) || "8.2";
        const heatIdx = cRisk.heat_index_c?.toFixed(1) || "28.5";

        newLines.push(`[${ts}] ── TICK ${tick} ──────────────────────────────`);
        newLines.push(`[${ts}] [SENSOR] HR: ${(p.heartRate || 75).toFixed(0)}bpm | HRV: ${(p.hrv || 70).toFixed(1)}ms | Temp: ${(p.skinTemp || 25).toFixed(1)}°C | Gas: ${(p.gasPpm || 8).toFixed(1)}ppm`);
        newLines.push(`[${ts}] [MOTION] Jerk: ${(p.jerk || 0.9).toFixed(2)}m/s³ | SpO2: ${(p.spo2 || 98).toFixed(1)}% | HeatIdx: ${heatIdx}°C`);
        newLines.push(`[${ts}] [TFLite] Infer: ${inferMs}ms | Anomaly Score: ${score}% | Flag: ${flag}`);

        if (status === "CRITICAL") {
          newLines.push(`[${ts}] ⚠️  ████ CRITICAL ANOMALY DETECTED ████`);
          newLines.push(`[${ts}] [ALARM ] Haptic motor TRIGGERED | LoRa Distress TX: ${p.worker?.worker_id || "WORKER_001"}`);
        } else if (status === "WARNING") {
          newLines.push(`[${ts}] [WARN  ] Elevated risk - supervisor review`);
        } else {
          newLines.push(`[${ts}] [OK    ] Status: NORMAL | BLE heartbeat sent`);
        }
      }

      setLines((prev) => [...prev, ...newLines].slice(-80));
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div
      ref={termRef}
      style={{
        background: "#000000",
        borderRadius: "6px",
        border: `1px solid ${computedRisk.status === "CRITICAL" ? "rgba(255,93,108,0.4)" : "rgba(66,214,155,0.3)"}`,
        padding: "10px 12px",
        fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
        fontSize: "0.7rem",
        lineHeight: "1.55",
        color: "#42d69b",
        maxHeight: "240px",
        overflowY: "auto",
        overflowX: "hidden",
        scrollBehavior: "smooth",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #1e293b", paddingBottom: "4px", marginBottom: "6px", position: "sticky", top: 0, background: "#000000", zIndex: 1 }}>
        <span style={{ color: "#58c8f6", fontWeight: "bold" }}>● nRF5340 UART Console (115200 Baud)</span>
        <span style={{ color: computedRisk.status === "CRITICAL" ? "#ff5d6c" : "#42d69b" }}>{computedRisk.status}</span>
      </div>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            color: line.includes("CRITICAL") || line.includes("████")
              ? "#ff5d6c"
              : line.includes("WARN")
              ? "#f3b33d"
              : line.includes("═") || line.includes("───")
              ? "#58c8f6"
              : line.includes("OK") || line.includes("... OK")
              ? "#42d69b"
              : "#a9b5ba",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {line}
        </div>
      ))}
      <span className="terminal-cursor" style={{ display: "inline-block", width: "8px", height: "14px", background: "#42d69b", animation: "blink-cursor 1s step-end infinite" }}>
        &nbsp;
      </span>
    </div>
  );
}

/* ─── Animated Gas Gauge Ring ─── */
function GasGauge({ value, max, label, unit, color, warnAt }) {
  const pct = clamp(value / max);
  const isWarn = value >= warnAt;
  const activeColor = isWarn ? "#ff5d6c" : color;
  const circumference = 2 * Math.PI * 36;
  const dashLen = pct * circumference;

  return (
    <div style={{ textAlign: "center" }}>
      <svg width="90" height="90" viewBox="0 0 90 90">
        <circle cx="45" cy="45" r="36" fill="none" stroke="#1a2d3d" strokeWidth="6" />
        <circle
          cx="45"
          cy="45"
          r="36"
          fill="none"
          stroke={activeColor}
          strokeWidth="6"
          strokeDasharray={`${dashLen} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 45 45)"
          style={{ transition: "stroke-dasharray 0.4s ease, stroke 0.3s ease", filter: isWarn ? `drop-shadow(0 0 6px ${activeColor})` : "none" }}
        />
        <text x="45" y="42" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="monospace">
          {typeof value === "number" ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}
        </text>
        <text x="45" y="56" textAnchor="middle" fill={activeColor} fontSize="9" fontFamily="monospace">
          {unit}
        </text>
      </svg>
      <div style={{ fontSize: "0.68rem", color: "#a9b5ba", marginTop: "2px" }}>{label}</div>
    </div>
  );
}

/* ─── Main Hardware Studio Component ─── */
export default function HardwareStudio({ selectedWorker, onSendOverride, isSimulating }) {
  const worker = selectedWorker || {
    worker_id: "WORKER_001",
    zone: "HV Switchgear Yard",
    site_id: "SUBSTATION_ALPHA",
    device_id: "EDGE-001",
    heart_rate_bpm: 76,
    hrv_ms: 72,
    temperature_c: 26.5,
    ambient_temp_c: 30.5,
    humidity_pct: 45,
    gas_ppm: 8,
    jerk_ms3: 0.9,
    spo2_pct: 98,
    anomaly_score: 0.18,
    status: "NORMAL",
  };

  const [hrv, setHrv] = useState(worker.hrv_ms || 72);
  const [heartRate, setHeartRate] = useState(worker.heart_rate_bpm || 76);
  const [skinTemp, setSkinTemp] = useState(worker.temperature_c || 26.5);
  const [gasPpm, setGasPpm] = useState(worker.gas_ppm || 8);
  const [jerk, setJerk] = useState(worker.jerk_ms3 || 0.9);
  const [humidity, setHumidity] = useState(worker.humidity_pct || 45);
  const [noise50Hz, setNoise50Hz] = useState(true);
  const [audioMuted, setAudioMuted] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [activeStudioView, setActiveStudioView] = useState("fullsim"); // "fullsim" | "schematic" | "wokwi"
  const [webSerialStatus, setWebSerialStatus] = useState("Disconnected");


  // Firmware flash simulation
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState(0);
  const [flashLogs, setFlashLogs] = useState([]);

  // Elapsed uptime counter
  const [uptime, setUptime] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setUptime((u) => u + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Firmware editor
  const [cppCodeText, setCppCodeText] = useState(`// VitalsGrid nRF5340 Zephyr RTOS TFLite Micro Firmware
// Target: Nordic nRF5340 Dual-Core ARM Cortex-M33 @ 128MHz
// RTOS: Zephyr v3.4.0 | TFLite Micro v2.14 | Tensor Arena: 34KB

#include <zephyr/kernel.h>
#include <zephyr/device.h>
#include <zephyr/drivers/sensor.h>
#include <tensorflow/lite/micro/all_ops_resolver.h>
#include <tensorflow/lite/micro/micro_interpreter.h>

#define CRITICAL_THRESHOLD  0.75f
#define TENSOR_ARENA_SIZE   (34 * 1024)

static uint8_t tensor_arena[TENSOR_ARENA_SIZE];

typedef struct {
    float heart_rate_bpm, hrv_ms, skin_temp_c;
    float ambient_temp_c, humidity_pct, gas_ppm;
    float motion_jerk, spo2_pct;
} SensorReadings_t;

typedef struct {
    float anomaly_score;
    uint16_t alert_flags;
    bool is_critical;
} InferenceResult_t;

InferenceResult_t RunEdgeInference(const SensorReadings_t* s) {
    // Heat Index (Rothfusz regression)
    float tf = s->ambient_temp_c * 1.8f + 32.0f;
    float hi = (-42.379f + 2.049f*tf + 10.14f*s->humidity_pct
                - 0.224f*tf*s->humidity_pct) - 32.0f) / 1.8f;

    // Normalized feature extraction [0..1]
    float heat    = fclamp((hi - 29.0f) / 13.0f);
    float fatigue = fclamp((68.0f - s->hrv_ms) / 40.0f);
    float cardiac = fclamp((s->heart_rate_bpm - 82.0f) / 50.0f);
    float toxic   = fclamp((s->gas_ppm - 12.0f) / 55.0f);
    float motion  = fclamp((s->motion_jerk - 1.5f) / 3.5f);
    float skin    = fclamp((s->skin_temp_c - 25.0f) / 5.0f);

    // Weighted sensor fusion score
    float score = heat*0.24f + fatigue*0.20f + cardiac*0.22f
                + toxic*0.14f + motion*0.13f + skin*0.07f;

    InferenceResult_t r = { .anomaly_score = score };
    r.is_critical = (score >= CRITICAL_THRESHOLD
                  || hi >= 39.0f || s->gas_ppm >= 55.0f
                  || s->spo2_pct <= 92.0f);

    if (r.is_critical) {
        TriggerLocalHapticAlarm(880);
        BroadcastLoRaBeacon(score);
    }
    return r;
}

int main(void) {
    printk("VitalsGrid nRF5340 Firmware Started\\n");
    SensorReadings_t sensors;
    while (1) {
        ReadAllSensors(&sensors);
        InferenceResult_t res = RunEdgeInference(&sensors);
        k_msleep(1000);  // 1 Hz sensing loop
    }
}`);

  const handleFlashFirmware = () => {
    setIsFlashing(true);
    setFlashProgress(0);
    setFlashLogs([]);

    const steps = [
      { pct: 8, msg: "> Initializing arm-none-eabi-gcc v12.2 toolchain..." },
      { pct: 18, msg: "> Parsing Zephyr CMakeLists.txt (nrf5340dk_nrf5340_cpuapp)..." },
      { pct: 30, msg: "> Compiling src/main_tflite_edge.cpp ..." },
      { pct: 42, msg: "> Compiling src/sensor_fusion.cpp ..." },
      { pct: 52, msg: "> Linking anomaly_detect_int8.tflite model (34.2KB)..." },
      { pct: 65, msg: "> Building zephyr.elf -> zephyr.hex (App Core)..." },
      { pct: 75, msg: "> Erasing nRF5340 flash via J-Link SWD (Sector 0-127)..." },
      { pct: 88, msg: "> Writing zephyr.hex to 0x00000000 (128KB)..." },
      { pct: 95, msg: "> Verifying CRC32 checksum: 0xA4F7B2E1 ..." },
      { pct: 100, msg: "✅ Flash complete! Target reset. TinyML Edge Engine ACTIVE." },
    ];

    steps.forEach((step, i) => {
      setTimeout(() => {
        setFlashProgress(step.pct);
        setFlashLogs((prev) => [...prev, step.msg]);
        if (i === steps.length - 1) {
          setTimeout(() => setIsFlashing(false), 2500);
        }
      }, (i + 1) * 450);
    });
  };

  const handleConnectWebSerial = async () => {
    if ("serial" in navigator) {
      try {
        setWebSerialStatus("Requesting USB Port...");
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        setWebSerialStatus("✅ CONNECTED (115200 Baud)");

        if (port.readable) {
          const textDecoder = new TextDecoderStream();
          port.readable.pipeTo(textDecoder.writable).catch(() => {});
          const reader = textDecoder.readable.getReader();
          let lineBuffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              reader.releaseLock();
              break;
            }
            if (value) {
              lineBuffer += value;
              const lines = lineBuffer.split("\n");
              lineBuffer = lines.pop(); // preserve trailing incomplete chunk
              for (const rawLine of lines) {
                const trimmed = rawLine.trim();
                if (!trimmed) continue;
                try {
                  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                    const data = JSON.parse(trimmed);
                    if (data.hr || data.heartRate || data.heart_rate_bpm) setHeartRate(Number(data.hr || data.heartRate || data.heart_rate_bpm));
                    if (data.hrv || data.hrv_ms) setHrv(Number(data.hrv || data.hrv_ms));
                    if (data.temp || data.skinTemp || data.temperature_c) setSkinTemp(Number(data.temp || data.skinTemp || data.temperature_c));
                    if (data.gas || data.gasPpm || data.gas_ppm) setGasPpm(Number(data.gas || data.gasPpm || data.gas_ppm));
                    if (data.jerk || data.jerk_ms3) setJerk(Number(data.jerk || data.jerk_ms3));
                    if (data.hum || data.humidity || data.humidity_pct) setHumidity(Number(data.hum || data.humidity || data.humidity_pct));
                  } else if (trimmed.includes(",")) {
                    const parts = trimmed.split(",").map((p) => parseFloat(p.trim()));
                    if (parts.length >= 5 && !isNaN(parts[0])) {
                      if (!isNaN(parts[0])) setHeartRate(parts[0]);
                      if (!isNaN(parts[1])) setHrv(parts[1]);
                      if (!isNaN(parts[2])) setSkinTemp(parts[2]);
                      if (!isNaN(parts[3])) setGasPpm(parts[3]);
                      if (!isNaN(parts[4])) setJerk(parts[4]);
                    }
                  }
                } catch (e) {
                  // Ignore parse errors for non-JSON lines
                }
              }
            }
          }
        }
      } catch (err) {
        setWebSerialStatus("Cancelled / Disconnected");
      }
    } else {
      setWebSerialStatus("⚠️ WebSerial API not supported in this browser");
    }
  };

  // Sync sliders when selected worker changes externally
  useEffect(() => {
    if (isLocked) return;
    setHrv(worker.hrv_ms || 72);
    setHeartRate(worker.heart_rate_bpm || 76);
    setSkinTemp(worker.temperature_c || 26.5);
    setGasPpm(worker.gas_ppm || 8);
    setJerk(worker.jerk_ms3 || 0.9);
    setHumidity(worker.humidity_pct || 45);
  }, [isLocked, worker.worker_id, worker.hrv_ms, worker.heart_rate_bpm, worker.temperature_c, worker.gas_ppm, worker.jerk_ms3, worker.humidity_pct]);

  // Compute live risk
  const spo2 = Math.max(88, 98.5 - Math.max(0, (70 - hrv) * 0.06) - Math.max(0, (gasPpm - 30) * 0.08));
  const liveInput = {
    heart_rate_bpm: heartRate,
    hrv_ms: hrv,
    temperature_c: skinTemp,
    ambient_temp_c: skinTemp + 5,
    humidity_pct: humidity,
    gas_ppm: gasPpm,
    jerk_ms3: jerk,
    spo2_pct: spo2,
    fall_confidence: clamp((jerk - 2.8) / 4.2),
    ecg_stress: clamp((heartRate - 78) / 68 + (70 - hrv) / 160),
  };

  const computedRisk = calculateEdgeRisk(liveInput);

  // Audio buzzer on critical
  const audioCtxRef = useRef(null);
  useEffect(() => {
    if (computedRisk.status === "CRITICAL" && !audioMuted) {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
        if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
      } catch (e) {}
    }
  }, [computedRisk.status, audioMuted]);

  const handleApplySliders = useCallback(
    (newParams) => {
      const updated = {
        hrv_ms: newParams.hrv ?? hrv,
        heart_rate_bpm: newParams.heartRate ?? heartRate,
        temperature_c: newParams.skinTemp ?? skinTemp,
        gas_ppm: newParams.gasPpm ?? gasPpm,
        jerk_ms3: newParams.jerk ?? jerk,
        humidity_pct: newParams.humidity ?? humidity,
      };
      if (onSendOverride) onSendOverride(worker.worker_id, updated);
    },
    [hrv, heartRate, skinTemp, gasPpm, jerk, humidity, onSendOverride, worker.worker_id]
  );

  const triggerPreset = (type) => {
    let params = {};
    if (type === "NORMAL") params = { hrv: 78, heartRate: 72, skinTemp: 25.5, gasPpm: 6, jerk: 0.8, humidity: 42 };
    else if (type === "HEATSTROKE") params = { hrv: 24, heartRate: 138, skinTemp: 37.8, gasPpm: 12, jerk: 1.2, humidity: 72 };
    else if (type === "GAS_LEAK") params = { hrv: 45, heartRate: 110, skinTemp: 27.0, gasPpm: 68, jerk: 0.9, humidity: 55 };
    else if (type === "FALL_IMPACT") params = { hrv: 35, heartRate: 125, skinTemp: 28.0, gasPpm: 10, jerk: 5.6, humidity: 48 };
    else if (type === "CARDIAC") params = { hrv: 18, heartRate: 155, skinTemp: 29.0, gasPpm: 8, jerk: 0.5, humidity: 45 };

    setIsLocked(true);
    setHrv(params.hrv);
    setHeartRate(params.heartRate);
    setSkinTemp(params.skinTemp);
    setGasPpm(params.gasPpm);
    setJerk(params.jerk);
    setHumidity(params.humidity);
    handleApplySliders(params);
  };

  const copyCppCode = () => {
    navigator.clipboard.writeText(cppCodeText);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2500);
  };

  const formatUptime = (s) => `${Math.floor(s / 3600).toString().padStart(2, "0")}:${Math.floor((s % 3600) / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const statusColor = computedRisk.status === "CRITICAL" ? "#ff5d6c" : computedRisk.status === "WARNING" ? "#f3b33d" : "#42d69b";

  return (
    <div className="hardware-studio-container">
      {/* ═══ Top Banner ═══ */}
      <div className="studio-banner">
        <div>
          <span className="studio-badge">⚡ VitalsGrid Hardware-in-the-Loop Testbench</span>
          <h2>Nordic nRF5340 Real-Time Sensor Fusion Engine</h2>
          <p>
            Target Node: <strong>{worker.worker_id}</strong> ({worker.zone}) | MCU: nRF5340 Cortex-M33 @ 128MHz | Uptime: <strong style={{ color: "#42d69b" }}>{formatUptime(uptime)}</strong>
          </p>
        </div>
        <div className="banner-actions" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button type="button" className={`preset-btn ${isLocked ? "emergency" : ""}`} onClick={() => setIsLocked(!isLocked)}>
            {isLocked ? "🔒 Sliders Locked" : "🔓 Live Sync"}
          </button>
          <button type="button" className={`audio-btn ${audioMuted ? "muted" : "active"}`} onClick={() => setAudioMuted(!audioMuted)}>
            {audioMuted ? "🔇 Muted" : "🔊 Alarm Active"}
          </button>
        </div>
      </div>

      {/* ═══ Scenario Presets ═══ */}
      <div className="preset-bar">
        <span className="preset-label">🧪 Emergency Scenarios:</span>
        <button type="button" className="preset-btn normal" onClick={() => triggerPreset("NORMAL")}>🟢 Normal</button>
        <button type="button" className="preset-btn heat" onClick={() => triggerPreset("HEATSTROKE")}>🔥 Heatstroke</button>
        <button type="button" className="preset-btn gas" onClick={() => triggerPreset("GAS_LEAK")}>☣️ Toxic Gas Leak</button>
        <button type="button" className="preset-btn emergency" onClick={() => triggerPreset("FALL_IMPACT")}>🚨 Fall Impact</button>
        <button type="button" className="preset-btn" style={{ borderColor: "rgba(243,179,61,0.4)", background: "rgba(243,179,61,0.1)", color: "#f3b33d" }} onClick={() => triggerPreset("CARDIAC")}>💔 Cardiac Arrest</button>
      </div>

      {/* ═══ Status Bar: Live Risk + Sensor Gauges ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "16px", alignItems: "center", padding: "16px 20px", background: "var(--panel)", border: `2px solid ${statusColor}40`, borderRadius: "8px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: statusColor, boxShadow: `0 0 16px ${statusColor}`, animation: computedRisk.status === "CRITICAL" ? "pulse-red 1s infinite" : "none" }} />
            <span style={{ fontSize: "1.3rem", fontWeight: 800, color: statusColor, letterSpacing: "0.05em" }}>{computedRisk.status}</span>
            <span style={{ fontSize: "2rem", fontWeight: 900, color: "#ffffff", fontFamily: "monospace" }}>{(computedRisk.anomaly_score * 100).toFixed(1)}%</span>
            <span style={{ fontSize: "0.8rem", color: "#a9b5ba" }}>Anomaly Score</span>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {Object.entries(computedRisk.contributions || {}).map(([key, val]) => (
              <div key={key} style={{ padding: "4px 10px", background: val >= 0.65 ? "rgba(255,93,108,0.2)" : "rgba(88,200,246,0.08)", borderRadius: "4px", border: `1px solid ${val >= 0.65 ? "#ff5d6c" : "#1a2d3d"}` }}>
                <span style={{ fontSize: "0.68rem", color: "#a9b5ba", textTransform: "capitalize" }}>{key}: </span>
                <strong style={{ fontSize: "0.78rem", color: val >= 0.65 ? "#ff5d6c" : val >= 0.4 ? "#f3b33d" : "#42d69b" }}>{(val * 100).toFixed(0)}%</strong>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <GasGauge value={heartRate} max={180} label="Heart Rate" unit="BPM" color="#ff5d6c" warnAt={120} />
          <GasGauge value={spo2} max={100} label="SpO2" unit="%" color="#58c8f6" warnAt={0} />
          <GasGauge value={gasPpm} max={100} label="Gas PPM" unit="PPM" color="#f3b33d" warnAt={55} />
          <GasGauge value={skinTemp} max={45} label="Skin Temp" unit="°C" color="#42d69b" warnAt={36} />
        </div>
      </div>

      {/* ═══ View Tabs ═══ */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {[
          { id: "fullsim", label: "🖥️ Full Simulation + Serial" },
          { id: "schematic", label: "⚡ PCB Schematic & Oscilloscope" },
          { id: "wokwi", label: "🌐 Firmware IDE + Wokwi" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`preset-btn ${activeStudioView === tab.id ? "normal" : ""}`}
            style={{ padding: "8px 16px", background: activeStudioView === tab.id ? "rgba(66,214,155,0.2)" : "rgba(255,255,255,0.04)", borderColor: activeStudioView === tab.id ? "#42d69b" : "rgba(255,255,255,0.1)" }}
            onClick={() => setActiveStudioView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <button type="button" className="preset-btn" style={{ marginLeft: "auto", borderColor: "rgba(88,200,246,0.3)", color: "#58c8f6" }} onClick={handleConnectWebSerial}>
          🔌 Connect Physical USB ({webSerialStatus})
        </button>
      </div>

      {/* ═══ TAB 1: Full Simulation ═══ */}
      {activeStudioView === "fullsim" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {/* Left: Live Oscilloscope + Accelerometer */}
          <div className="studio-card" style={{ padding: "16px" }}>
            <div className="card-header" style={{ marginBottom: "10px" }}>
              <div>
                <h3 style={{ color: "#ff5d6c" }}>📈 Real-Time Bio-Signal Oscilloscope</h3>
                <span className="subhead">TI AFE4900 ECG Lead-II Channel + ST LSM6DSOX IMU</span>
              </div>
              <label className="toggle-label" style={{ fontSize: "0.78rem" }}>
                <input type="checkbox" checked={noise50Hz} onChange={(e) => setNoise50Hz(e.target.checked)} />
                <span>50Hz Notch Filter</span>
              </label>
            </div>

            {/* ECG Oscilloscope */}
            <LiveOscilloscope heartRate={heartRate} hrv={hrv} noise50Hz={noise50Hz} status={computedRisk.status} />

            {/* Accelerometer */}
            <div style={{ marginTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#42d69b", marginBottom: "4px" }}>
                <span>📊 ST LSM6DSOX 3-Axis Accelerometer</span>
                <span style={{ color: jerk > 3 ? "#ff5d6c" : "#a9b5ba" }}>Jerk: {jerk.toFixed(2)} m/s³</span>
              </div>
              <LiveAccelerometer jerk={jerk} status={computedRisk.status} />
            </div>

            {/* CPU Load Bars */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "12px" }}>
              <div style={{ padding: "8px 12px", background: "#050b0e", borderRadius: "6px", border: "1px solid #1a2d3d" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#a9b5ba", marginBottom: "4px" }}>
                  <span>App Core (TFLite)</span>
                  <span style={{ color: "#58c8f6" }}>{(24 + computedRisk.anomaly_score * 38).toFixed(0)}%</span>
                </div>
                <div style={{ height: "4px", background: "#1a2d3d", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${24 + computedRisk.anomaly_score * 38}%`, background: "linear-gradient(90deg, #58c8f6, #42d69b)", transition: "width 0.4s" }} />
                </div>
              </div>
              <div style={{ padding: "8px 12px", background: "#050b0e", borderRadius: "6px", border: "1px solid #1a2d3d" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#a9b5ba", marginBottom: "4px" }}>
                  <span>Net Core (BLE/LoRa)</span>
                  <span style={{ color: "#f3b33d" }}>{computedRisk.status === "CRITICAL" ? "42" : "18"}%</span>
                </div>
                <div style={{ height: "4px", background: "#1a2d3d", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: computedRisk.status === "CRITICAL" ? "42%" : "18%", background: "linear-gradient(90deg, #f3b33d, #ff5d6c)", transition: "width 0.4s" }} />
                </div>
              </div>
            </div>

            {/* Virtual OLED Display */}
            <div style={{ marginTop: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "0.72rem", color: "#a9b5ba", marginBottom: "6px" }}>📟 SSD1306 OLED Display (128×64 I2C 0x3C)</div>
              <div style={{ width: "260px", height: "135px", background: "#000000", border: "4px solid #334155", borderRadius: "8px", margin: "0 auto", padding: "10px", textAlign: "left", boxShadow: `0 0 16px ${statusColor}40` }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #334155", paddingBottom: "4px" }}>
                  <span style={{ fontSize: "0.68rem", color: "#58c8f6", fontFamily: "monospace" }}>VITALSGRID v2.4</span>
                  <span style={{ fontSize: "0.68rem", color: statusColor, fontFamily: "monospace", fontWeight: "bold" }}>{computedRisk.status}</span>
                </div>
                <div style={{ marginTop: "6px", fontSize: "0.72rem", color: "#ffffff", fontFamily: "monospace", lineHeight: "1.6" }}>
                  <div>NODE: {worker.worker_id}</div>
                  <div>HR: {heartRate}bpm | HRV: {hrv}ms</div>
                  <div>TEMP: {skinTemp.toFixed(1)}°C | GAS: {gasPpm}ppm</div>
                  <div>SpO2: {spo2.toFixed(0)}% | Jerk: {jerk.toFixed(1)}</div>
                  <div style={{ color: statusColor, fontWeight: "bold" }}>RISK: {(computedRisk.anomaly_score * 100).toFixed(1)}%</div>
                </div>
              </div>
              {/* Alert LED + Piezo */}
              <div style={{ display: "flex", justifyContent: "center", gap: "28px", marginTop: "10px" }}>
                <div>
                  <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: statusColor, boxShadow: `0 0 ${computedRisk.status === "CRITICAL" ? "18" : "8"}px ${statusColor}`, margin: "0 auto", animation: computedRisk.status === "CRITICAL" ? "pulse-red 0.8s infinite" : "none" }} />
                  <span style={{ fontSize: "0.65rem", color: "#a9b5ba", display: "block", marginTop: "3px" }}>RGB LED</span>
                </div>
                <div>
                  <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: computedRisk.status === "CRITICAL" ? "rgba(255,93,108,0.3)" : "#1e293b", border: `2px solid ${statusColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", margin: "0 auto" }}>🔊</div>
                  <span style={{ fontSize: "0.65rem", color: "#a9b5ba", display: "block", marginTop: "3px" }}>{computedRisk.status === "CRITICAL" ? "880Hz ON" : "Standby"}</span>
                </div>
                <div>
                  <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: computedRisk.status === "CRITICAL" ? "rgba(255,93,108,0.3)" : "#1e293b", border: `2px solid ${computedRisk.status === "CRITICAL" ? "#ff5d6c" : "#58c8f6"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", margin: "0 auto" }}>📳</div>
                  <span style={{ fontSize: "0.65rem", color: "#a9b5ba", display: "block", marginTop: "3px" }}>{computedRisk.status === "CRITICAL" ? "VIBRATING" : "Idle"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Serial Terminal + Sensor Sliders */}
          <div className="studio-card" style={{ padding: "16px" }}>
            <div className="card-header" style={{ marginBottom: "8px" }}>
              <div>
                <h3 style={{ color: "#42d69b" }}>🖥️ Live UART Serial Console</h3>
                <span className="subhead">Real-time firmware telemetry output from nRF5340</span>
              </div>
            </div>

            <LiveSerialTerminal
              heartRate={heartRate}
              hrv={hrv}
              skinTemp={skinTemp}
              gasPpm={gasPpm}
              jerk={jerk}
              spo2={spo2}
              computedRisk={computedRisk}
              worker={worker}
            />

            {/* ── Sensor Sliders ── */}
            <div style={{ marginTop: "12px" }}>
              <h4 style={{ color: "#58c8f6", fontSize: "0.9rem", marginBottom: "8px" }}>🎛️ Live Sensor Signal Injector</h4>
              <div className="control-sliders">
                {[
                  { label: "💓 Heart Rate", unit: "BPM", value: heartRate, set: setHeartRate, key: "heartRate", min: 45, max: 180, step: 1, ticks: ["45 (Bradicardia)", "75 (Normal)", "180 (VTach)"] },
                  { label: "🫀 HRV Fatigue", unit: "ms", value: hrv, set: setHrv, key: "hrv", min: 10, max: 120, step: 1, ticks: ["10 ms (Collapse)", "70 ms (Normal)", "120 ms (Rested)"] },
                  { label: "🌡️ Skin Temp", unit: "°C", value: skinTemp, set: setSkinTemp, key: "skinTemp", min: 18, max: 44, step: 0.5, ticks: ["18°C", "26°C (Baseline)", "44°C (Lethal)"] },
                  { label: "☣️ Gas PPM", unit: "PPM", value: gasPpm, set: setGasPpm, key: "gasPpm", min: 0, max: 100, step: 1, ticks: ["0 (Clean)", "35 (Warning)", "100 (Lethal)"] },
                  { label: "💥 Motion Jerk", unit: "m/s³", value: jerk, set: setJerk, key: "jerk", min: 0, max: 10, step: 0.1, ticks: ["0 (Still)", "1 (Walk)", "10 (Hard Fall)"] },
                  { label: "💧 Humidity", unit: "%", value: humidity, set: setHumidity, key: "humidity", min: 10, max: 95, step: 1, ticks: ["10% (Dry)", "45% (Normal)", "95% (Saturated)"] },
                ].map((s) => (
                  <div key={s.key} className="slider-group">
                    <div className="slider-meta">
                      <span className="slider-name">{s.label}</span>
                      <strong className="slider-val">{typeof s.value === "number" ? (Number.isInteger(s.value) || s.step >= 1 ? s.value : s.value.toFixed(1)) : s.value} {s.unit}</strong>
                    </div>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={s.value}
                      onChange={(e) => {
                        setIsLocked(true);
                        const val = Number(e.target.value);
                        s.set(val);
                        handleApplySliders({ [s.key]: val });
                      }}
                    />
                    <div className="slider-ticks">{s.ticks.map((t) => <span key={t}>{t}</span>)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 2: PCB Schematic ═══ */}
      {activeStudioView === "schematic" && (
        <div className="studio-grid">
          <div className="studio-card mcu-visual-card">
            <div className="card-header">
              <h3>⚡ nRF5340 Hardware Wiring Schematic & Bio-Potential Monitor</h3>
              <span className="subhead">Dual-core Cortex-M33 MCU + TI AFE4900 ECG + ST LSM6DSOX IMU + SGP40 Gas</span>
            </div>

            <div className="circuit-diagram">
              <svg viewBox="0 0 640 340" className="circuit-svg">
                <defs>
                  <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                <rect x="15" y="15" width="610" height="310" rx="14" fill="#081016" stroke="#1a2d3d" strokeWidth="2.5" />
                <text x="35" y="42" fill="#58c8f6" fontSize="12" fontWeight="bold" fontFamily="monospace">
                  VITALSGRID nRF5340 DUAL-CORE PCB v2.4 (AIR-GAPPED OT)
                </text>

                {/* PCB Traces */}
                <path d="M 180 115 H 205 V 140 H 218" fill="none" stroke="#ff5d6c" strokeWidth="2" strokeDasharray="4,3">
                  <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1.5s" repeatCount="indefinite" />
                </path>
                <circle cx="180" cy="115" r="3" fill="#ff5d6c" />
                <circle cx="218" cy="140" r="3" fill="#ff5d6c" />

                <path d="M 180 235 H 205 V 200 H 218" fill="none" stroke="#42d69b" strokeWidth="2" strokeDasharray="4,3">
                  <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1.2s" repeatCount="indefinite" />
                </path>
                <circle cx="180" cy="235" r="3" fill="#42d69b" />
                <circle cx="218" cy="200" r="3" fill="#42d69b" />

                <path d="M 460 115 H 435 V 130 H 422" fill="none" stroke="#f3b33d" strokeWidth="2" strokeDasharray="4,3">
                  <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1.8s" repeatCount="indefinite" />
                </path>
                <circle cx="460" cy="115" r="3" fill="#f3b33d" />
                <circle cx="422" cy="130" r="3" fill="#f3b33d" />

                <path d="M 460 235 H 435 V 200 H 422" fill="none" stroke="#58c8f6" strokeWidth="2" strokeDasharray="4,3">
                  <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1s" repeatCount="indefinite" />
                </path>
                <circle cx="460" cy="235" r="3" fill="#58c8f6" />
                <circle cx="422" cy="200" r="3" fill="#58c8f6" />

                {/* MCU */}
                <rect x="230" y="90" width="180" height="160" rx="8" fill="#112231" stroke="#58c8f6" strokeWidth="2" filter="url(#glow-cyan)" />
                <text x="245" y="118" fill="#ffffff" fontSize="14" fontWeight="bold">Nordic nRF5340</text>
                <text x="245" y="138" fill="#58c8f6" fontSize="10" fontFamily="monospace">App Core: 128MHz (TFLM)</text>
                <text x="245" y="156" fill="#42d69b" fontSize="10" fontFamily="monospace">Net Core: BLE / LoRa</text>
                <text x="245" y="174" fill="#a9b5ba" fontSize="10" fontFamily="monospace">RAM: 512KB | TFLM: 34KB</text>

                {/* Pins */}
                <rect x="218" y="110" width="12" height="5" rx="1" fill="#a9b5ba" />
                <rect x="218" y="137.5" width="12" height="5" rx="1" fill="#ff5d6c" />
                <text x="202" y="142" fill="#ff5d6c" fontSize="7" fontFamily="monospace">SPI</text>
                <rect x="218" y="165" width="12" height="5" rx="1" fill="#a9b5ba" />
                <rect x="218" y="197.5" width="12" height="5" rx="1" fill="#42d69b" />
                <text x="202" y="202" fill="#42d69b" fontSize="7" fontFamily="monospace">I2C</text>
                <rect x="218" y="225" width="12" height="5" rx="1" fill="#a9b5ba" />
                <rect x="410" y="110" width="12" height="5" rx="1" fill="#a9b5ba" />
                <rect x="410" y="127.5" width="12" height="5" rx="1" fill="#f3b33d" />
                <text x="426" y="132" fill="#f3b33d" fontSize="7" fontFamily="monospace">I2C</text>
                <rect x="410" y="165" width="12" height="5" rx="1" fill="#a9b5ba" />
                <rect x="410" y="197.5" width="12" height="5" rx="1" fill="#58c8f6" />
                <text x="426" y="202" fill="#58c8f6" fontSize="7" fontFamily="monospace">PWM</text>
                <rect x="410" y="225" width="12" height="5" rx="1" fill="#a9b5ba" />

                {/* Status LED */}
                <circle cx="390" cy="110" r="6" fill={statusColor} filter={computedRisk.status === "CRITICAL" ? "url(#glow-red)" : "none"}>
                  {computedRisk.status === "CRITICAL" && <animate attributeName="opacity" values="1;0.3;1" dur="0.6s" repeatCount="indefinite" />}
                </circle>

                {/* Sensor Modules */}
                <g transform="translate(35, 75)">
                  <rect x="0" y="0" width="145" height="80" rx="6" fill="#101d29" stroke="#ff5d6c" strokeWidth="1.5" />
                  <text x="12" y="24" fill="#ff5d6c" fontSize="12" fontWeight="bold">TI AFE4900</text>
                  <text x="12" y="42" fill="#a9b5ba" fontSize="9">Bio-Potential ECG/HRV</text>
                  <rect x="12" y="50" width="121" height="20" rx="3" fill="#182736" />
                  <text x="18" y="64" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="monospace">
                    {hrv.toFixed(0)} ms | {heartRate.toFixed(0)} bpm
                  </text>
                </g>

                <g transform="translate(35, 195)">
                  <rect x="0" y="0" width="145" height="80" rx="6" fill="#101d29" stroke="#42d69b" strokeWidth="1.5" />
                  <text x="12" y="24" fill="#42d69b" fontSize="12" fontWeight="bold">ST LSM6DSOX</text>
                  <text x="12" y="42" fill="#a9b5ba" fontSize="9">6-Axis Motion Jerk</text>
                  <rect x="12" y="50" width="121" height="20" rx="3" fill="#182736" />
                  <text x="18" y="64" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="monospace">
                    {jerk.toFixed(2)} m/s³
                  </text>
                </g>

                <g transform="translate(460, 75)">
                  <rect x="0" y="0" width="145" height="80" rx="6" fill="#101d29" stroke="#f3b33d" strokeWidth="1.5" />
                  <text x="12" y="24" fill="#f3b33d" fontSize="12" fontWeight="bold">Sensirion SGP40</text>
                  <text x="12" y="42" fill="#a9b5ba" fontSize="9">VOC Gas & Temp</text>
                  <rect x="12" y="50" width="121" height="20" rx="3" fill="#182736" />
                  <text x="18" y="64" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="monospace">
                    {gasPpm.toFixed(0)} ppm | {skinTemp.toFixed(1)}°C
                  </text>
                </g>

                <g transform="translate(460, 195)">
                  <rect x="0" y="0" width="145" height="80" rx="6" fill={computedRisk.status === "CRITICAL" ? "rgba(255,93,108,0.2)" : "#101d29"} stroke={computedRisk.status === "CRITICAL" ? "#ff5d6c" : "#58c8f6"} strokeWidth="1.8" />
                  <text x="12" y="24" fill="#58c8f6" fontSize="12" fontWeight="bold">Piezo + Haptic</text>
                  <text x="12" y="42" fill="#a9b5ba" fontSize="9">Local Alarm Output</text>
                  <rect x="12" y="50" width="121" height="20" rx="3" fill={computedRisk.status === "CRITICAL" ? "rgba(255,93,108,0.35)" : "#182736"} />
                  <text x="18" y="64" fill={computedRisk.status === "CRITICAL" ? "#ff5d6c" : "#42d69b"} fontSize="11" fontWeight="bold" fontFamily="monospace">
                    {computedRisk.status === "CRITICAL" ? "🔊 ACTIVE ALARM" : "STANDBY"}
                  </text>
                </g>

                <text x="35" y="306" fill="#a9b5ba" fontSize="10" fontFamily="monospace">
                  Filter: {noise50Hz ? "50Hz Notch Active" : "Bypass"} | Air-Gap WAN: 0.0.0.0 | Latency: {computedRisk.inference_ms}ms
                </text>
              </svg>
            </div>

            <div className="noise-toggle-row">
              <label className="toggle-label">
                <input type="checkbox" checked={noise50Hz} onChange={(e) => setNoise50Hz(e.target.checked)} />
                <span>50 Hz Substation Power Grid Noise Rejection Notch Filter</span>
              </label>
              <span className="filter-badge">{noise50Hz ? "Active (50Hz Notch)" : "Bypassed"}</span>
            </div>

            {/* Oscilloscope */}
            <div className="math-panel" style={{ marginTop: "8px" }}>
              <div className="panel-subhead">
                <span style={{ color: "#ff5d6c" }}>📈 TI AFE4900 Real-Time ECG Oscilloscope</span>
                <strong style={{ color: statusColor }}>{heartRate} BPM | HRV {hrv}ms</strong>
              </div>
              <LiveOscilloscope heartRate={heartRate} hrv={hrv} noise50Hz={noise50Hz} status={computedRisk.status} />

              <div style={{ marginTop: "10px" }}>
                <div className="panel-subhead">
                  <span style={{ color: "#42d69b" }}>📊 ST LSM6DSOX 3-Axis Accelerometer</span>
                  <strong style={{ color: jerk > 3 ? "#ff5d6c" : "#a9b5ba" }}>Jerk: {jerk.toFixed(2)} m/s³</strong>
                </div>
                <LiveAccelerometer jerk={jerk} status={computedRisk.status} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "8px" }}>
                <div className="sec-row" style={{ padding: "8px 12px" }}>
                  <span>App Core (Cortex-M33 @ 128MHz)</span>
                  <strong className="allowed">TFLM CPU: {(24 + computedRisk.anomaly_score * 38).toFixed(0)}%</strong>
                </div>
                <div className="sec-row" style={{ padding: "8px 12px" }}>
                  <span>Net Core (BLE 5.2 / LoRa)</span>
                  <strong className="highlight">Radio: {computedRisk.status === "CRITICAL" ? "42" : "18"}%</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Sliders + TFLite Display */}
          <div className="studio-card controls-card">
            <div className="card-header">
              <h3>🎛️ Live Sensor Signal Injector</h3>
              <span className="subhead">Move sliders to test on-device TinyML decision engine</span>
            </div>

            <div className="control-sliders">
              {[
                { label: "💓 Heart Rate (TI AFE4900)", unit: "BPM", value: heartRate, set: setHeartRate, key: "heartRate", min: 45, max: 180, step: 1, ticks: ["45 (Bradicardia)", "75 (Normal)", "180 (VTach)"] },
                { label: "🫀 HRV Fatigue (ms)", unit: "ms", value: hrv, set: setHrv, key: "hrv", min: 10, max: 120, step: 1, ticks: ["10 ms (Exhaustion)", "70 ms (Normal)", "120 ms (Rested)"] },
                { label: "🌡️ Skin Temp (°C)", unit: "°C", value: skinTemp, set: setSkinTemp, key: "skinTemp", min: 18, max: 44, step: 0.5, ticks: ["18°C", "26.5°C (Baseline)", "44°C (Heat Stroke)"] },
                { label: "☣️ SF6 / Toxic Gas (SGP40)", unit: "PPM", value: gasPpm, set: setGasPpm, key: "gasPpm", min: 0, max: 100, step: 1, ticks: ["0 (Safe)", "35 (Warning)", "100 (Hazardous)"] },
                { label: "💥 Motion Jerk (LSM6DSOX)", unit: "m/s³", value: jerk, set: setJerk, key: "jerk", min: 0, max: 10, step: 0.1, ticks: ["0 (Stationary)", "1 (Walking)", "10 (Hard Fall)"] },
                { label: "💧 Humidity", unit: "%", value: humidity, set: setHumidity, key: "humidity", min: 10, max: 95, step: 1, ticks: ["10% (Dry)", "45% (Normal)", "95% (Saturated)"] },
              ].map((s) => (
                <div key={s.key} className="slider-group">
                  <div className="slider-meta">
                    <span className="slider-name">{s.label}</span>
                    <strong className="slider-val">{typeof s.value === "number" ? (s.step >= 1 ? s.value : s.value.toFixed(1)) : s.value} {s.unit}</strong>
                  </div>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={s.value}
                    onChange={(e) => {
                      setIsLocked(true);
                      const val = Number(e.target.value);
                      s.set(val);
                      handleApplySliders({ [s.key]: val });
                    }}
                  />
                  <div className="slider-ticks">{s.ticks.map((t) => <span key={t}>{t}</span>)}</div>
                </div>
              ))}
            </div>

            {/* TFLite Inference Display */}
            <div className="math-panel">
              <h4>🧠 Quantized TFLite Micro Inference Engine</h4>
              <div className="formula-box">
                <code>Dense Layer (6 Inputs → 8 Hidden ReLU → Softmax Anomaly Score)</code>
              </div>

              <div style={{ marginTop: "8px", padding: "8px", background: "#050b0e", borderRadius: "6px", border: "1px solid rgba(88,200,246,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#58c8f6", marginBottom: "4px" }}>
                  <span>TFLite INT8 Tensor Activations (Hidden):</span>
                  <span>Arena: 34.2 KB</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
                  {(computedRisk.tflite_tensor_activations || [0.12, 0.45, 0.0, 0.38, 0.22, 0.51, 0.09, 0.14]).map((val, idx) => (
                    <div key={idx} style={{ background: "#101d29", padding: "4px", borderRadius: "4px", textAlign: "center", border: "1px solid #1a2d3d" }}>
                      <span style={{ fontSize: "0.68rem", color: "#a9b5ba", display: "block" }}>Node {idx + 1}</span>
                      <strong style={{ fontSize: "0.8rem", color: val > 0.3 ? "#42d69b" : "#ffffff" }}>{val.toFixed(3)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="score-result" style={{ marginTop: "10px" }}>
                <span>Computed Edge Anomaly Score:</span>
                <strong style={{ color: statusColor }}>{(computedRisk.anomaly_score * 100).toFixed(1)}%</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 3: Firmware IDE + Wokwi ═══ */}
      {activeStudioView === "wokwi" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {/* Left: C++ IDE */}
          <div className="studio-card" style={{ padding: "16px" }}>
            <div className="card-header" style={{ marginBottom: "10px" }}>
              <div>
                <h3 style={{ color: "#58c8f6" }}>💻 nRF5340 Zephyr RTOS Firmware IDE</h3>
                <span className="subhead">Target: Nordic nRF5340 Cortex-M33 | arm-none-eabi-gcc 12.2</span>
              </div>
              <span className="sec-chip pass">🟢 COMPILED</span>
            </div>

            <div style={{ background: "#050b0e", border: "1px solid var(--line)", borderRadius: "6px", padding: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#a9b5ba", marginBottom: "6px" }}>
                <span>📁 firmware/nrf5340_vitalsgrid.cpp</span>
                <span>Zephyr RTOS v3.4.0</span>
              </div>
              <textarea
                value={cppCodeText}
                onChange={(e) => setCppCodeText(e.target.value)}
                spellCheck={false}
                style={{
                  width: "100%",
                  height: "350px",
                  background: "#081016",
                  color: "#58c8f6",
                  border: "1px solid rgba(88,200,246,0.3)",
                  borderRadius: "4px",
                  padding: "10px",
                  fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
                  fontSize: "0.76rem",
                  lineHeight: "1.5",
                  resize: "vertical",
                  tabSize: 4,
                }}
              />
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button type="button" className="preset-btn normal" style={{ flex: 1, padding: "10px", fontWeight: "bold" }} onClick={handleFlashFirmware} disabled={isFlashing}>
                  {isFlashing ? `⚡ Flashing nRF5340 (${flashProgress}%)...` : "⚡ Compile & Flash to nRF5340"}
                </button>
                <button type="button" className="preset-btn" style={{ padding: "10px 16px" }} onClick={copyCppCode}>
                  {codeCopied ? "✅ Copied" : "📋 Copy"}
                </button>
              </div>

              {(isFlashing || flashLogs.length > 0) && (
                <div style={{ marginTop: "10px", background: "#000000", padding: "10px", borderRadius: "6px", border: "1px solid rgba(66,214,155,0.3)", fontFamily: "monospace", fontSize: "0.72rem", color: "#42d69b" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", borderBottom: "1px solid #1e293b", paddingBottom: "4px" }}>
                    <span>ARM Cortex-M33 Flash Console</span>
                    <span>{flashProgress}%</span>
                  </div>
                  <div style={{ height: "4px", background: "#1e293b", borderRadius: "2px", marginBottom: "8px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${flashProgress}%`, background: "linear-gradient(90deg, #42d69b, #58c8f6)", transition: "width 0.3s ease" }} />
                  </div>
                  {flashLogs.map((log, idx) => (
                    <div key={idx} style={{ margin: "2px 0", color: log.includes("✅") ? "#42d69b" : "#a9b5ba" }}>{log}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Wokwi Simulation Board + Serial */}
          <div className="studio-card" style={{ padding: "16px" }}>
            <div className="card-header" style={{ marginBottom: "10px" }}>
              <div>
                <h3 style={{ color: "#42d69b" }}>🌐 Wokwi Embedded MCU Simulator</h3>
                <span className="subhead">Interactive ESP32 / nRF52840 simulation with live sensor data</span>
              </div>
            </div>

            {/* Wokwi Simulated Console Output */}
            <div style={{ background: "#000000", borderRadius: "8px", border: "1px solid rgba(88,200,246,0.3)", padding: "14px", marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #1e293b", paddingBottom: "6px", marginBottom: "10px" }}>
                <span style={{ color: "#42d69b", fontFamily: "monospace", fontSize: "0.8rem", fontWeight: "bold" }}>⚡ WOKWI SIMULATED HARDWARE TARGET</span>
                <span style={{ color: "#58c8f6", fontFamily: "monospace", fontSize: "0.8rem" }}>Zephyr RTOS v3.4</span>
              </div>
              <pre style={{ color: "#a9b5ba", fontSize: "0.74rem", margin: 0, fontFamily: "monospace", lineHeight: "1.6" }}>
{`[INIT] Nordic nRF5340 Dual ARM Cortex-M33 @ 128MHz
[I2C 0x3C] SSD1306 OLED Display .............. OK
[I2C 0x6A] ST LSM6DSOX Accelerometer ......... OK
[I2C 0x59] Sensirion SGP40 VOC Sensor ........ OK
[SPI    ] TI AFE4900 Bio-Potential AFE ....... OK
[SPI    ] Semtech SX1262 LoRa Transceiver .... OK
[PWM    ] Haptic Motor + Piezo (P0.28) ....... OK
[TFLite ] Model: anomaly_detect_int8.tflite
[TFLite ] Tensor Arena: 34816 bytes
─────────────────────────────────────────────────
[SENSOR ] HR: ${heartRate.toFixed(0)} bpm | HRV: ${hrv.toFixed(0)} ms
[SENSOR ] Skin: ${skinTemp.toFixed(1)}°C | Gas: ${gasPpm.toFixed(0)} ppm
[SENSOR ] Jerk: ${jerk.toFixed(2)} m/s³ | SpO2: ${spo2.toFixed(1)}%
[TFLite ] Anomaly Score: ${(computedRisk.anomaly_score * 100).toFixed(1)}%
[STATUS ] ${computedRisk.status} | Flag: 0x${(computedRisk.alert_flag || 0).toString(16).toUpperCase().padStart(4, "0")}
[BEACON ] ${computedRisk.status === "CRITICAL" ? "⚠️ LoRa DISTRESS TX Active" : "BLE heartbeat (nominal)"}`}
              </pre>
            </div>

            {/* Wokwi Link */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <a
                href="https://wokwi.com/projects/new/esp32"
                target="_blank"
                rel="noreferrer"
                className="preset-btn normal"
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", padding: "10px", fontWeight: "bold" }}
              >
                🚀 Open New Wokwi ESP32 Project ↗
              </a>
              <a
                href="https://wokwi.com/projects/new/arduino-uno"
                target="_blank"
                rel="noreferrer"
                className="preset-btn"
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", padding: "10px" }}
              >
                🔧 Open Wokwi Arduino UNO ↗
              </a>
            </div>

            {/* Live Serial Terminal */}
            <LiveSerialTerminal
              heartRate={heartRate}
              hrv={hrv}
              skinTemp={skinTemp}
              gasPpm={gasPpm}
              jerk={jerk}
              spo2={spo2}
              computedRisk={computedRisk}
              worker={worker}
            />
          </div>
        </div>
      )}

      {/* ═══ Bottom: TFLite Neural Network Visualization ═══ */}
      <div className="studio-card" style={{ padding: "16px" }}>
        <h4 style={{ color: "#58c8f6", marginBottom: "8px" }}>🧠 TFLite Micro INT8 Neural Network — Live Forward Pass Visualization</h4>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr auto", gap: "12px", alignItems: "center" }}>
          {/* Input Layer */}
          <div>
            <div style={{ fontSize: "0.72rem", color: "#58c8f6", fontWeight: "bold", marginBottom: "6px" }}>Input [6]</div>
            {[
              { name: "Heat", val: computedRisk.contributions?.heat },
              { name: "Fatigue", val: computedRisk.contributions?.fatigue },
              { name: "Cardiac", val: computedRisk.contributions?.cardiac },
              { name: "Exposure", val: computedRisk.contributions?.exposure },
              { name: "Motion", val: computedRisk.contributions?.motion },
              { name: "SkinTemp", val: computedRisk.contributions?.skinHeat },
            ].map((n) => (
              <div key={n.name} style={{ padding: "3px 8px", background: (n.val || 0) > 0.5 ? "rgba(255,93,108,0.2)" : "#101d29", borderRadius: "4px", border: "1px solid #1a2d3d", marginBottom: "3px", fontSize: "0.7rem", display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ color: "#a9b5ba" }}>{n.name}</span>
                <strong style={{ color: (n.val || 0) > 0.5 ? "#ff5d6c" : "#42d69b" }}>{((n.val || 0) * 100).toFixed(0)}%</strong>
              </div>
            ))}
          </div>

          {/* Arrows */}
          <div style={{ textAlign: "center", color: "#1a2d3d", fontSize: "1.5rem" }}>→</div>

          {/* Hidden Layer */}
          <div>
            <div style={{ fontSize: "0.72rem", color: "#42d69b", fontWeight: "bold", marginBottom: "6px" }}>Hidden [8] ReLU</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px" }}>
              {(computedRisk.tflite_tensor_activations || [0, 0, 0, 0, 0, 0, 0, 0]).map((val, i) => (
                <div key={i} style={{ padding: "3px 6px", background: val > 0.3 ? "rgba(66,214,155,0.2)" : "#101d29", borderRadius: "4px", border: "1px solid #1a2d3d", textAlign: "center" }}>
                  <span style={{ fontSize: "0.6rem", color: "#a9b5ba" }}>H{i}</span>
                  <div style={{ fontSize: "0.72rem", color: val > 0.3 ? "#42d69b" : "#ffffff", fontWeight: "bold" }}>{val.toFixed(3)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Arrows */}
          <div style={{ textAlign: "center", color: "#1a2d3d", fontSize: "1.5rem" }}>→</div>

          {/* Output */}
          <div>
            <div style={{ fontSize: "0.72rem", color: statusColor, fontWeight: "bold", marginBottom: "6px" }}>Output [Softmax]</div>
            <div style={{ padding: "12px", background: `${statusColor}15`, borderRadius: "8px", border: `2px solid ${statusColor}`, textAlign: "center" }}>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: statusColor, fontFamily: "monospace" }}>
                {(computedRisk.anomaly_score * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: statusColor, marginTop: "4px" }}>
                {computedRisk.status}
              </div>
              <div style={{ fontSize: "0.68rem", color: "#a9b5ba", marginTop: "4px" }}>
                Inference: {computedRisk.inference_ms}ms | Flag: 0x{(computedRisk.alert_flag || 0).toString(16).toUpperCase().padStart(4, "0")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
