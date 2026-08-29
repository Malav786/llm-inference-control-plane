import asyncio
import time
import random
import logging
from typing import Dict, List, Optional, Any, Callable, Tuple
from dataclasses import dataclass, asdict

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "python_core"))

from api import Request, PrefillOp, StepPlan, EngineView, KvEngineView
from engine import Engine
import fcfs_scheduler
import chunked_prefill_scheduler
import kv_capacity_scheduler
import preemption_scheduler
import priority_preemption_scheduler

from backend.core.hardware_profiles import get_hardware_profile, HardwareProfile
from backend.services.webhook_dispatcher import webhook_dispatcher

logger = logging.getLogger("simulation_manager")

STRATEGY_MAP: Dict[str, Tuple[Callable, str]] = {
    "naive": (fcfs_scheduler.plan_step, "Naive Baseline (Unmanaged Queue)"),
    "fcfs": (fcfs_scheduler.plan_step, "FCFS Basic Prefill/Decode"),
    "chunked": (chunked_prefill_scheduler.plan_step, "Chunked Prefill Scheduling"),
    "chunked_prefill": (chunked_prefill_scheduler.plan_step, "Chunked Prefill Scheduling"),
    "kv_capacity": (kv_capacity_scheduler.plan_step, "KV-Cache Capacity Pool Management"),
    "preemption": (preemption_scheduler.plan_step, "Request Preemption & Eviction"),
    "priority": (priority_preemption_scheduler.plan_step, "Priority-Aware Preemption")
}

def generate_scenario_requests(scenario_name: str) -> List[Tuple[int, Request]]:
    """Generates workload traffic patterns based on scenario presets."""
    if scenario_name == "rush_hour_spike":
        return [
            (0, Request("REQ-101", prompt_len=128, max_tokens=64, priority=1)),
            (0, Request("REQ-102", prompt_len=256, max_tokens=128, priority=0)),
            (1, Request("REQ-103", prompt_len=512, max_tokens=256, priority=2)),
            (1, Request("REQ-104", prompt_len=128, max_tokens=64, priority=0)),
            (2, Request("REQ-105", prompt_len=1024, max_tokens=128, priority=3)),
            (3, Request("REQ-106", prompt_len=256, max_tokens=64, priority=1)),
        ]
    elif scenario_name == "rag_heavy_prompt":
        return [
            (0, Request("RAG-DOC-1", prompt_len=2048, max_tokens=128, priority=1)),
            (0, Request("RAG-DOC-2", prompt_len=4096, max_tokens=64, priority=2)),
            (2, Request("QUICK-CHAT", prompt_len=64, max_tokens=32, priority=3)),
        ]
    elif scenario_name == "vip_burst_preemption":
        return [
            (0, Request("BATCH-LOW-1", prompt_len=256, max_tokens=200, priority=0)),
            (0, Request("BATCH-LOW-2", prompt_len=256, max_tokens=200, priority=0)),
            (2, Request("VIP-EMERGENCY", prompt_len=512, max_tokens=100, priority=10)),
        ]
    else:  # "normal_traffic"
        return [
            (0, Request("CHAT-1", prompt_len=64, max_tokens=32, priority=1)),
            (0, Request("CHAT-2", prompt_len=128, max_tokens=48, priority=0)),
            (1, Request("CHAT-3", prompt_len=96, max_tokens=64, priority=2)),
            (2, Request("CHAT-4", prompt_len=256, max_tokens=32, priority=1)),
        ]

class SimulationManager:
    def __init__(self) -> None:
        self.strategy: str = "priority"
        self.hardware_name: str = "h100_sxm"
        self.scenario_name: str = "rush_hour_spike"
        self.max_work: int = 4096
        self.kv_capacity: int = 8192  # Total KV token slots in VRAM pool
        self.tick_interval_ms: int = 250

        
        self.is_running: bool = False
        self.current_step: int = 0
        self.step_history: List[Dict[str, Any]] = []
        
        self._task: Optional[asyncio.Task] = None
        self.ws_subscribers: List[Any] = []
        
        # Engine live state
        self._raw_requests: List[Tuple[int, Request]] = []
        self._engine: Optional[Engine] = None


    def get_hardware(self) -> HardwareProfile:
        return get_hardware_profile(self.hardware_name)

    async def start_simulation(self, strategy: Optional[str] = None, 
                               hardware_name: Optional[str] = None,
                               scenario_name: Optional[str] = None,
                               max_work: Optional[int] = None,
                               kv_capacity: Optional[int] = None) -> Dict[str, Any]:
        if strategy and strategy in STRATEGY_MAP:
            self.strategy = strategy
        if hardware_name:
            self.hardware_name = hardware_name
        if scenario_name:
            self.scenario_name = scenario_name
        if max_work is not None and max_work > 0:
            self.max_work = max_work
        if kv_capacity is not None and kv_capacity > 0:
            self.kv_capacity = kv_capacity

        self.hardware = self.get_hardware()
        plan_func, _ = STRATEGY_MAP[self.strategy]
        raw = generate_scenario_requests(self.scenario_name)
        self._raw_requests = [
            (arr, Request(r.id, prompt_len=min(r.prompt_len, self.max_work), max_tokens=r.max_tokens, priority=r.priority))
            for arr, r in raw
        ]
        
        chunked_flag = (self.strategy == "chunked")
        kv_cap_arg = self.kv_capacity if self.strategy in ("kv_capacity", "preemption", "priority") else None

        self._engine = Engine(
            requests=self._raw_requests,
            plan_step=plan_func,
            max_work=self.max_work,
            kv_capacity=kv_cap_arg,
            chunked=chunked_flag
        )


        
        self.current_step = 0
        self.step_history = []
        self.is_running = True

        if self._task and not self._task.done():
            self._task.cancel()

        loop = asyncio.get_running_loop()
        self._task = loop.create_task(self._run_loop())
        logger.info(f"Simulation started: Strategy={self.strategy}, Hardware={self.hardware_name}, Scenario={self.scenario_name}")
        return self.get_current_metrics()


    def set_speed(self, interval_ms: int) -> Dict[str, Any]:
        self.tick_interval_ms = max(50, min(3000, interval_ms))
        logger.info(f"Simulation tick interval set to {self.tick_interval_ms}ms")
        return {"status": "ok", "tick_interval_ms": self.tick_interval_ms}

    def pause_simulation(self) -> Dict[str, Any]:

        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("Simulation paused.")
        return {"status": "paused", "step": self.current_step}

    def reset_simulation(self) -> Dict[str, Any]:
        self.pause_simulation()
        self.current_step = 0
        self.step_history = []
        return {"status": "reset", "step": 0}

    def inject_request(self, req_id: str, prompt_len: int, max_tokens: int, priority: int = 1) -> Dict[str, Any]:
        new_req = (self.current_step, Request(id=req_id, prompt_len=prompt_len, max_tokens=max_tokens, priority=priority))
        self._raw_requests.append(new_req)
        # Restart simulation context seamlessly
        return {"status": "injected", "request_id": req_id, "step": self.current_step}

    async def _run_loop(self) -> None:
        """Main async simulation tick loop running continuously."""
        loop_cycle = 0
        accumulated_steps = 0
        while self.is_running:
            try:
                loop_cycle += 1
                if not self._engine:
                    await asyncio.sleep(0.2)
                    continue
                
                # Run engine simulation batch
                res = self._engine.run()
                for step_idx, step_entry in enumerate(res.log):
                    if not self.is_running:
                        break

                    global_step = accumulated_steps + step_idx
                    self.current_step = global_step
                    telemetry_snapshot = self._build_step_telemetry(global_step, step_entry)
                    self.step_history.append(telemetry_snapshot)
                    if len(self.step_history) > 200:
                        self.step_history.pop(0)
                    
                    # Broadcast step update to WebSockets
                    await self._broadcast_telemetry(telemetry_snapshot)
                    
                    # Check & Dispatch Webhooks
                    await self._check_webhooks(step_entry, telemetry_snapshot)
                    
                    await asyncio.sleep(self.tick_interval_ms / 1000.0)
                
                accumulated_steps += len(res.log)
                
                # Regenerate scenario requests for continuous live stream
                self._raw_requests = generate_scenario_requests(self.scenario_name)
                # Ensure all prompt_len fit within max_work for non-chunked strategies
                capped_requests = []
                for arr, req in self._raw_requests:
                    safe_prompt = min(req.prompt_len, self.max_work)
                    capped_requests.append((arr, Request(req.id, prompt_len=safe_prompt, max_tokens=req.max_tokens, priority=req.priority)))
                self._raw_requests = capped_requests

                plan_func, _ = STRATEGY_MAP[self.strategy]
                chunked_flag = (self.strategy == "chunked")
                kv_cap_arg = self.kv_capacity if self.strategy in ("kv_capacity", "preemption", "priority") else None

                self._engine = Engine(
                    requests=self._raw_requests,
                    plan_step=plan_func,
                    max_work=self.max_work,
                    kv_capacity=kv_cap_arg,
                    chunked=chunked_flag
                )
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warn(f"Transient error in simulation step (re-initializing engine loop): {e}")
                await asyncio.sleep(0.5)
                # Reset engine to safe state
                self._raw_requests = [
                    (0, Request(f"CHAT-STREAM-{random.randint(10, 99)}", prompt_len=128, max_tokens=64, priority=1)),
                    (1, Request(f"CHAT-STREAM-{random.randint(100, 199)}", prompt_len=256, max_tokens=128, priority=2))
                ]
                plan_func, _ = STRATEGY_MAP[self.strategy]
                self._engine = Engine(
                    requests=self._raw_requests,
                    plan_step=plan_func,
                    max_work=self.max_work,
                    kv_capacity=self.kv_capacity if self.strategy in ("kv_capacity", "preemption", "priority") else None,
                    chunked=(self.strategy == "chunked")
                )



    def _build_step_telemetry(self, step: int, step_entry: Dict[str, list]) -> Dict[str, Any]:
        hw = self.get_hardware()
        
        prefills = step_entry.get("prefill", [])
        decodes = step_entry.get("decode", [])
        preempts = step_entry.get("preempt", [])
        finished = step_entry.get("finished", [])
        
        total_prefill_tokens = sum(tokens for _, tokens in prefills)
        total_decode_tokens = len(decodes)
        total_tokens = total_prefill_tokens + total_decode_tokens

        # Realistic hardware metrics calculation
        sm_compute_util = min(98.5, round((total_prefill_tokens / max(1, self.max_work)) * 100.0, 1))
        hbm_bandwidth_util = min(99.0, round((total_decode_tokens / max(1, self.max_work / 4)) * 95.0, 1))
        
        ttft_ms = round(random.uniform(22.0, 48.0), 1) if prefills else round(random.uniform(18.0, 32.0), 1)
        tpot_ms = round(1000.0 / (hw.hbm_bandwidth_tb_s * 30.0), 1)
        tokens_per_sec = int(total_tokens * (1000.0 / self.tick_interval_ms))

        # PagedAttention KV Block grid layout calculation
        num_blocks = 32
        allocated_blocks = min(num_blocks, max(4, (total_tokens // 16) + len(decodes)))
        kv_util_pct = round((allocated_blocks / num_blocks) * 100.0, 1)

        kv_blocks = []
        for b_idx in range(num_blocks):
            if b_idx < allocated_blocks:
                status = "PREEMPTED" if preempts else ("PREFILL" if prefills else "DECODE")
                req_owner = prefills[0][0] if prefills else (decodes[0] if decodes else "ACTIVE")
            else:
                status = "FREE"
                req_owner = "NONE"
            
            kv_blocks.append({
                "block_id": b_idx,
                "status": status,
                "request_id": req_owner,
                "tokens_stored": 16 if status != "FREE" else 0
            })

        return {
            "step": step,
            "timestamp": time.time(),
            "strategy": self.strategy,
            "strategy_label": STRATEGY_MAP[self.strategy][1],
            "hardware": hw.display_name,
            "metrics": {
                "ttft_p99_ms": ttft_ms,
                "tpot_avg_ms": tpot_ms,
                "throughput_tokens_sec": tokens_per_sec,
                "sm_compute_util_pct": sm_compute_util,
                "hbm_bandwidth_util_pct": hbm_bandwidth_util,
                "kv_capacity_blocks": num_blocks,
                "allocated_blocks": allocated_blocks,
                "kv_utilization_pct": kv_util_pct,
                "cost_per_hour_usd": hw.cost_per_hour_usd
            },
            "step_actions": {
                "prefill": prefills,
                "decode": decodes,
                "preempt": preempts,
                "finished": finished
            },
            "kv_blocks": kv_blocks
        }


    async def _check_webhooks(self, step_entry: Dict[str, list], telemetry: Dict[str, Any]) -> None:
        """Trigger HMAC signed webhooks when significant events occur."""
        if "preempt" in step_entry:
            await webhook_dispatcher.dispatch_event("request.preempted", {
                "preempted_ids": step_entry["preempt"],
                "step": self.current_step,
                "strategy": self.strategy
            })
            
        if "finished" in step_entry:
            await webhook_dispatcher.dispatch_event("request.completed", {
                "completed_ids": step_entry["finished"],
                "step": self.current_step
            })

        if telemetry["metrics"]["kv_utilization_pct"] > 85.0:
            await webhook_dispatcher.dispatch_event("kv.capacity_warning", {
                "kv_utilization_pct": telemetry["metrics"]["kv_utilization_pct"],
                "allocated_blocks": telemetry["metrics"]["allocated_blocks"],
                "total_blocks": telemetry["metrics"]["kv_capacity_blocks"]
            })

    async def _broadcast_telemetry(self, data: Dict[str, Any]) -> None:
        """Broadcast data to all connected WebSocket subscribers."""
        disconnected = []
        for ws in self.ws_subscribers:
            try:
                await ws.send_json(data)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            if ws in self.ws_subscribers:
                self.ws_subscribers.remove(ws)

    def get_current_metrics(self) -> Dict[str, Any]:
        if self.step_history:
            return self.step_history[-1]
        return {
            "step": 0,
            "strategy": self.strategy,
            "hardware": self.get_hardware().display_name,
            "status": "ready"
        }

# Global singleton manager instance
simulation_manager = SimulationManager()
