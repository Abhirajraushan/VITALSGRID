import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateEdgeRisk, clamp, RISK_POLICY } from "./riskEngine";
import HardwareStudio from "./HardwareStudio";
import SecurityPanel from "./SecurityPanel";
import IncidentReport from "./IncidentReport";
import Login from "./Login";
import "./App.css";

// Multilingual i18n Dictionary (English & Hindi)
const I18N = {
  en: {
    brandSubtitle: "AIR-GAPPED OT SCADA INTRANET HUB (ZERO CLOUD WAN BINDING)",
    tagline: "Cloud-Independent Industrial Worker Safety & TinyML Edge Surveillance Engine",
    activeViewLabel: "SCADA Control View:",
    tabOverview: "📊 Dashboard Overview",
    tabRoster: "👷 Worker Safety Roster",
    tabShift: "🔄 3-Shift Handover",
    tabStudio: "⚡ Wokwi Hardware Studio",
    tabSecurity: "🛡️ OT Security & Encryption",
    langToggle: "🇮🇳 Hindi (हिंदी)",
    sunlightToggle: "☀️ Sunlight Mode",
    darkToggle: "🌙 Dark Mode",
    operator: "Operator:",
    site: "Plant Facility:",
    shift: "Active Shift:",
    workersCount: "TOTAL WORKERS",
    criticalCount: "CRITICAL ALERTS",
    warningCount: "WARNING HAZARDS",
    normalCount: "NORMAL STABLE",
    avgRisk: "AVG ANOMALY RISK",
    emergencySosTitle: "🚨 EMERGENCY SOS DISPATCH ESCALATION WORKFLOW",
    ambulanceCall: "🚑 Medical Ambulance Hotline (+91 112 / Plant Hospital)",
    sirenCommand: "📢 Plant Haptic & Siren Relay Triggered (880Hz)",
    dispatchLog: "SMS / WhatsApp Emergency Notice Broadcasted to Site Supervisor",
    shiftHandoverTitle: "🔄 3-Shift Changeover Handover Checklist (DGMS / Factories Act Compliant)",
    shiftA: "Shift A (06:00 - 14:00IST Morning)",
    shiftB: "Shift B (14:00 - 22:00IST Evening)",
    shiftC: "Shift C (22:00 - 06:00IST Night)",
  },
  hi: {
    brandSubtitle: "एयर-गैप्ड ओटी स्काडा इंट्रानेट हब (ज़ीरो क्लाउड डिपेंडेंसी)",
    tagline: "स्वदेशी इंडस्ट्रियल वर्कर सुरक्षा एवं टाइनी-एमएल एज सर्विलांस प्लेटफॉर्म",
    activeViewLabel: "स्काडा कंट्रोल व्यू:",
    tabOverview: "📊 डैशबोर्ड अवलोकन",
    tabRoster: "👷 कर्मचारी सुरक्षा रोस्टर",
    tabShift: "🔄 3-शिफ्ट हैंडओवर प्रणाली",
    tabStudio: "⚡ वोकवी हार्डवेयर स्टूडियो",
    tabSecurity: "🛡️ ओटी सुरक्षा एवं एन्क्रिप्शन",
    langToggle: "🇬🇧 English",
    sunlightToggle: "☀️ सनलाइट मोड",
    darkToggle: "🌙 डार्क मोड",
    operator: "ऑपरेटर:",
    site: "प्लांट साइट:",
    shift: "सक्रिय शिफ्ट:",
    workersCount: "कुल कर्मचारी",
    criticalCount: "गंभीर अलर्ट",
    warningCount: "चेतावनी खतरे",
    normalCount: "सामान्य सुरक्षित",
    avgRisk: "औसत जोखिम स्कोर",
    emergencySosTitle: "🚨 आपातकालीन एसओएस डिस्पैच अलर्ट वर्कफ़्लो",
    ambulanceCall: "🚑 मेडिकल एम्बुलेंस सेवा (+91 112 / प्लांट अस्पताल)",
    sirenCommand: "📢 प्लांट सायरन रिले ट्रिगर किया गया (880Hz)",
    dispatchLog: "साइट सुपरवाइजर को एसएमएस/व्हाट्सएप आपातकालीन सूचना भेजी गई",
    shiftHandoverTitle: "🔄 3-शिफ्ट परिवर्तन हैंडओवर चेकलिस्ट (डीजीएमएस / फैक्टरी अधिनियम अनुपालन)",
    shiftA: "शिफ्ट A (06:00 - 14:00IST सुबह)",
    shiftB: "शिफ्ट B (14:00 - 22:00IST शाम)",
    shiftC: "शिफ्ट C (22:00 - 06:00IST रात्रि)",
  }
};

const STATUS_META = {
  CRITICAL: { color: "#ff5d6c", soft: "rgba(255, 93, 108, 0.16)", label: "Critical", tone: "critical", summary: "Local alarm + distress beacon" },
  WARNING: { color: "#f3b33d", soft: "rgba(243, 179, 61, 0.14)", label: "Warning", tone: "warning", summary: "Supervisor review" },
  NORMAL: { color: "#42d69b", soft: "rgba(66, 214, 155, 0.14)", label: "Normal", tone: "normal", summary: "Stable heartbeat" },
  UNSTRAPPED: { color: "#f3b33d", soft: "rgba(243, 179, 61, 0.2)", label: "Unstrapped", tone: "warning", summary: "Wearable Lead-Off" },
};

const ARCHITECTURE_STEPS = [
  { title: "Wearable node", detail: "nRF5340 MCU, TI ECG AFE, IMU, skin heat, SpO2, gas sensor" },
  { title: "TinyML inference", detail: "Sensor fusion runs locally without sending raw vitals to cloud" },
  { title: "Offline beacon", detail: "Critical risk triggers haptic/audio alarm plus BLE/LoRa distress packet" },
  { title: "Intranet console", detail: "Supervisor dashboard receives events on the air-gapped site network" },
];

function formatPercent(value) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${(safeValue * 100).toFixed(1)}%`;
}

function formatAlertFlag(value) {
  const numeric = Number(value || 0);
  return `0x${numeric.toString(16).toUpperCase().padStart(4, "0")}`;
}

function formatTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getStatusMeta(statusOrScore) {
  if (typeof statusOrScore === "string" && STATUS_META[statusOrScore]) return STATUS_META[statusOrScore];
  const score = Number(statusOrScore || 0);
  if (score >= RISK_POLICY.criticalThreshold) return STATUS_META.CRITICAL;
  if (score >= RISK_POLICY.warningThreshold) return STATUS_META.WARNING;
  return STATUS_META.NORMAL;
}

function normalizeTelemetry(row) {
  const sensors = row?.sensors || {};
  const rawSite = row?.site_id || "NTPC Singrauli Thermal Station";
  const mappedSite =
    rawSite === "SITE_A" || rawSite === "SUBSTATION_ALPHA" ? "NTPC Singrauli Thermal Station" :
      rawSite === "SITE_B" ? "Coal India Jharia Mine" :
        rawSite === "SITE_C" ? "Tata Steel Jamshedpur Works" : rawSite;

  const base = {
    worker_id: row?.worker_id || "WORKER_000",
    site_id: mappedSite,
    zone: row?.zone || "HV Switchgear Yard",
    device_id: row?.device_id || "EDGE-nRF5340-01",
    timestamp: row?.timestamp || row?.received_at || new Date().toISOString(),
    temperature_c: Number(sensors.temperature_c ?? row?.temperature_c ?? 26),
    hrv_ms: Number(sensors.hrv_ms ?? row?.hrv_ms ?? 70),
    jerk_ms3: Number(sensors.jerk_ms3 ?? row?.jerk_ms3 ?? 1.2),
    heart_rate_bpm: Number(sensors.heart_rate_bpm ?? row?.heart_rate_bpm ?? 76),
    spo2_pct: Number(sensors.spo2_pct ?? row?.spo2_pct ?? 98),
    ambient_temp_c: Number(sensors.ambient_temp_c ?? row?.ambient_temp_c ?? 34),
    wbgt_c: Number(sensors.wbgt_c ?? row?.wbgt_c ?? 32.5),
    humidity_pct: Number(sensors.humidity_pct ?? row?.humidity_pct ?? 45),
    gas_ppm: Number(sensors.gas_ppm ?? row?.gas_ppm ?? 8),
    ecg_stress: Number(sensors.ecg_stress ?? row?.ecg_stress ?? 0.16),
    fall_confidence: Number(sensors.fall_confidence ?? row?.fall_confidence ?? 0.02),
    battery_pct: Number(sensors.battery_pct ?? row?.battery_pct ?? 92),
    rssi_dbm: Number(sensors.rssi_dbm ?? row?.rssi_dbm ?? -64),
    lead_off: Boolean(row?.lead_off || sensors?.lead_off || false),
    x: Number(row?.x ?? 50),
    y: Number(row?.y ?? 50),
  };
  const risk = row?.contributions ? row : calculateEdgeRisk(base);
  if (base.lead_off) risk.status = "UNSTRAPPED";
  return { ...base, ...risk };
}

function parseCsvRows(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV must contain a header row and at least one data row.");

  const headers = lines[0].split(",").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return normalizeTelemetry(row);
  });
}

function buildWorkersMap(rows) {
  return rows.reduce((acc, row) => {
    const worker = normalizeTelemetry(row);
    acc[worker.worker_id] = worker;
    return acc;
  }, {});
}

function buildSummary(workers) {
  const rows = Object.values(workers);
  const critical = rows.filter((row) => row.status === "CRITICAL").length;
  const warning = rows.filter((row) => row.status === "WARNING").length;
  const normal = rows.filter((row) => row.status === "NORMAL").length;
  const avgRisk = rows.length ? rows.reduce((sum, row) => sum + row.anomaly_score, 0) / rows.length : 0;
  return {
    workers: rows.length,
    critical,
    warning,
    normal,
    avgRisk,
    activeAlerts: critical,
    siteCount: new Set(rows.map((row) => row.site_id)).size,
  };
}

function SparklineChart({ values, color, height = 130, fill = false }) {
  if (!values || values.length === 0) return <div className="chart-empty">No signal</div>;

  const width = 520;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 20) - 10;
      return `${x},${y}`;
    })
    .join(" ");
  const areaPoints = `${points} ${width},${height} 0,${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sparkline-svg" preserveAspectRatio="none">
      {fill ? <polygon points={areaPoints} fill={color} opacity="0.16" /> : null}
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function EcgWave({ worker }) {
  const width = 620;
  const height = 150;
  const stress = clamp(worker.ecg_stress);
  const points = Array.from({ length: 124 }, (_, index) => {
    const phase = index % 18;
    const baseline = height / 2 + Math.sin(index / 3) * (3 + stress * 4);
    const spike =
      phase === 8 ? -46 - stress * 22 :
        phase === 9 ? 34 + stress * 15 :
          phase === 10 ? -12 : 0;
    return `${(index / 123) * width},${baseline + spike}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="ecg-wave" preserveAspectRatio="none">
      <defs>
        <linearGradient id="ecgGradient" x1="0" x2="1">
          <stop offset="0%" stopColor="#42d69b" />
          <stop offset="55%" stopColor="#f3b33d" />
          <stop offset="100%" stopColor="#ff5d6c" />
        </linearGradient>
      </defs>
      <polyline points={points} fill="none" stroke="url(#ecgGradient)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function MiniBarChart({ values, labels, color }) {
  const max = Math.max(...values, 1);
  return (
    <div className="mini-bar-chart">
      {values.map((value, index) => (
        <div key={labels[index] || index} className="mini-bar-item">
          <div className="mini-bar-track">
            <div className="mini-bar-fill" style={{ height: `${clamp(value / max, 0.08, 1) * 100}%`, background: color }} />
          </div>
          <span>{labels[index]}</span>
        </div>
      ))}
    </div>
  );
}

function DonutRing({ value, label, color }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamp(value));
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 120 120" className="donut-svg">
        <circle cx="60" cy="60" r={radius} className="donut-back" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          className="donut-front"
          style={{ stroke: color, strokeDasharray: `${circumference} ${circumference}`, strokeDashoffset: offset }}
        />
      </svg>
      <div className="donut-center">
        <strong>{formatPercent(value)}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, status }) {
  return (
    <div className={`summary-card ${status}`}>
      <div>
        <span className="label">{label}</span>
        <span className="count">{value}</span>
      </div>
      <span className="mini-dot" />
    </div>
  );
}

function ArchitecturePanel() {
  return (
    <section className="architecture-panel">
      <div className="panel-header">
        <div>
          <span className="panel-title">Product architecture</span>
          <h2>Cloud-independent worker safety loop</h2>
        </div>
        <span className="offline-chip">Zero cloud path</span>
      </div>
      <div className="architecture-flow">
        {ARCHITECTURE_STEPS.map((step, index) => (
          <div key={step.title} className="architecture-step">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step.title}</strong>
            <p>{step.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function getApiHost() {
  return window.location.hostname || "localhost";
}

function getApiPort() {
  if (window.location.port && window.location.port !== "3000" && window.location.port !== "3001") {
    return window.location.port;
  }
  return "8080";
}

function getWsUrl() {
  return `ws://${getApiHost()}:${getApiPort()}`;
}

function getHttpUrl(pathname) {
  return `http://${getApiHost()}:${getApiPort()}${pathname}`;
}

function WorkerMap({ workers, selectedWorkerId, onSelect }) {
  const grouped = useMemo(() => {
    return workers.reduce((acc, worker) => {
      acc[worker.site_id] = acc[worker.site_id] || [];
      acc[worker.site_id].push(worker);
      return acc;
    }, {});
  }, [workers]);

  return (
    <div className="map-panel">
      <div className="panel-subhead">
        <span>Facility Architectural Layout & Node Map</span>
        <strong>{workers.length} SCADA Nodes Active</strong>
      </div>
      <div className="site-map floorplan-mode" role="list" aria-label="Substation architectural worker location map">
        {/* Architectural Substation Blueprint Layout Overlays */}
        <div className="substation-zone zone-hv">
          <span className="zone-tag">⚡ HV Switchgear Yard (500kV)</span>
        </div>
        <div className="substation-zone zone-control">
          <span className="zone-tag">🖥️ Control Room Bay A</span>
        </div>
        <div className="substation-zone zone-transformer">
          <span className="zone-tag">🔌 Transformer Yard B</span>
        </div>
        <div className="substation-zone zone-sf6">
          <span className="zone-tag hazard">☣️ SF6 Breaker Trench</span>
        </div>

        {/* Blueprint Grid Lines */}
        <div className="map-grid-line horizontal top" />
        <div className="map-grid-line horizontal bottom" />
        <div className="map-grid-line vertical left" />
        <div className="map-grid-line vertical right" />

        {Object.entries(grouped).map(([siteId, siteWorkers]) => {
          const x = siteWorkers.reduce((sum, worker) => sum + worker.x, 0) / siteWorkers.length;
          const y = siteWorkers.reduce((sum, worker) => sum + worker.y, 0) / siteWorkers.length;
          const siteRisk = siteWorkers.reduce((sum, worker) => sum + worker.anomaly_score, 0) / siteWorkers.length;
          const meta = getStatusMeta(siteRisk);
          return (
            <div
              key={siteId}
              className="site-cluster"
              style={{ left: `${x}%`, top: `${y}%`, borderColor: meta.color, background: meta.soft }}
            >
              <span>{siteId}</span>
              <strong>{formatPercent(siteRisk)}</strong>
            </div>
          );
        })}

        {workers.map((worker) => {
          const meta = getStatusMeta(worker.status);
          const isSelected = selectedWorkerId === worker.worker_id;
          return (
            <button
              key={worker.worker_id}
              type="button"
              className={`map-worker ${isSelected ? "selected" : ""}`}
              style={{ left: `${clamp(worker.x, 5, 95)}%`, top: `${clamp(worker.y, 8, 90)}%`, color: meta.color }}
              onClick={() => onSelect(worker.worker_id)}
              aria-label={`Open ${worker.worker_id}`}
              title={`${worker.worker_id} - ${worker.zone} (${meta.label} Risk)`}
            >
              <span style={{ background: meta.color, boxShadow: `0 0 12px ${meta.color}` }} />
              <div className="worker-map-tooltip">
                <strong>{worker.worker_id}</strong>
                <span>{worker.zone}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WorkerRoster({ workers, selectedWorkerId, onSelect }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredWorkers = useMemo(() => {
    return workers.filter((worker) => {
      const matchesSearch =
        worker.worker_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        worker.zone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        worker.site_id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || worker.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [workers, searchQuery, statusFilter]);

  return (
    <div className="roster-panel">
      <div className="panel-subhead">
        <span>Indian Plant Worker Roster</span>
        <strong>{filteredWorkers.length} / {workers.length}</strong>
      </div>

      <div className="roster-controls" style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
        <input
          type="text"
          className="roster-search-input"
          placeholder="🔍 Search Worker ID / Zone / Plant..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div style={{ display: "flex", gap: "4px" }}>
          {["ALL", "CRITICAL", "WARNING", "NORMAL"].map((status) => (
            <button
              key={status}
              type="button"
              className={`preset-btn ${statusFilter === status ? "active" : ""}`}
              style={{ flex: 1, padding: "3px 4px", fontSize: "0.7rem", opacity: statusFilter === status ? 1 : 0.6 }}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="worker-roster">
        {filteredWorkers.map((worker) => {
          const meta = getStatusMeta(worker.status);
          return (
            <button
              key={worker.worker_id}
              type="button"
              className={`worker-row ${selectedWorkerId === worker.worker_id ? "selected" : ""}`}
              onClick={() => onSelect(worker.worker_id)}
            >
              <span className="worker-dot" style={{ background: meta.color, boxShadow: `0 0 14px ${meta.color}` }} />
              <span className="worker-name">{worker.worker_id}</span>
              <span className="worker-site">{worker.zone}</span>
              <span className={`status-pill ${meta.tone}`}>{meta.label}</span>
              <strong>{formatPercent(worker.anomaly_score)}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ContributionBars({ contributions }) {
  const rows = [
    ["Heat index", contributions.heat, "#ef8f4c"],
    ["HRV fatigue", contributions.fatigue, "#e2c75b"],
    ["ECG stress", contributions.cardiac, "#ff5d6c"],
    ["Toxic exposure", contributions.exposure, "#58c8f6"],
    ["Motion/fall", contributions.motion, "#42d69b"],
  ];

  return (
    <div className="model-bars">
      {rows.map(([label, value, color]) => (
        <div key={label}>
          <span>{label}</span>
          <i><b style={{ width: `${clamp(value) * 100}%`, background: color }} /></i>
          <strong>{formatPercent(value)}</strong>
        </div>
      ))}
    </div>
  );
}

function WorkerDetail({ worker, timeline, onRunScenario, onViewReport }) {
  const meta = getStatusMeta(worker.status);
  return (
    <section className="worker-detail">
      <div className="detail-header">
        <div>
          <span className="panel-title">Worker detail</span>
          <h2>{worker.worker_id}</h2>
          <p>{worker.site_id} / {worker.zone} / {worker.device_id}</p>
        </div>
        <div className="detail-actions">
          <button type="button" className="scenario-button" style={{ background: "rgba(88,200,246,0.15)", borderColor: "#58c8f6", color: "#58c8f6" }} onClick={() => onViewReport(worker)}>📜 DGMS Audit Form IV</button>
          <button type="button" className="scenario-button" onClick={() => onRunScenario(worker.worker_id)}>🚨 Run Emergency SOS</button>
          <span className={`status-badge big ${meta.tone}`}>{meta.label}</span>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-metric"><span>Edge AI risk</span><strong style={{ color: meta.color }}>{formatPercent(worker.anomaly_score)}</strong></div>
        <div className="detail-metric"><span>ECG/heart rate</span><strong>{worker.heart_rate_bpm.toFixed(0)} bpm</strong></div>
        <div className="detail-metric"><span>HRV fatigue</span><strong>{worker.hrv_ms.toFixed(1)} ms</strong></div>
        <div className="detail-metric"><span>IS 14489 WBGT Heat</span><strong>{(worker.wbgt_c || worker.ambient_temp_c).toFixed(1)} °C</strong></div>
        <div className="detail-metric"><span>SpO2 level</span><strong>{worker.spo2_pct.toFixed(1)}%</strong></div>
        <div className="detail-metric"><span>Sensirion Toxic Gas</span><strong>{worker.gas_ppm.toFixed(0)} ppm</strong></div>
        <div className="detail-metric"><span>Wearable Battery</span><strong>🔋 {worker.battery_pct}%</strong></div>
        <div className="detail-metric"><span>LoRa Signal Strength</span><strong>📡 {worker.rssi_dbm} dBm</strong></div>
      </div>

      <div className="detail-visuals">
        <div className="risk-card">
          <DonutRing value={worker.anomaly_score} label="Risk" color={meta.color} />
          <div className="detail-meta">
            <p><strong>Model</strong><span>{worker.model_version}</span></p>
            <p><strong>Alert flag</strong><span>{formatAlertFlag(worker.alert_flag)}</span></p>
            <p><strong>Beacon</strong><span>{worker.beacon_protocol}</span></p>
            <p><strong>Lead Status</strong><span>{worker.lead_off ? "⚠️ Unstrapped" : "✅ Contact Pass"}</span></p>
          </div>
        </div>

        <div className="vitals-panel">
          <div className="panel-subhead">
            <span>ECG waveform simulation</span>
            <strong>{worker.ecg_stress.toFixed(2)} stress</strong>
          </div>
          <EcgWave worker={worker} />
          <ContributionBars contributions={worker.contributions || {}} />
        </div>
      </div>

      <div className="signal-panel">
        <div className="panel-subhead">
          <span>Site risk timeline</span>
          <strong>{timeline.length} samples</strong>
        </div>
        <SparklineChart values={timeline} color={meta.color} fill />
      </div>
    </section>
  );
}

function BeaconTimeline({ beacons, topIncident, onSelect }) {
  const items = beacons.length
    ? beacons
    : topIncident
      ? [{
        id: "preview",
        worker_id: topIncident.worker_id,
        site_id: topIncident.site_id,
        zone: topIncident.zone,
        protocol: topIncident.beacon_protocol,
        local_alarm: topIncident.status === "CRITICAL",
        gateway: `${topIncident.site_id}_INTRANET_GATEWAY`,
        timestamp: topIncident.timestamp,
      }]
      : [];

  return (
    <div className="system-card">
      <span className="panel-title">Offline beacon timeline</span>
      <div className="beacon-list">
        {items.map((item) => (
          <button key={item.id} type="button" className="beacon-item" onClick={() => onSelect(item.worker_id)}>
            <div><strong>{item.worker_id}</strong><span>{formatTime(item.timestamp)}</span></div>
            <p>{item.protocol} via {item.gateway}</p>
            <em>{item.local_alarm ? "Haptic/audio alarm active" : "Heartbeat packet"}</em>
          </button>
        ))}
      </div>
    </div>
  );
}

function ShiftHandoverPanel({ activeShift, onShiftChange, workers, lang }) {
  const [checklist, setChecklist] = useState({
    gasSensorsCalibrated: true,
    loraGatewayVerified: true,
    medicalKitsStocked: true,
    ppeHelmetsInspected: true,
  });

  const shiftWorkers = Object.values(workers);
  const criticalCount = shiftWorkers.filter((w) => w.status === "CRITICAL").length;
  const warningCount = shiftWorkers.filter((w) => w.status === "WARNING" || w.status === "UNSTRAPPED").length;
  const t = I18N[lang || "en"];

  return (
    <div className="analytics-panel" style={{ padding: "20px", marginBottom: "20px" }}>
      <div className="panel-header">
        <span className="eyebrow">DGMS CMR 2017 / FACTORIES ACT 1948 COMPLIANT</span>
        <h2>{t.shiftHandoverTitle}</h2>
      </div>

      <div style={{ display: "flex", gap: "10px", margin: "16px 0" }}>
        {["Shift A (06:00 - 14:00IST Morning)", "Shift B (14:00 - 22:00IST Evening)", "Shift C (22:00 - 06:00IST Night)"].map((s) => (
          <button
            key={s}
            type="button"
            className={`preset-btn ${activeShift === s ? "active" : ""}`}
            style={{ flex: 1, padding: "10px", fontSize: "0.85rem" }}
            onClick={() => onShiftChange(s)}
          >
            {s.includes("Shift A") ? "🌅 " : s.includes("Shift B") ? "🌆 " : "🌙 "} {s}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div className="metric-box">
          <span className="label">SHIFT INCIDENT & RISK SUMMARY</span>
          <strong style={{ fontSize: "1.2rem", color: criticalCount > 0 ? "#ff5d6c" : "#42d69b" }}>
            🚨 {criticalCount} Critical Incidents | ⚠️ {warningCount} Warning Hazards
          </strong>
        </div>

        <div className="metric-box">
          <span className="label">MANDATORY SHIFT SAFETY CHECKLIST</span>
          <div style={{ display: "grid", gap: "6px", marginTop: "6px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem" }}>
              <input type="checkbox" checked={checklist.gasSensorsCalibrated} onChange={(e) => setChecklist({ ...checklist, gasSensorsCalibrated: e.target.checked })} />
              <span>Sensirion SF6 / Toxic Gas Sensors Zero-Calibrated</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem" }}>
              <input type="checkbox" checked={checklist.loraGatewayVerified} onChange={(e) => setChecklist({ ...checklist, loraGatewayVerified: e.target.checked })} />
              <span>LoRaWAN / BLE Air-Gapped Base Station Connectivity Verified</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmergencySosModal({ criticalWorker, onClose, lang }) {
  const [sirenActive] = useState(true);
  const [ambulanceAlert] = useState(true);
  const t = I18N[lang || "en"];

  if (!criticalWorker) return null;

  return (
    <div className="incident-report-overlay">
      <div className="incident-report-modal" style={{ maxWidth: "580px", border: "2px solid #ff5d6c", boxShadow: "0 0 30px rgba(255,93,108,0.4)" }}>
        <div className="report-header" style={{ borderBottom: "1px solid rgba(255,93,108,0.3)" }}>
          <div className="report-brand">
            <span className="scada-logo" style={{ color: "#ff5d6c" }}>🚨 AUTOMATED SCADA ESCALATION WORKFLOW</span>
            <h2 style={{ color: "#ff5d6c" }}>{t.emergencySosTitle}</h2>
          </div>
          <button type="button" className="preset-btn reset" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: "16px 0", display: "grid", gap: "12px" }}>
          <div className="metric-box" style={{ background: "rgba(255,93,108,0.12)", borderColor: "#ff5d6c" }}>
            <span className="label" style={{ color: "#ff5d6c" }}>VICTIM WORKER IDENTIFICATION</span>
            <strong style={{ fontSize: "1.3rem", color: "#ff5d6c" }}>
              {criticalWorker.name || criticalWorker.worker_id} ({criticalWorker.zone})
            </strong>
            <p style={{ fontSize: "0.85rem", marginTop: "4px", color: "var(--text)" }}>
              Hazard: {criticalWorker.lead_off ? "Sensor Unstrapped / Lead-Off" : `Anomaly Score: ${(criticalWorker.anomaly_score * 100).toFixed(1)}% | WBGT: ${(criticalWorker.wbgt_c || criticalWorker.ambient_temp_c).toFixed(1)}°C`}
            </p>
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: "6px", border: "1px solid var(--line)" }}>
              <span>{t.ambulanceCall}</span>
              <span className="sec-chip pass">{ambulanceAlert ? "DISPATCHED" : "PENDING"}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: "6px", border: "1px solid var(--line)" }}>
              <span>{t.sirenCommand}</span>
              <span className="sec-chip pass">{sirenActive ? "RELAY ACTIVE (880Hz)" : "OFF"}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: "6px", border: "1px solid var(--line)" }}>
              <span>📲 {t.dispatchLog}</span>
              <span className="sec-chip pass">SENT (+91-9876543210)</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button type="button" className="preset-btn emergency" style={{ flex: 1, padding: "10px" }} onClick={onClose}>
            ✅ Acknowledge & Dispatch Rapid Response Team
          </button>
        </div>
      </div>
    </div>
  );
}

function VitalsGridDashboard() {
  const [userSession, setUserSession] = useState(() => {
    try {
      const saved = localStorage.getItem("vitalsgrid_session");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [lang, setLang] = useState("en"); // "en" | "hi"
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "shift" | "studio" | "security"
  const [activeShift, setActiveShift] = useState("Shift A (06:00 - 14:00IST Morning)");
  const [workers, setWorkers] = useState({});
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("dataset");
  const [messageCount, setMessageCount] = useState(0);
  const [alertingWorkers, setAlertingWorkers] = useState(new Set());
  const [dataMode, setDataMode] = useState("dataset");
  const [reportWorker, setReportWorker] = useState(null);
  const [sosWorker, setSosWorker] = useState(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const voiceLang = lang === "hi" ? "hi-IN" : "en-IN";
  const [sunlightMode, setSunlightMode] = useState(false);
  const [datasetRows, setDatasetRows] = useState([]);
  const [datasetIndex, setDatasetIndex] = useState(0);
  const [datasetLoaded, setDatasetLoaded] = useState(false);
  const [csvError, setCsvError] = useState("");
  const [beacons, setBeacons] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimeout = useRef(null);
  const spokenAlertsRef = useRef(new Map());
  const workerHistoryRef = useRef(new Map());

  const handleSignOut = useCallback(() => {
    try {
      localStorage.removeItem("vitalsgrid_session");
    } catch (e) { }
    setUserSession(null);
  }, []);

  const stopAllSpeech = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      if (!next) {
        stopAllSpeech();
      }
      return next;
    });
  }, [stopAllSpeech]);

  const speakPAAnnouncement = useCallback((workerId, zone) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    const now = Date.now();
    const lastSpoken = spokenAlertsRef.current.get(workerId) || 0;

    if (now - lastSpoken < 25000) return;
    spokenAlertsRef.current.set(workerId, now);

    try {
      window.speechSynthesis.cancel();
      const text = voiceLang === "hi-IN"
        ? `सावधान! ${workerId} पर ${zone} में आपातकालीन खतरा दर्ज हुआ है! लोकल अलार्म सक्रिय है।`
        : `Critical safety alert for ${workerId} at ${zone}. Local alarm active.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voiceLang;
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) { }
  }, [voiceEnabled, voiceLang]);

  const applyPayload = useCallback((payload) => {
    const worker = normalizeTelemetry(payload);
    setWorkers((prev) => ({ ...prev, [worker.worker_id]: worker }));
    setSelectedWorkerId((prev) => prev || worker.worker_id);

    const history = workerHistoryRef.current.get(worker.worker_id) || [];
    workerHistoryRef.current.set(worker.worker_id, [...history, worker.anomaly_score].slice(-20));

    if (worker.status === "CRITICAL") {
      setAlertingWorkers((prev) => new Set(prev).add(worker.worker_id));
      speakPAAnnouncement(worker.worker_id, worker.zone);
      setTimeout(() => {
        setAlertingWorkers((prev) => {
          const next = new Set(prev);
          next.delete(worker.worker_id);
          return next;
        });
      }, 1100);
    }
    setMessageCount((prev) => prev + 1);
  }, [speakPAAnnouncement]);

  const addBeacon = useCallback((worker) => {
    if (worker.status !== "CRITICAL") return;
    setBeacons((prev) => [{
      id: `BEACON_${Date.now()}_${worker.worker_id}`,
      worker_id: worker.worker_id,
      site_id: worker.site_id,
      zone: worker.zone,
      protocol: worker.beacon_protocol,
      gateway: `${worker.site_id}_INTRANET_GATEWAY`,
      local_alarm: true,
      timestamp: new Date().toISOString(),
    }, ...prev].slice(0, 8));
  }, []);

  const handleSendOverride = useCallback((workerId, params) => {
    const current = workers[workerId] || {};
    const updated = normalizeTelemetry({ ...current, ...params, worker_id: workerId });
    applyPayload(updated);
    addBeacon(updated);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "hardware_override", type: "hardware_override", worker_id: workerId, params }));
    }
    fetch(getHttpUrl("/api/hardware-override"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worker_id: workerId, params }),
    }).catch(() => { });
  }, [addBeacon, applyPayload, workers]);

  const loadRows = useCallback((rows) => {
    const normalizedRows = rows.map(normalizeTelemetry);
    const nextWorkers = buildWorkersMap(normalizedRows);
    setDatasetRows(normalizedRows);
    setWorkers(nextWorkers);
    setDatasetIndex(0);
    setDatasetLoaded(normalizedRows.length > 0);
    setCsvError("");
    setDataMode("dataset");
    setSelectedWorkerId((prev) => (prev && nextWorkers[prev] ? prev : normalizedRows[0]?.worker_id || ""));
  }, []);

  const handleCsvUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        loadRows(parseCsvRows(typeof e.target?.result === "string" ? e.target.result : ""));
      } catch (error) {
        setCsvError(error.message || "Unable to parse CSV file.");
      }
    };
    reader.onerror = () => setCsvError("CSV file could not be read.");
    reader.readAsText(file);
  }, [loadRows]);

const DEFAULT_TELEMETRY_ROWS = [
  { worker_id: "WORKER_001", site_id: "SITE_A", zone: "Hot Aisle", device_id: "EDGE_A1", timestamp: "2026-08-28T10:00:00Z", temperature_c: 42.1, hrv_ms: 25.0, jerk_ms3: 2.80, heart_rate_bpm: 142, spo2_pct: 91.2, ambient_temp_c: 41.0, humidity_pct: 64, gas_ppm: 55, ecg_stress: 0.76, fall_confidence: 0.10, x: 12, y: 22 },
  { worker_id: "WORKER_002", site_id: "SITE_A", zone: "Cable Trench", device_id: "EDGE_A2", timestamp: "2026-08-28T10:01:00Z", temperature_c: 41.5, hrv_ms: 29.0, jerk_ms3: 1.55, heart_rate_bpm: 135, spo2_pct: 90.8, ambient_temp_c: 40.0, humidity_pct: 60, gas_ppm: 58, ecg_stress: 0.72, fall_confidence: 0.07, x: 18, y: 31 },
  { worker_id: "WORKER_003", site_id: "SITE_A", zone: "Transformer Bay", device_id: "EDGE_A3", timestamp: "2026-08-28T10:02:00Z", temperature_c: 36.2, hrv_ms: 42.0, jerk_ms3: 2.00, heart_rate_bpm: 110, spo2_pct: 95.2, ambient_temp_c: 35.0, humidity_pct: 52, gas_ppm: 38, ecg_stress: 0.48, fall_confidence: 0.05, x: 24, y: 35 },
  { worker_id: "WORKER_004", site_id: "SITE_B", zone: "Boiler Room", device_id: "EDGE_B1", timestamp: "2026-08-28T10:03:00Z", temperature_c: 35.8, hrv_ms: 44.0, jerk_ms3: 1.90, heart_rate_bpm: 108, spo2_pct: 95.8, ambient_temp_c: 34.5, humidity_pct: 50, gas_ppm: 36, ecg_stress: 0.45, fall_confidence: 0.04, x: 29, y: 44 },
  { worker_id: "WORKER_005", site_id: "SITE_B", zone: "Underground Silo", device_id: "EDGE_B2", timestamp: "2026-08-28T10:04:00Z", temperature_c: 36.0, hrv_ms: 41.5, jerk_ms3: 2.10, heart_rate_bpm: 112, spo2_pct: 95.0, ambient_temp_c: 35.2, humidity_pct: 54, gas_ppm: 40, ecg_stress: 0.50, fall_confidence: 0.06, x: 38, y: 69 },
  { worker_id: "WORKER_006", site_id: "SITE_B", zone: "Transformer Bay", device_id: "EDGE_B3", timestamp: "2026-08-28T10:05:00Z", temperature_c: 24.4, hrv_ms: 78.3, jerk_ms3: 1.10, heart_rate_bpm: 73, spo2_pct: 98.5, ambient_temp_c: 29.2, humidity_pct: 38, gas_ppm: 5, ecg_stress: 0.12, fall_confidence: 0.02, x: 43, y: 74 },
  { worker_id: "WORKER_007", site_id: "SITE_C", zone: "Relay Room", device_id: "EDGE_C1", timestamp: "2026-08-28T10:06:00Z", temperature_c: 23.2, hrv_ms: 80.6, jerk_ms3: 1.42, heart_rate_bpm: 74, spo2_pct: 98.4, ambient_temp_c: 29.0, humidity_pct: 39, gas_ppm: 6, ecg_stress: 0.12, fall_confidence: 0.02, x: 48, y: 63 },
  { worker_id: "WORKER_008", site_id: "SITE_C", zone: "Relay Room", device_id: "EDGE_C2", timestamp: "2026-08-28T10:07:00Z", temperature_c: 21.9, hrv_ms: 78.4, jerk_ms3: 1.35, heart_rate_bpm: 75, spo2_pct: 98.8, ambient_temp_c: 28.3, humidity_pct: 36, gas_ppm: 5, ecg_stress: 0.11, fall_confidence: 0.01, x: 53, y: 25 },
  { worker_id: "WORKER_009", site_id: "SITE_C", zone: "Battery Room", device_id: "EDGE_C3", timestamp: "2026-08-28T10:08:00Z", temperature_c: 24.5, hrv_ms: 74.3, jerk_ms3: 1.35, heart_rate_bpm: 76, spo2_pct: 98.1, ambient_temp_c: 30.4, humidity_pct: 42, gas_ppm: 8, ecg_stress: 0.16, fall_confidence: 0.03, x: 59, y: 32 },
  { worker_id: "WORKER_010", site_id: "SITE_D", zone: "Switch Yard", device_id: "EDGE_D1", timestamp: "2026-08-28T10:09:00Z", temperature_c: 25.1, hrv_ms: 73.8, jerk_ms3: 1.44, heart_rate_bpm: 77, spo2_pct: 98.0, ambient_temp_c: 31.0, humidity_pct: 43, gas_ppm: 7, ecg_stress: 0.17, fall_confidence: 0.03, x: 64, y: 39 },
  { worker_id: "WORKER_011", site_id: "SITE_D", zone: "Switch Yard", device_id: "EDGE_D2", timestamp: "2026-08-28T10:10:00Z", temperature_c: 24.8, hrv_ms: 72.7, jerk_ms3: 1.25, heart_rate_bpm: 75, spo2_pct: 98.2, ambient_temp_c: 30.8, humidity_pct: 41, gas_ppm: 6, ecg_stress: 0.15, fall_confidence: 0.02, x: 70, y: 57 },
  { worker_id: "WORKER_012", site_id: "SITE_D", zone: "Control Room", device_id: "EDGE_D3", timestamp: "2026-08-28T10:11:00Z", temperature_c: 22.7, hrv_ms: 74.9, jerk_ms3: 1.65, heart_rate_bpm: 81, spo2_pct: 98.0, ambient_temp_c: 30.1, humidity_pct: 41, gas_ppm: 8, ecg_stress: 0.17, fall_confidence: 0.03, x: 76, y: 65 },
  { worker_id: "WORKER_013", site_id: "SITE_E", zone: "SCADA Hut", device_id: "EDGE_E1", timestamp: "2026-08-28T10:12:00Z", temperature_c: 23.9, hrv_ms: 79.2, jerk_ms3: 1.29, heart_rate_bpm: 76, spo2_pct: 98.4, ambient_temp_c: 29.8, humidity_pct: 38, gas_ppm: 6, ecg_stress: 0.12, fall_confidence: 0.02, x: 82, y: 70 },
  { worker_id: "WORKER_014", site_id: "SITE_E", zone: "SCADA Hut", device_id: "EDGE_E2", timestamp: "2026-08-28T10:13:00Z", temperature_c: 24.6, hrv_ms: 72.1, jerk_ms3: 1.32, heart_rate_bpm: 77, spo2_pct: 98.1, ambient_temp_c: 30.9, humidity_pct: 42, gas_ppm: 7, ecg_stress: 0.16, fall_confidence: 0.03, x: 84, y: 31 },
  { worker_id: "WORKER_015", site_id: "SITE_E", zone: "Transformer Bay", device_id: "EDGE_E3", timestamp: "2026-08-28T10:14:00Z", temperature_c: 25.9, hrv_ms: 70.6, jerk_ms3: 1.45, heart_rate_bpm: 80, spo2_pct: 97.9, ambient_temp_c: 32.2, humidity_pct: 46, gas_ppm: 9, ecg_stress: 0.20, fall_confidence: 0.04, x: 89, y: 40 },
  { worker_id: "WORKER_016", site_id: "SITE_F", zone: "Cable Gallery", device_id: "EDGE_F1", timestamp: "2026-08-28T10:15:00Z", temperature_c: 22.2, hrv_ms: 83.2, jerk_ms3: 1.27, heart_rate_bpm: 71, spo2_pct: 98.9, ambient_temp_c: 28.0, humidity_pct: 37, gas_ppm: 5, ecg_stress: 0.09, fall_confidence: 0.01, x: 92, y: 49 },
  { worker_id: "WORKER_017", site_id: "SITE_F", zone: "Cable Gallery", device_id: "EDGE_F2", timestamp: "2026-08-28T10:16:00Z", temperature_c: 23.5, hrv_ms: 75.1, jerk_ms3: 1.73, heart_rate_bpm: 82, spo2_pct: 97.9, ambient_temp_c: 30.8, humidity_pct: 44, gas_ppm: 8, ecg_stress: 0.19, fall_confidence: 0.04, x: 14, y: 57 },
  { worker_id: "WORKER_018", site_id: "SITE_F", zone: "Hot Aisle", device_id: "EDGE_F3", timestamp: "2026-08-28T10:17:00Z", temperature_c: 24.7, hrv_ms: 75.4, jerk_ms3: 1.32, heart_rate_bpm: 76, spo2_pct: 98.1, ambient_temp_c: 30.2, humidity_pct: 41, gas_ppm: 6, ecg_stress: 0.15, fall_confidence: 0.03, x: 19, y: 64 },
  { worker_id: "WORKER_019", site_id: "SITE_G", zone: "Control Room", device_id: "EDGE_G1", timestamp: "2026-08-28T10:18:00Z", temperature_c: 23.5, hrv_ms: 78.2, jerk_ms3: 1.25, heart_rate_bpm: 74, spo2_pct: 98.5, ambient_temp_c: 28.2, humidity_pct: 38, gas_ppm: 5, ecg_stress: 0.11, fall_confidence: 0.01, x: 25, y: 72 },
  { worker_id: "WORKER_020", site_id: "SITE_G", zone: "Switchgear Room", device_id: "EDGE_G2", timestamp: "2026-08-28T10:19:00Z", temperature_c: 24.1, hrv_ms: 76.5, jerk_ms3: 1.30, heart_rate_bpm: 76, spo2_pct: 98.2, ambient_temp_c: 29.1, humidity_pct: 40, gas_ppm: 6, ecg_stress: 0.13, fall_confidence: 0.02, x: 31, y: 79 },
];

  useEffect(() => {
    fetch(getHttpUrl("/api/dataset"))
      .then((response) => (response.ok ? response.json() : []))
      .then((rows) => {
        if (Array.isArray(rows) && rows.length > 0) {
          loadRows(rows);
        } else {
          loadRows(DEFAULT_TELEMETRY_ROWS);
        }
      })
      .catch(() => {
        loadRows(DEFAULT_TELEMETRY_ROWS);
      });
  }, [loadRows]);

  const connectWebSocket = useCallback(() => {
    if (dataMode !== "live") return;
    setConnectionStatus("connecting");
    try {
      const ws = new WebSocket(getWsUrl());
      ws.onopen = () => setConnectionStatus("connected");
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "worker_update") applyPayload(message.payload);
          if (message.type === "beacon_event") setBeacons((prev) => [message.payload, ...prev].slice(0, 8));
        } catch (error) {
          console.error("WebSocket payload parse failed", error);
        }
      };
      ws.onerror = () => setConnectionStatus("offline");
      ws.onclose = () => {
        setConnectionStatus("offline");
        reconnectTimeout.current = setTimeout(() => connectWebSocket(), 3000);
      };
      wsRef.current = ws;
    } catch (error) {
      console.error("WebSocket connection error:", error);
      setConnectionStatus("offline");
    }
  }, [applyPayload, dataMode]);

  useEffect(() => {
    if (dataMode === "live") {
      connectWebSocket();
      return () => {
        if (wsRef.current) wsRef.current.close();
        if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      };
    }
    if (wsRef.current) wsRef.current.close();
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    wsRef.current = null;
    reconnectTimeout.current = null;
    setConnectionStatus("dataset");
    return undefined;
  }, [connectWebSocket, dataMode]);

  useEffect(() => {
    if (dataMode !== "dataset" || datasetRows.length === 0) return undefined;
    const interval = setInterval(() => {
      const row = datasetRows[datasetIndex];
      if (!row) return;
      const worker = normalizeTelemetry({ ...row, timestamp: new Date().toISOString() });
      applyPayload(worker);
      addBeacon(worker);
      setDatasetIndex((prev) => (prev + 1) % datasetRows.length);
    }, 1600);
    return () => clearInterval(interval);
  }, [addBeacon, applyPayload, dataMode, datasetIndex, datasetRows]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const runEmergencyScenario = useCallback((workerId) => {
    const current = workers[workerId];
    if (!current) return;
    const escalated = normalizeTelemetry({
      ...current,
      timestamp: new Date().toISOString(),
      temperature_c: Math.max(current.temperature_c, 29.4),
      hrv_ms: Math.min(current.hrv_ms, 31.5),
      jerk_ms3: Math.max(current.jerk_ms3, 4.75),
      heart_rate_bpm: Math.max(current.heart_rate_bpm, 128),
      spo2_pct: Math.min(current.spo2_pct, 91.5),
      ambient_temp_c: Math.max(current.ambient_temp_c, 41.2),
      humidity_pct: Math.max(current.humidity_pct, 70),
      gas_ppm: Math.max(current.gas_ppm, 58),
      ecg_stress: Math.max(current.ecg_stress, 0.88),
      fall_confidence: Math.max(current.fall_confidence, 0.66),
    });
    applyPayload(escalated);
    addBeacon(escalated);
    setSosWorker(escalated);
    setSelectedWorkerId(escalated.worker_id);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "emergency_scenario", worker_id: escalated.worker_id }));
    }
  }, [addBeacon, applyPayload, workers]);

  const workerList = useMemo(() => {
    return Object.values(workers).sort((a, b) => {
      if (b.anomaly_score !== a.anomaly_score) return b.anomaly_score - a.anomaly_score;
      return a.worker_id.localeCompare(b.worker_id);
    });
  }, [workers]);

  const summary = useMemo(() => buildSummary(workers), [workers]);
  const selectedWorker = workers[selectedWorkerId] || workerList[0] || normalizeTelemetry({});
  const selectedMeta = getStatusMeta(selectedWorker.status);
  const riskPercent = Math.min(100, (summary.avgRisk || 0) * 100);
  const topIncident = workerList.find((worker) => worker.status === "CRITICAL") || workerList[0];
  const inrRiskSavedLakhs = ((summary.critical * 1.8) + (summary.warning * 0.4)).toFixed(1);

  const siteBreakdown = useMemo(() => workerList.reduce((acc, row) => {
    acc[row.site_id] = (acc[row.site_id] || 0) + 1;
    return acc;
  }, {}), [workerList]);
  const siteLabels = Object.keys(siteBreakdown).slice(0, 6);
  const siteValues = siteLabels.map((site) => siteBreakdown[site]);
  const exposureBins = [0, 12, 24, 36, 48, 60].map((bin) => ({
    label: `${bin}`,
    value: workerList.filter((row) => row.gas_ppm >= bin && row.gas_ppm < bin + 12).length,
  }));
  const trendValues = workerList.slice(0, 14).reverse().map((row) => row.anomaly_score);
  const workerTimeline = useMemo(() => {
    const historical = workerHistoryRef.current.get(selectedWorker.worker_id);
    if (historical && historical.length >= 2) return historical;
    const sameSite = datasetRows.filter((row) => row.site_id === selectedWorker.site_id).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const values = sameSite.map((row) => row.anomaly_score);
    return values.length > 2 ? values : trendValues;
  }, [datasetRows, selectedWorker.site_id, selectedWorker.worker_id, trendValues]);

  const t = I18N[lang || "en"];

  if (!userSession) {
    return <Login onLoginSuccess={(session) => setUserSession(session)} />;
  }

  return (
    <div className={`dashboard-shell ${sunlightMode ? "sunlight-mode" : ""}`}>
      {/* Incident Audit Report Modal */}
      {reportWorker && <IncidentReport worker={reportWorker} onClose={() => setReportWorker(null)} />}

      {/* Emergency SOS Escalation Modal */}
      {sosWorker && <EmergencySosModal criticalWorker={sosWorker} onClose={() => setSosWorker(null)} lang={lang} />}

      {/* Header Bar */}
      <header className="dashboard-header">
        <div className="brand-block">
          <div className="brand-title-row">
            <div className="brand-mark" aria-hidden="true">V</div>
            <div>
              <h1>VitalsGrid SCADA Control Hub</h1>
              <p className="brand-subtitle">{t.brandSubtitle}</p>
            </div>
          </div>
        </div>
        <div className="header-metrics">
          <div className="metric-box"><span className="label">{t.operator}</span><strong>{userSession.username}</strong></div>
          <div className="metric-box"><span className="label">Saved Risk</span><strong style={{ color: "#42d69b" }}>₹{inrRiskSavedLakhs}L</strong></div>
          <div className="metric-box"><span className="label">Network</span><strong>{connectionStatus === "connected" ? "Intranet online" : connectionStatus}</strong></div>
          <div className="metric-box"><span className="label">Packets</span><strong>{messageCount}</strong></div>
          <button
            type="button"
            className="preset-btn"
            style={{ borderColor: "rgba(255, 93, 108, 0.4)", color: "#ff8e99" }}
            onClick={handleSignOut}
          >
            🔒 Sign Out
          </button>
        </div>
      </header>

      {/* Navigation View Tab Bar */}
      <nav className="view-nav-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="nav-tabs" style={{ display: "flex", gap: "8px" }}>
          <button type="button" className={`nav-tab-btn ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>{t.tabOverview}</button>
          <button type="button" className={`nav-tab-btn ${activeTab === "shift" ? "active" : ""}`} onClick={() => setActiveTab("shift")}>{t.tabShift}</button>
          <button type="button" className={`nav-tab-btn ${activeTab === "studio" ? "active" : ""}`} onClick={() => setActiveTab("studio")}>{t.tabStudio}</button>
          <button type="button" className={`nav-tab-btn ${activeTab === "security" ? "active" : ""}`} onClick={() => setActiveTab("security")}>{t.tabSecurity}</button>
        </div>

        <div className="banner-actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button type="button" className="preset-btn" style={{ borderColor: "#58c8f6", color: "#58c8f6" }} onClick={() => setLang(lang === "en" ? "hi" : "en")}>
            {t.langToggle}
          </button>
          <button
            type="button"
            className={`audio-btn ${sunlightMode ? "active" : ""}`}
            onClick={() => setSunlightMode(!sunlightMode)}
          >
            {sunlightMode ? "☀️ High-Contrast Sun" : "🌙 Dark Mode"}
          </button>
          <button
            type="button"
            className={`audio-btn ${voiceEnabled ? "active" : "muted"}`}
            onClick={toggleVoice}
          >
            {voiceEnabled ? "📢 PA Voice Active" : "🔇 PA Voice Muted"}
          </button>
        </div>
      </nav>

      {activeTab === "shift" ? (
        <ShiftHandoverPanel activeShift={activeShift} onShiftChange={setActiveShift} workers={workers} lang={lang} />
      ) : activeTab === "studio" ? (
        <HardwareStudio
          selectedWorker={selectedWorker}
          onSendOverride={handleSendOverride}
          isSimulating={dataMode === "live"}
        />
      ) : activeTab === "security" ? (
        <SecurityPanel />
      ) : (
        <>
          <section className="summary-strip">
            <SummaryCard label={t.criticalCount} value={summary.critical || 0} status="critical" />
            <SummaryCard label={t.warningCount} value={summary.warning || 0} status="warning" />
            <SummaryCard label={t.normalCount} value={summary.normal || 0} status="normal" />
            <SummaryCard label={t.avgRisk} value={formatPercent(summary.avgRisk || 0)} status="system" />
          </section>

          <ArchitecturePanel />

          <main className="dashboard-layout">
            <section className="operations-area">
              <div className="topology-panel">
                <div className="panel-header">
                  <div>
                    <span className="panel-title">Operations overview</span>
                    <h2>Facility telemetry and risk map</h2>
                  </div>
                  <div className="mode-toggle">
                    <button type="button" className={dataMode === "dataset" ? "active" : ""} onClick={() => setDataMode("dataset")} disabled={!datasetLoaded}>Dataset</button>
                    <button type="button" className={dataMode === "live" ? "active" : ""} onClick={() => setDataMode("live")}>Live</button>
                  </div>
                </div>

                <div className="visual-grid">
                  <WorkerMap workers={workerList} selectedWorkerId={selectedWorker.worker_id} onSelect={setSelectedWorkerId} />
                  <div className="analytics-stack">
                    <div className="analytics-panel">
                      <div className="panel-subhead"><span>Computed risk trend</span><strong>{trendValues.length ? formatPercent(trendValues[trendValues.length - 1]) : "0.0%"}</strong></div>
                      <SparklineChart values={trendValues} color="#58c8f6" fill />
                    </div>
                    <div className="small-chart-grid">
                      <div className="analytics-panel">
                        <div className="panel-subhead"><span>Sites</span><strong>{siteLabels.length}</strong></div>
                        <MiniBarChart values={siteValues} labels={siteLabels} color="#42d69b" />
                      </div>
                      <div className="analytics-panel">
                        <div className="panel-subhead"><span>Gas ppm spread</span><strong>{Math.max(...exposureBins.map((bin) => bin.value), 0)}</strong></div>
                        <MiniBarChart values={exposureBins.map((bin) => bin.value)} labels={exposureBins.map((bin) => bin.label)} color="#f3b33d" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="dataset-strip">
                  <div>
                    <span className="dataset-label">Dataset status</span>
                    <strong>{datasetLoaded ? `${datasetRows.length} raw telemetry rows, risk computed locally` : "No dataset available"}</strong>
                  </div>
                  <label className="csv-upload"><input type="file" accept=".csv,text/csv" onChange={handleCsvUpload} /><span>Upload CSV</span></label>
                </div>
                {csvError ? <div className="csv-error">{csvError}</div> : null}
              </div>

              <WorkerDetail
                worker={selectedWorker}
                timeline={workerTimeline}
                onRunScenario={runEmergencyScenario}
                onViewReport={(w) => setReportWorker(w)}
              />
            </section>

            <aside className="side-area">
              <WorkerRoster workers={workerList} selectedWorkerId={selectedWorker.worker_id} onSelect={setSelectedWorkerId} />
              <BeaconTimeline beacons={beacons} topIncident={topIncident} onSelect={setSelectedWorkerId} />

              <div className="system-card accent-card">
                <span className="panel-title">Response status</span>
                <div className="response-meter"><div className="response-fill" style={{ width: `${riskPercent}%` }} /></div>
                <p>{summary.critical > 0 ? `Priority escalation active for ${summary.critical} worker(s).` : "All monitored workers are inside the normal safety band."}</p>
              </div>

              <div className="system-card">
                <span className="panel-title">Policy and system</span>
                <div className="system-list">
                  <div className="system-item"><span>Warning policy</span><strong>{formatPercent(RISK_POLICY.warningThreshold)}</strong></div>
                  <div className="system-item"><span>Critical policy</span><strong>{formatPercent(RISK_POLICY.criticalThreshold)}</strong></div>
                  <div className="system-item"><span>Sites online</span><strong>{summary.siteCount || 0}</strong></div>
                  <div className="system-item"><span>Selected state</span><strong style={{ color: selectedMeta.color }}>{selectedWorker.status}</strong></div>
                </div>
              </div>
            </aside>
          </main>
        </>
      )}

      {alertingWorkers.size > 0 ? (
        <div className="toast-alert">
          <strong>{alertingWorkers.size}</strong>
          <span>local alarm and beacon triggered</span>
        </div>
      ) : null}
    </div>
  );
}

export default VitalsGridDashboard;
