/**
 * VitalsGrid Enterprise Command Hub
 * Local mesh ingestion, static dataset replay, beacon events, and dashboard hosting.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");

const RISK_POLICY = JSON.parse(fs.readFileSync(path.join(__dirname, "risk_policy.json"), "utf8"));

function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function calculateHeatIndexC(ambientTempC, humidityPct) {
  const tempF = ambientTempC * 1.8 + 32;
  const rh = humidityPct;
  const heatF =
    -42.379 +
    2.04901523 * tempF +
    10.14333127 * rh -
    0.22475541 * tempF * rh -
    0.00683783 * tempF * tempF -
    0.05481717 * rh * rh +
    0.00122874 * tempF * tempF * rh +
    0.00085282 * tempF * rh * rh -
    0.00000199 * tempF * tempF * rh * rh;

  return Number(((heatF - 32) / 1.8).toFixed(1));
}

function calculateEdgeRisk(input) {
  const heartRate = Number(input.heart_rate_bpm ?? 75);
  const hrv = Number(input.hrv_ms ?? 70);
  const temperature = Number(input.temperature_c ?? input.skin_temp_c ?? 24);
  const ambient = Number(input.ambient_temp_c ?? temperature + 6);
  const humidity = Number(input.humidity_pct ?? 45);
  const gas = Number(input.gas_ppm ?? 8);
  const spo2 = Number(input.spo2_pct ?? 98);
  const jerk = Number(input.jerk_ms3 ?? 1.2);
  const fall = Number(input.fall_confidence ?? 0);
  const ecgStress = Number(input.ecg_stress ?? 0.16);
  const heatIndex = Number(input.heat_index_c ?? calculateHeatIndexC(ambient, humidity));

  const heat = clamp((heatIndex - 29) / 13);
  const fatigue = clamp((68 - hrv) / 40);
  const cardiac = clamp((heartRate - 82) / 50) * 0.55 + clamp(ecgStress) * 0.45;
  const exposure = clamp((gas - 12) / 55) * 0.72 + clamp((95 - spo2) / 8) * 0.28;
  const motion = clamp((jerk - 1.5) / 3.5) * 0.7 + clamp(fall) * 0.3;
  const skinHeat = clamp((temperature - 25) / 5);
  const score = clamp(
    heat * 0.24 +
      fatigue * 0.2 +
      cardiac * 0.22 +
      exposure * 0.14 +
      motion * 0.13 +
      skinHeat * 0.07
  );

  const status =
    score >= RISK_POLICY.criticalThreshold ||
    heatIndex >= RISK_POLICY.heatIndexCriticalC ||
    gas >= RISK_POLICY.gasCriticalPpm ||
    spo2 <= RISK_POLICY.spo2CriticalPct
      ? "CRITICAL"
      : score >= RISK_POLICY.warningThreshold
        ? "WARNING"
        : "NORMAL";

  const alertFlag =
    (heat >= 0.75 ? 0x0100 : 0) |
    (fatigue >= 0.65 ? 0x0200 : 0) |
    (cardiac >= 0.65 ? 0x0400 : 0) |
    (exposure >= 0.65 ? 0x0800 : 0) |
    (motion >= 0.65 ? 0x1000 : 0);

  return {
    anomaly_score: Number(score.toFixed(3)),
    status,
    alert_flag: alertFlag,
    heat_index_c: heatIndex,
    contributions: { heat, fatigue, cardiac, exposure, motion, skinHeat },
    model_version: "VG-TinyML-Fusion-v0.3",
    inference_ms: Number((8 + score * 12).toFixed(1)),
    local_alarm: status === "CRITICAL",
    beacon_protocol: status === "CRITICAL" ? "LoRa/BLE distress" : "BLE heartbeat",
  };
}

class VitalsGridHub {
  constructor(port = 8080) {
    this.port = port;
    this.server = null;
    this.wss = null;
    this.clients = new Map();
    this.workers = new Map();
    this.alerts = [];
    this.events = [];
    this.beacons = [];
    this.maxHistory = 200;
    this.startTime = Date.now();
    this.datasetPath = path.join(__dirname, "data", "telemetry_50.csv");
    this.historyFile = path.join(__dirname, "data", "alerts_history.json");
    this.buildPath = path.join(__dirname, "build");
    this.loadPersistedHistory();
  }

  loadPersistedHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const saved = JSON.parse(fs.readFileSync(this.historyFile, "utf8"));
        if (Array.isArray(saved.alerts)) this.alerts = saved.alerts;
        if (Array.isArray(saved.beacons)) this.beacons = saved.beacons;
      }
    } catch (e) {
      console.warn("Could not load persisted alert history:", e.message);
    }
  }

  savePersistedHistory() {
    try {
      const payload = {
        alerts: this.alerts.slice(0, 30),
        beacons: this.beacons.slice(0, 30),
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(this.historyFile, JSON.stringify(payload, null, 2), "utf8");
    } catch (e) {}
  }

  initialize() {
    this.server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${this.port}`);

      if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          status: "online",
          service: "VitalsGrid Hub",
          uptime: process.uptime(),
          workers: this.workers.size,
          alerts: this.alerts.length,
          beacons: this.beacons.length,
          riskPolicy: RISK_POLICY,
          timestamp: new Date().toISOString(),
        }));
        return;
      }

      if (url.pathname === "/status") return this.sendJson(res, this.getStatus());
      if (url.pathname === "/api/summary") return this.sendJson(res, this.getSummary());
      if (url.pathname === "/api/workers") return this.sendJson(res, Array.from(this.workers.values()));
      if (url.pathname === "/api/alerts") return this.sendJson(res, this.alerts.slice(0, 20));
      if (url.pathname === "/api/events") return this.sendJson(res, this.events.slice(0, 50));
      if (url.pathname === "/api/beacons") return this.sendJson(res, this.beacons.slice(0, 30));
      if (url.pathname === "/api/risk-policy") return this.sendJson(res, RISK_POLICY);
      if (url.pathname === "/api/dataset") return this.sendJson(res, this.loadDataset());

      if (url.pathname === "/api/hardware-override" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            this.broadcastToClients({ type: "hardware_override", action: "hardware_override", ...payload });
            if (payload.worker_id && payload.params) {
              const current = this.workers.get(payload.worker_id) || {};
              const updated = this.normalizeDatasetRow({ ...current, ...payload.params, worker_id: payload.worker_id });
              this.processWorkerTelemetry(updated);
            }
            this.sendJson(res, { success: true, message: "Hardware override broadcasted" });
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      if (this.serveStaticFile(res, url.pathname)) return;

      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("VitalsGrid Hub - use WebSocket or API endpoints");
    });

    this.wss = new WebSocket.Server({ server: this.server });
    const handleListenError = (error) => {
      if (error.code === "EADDRINUSE") {
        console.log(`VitalsGrid Hub is already running at http://localhost:${this.port}`);
        process.exit(0);
      }
      console.error("VitalsGrid Hub failed to start:", error.message);
      process.exit(1);
    };
    this.server.on("error", handleListenError);
    this.wss.on("error", handleListenError);
    this.setupWebSocketHandlers();

    this.server.listen(this.port, () => {
      console.log("\n" + "=".repeat(88));
      console.log("VitalsGrid Enterprise Command Hub - ONLINE");
      console.log("=".repeat(88));
      console.log(`WebSocket: ws://localhost:${this.port}`);
      console.log(`Dashboard: http://localhost:${this.port}`);
      console.log(`Dataset: ${this.datasetPath}`);
      console.log("=".repeat(88) + "\n");
    });
  }

  sendJson(res, payload) {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(payload, null, 2));
  }

  serveStaticFile(res, pathname) {
    const route = pathname === "/" ? "/index.html" : pathname;
    const safePath = route.startsWith("/") ? route.slice(1) : route;
    const filePath = path.join(this.buildPath, safePath);

    if (!fs.existsSync(filePath) || !filePath.startsWith(this.buildPath)) {
      return false;
    }

    const ext = path.extname(filePath);
    const contentType = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".ico": "image/x-icon",
    }[ext] || "application/octet-stream";

    try {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(fs.readFileSync(filePath));
      return true;
    } catch (error) {
      return false;
    }
  }

  loadDataset() {
    try {
      if (!fs.existsSync(this.datasetPath)) return [];

      const raw = fs.readFileSync(this.datasetPath, "utf8");
      const lines = raw.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return [];

      const headers = lines[0].split(",").map((header) => header.trim());
      return lines.slice(1).map((line) => {
        const values = line.split(",").map((value) => value.trim());
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] ?? "";
        });
        return this.normalizeDatasetRow(row);
      });
    } catch (error) {
      console.error("Dataset load failed:", error.message);
      return [];
    }
  }

  setupWebSocketHandlers() {
    this.wss.on("connection", (ws, req) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, {
        ws,
        id: clientId,
        connectedAt: new Date().toISOString(),
        ip: req.socket.remoteAddress,
      });

      ws.on("message", (message) => this.handleIncomingMessage(message, clientId));
      ws.on("error", (error) => console.error(`WebSocket error (${clientId}): ${error.message}`));
      ws.on("close", () => this.clients.delete(clientId));

      this.sendInitialSnapshot(ws);
    });
  }

  handleIncomingMessage(message, clientId) {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "ping") {
        const client = this.clients.get(clientId);
        if (client) client.ws.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }));
        return;
      }

      if (data.type === "ack_alert") return this.handleAlertAcknowledgement(data);

      if (data.type === "dataset_replay" && Array.isArray(data.rows)) {
        data.rows.forEach((row) => this.processWorkerTelemetry(this.normalizeDatasetRow(row)));
        return;
      }

      if (data.type === "emergency_scenario") {
        this.runEmergencyScenario(data.worker_id);
        return;
      }

      if (data.type === "hardware_override" || data.action === "hardware_override") {
        this.broadcastToClients({ action: "hardware_override", type: "hardware_override", ...data });
        if (data.worker_id && data.params) {
          const current = this.workers.get(data.worker_id) || {};
          const updated = this.normalizeDatasetRow({ ...current, ...data.params, worker_id: data.worker_id });
          this.processWorkerTelemetry(updated);
        }
        return;
      }

      if (data.worker_id) {
        this.processWorkerTelemetry(this.normalizeDatasetRow(data));
        return;
      }

      console.warn(`Unknown message format from ${clientId}`);
    } catch (error) {
      console.error(`Failed to parse incoming payload: ${error.message}`);
    }
  }

  normalizeDatasetRow(row) {
    const sensors = row.sensors || {};
    const normalized = {
      worker_id: row.worker_id,
      site_id: row.site_id || "SITE_A",
      zone: row.zone || "Control room",
      device_id: row.device_id,
      timestamp: row.timestamp || new Date().toISOString(),
      temperature_c: Number(row.temperature_c ?? row.skin_temp_c ?? sensors.temperature_c ?? 24),
      hrv_ms: Number(row.hrv_ms ?? sensors.hrv_ms ?? 70),
      jerk_ms3: Number(row.jerk_ms3 ?? sensors.jerk_ms3 ?? 1.2),
      heart_rate_bpm: Number(row.heart_rate_bpm ?? sensors.heart_rate_bpm ?? 76),
      spo2_pct: Number(row.spo2_pct ?? sensors.spo2_pct ?? 98),
      ambient_temp_c: Number(row.ambient_temp_c ?? sensors.ambient_temp_c ?? 31),
      humidity_pct: Number(row.humidity_pct ?? sensors.humidity_pct ?? 45),
      gas_ppm: Number(row.gas_ppm ?? sensors.gas_ppm ?? 8),
      ecg_stress: Number(row.ecg_stress ?? sensors.ecg_stress ?? 0.16),
      fall_confidence: Number(row.fall_confidence ?? sensors.fall_confidence ?? 0.02),
      x: Number(row.x ?? 50),
      y: Number(row.y ?? 50),
    };
    const risk = calculateEdgeRisk(normalized);

    return {
      ...normalized,
      ...risk,
      sensors: {
        temperature_c: normalized.temperature_c,
        hrv_ms: normalized.hrv_ms,
        jerk_ms3: normalized.jerk_ms3,
        heart_rate_bpm: normalized.heart_rate_bpm,
        spo2_pct: normalized.spo2_pct,
        ambient_temp_c: normalized.ambient_temp_c,
        humidity_pct: normalized.humidity_pct,
        gas_ppm: normalized.gas_ppm,
        ecg_stress: normalized.ecg_stress,
        fall_confidence: normalized.fall_confidence,
      },
    };
  }

  processWorkerTelemetry(data) {
    const workerId = data.worker_id || `WORKER_${Date.now()}`;
    const normalized = this.normalizeDatasetRow({ ...data, worker_id: workerId });
    normalized.received_at = new Date().toISOString();
    this.workers.set(workerId, normalized);

    if (normalized.status === "CRITICAL") {
      this.recordCriticalEvent(normalized);
    } else {
      this.recordTelemetryEvent(normalized);
    }

    this.broadcastToClients({
      type: "worker_update",
      payload: normalized,
      timestamp: new Date().toISOString(),
    });

    this.broadcastToClients({
      type: "system_snapshot",
      payload: this.getSummary(),
      timestamp: new Date().toISOString(),
    });
  }

  recordTelemetryEvent(worker) {
    this.events.unshift({
      id: `EVENT_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      type: "edge_inference",
      worker_id: worker.worker_id,
      site_id: worker.site_id,
      status: worker.status,
      anomaly_score: worker.anomaly_score,
      timestamp: new Date().toISOString(),
    });
    this.trimQueues();
  }

  recordCriticalEvent(worker) {
    const alert = {
      id: `ALERT_${worker.worker_id}`,
      worker_id: worker.worker_id,
      site_id: worker.site_id,
      severity: "critical",
      anomaly_score: worker.anomaly_score,
      alert_flag: worker.alert_flag,
      message: "On-device TinyML model triggered local alarm and offline distress beacon.",
      created_at: new Date().toISOString(),
    };
    const beacon = {
      id: `BEACON_${Date.now()}`,
      worker_id: worker.worker_id,
      site_id: worker.site_id,
      zone: worker.zone,
      protocol: worker.beacon_protocol,
      local_alarm: true,
      rssi_dbm: -55 - Math.round(worker.anomaly_score * 24),
      gateway: `${worker.site_id}_INTRANET_GATEWAY`,
      timestamp: new Date().toISOString(),
    };

    const existingIndex = this.alerts.findIndex((item) => item.worker_id === worker.worker_id);
    if (existingIndex >= 0) this.alerts.splice(existingIndex, 1, alert);
    else this.alerts.unshift(alert);

    this.beacons.unshift(beacon);
    this.events.unshift({
      id: `EVENT_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      type: "distress_beacon",
      worker_id: worker.worker_id,
      site_id: worker.site_id,
      status: worker.status,
      anomaly_score: worker.anomaly_score,
      timestamp: new Date().toISOString(),
    });

    this.broadcastToClients({
      type: "beacon_event",
      payload: beacon,
      timestamp: new Date().toISOString(),
    });
    this.trimQueues();
  }

  runEmergencyScenario(workerId) {
    const current = this.workers.get(workerId) || this.loadDataset()[0];
    const escalated = {
      ...current,
      timestamp: new Date().toISOString(),
      temperature_c: Math.max(current.temperature_c || 27, 29.4),
      hrv_ms: Math.min(current.hrv_ms || 42, 31.5),
      jerk_ms3: Math.max(current.jerk_ms3 || 3.8, 4.75),
      heart_rate_bpm: Math.max(current.heart_rate_bpm || 114, 128),
      spo2_pct: Math.min(current.spo2_pct || 94, 91.5),
      ambient_temp_c: Math.max(current.ambient_temp_c || 38, 41.2),
      humidity_pct: Math.max(current.humidity_pct || 63, 70),
      gas_ppm: Math.max(current.gas_ppm || 18, 58),
      ecg_stress: Math.max(current.ecg_stress || 0.7, 0.88),
      fall_confidence: Math.max(current.fall_confidence || 0.2, 0.66),
    };
    this.processWorkerTelemetry(escalated);
  }

  trimQueues() {
    if (this.events.length > this.maxHistory) this.events = this.events.slice(0, this.maxHistory);
    if (this.alerts.length > 30) this.alerts = this.alerts.slice(0, 30);
    if (this.beacons.length > 30) this.beacons = this.beacons.slice(0, 30);
    this.savePersistedHistory();
  }

  handleAlertAcknowledgement(data) {
    const alert = this.alerts.find((item) => item.id === data.alert_id);
    if (!alert) return;
    alert.acknowledged = true;
    alert.acknowledged_at = new Date().toISOString();
    this.broadcastToClients({ type: "alert_acknowledged", payload: alert, timestamp: new Date().toISOString() });
  }

  sendInitialSnapshot(ws) {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "system_snapshot", payload: this.getSummary(), timestamp: new Date().toISOString() }));
  }

  broadcastToClients(message) {
    const payload = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) client.ws.send(payload);
    });
  }

  generateClientId() {
    return `CLIENT_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  getSummary() {
    const workers = Array.from(this.workers.values());
    const critical = workers.filter((worker) => worker.status === "CRITICAL").length;
    const warning = workers.filter((worker) => worker.status === "WARNING").length;
    const normal = workers.filter((worker) => worker.status === "NORMAL").length;
    const avgRisk = workers.length
      ? workers.reduce((sum, worker) => sum + (worker.anomaly_score || 0), 0) / workers.length
      : 0;

    return {
      workers: workers.length,
      critical,
      warning,
      normal,
      avgRisk,
      activeAlerts: this.alerts.length,
      activeBeacons: this.beacons.length,
      uptime: process.uptime(),
      siteCount: new Set(workers.map((worker) => worker.site_id)).size,
      modelVersion: "VG-TinyML-Fusion-v0.3",
      riskPolicy: RISK_POLICY,
      generated_at: new Date().toISOString(),
    };
  }

  getStatus() {
    return {
      port: this.port,
      service: "VitalsGrid Enterprise Hub",
      activeClients: this.clients.size,
      workers: Array.from(this.workers.values()),
      alerts: this.alerts.slice(0, 10),
      beacons: this.beacons.slice(0, 10),
      events: this.events.slice(0, 10),
      summary: this.getSummary(),
      uptime: process.uptime(),
      startedAt: new Date(this.startTime).toISOString(),
      timestamp: new Date().toISOString(),
    };
  }
}

const hub = new VitalsGridHub(8080);
hub.initialize();

process.on("SIGINT", () => {
  console.log("\nShutting down VitalsGrid Enterprise Command Hub...");
  hub.server.close(() => process.exit(0));
});

module.exports = VitalsGridHub;
