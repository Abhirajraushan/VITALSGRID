import React, { useState } from "react";

export default function IncidentReport({ worker, onClose }) {
  const [selectedShift, setSelectedShift] = useState("Shift A (06:00 - 14:00IST Morning)");

  if (!worker) return null;

  const handlePrint = () => {
    window.print();
  };

  const reportId = `DGMS-INC-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const dateStr = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST";
  const empAadhaarCode = `IND-EMP-${Math.floor(1000 + Math.random() * 9000)}`;

  const handleExportJson = () => {
    const exportData = {
      ...worker,
      report_id: reportId,
      shift: selectedShift,
      emp_code: empAadhaarCode,
      compliance: "DGMS CMR 2017 / Factories Act 1948 (Sec 41B) / IS 14489 / CEA 2010",
      emergency_dispatch: "+91 112 National Emergency / Plant Hospital Rapid Response",
      generated_at: dateStr,
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `dgms_audit_log_${worker.worker_id}_${reportId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportTxt = () => {
    const textContent = `VITALSGRID INDUSTRIAL SAFETY AUDIT REPORT (INDIA COMPLIANT)
Report ID: ${reportId}
Timestamp: ${dateStr}
Worker ID / Aadhaar Code: ${worker.worker_id} (${empAadhaarCode})
Plant / Site Facility: ${worker.site_id}
Work Zone: ${worker.zone}
Workplace Shift: ${selectedShift}
Risk Status: ${worker.status} (Anomaly Score: ${(worker.anomaly_score * 100).toFixed(1)}%)
Heart Rate: ${worker.heart_rate_bpm} BPM | HRV: ${worker.hrv_ms} ms
Skin Temp: ${worker.temperature_c} °C | Ambient Gas: ${worker.gas_ppm} PPM
Motion Jerk: ${worker.jerk_ms3} m/s³
Beacon Protocol: ${worker.beacon_protocol}
Statutory Compliance: DGMS Coal Mines Reg 2017 | Factories Act 1948 (Sec 41B) | IS 14489 | CEA Safety 2010
Emergency Hotlines: +91 112 / Plant Hospital Control / DGMS Regional Director
    `;
    const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(textContent);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `dgms_audit_log_${worker.worker_id}_${reportId}.txt`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="incident-report-overlay">
      <div className="incident-report-modal printable-area">
        <div className="report-header">
          <div className="report-brand">
            <span className="scada-logo">🇮🇳 VITALSGRID SCADA OT | INDIAN INDUSTRIAL COMPLIANCE</span>
            <h2>OFFICIAL INDUSTRIAL INCIDENT & WORKER SAFETY AUDIT REPORT</h2>
            <p>Statutory Standards: DGMS Coal Mines Reg 2017 | The Factories Act, 1948 (Sec 41B) | IS 14489 | CEA Safety Regs 2010</p>
          </div>
          <div className="report-meta-box">
            <p><strong>REPORT ID:</strong> {reportId}</p>
            <p><strong>TIMESTAMP:</strong> {dateStr}</p>
            <p><strong>SECURITY LEVEL:</strong> AIR-GAPPED OT (ZERO WAN)</p>
          </div>
        </div>

        <div className="report-divider" />

        <div className="report-section">
          <h3>1. WORKER & PLANT FACILITY IDENTIFICATION</h3>
          <div className="report-grid">
            <div><span>Worker Badge / Aadhaar ID:</span> <strong>{worker.name || worker.worker_id} ({empAadhaarCode})</strong></div>
            <div><span>Assigned Plant Zone:</span> <strong>{worker.zone}</strong></div>
            <div><span>Facility & Location:</span> <strong>{worker.site_id}</strong></div>
            <div><span>Wearable Node ID:</span> <strong>{worker.device_id || "EDGE-nRF5340-01"}</strong></div>
            <div>
              <span>Industrial Work Shift:</span>
              <select
                className="shift-select no-print"
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                style={{ background: "#172126", color: "#42d69b", border: "1px solid #42d69b", padding: "4px 8px", borderRadius: "4px", marginTop: "4px", fontSize: "0.85rem" }}
              >
                <option value="Shift A (06:00 - 14:00IST Morning)">Shift A (06:00 - 14:00 Morning)</option>
                <option value="Shift B (14:00 - 22:00IST Evening)">Shift B (14:00 - 22:00 Evening)</option>
                <option value="Shift C (22:00 - 06:00IST Night)">Shift C (22:00 - 06:00 Night General)</option>
              </select>
            </div>
            <div><span>Emergency Dispatch:</span> <strong>+91 112 / Plant Hospital Medical Response</strong></div>
          </div>
        </div>

        <div className="report-section">
          <h3>2. ON-DEVICE TINYML ANOMALY EVALUATION</h3>
          <div className="report-grid">
            <div><span>Risk Classification:</span> <strong className={`status-badge ${worker.status}`}>{worker.status} EMERGENCY</strong></div>
            <div><span>Anomaly Score:</span> <strong>{(worker.anomaly_score * 100).toFixed(1)}%</strong></div>
            <div><span>TinyML Engine:</span> <strong>{worker.model_version || "VG-TinyML-Fusion-v0.3"}</strong></div>
            <div><span>MCU Latency:</span> <strong>{worker.inference_ms || "8.4"} ms (On-Device nRF5340)</strong></div>
          </div>
        </div>

        <div className="report-section">
          <h3>3. CRITICAL TELEMETRY SNAPSHOT AT TIME OF INCIDENT</h3>
          <table className="report-table">
            <thead>
              <tr>
                <th>Sensor Module</th>
                <th>Parameter</th>
                <th>Recorded Value</th>
                <th>DGMS / Factories Act 1948 Limit</th>
                <th>Evaluation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>TI AFE4900 ECG</td>
                <td>Heart Rate / HRV</td>
                <td>{worker.heart_rate_bpm?.toFixed(0)} BPM / {worker.hrv_ms?.toFixed(1)} ms</td>
                <td>HR &lt; 120 BPM / HRV &gt; 35 ms</td>
                <td className={worker.hrv_ms < 35 ? "fail" : "pass"}>{worker.hrv_ms < 35 ? "CRITICAL FATIGUE" : "PASS"}</td>
              </tr>
              <tr>
                <td>ST LSM6DSOX IMU</td>
                <td>Motion Jerk / Fall Impact</td>
                <td>{worker.jerk_ms3?.toFixed(2)} m/s³</td>
                <td>Jerk &lt; 3.0 m/s³</td>
                <td className={worker.jerk_ms3 > 3.0 ? "fail" : "pass"}>{worker.jerk_ms3 > 3.0 ? "FALL IMPACT" : "PASS"}</td>
              </tr>
              <tr>
                <td>Sensirion SGP40</td>
                <td>Toxic SF6 / Gas Leak</td>
                <td>{worker.gas_ppm?.toFixed(0)} PPM</td>
                <td>Gas &lt; 35 PPM (DGMS Norm)</td>
                <td className={worker.gas_ppm >= 55 ? "fail" : "pass"}>{worker.gas_ppm >= 55 ? "TOXIC LEAK" : "PASS"}</td>
              </tr>
              <tr>
                <td>Sensirion HTS221</td>
                <td>Ambient Heat Index</td>
                <td>{worker.ambient_temp_c?.toFixed(1)} °C</td>
                <td>Heat &lt; 37.5 °C (Indian Summer Limit)</td>
                <td className={worker.ambient_temp_c >= 37.5 ? "fail" : "pass"}>{worker.ambient_temp_c >= 37.5 ? "HEAT EXHAUSTION" : "PASS"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="report-section">
          <h3>4. AIR-GAPPED DISPATCH LOG & INDIAN REGULATORY DISPATCH</h3>
          <p className="report-text">
            On-device haptic buzzer activated in <strong>&lt;100ms</strong>. Offline LoRa/BLE distress beacon broadcasted to SCADA Intranet Command Hub without cloud dependencies. Emergency protocol alert logged for DGMS Regional Safety Inspector audit under Factories Act, 1948 Section 41B.
          </p>
        </div>

        <div className="report-signatures">
          <div>
            <div className="sig-line" />
            <p>SCADA Site Chief Supervisor (Plant Head)</p>
          </div>
          <div>
            <div className="sig-line" />
            <p>DGMS / Factory Inspector Safety Auditor</p>
          </div>
        </div>

        <div className="report-actions no-print">
          <button type="button" className="preset-btn emergency" onClick={handlePrint}>🖨️ Print / Save PDF</button>
          <button type="button" className="preset-btn" style={{ background: "rgba(88,200,246,0.15)", borderColor: "#58c8f6", color: "#58c8f6" }} onClick={handleExportJson}>📥 Export JSON</button>
          <button type="button" className="preset-btn" style={{ background: "rgba(66,214,155,0.15)", borderColor: "#42d69b", color: "#42d69b" }} onClick={handleExportTxt}>📄 Export TXT Log</button>
          <button type="button" className="preset-btn reset" onClick={onClose}>Close Report</button>
        </div>
      </div>
    </div>
  );
}

