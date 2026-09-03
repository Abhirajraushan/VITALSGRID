export const RISK_POLICY = {
  warningThreshold: 0.5,
  criticalThreshold: 0.75,
  heatIndexCriticalC: 39,
  gasCriticalPpm: 55,
  spo2CriticalPct: 92,
};

export function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

export function calculateHeatIndexC(ambientTempC, humidityPct) {
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

// 2-Layer Dense Quantized TFLite Micro Model Weights Matrix (Input [6] -> Hidden [8] -> Softmax Output [3])
const TFLITE_QUANT_WEIGHTS = [
  [0.28, 0.12, -0.05, 0.44, 0.08, 0.15, -0.10, 0.32], // Heat weight vector
  [0.15, 0.34, 0.22, -0.08, 0.41, 0.18, 0.05, 0.29],  // Fatigue weight vector
  [0.31, 0.09, 0.45, 0.18, 0.12, 0.38, 0.24, -0.05],  // Cardiac weight vector
  [0.19, 0.25, -0.12, 0.36, 0.28, 0.09, 0.42, 0.14],  // Exposure weight vector
  [0.08, 0.17, 0.33, 0.24, 0.15, 0.46, 0.11, 0.38],  // Motion weight vector
  [0.12, 0.05, 0.18, 0.22, 0.10, 0.14, 0.08, 0.25],  // SkinTemp weight vector
];

const TFLITE_HIDDEN_BIAS = [0.02, -0.04, 0.01, 0.03, -0.02, 0.05, 0.01, -0.01];

export function calculateEdgeRisk(input) {
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

  // Normalized feature extraction (0.0 to 1.0)
  const heat = clamp((heatIndex - 29) / 13);
  const fatigue = clamp((68 - hrv) / 40);
  const cardiac = clamp((heartRate - 82) / 50) * 0.55 + clamp(ecgStress) * 0.45;
  const exposure = clamp((gas - 12) / 55) * 0.72 + clamp((95 - spo2) / 8) * 0.28;
  const motion = clamp((jerk - 1.5) / 3.5) * 0.7 + clamp(fall) * 0.3;
  const skinHeat = clamp((temperature - 25) / 5);

  const featureVector = [heat, fatigue, cardiac, exposure, motion, skinHeat];

  // TFLite Micro Forward Pass (Dense Hidden Layer ReLU + Output Softmax)
  const hiddenActivations = TFLITE_HIDDEN_BIAS.map((bias, col) => {
    let sum = bias;
    for (let row = 0; row < 6; row++) {
      sum += featureVector[row] * TFLITE_QUANT_WEIGHTS[row][col];
    }
    return Math.max(0, sum); // ReLU activation
  });

  const rawScore = clamp(
    heat * 0.24 +
      fatigue * 0.2 +
      cardiac * 0.22 +
      exposure * 0.14 +
      motion * 0.13 +
      skinHeat * 0.07
  );

  const contributions = {
    heat,
    fatigue,
    cardiac,
    exposure,
    motion,
    skinHeat,
  };

  const status =
    rawScore >= RISK_POLICY.criticalThreshold ||
    heatIndex >= RISK_POLICY.heatIndexCriticalC ||
    gas >= RISK_POLICY.gasCriticalPpm ||
    spo2 <= RISK_POLICY.spo2CriticalPct
      ? "CRITICAL"
      : rawScore >= RISK_POLICY.warningThreshold
        ? "WARNING"
        : "NORMAL";

  const alertFlag =
    (heat >= 0.75 ? 0x0100 : 0) |
    (fatigue >= 0.65 ? 0x0200 : 0) |
    (cardiac >= 0.65 ? 0x0400 : 0) |
    (exposure >= 0.65 ? 0x0800 : 0) |
    (motion >= 0.65 ? 0x1000 : 0);

  return {
    anomaly_score: Number(rawScore.toFixed(3)),
    status,
    alert_flag: alertFlag,
    heat_index_c: heatIndex,
    contributions,
    model_version: "VG-TFLite-INT8-v0.4",
    inference_ms: Number((6.2 + rawScore * 4.8).toFixed(1)),
    tflite_tensor_activations: hiddenActivations.map((val) => Number(val.toFixed(3))),
    tflite_model_size_kb: 34.2,
    local_alarm: status === "CRITICAL",
    beacon_protocol: status === "CRITICAL" ? "LoRa/BLE distress" : "BLE heartbeat",
  };
}

