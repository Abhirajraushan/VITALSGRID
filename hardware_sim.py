"""
Nordic nRF5340 MCU Multi-Worker Hardware Simulator for VitalsGrid
Generates synthetic sensor telemetry for multiple SCADA substation workers
Supports bi-directional WebSocket RPC control for real-time judge hardware testing
"""

import asyncio
import websockets
import json
import time
import math
import random
import sys
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, List

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

POLICY_PATH = Path(__file__).with_name("risk_policy.json")
RISK_POLICY = json.loads(POLICY_PATH.read_text(encoding="utf-8")) if POLICY_PATH.exists() else {
    "warningThreshold": 0.5,
    "criticalThreshold": 0.75,
    "heatIndexCriticalC": 39,
    "gasCriticalPpm": 55,
    "spo2CriticalPct": 92
}

WORKER_PROFILES = [
    {"id": "WORKER_001", "name": "Rajesh Kumar", "zone": "HV Switchgear Yard", "site_id": "SUBSTATION_ALPHA", "x": 18, "y": 28},
    {"id": "WORKER_002", "name": "Priya Sharma", "zone": "Control Room Bay A", "site_id": "SUBSTATION_ALPHA", "x": 42, "y": 64},
    {"id": "WORKER_003", "name": "Amit Patel", "zone": "Transformer 500kV Yard", "site_id": "SUBSTATION_BETA", "x": 76, "y": 32},
    {"id": "WORKER_004", "name": "Ananya Roy", "zone": "SF6 Breaker Trench", "site_id": "SUBSTATION_BETA", "x": 60, "y": 78},
    {"id": "WORKER_005", "name": "Vikram Singh", "zone": "SCADA Server Room", "site_id": "CONTROL_CENTER", "x": 88, "y": 15},
]

class WorkerNodeSimulator:
    def __init__(self, profile: Dict):
        self.worker_id = profile["id"]
        self.name = profile.get("name", "Grid Worker")
        self.site_id = profile["site_id"]
        self.zone = profile["zone"]
        self.device_id = f"EDGE-{self.worker_id[-3:]}"
        self.x = profile["x"]
        self.y = profile["y"]
        
        self.start_time = time.time()
        self.collapse_triggered = False
        self.collapse_start_time = None
        
        # Override parameters (from WS RPC or CLI)
        self.manual_override = {}
        
    def get_elapsed_time(self) -> float:
        return time.time() - self.start_time

    def set_override(self, params: Dict):
        self.manual_override.update(params)
        print(f"🎮 [RPC OVERRIDE] Applied manual hardware overrides to {self.worker_id}: {params}")

    def clear_override(self):
        self.manual_override.clear()

    def generate_sensor_data(self) -> Dict:
        elapsed = self.get_elapsed_time()
        
        # Check overrides
        ov = self.manual_override
        
        if "collapse" in ov and ov["collapse"] and not self.collapse_triggered:
            self.collapse_triggered = True
            self.collapse_start_time = elapsed
            print(f"\n⚠️ [MANUAL EVENT] Collapse triggered on {self.worker_id}!")

        # Calculate base metrics
        if not self.collapse_triggered:
            base_hrv = 75 + 18 * math.sin(elapsed * 0.08 + hash(self.worker_id) % 7)
            hrv = ov.get("hrv_ms", max(35, min(115, base_hrv + random.gauss(0, 4))))
            
            base_temp = 23 + 1.2 * math.sin(elapsed * 0.04)
            skin_temp = ov.get("temperature_c", max(18, min(32, base_temp + random.gauss(0, 0.3))))
            
            jerk = ov.get("jerk_ms3", max(0.2, min(3.2, 0.9 + 0.6 * math.sin(elapsed * 0.12) + random.gauss(0, 0.15))))
            heart_rate = ov.get("heart_rate_bpm", max(60, min(140, 75 + (70 - hrv) * 0.65 + random.gauss(0, 2))))
            ambient_temp = ov.get("ambient_temp_c", 29.5 + math.sin(elapsed * 0.03) * 1.5)
            humidity = ov.get("humidity_pct", 42 + math.sin(elapsed * 0.04) * 5)
            gas_ppm = ov.get("gas_ppm", max(3, 8 + random.gauss(0, 1.2)))
            spo2 = ov.get("spo2_pct", max(94, 98.2 - max(0, 70 - hrv) * 0.02))
        else:
            collapse_t = elapsed - (self.collapse_start_time or elapsed)
            degradation = math.exp(-0.45 * collapse_t)
            hrv = ov.get("hrv_ms", max(16, 18 + 28 * degradation))
            heart_rate = ov.get("heart_rate_bpm", min(155, 128 + 12 * (1 - degradation)))
            jerk = ov.get("jerk_ms3", min(8.0, 3.5 + 2.5 * math.sin(collapse_t * 1.8)))
            skin_temp = ov.get("temperature_c", 36.5 + min(3.5, collapse_t * 0.1))
            ambient_temp = ov.get("ambient_temp_c", 38.5 + min(4.0, collapse_t * 0.12))
            humidity = ov.get("humidity_pct", 72)
            gas_ppm = ov.get("gas_ppm", 62)
            spo2 = ov.get("spo2_pct", 90.5)

        ecg_stress = min(1.0, max(0.0, (heart_rate - 78) / 68 + (70 - hrv) / 160))
        fall_confidence = min(1.0, max(0.0, (jerk - 2.8) / 4.2))

        # Check automated collapse trigger condition for worker 001 if no manual trigger
        if self.worker_id == "WORKER_001" and (elapsed >= 30 or heart_rate > 128 or hrv < 30) and not self.collapse_triggered:
            self.collapse_triggered = True
            self.collapse_start_time = elapsed
            print(f"\n⚠️  [AUTOMATED ANOMALY] Heatstroke & Collapse event triggered on {self.worker_id} at {elapsed:.1f}s")

        return {
            "worker_id": self.worker_id,
            "name": self.name,
            "site_id": self.site_id,
            "zone": self.zone,
            "device_id": self.device_id,
            "timestamp": datetime.now().isoformat(),
            "elapsed_seconds": round(elapsed, 1),
            "x": self.x,
            "y": self.y,
            "sensors": {
                "temperature_c": round(skin_temp, 2),
                "hrv_ms": round(hrv, 2),
                "jerk_ms3": round(jerk, 2),
                "heart_rate_bpm": round(heart_rate, 1),
                "spo2_pct": round(spo2, 1),
                "ambient_temp_c": round(ambient_temp, 1),
                "humidity_pct": round(humidity, 1),
                "gas_ppm": round(gas_ppm, 1),
                "ecg_stress": round(ecg_stress, 3),
                "fall_confidence": round(fall_confidence, 3)
            }
        }

async def stream_multi_worker(ws_uri: str, num_workers: int = 4):
    workers = [WorkerNodeSimulator(WORKER_PROFILES[i % len(WORKER_PROFILES)]) for i in range(num_workers)]
    
    print("=" * 80)
    print("⚡ VitalsGrid Multi-Worker Hardware Simulator - Nordic nRF5340 Cluster")
    print(f"Target WebSocket: {ws_uri}")
    print(f"Active Simulated Workers: {num_workers}")
    print("=" * 80 + "\n")

    retry_count = 0
    while True:
        try:
            async with websockets.connect(ws_uri) as websocket:
                print(f"✅ Connected to VitalsGrid Command Hub at {ws_uri}", flush=True)
                retry_count = 0
                
                # Listen task for incoming WS RPC control commands from server/React
                async def receive_rpc():
                    async for message in websocket:
                        try:
                            cmd = json.loads(message)
                            if cmd.get("action") == "hardware_override":
                                target_id = cmd.get("worker_id")
                                params = cmd.get("params", {})
                                for w in workers:
                                    if w.worker_id == target_id or target_id == "ALL":
                                        w.set_override(params)
                            elif cmd.get("action") == "reset":
                                for w in workers:
                                    w.clear_override()
                                    w.collapse_triggered = False
                                print("🔄 All hardware worker simulators reset to baseline.", flush=True)
                        except Exception as err:
                            pass

                asyncio.create_task(receive_rpc())

                while True:
                    for worker in workers:
                        telemetry = worker.generate_sensor_data()
                        await websocket.send(json.dumps(telemetry))
                        
                        if worker.worker_id == "WORKER_001":
                            s = telemetry["sensors"]
                            print(f"📡 [{telemetry['elapsed_seconds']:5.1f}s] {worker.worker_id} ({worker.zone}) | "
                                  f"T:{s['temperature_c']}°C | HRV:{s['hrv_ms']}ms | HR:{s['heart_rate_bpm']}bpm | Jerk:{s['jerk_ms3']}", flush=True)
                    
                    await asyncio.sleep(1.0)
                    
        except (ConnectionRefusedError, websockets.exceptions.ConnectionClosed):
            retry_count += 1
            print(f"⚠️ Connection retry ({retry_count}). Hub may be initializing on {ws_uri}...")
            await asyncio.sleep(2)
        except Exception as e:
            print(f"❌ Error in simulator loop: {e}")
            await asyncio.sleep(2)

def main():
    parser = argparse.ArgumentParser(description="VitalsGrid Hardware Simulator")
    parser.add_argument("--ws-uri", default="ws://localhost:8080", help="WebSocket URI of VitalsGrid Hub")
    parser.add_argument("--workers", type=int, default=4, help="Number of simulated worker nodes (1-5)")
    args = parser.parse_args()

    try:
        asyncio.run(stream_multi_worker(args.ws_uri, min(5, max(1, args.workers))))
    except KeyboardInterrupt:
        print("\n✋ Simulation terminated gracefully.")

if __name__ == "__main__":
    main()
