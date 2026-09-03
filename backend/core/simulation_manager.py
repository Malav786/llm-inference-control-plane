"""Simulation manager — orchestrates the real-time stepwise engine loop.

Architecture after refactor
---------------------------
- Engine ticks one step per real-time interval (tick_interval_ms) via the
  additive Engine.run_stepwise() generator.
- Each engine step is executed in a thread pool executor so CPU-bound work
  never blocks the asyncio event loop (and therefore never delays WebSocket
  broadcasts).
- Injected requests go into self._injected_queue; the extra_requests_source
  callback drains it at the start of each engine tick, so injected work
  enters the live simulation immediately.
- After the engine exhausts all requests, a fresh scenario batch is generated
  and a new stepwise cycle begins (continuous live stream).
- All telemetry metrics are derived from the first-order roofline perf model
  in backend.core.perf_model — no random.uniform or random.randint for metrics.
  Every payload carries telemetry_kind = "modeled_estimate".
"""
import asyncio
import time
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
from backend.core.perf_model import PerfModel, LLAMA_7B_PROFILE
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

        # Live injection queue — drained each engine tick by extra_requests_source
        self._injected_queue: List[Tuple[int, Request]] = []

        # Per-request arrival step tracking for TTFT calculation
        self._arrival_step: Dict[str, int] = {}

        # Performance model — shared across cycles for rolling-window percentiles
        self._perf_model: PerfModel = PerfModel(
            profile=LLAMA_7B_PROFILE,
            tick_ms=self.tick_interval_ms,
        )

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

        # Update perf model tick_ms to match the current interval
        self._perf_model.tick_ms = self.tick_interval_ms

        raw = generate_scenario_requests(self.scenario_name)
        self._raw_requests = [
            (arr, Request(r.id, prompt_len=min(r.prompt_len, self.max_work),
                          max_tokens=r.max_tokens, priority=r.priority))
            for arr, r in raw
        ]
        self._injected_queue = []
        self._arrival_step = {}

        self.current_step = 0
        self.step_history = []
        self.is_running = True

        if self._task and not self._task.done():
            self._task.cancel()

        loop = asyncio.get_running_loop()
        self._task = loop.create_task(self._run_loop())
        logger.info(f"Simulation started: Strategy={self.strategy}, "
                    f"Hardware={self.hardware_name}, Scenario={self.scenario_name}")
        return self.get_current_metrics()

    def set_speed(self, interval_ms: int) -> Dict[str, Any]:
        self.tick_interval_ms = max(50, min(3000, interval_ms))
        self._perf_model.tick_ms = self.tick_interval_ms
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
        self._injected_queue = []
        self._arrival_step = {}
        return {"status": "reset", "step": 0}

    def inject_request(self, req_id: str, prompt_len: int,
                       max_tokens: int, priority: int = 1) -> Dict[str, Any]:
        """Inject a request into the live simulation.

        The request is placed in _injected_queue.  The stepwise generator's
        extra_requests_source callback drains this queue at the start of the
        very next engine tick, so the request enters the running simulation
        immediately — it is NOT lost when a scenario cycle restarts.
        """
        safe_prompt = min(prompt_len, self.max_work)
        new_req = Request(id=req_id, prompt_len=safe_prompt,
                          max_tokens=max_tokens, priority=priority)
        # offset=0: arrives at the current step
        self._injected_queue.append((0, new_req))
        logger.info(f"Request {req_id!r} queued for injection at step {self.current_step}")
        return {"status": "injected", "request_id": req_id, "step": self.current_step}

    # ------------------------------------------------------------------
    # Internal: injection callback for run_stepwise
    # ------------------------------------------------------------------

    def _drain_injected_queue(self, step: int) -> List[Tuple[int, Request]]:
        """Called by run_stepwise at the start of each tick.

        Drains _injected_queue and records arrival steps for TTFT tracking.
        """
        batch, self._injected_queue = self._injected_queue, []
        for _offset, req in batch:
            if req.id not in self._arrival_step:
                self._arrival_step[req.id] = step
        return batch

    # ------------------------------------------------------------------
    # Main async loop — real-time stepwise
    # ------------------------------------------------------------------

    async def _run_loop(self) -> None:
        """Main async simulation tick loop.

        Advances the engine exactly one step per tick_interval_ms.  The CPU-bound
        engine step is offloaded to a thread pool executor so it never blocks
        WebSocket broadcasts on the event loop.
        """
        loop = asyncio.get_running_loop()
        global_step = self.current_step

        while self.is_running:
            try:
                plan_func, _ = STRATEGY_MAP[self.strategy]
                chunked_flag = (self.strategy in ("chunked", "chunked_prefill"))
                kv_cap_arg = (self.kv_capacity
                              if self.strategy in ("kv_capacity", "preemption", "priority")
                              else None)

                # Record arrival steps for scenario requests
                for arrival, req in self._raw_requests:
                    if req.id not in self._arrival_step:
                        self._arrival_step[req.id] = arrival

                engine = Engine(
                    requests=self._raw_requests,
                    plan_step=plan_func,
                    max_work=self.max_work,
                    kv_capacity=kv_cap_arg,
                    chunked=chunked_flag,
                )

                gen = engine.run_stepwise(
                    extra_requests_source=self._drain_injected_queue
                )

                # Step through the generator one tick at a time
                exhausted = False
                while self.is_running and not exhausted:
                    tick_start = loop.time()

                    # Run one engine step off the event loop
                    try:
                        step_idx, step_entry = await loop.run_in_executor(
                            None, next, gen
                        )
                    except StopIteration:
                        exhausted = True
                        break

                    self.current_step = global_step + step_idx
                    telemetry_snapshot = self._build_step_telemetry(
                        self.current_step, step_entry
                    )
                    self.step_history.append(telemetry_snapshot)
                    if len(self.step_history) > 200:
                        self.step_history.pop(0)

                    # Broadcast and check webhooks
                    await self._broadcast_telemetry(telemetry_snapshot)
                    await self._check_webhooks(step_entry, telemetry_snapshot)

                    # Sleep for the remainder of the tick interval
                    elapsed = loop.time() - tick_start
                    remaining = max(0.0, self.tick_interval_ms / 1000.0 - elapsed)
                    if remaining > 0:
                        await asyncio.sleep(remaining)

                if not self.is_running:
                    break

                # All requests finished — advance global step counter and loop
                # with a fresh scenario batch (injected queue is preserved across cycles)
                global_step = self.current_step + 1

                raw = generate_scenario_requests(self.scenario_name)
                self._raw_requests = []
                for arr, r in raw:
                    safe_prompt = min(r.prompt_len, self.max_work)
                    new_r = Request(r.id, prompt_len=safe_prompt,
                                    max_tokens=r.max_tokens, priority=r.priority)
                    self._raw_requests.append((arr, new_r))
                    # Reset arrival tracking for scenario requests in the new cycle
                    self._arrival_step[new_r.id] = global_step + arr

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(
                    f"Transient error in simulation loop (re-initialising): {e}"
                )
                await asyncio.sleep(0.5)
                # Recover with minimal static requests — no random IDs
                self._raw_requests = [
                    (0, Request("RECOVERY-A", prompt_len=128, max_tokens=64, priority=1)),
                    (1, Request("RECOVERY-B", prompt_len=256, max_tokens=128, priority=2)),
                ]
                self._arrival_step = {"RECOVERY-A": global_step, "RECOVERY-B": global_step + 1}

    # ------------------------------------------------------------------
    # Telemetry builder — all numbers from perf_model, no RNG
    # ------------------------------------------------------------------

    def _build_step_telemetry(self, step: int,
                               step_entry: Dict[str, list]) -> Dict[str, Any]:
        hw = self.get_hardware()
        pm = self._perf_model

        prefills: List = step_entry.get("prefill", [])    # [[req_id, tokens], ...]
        decodes: List = step_entry.get("decode", [])       # [req_id, ...]
        preempts: List = step_entry.get("preempt", [])
        finished: List = step_entry.get("finished", [])

        total_prefill_tokens: int = sum(tokens for _, tokens in prefills)
        total_decode_tokens: int = len(decodes)
        total_tokens: int = total_prefill_tokens + total_decode_tokens

        # ── Prefill latency: compute-bound roofline ──────────────────
        prefill_ms = (pm.estimate_prefill_ms(total_prefill_tokens, hw)
                      if total_prefill_tokens > 0 else 0.0)

        # ── Decode latency: BW-bound roofline ───────────────────────
        # Average context length across decoding requests (use 1 as floor)
        # We don't track exact per-request context here, so we use a
        # conservative estimate: max_tokens / 2 as mid-decode context proxy.
        # This is documented and clearly labelled as a modelled estimate.
        avg_context = max(1, self.max_work // 8)   # conservative proxy
        decode_ms = (pm.estimate_decode_ms(avg_context, hw)
                     if total_decode_tokens > 0 else 0.0)

        # ── TTFT: queue-wait + prefill time ─────────────────────────
        for req_id, _tokens in prefills:
            arrival = self._arrival_step.get(req_id, step)
            wait_steps = max(0, step - arrival)
            ttft_ms = wait_steps * self.tick_interval_ms + prefill_ms
            pm.record_ttft(ttft_ms)

        # ── TPOT: per-token decode time ──────────────────────────────
        if decode_ms > 0:
            pm.record_tpot(decode_ms)

        # ── Throughput (tokens/sec) ──────────────────────────────────
        # Derived from total tokens processed in this tick
        tokens_per_sec = int(total_tokens * (1000.0 / self.tick_interval_ms))

        # ── Utilisation (roofline-derived, not RNG) ──────────────────
        sm_util = pm.estimate_sm_utilization(total_prefill_tokens, hw)
        hbm_util = pm.estimate_hbm_utilization(
            total_decode_tokens, avg_context, hw
        )

        # ── Percentiles from rolling window ─────────────────────────
        pct = pm.get_percentiles()   # all None when window empty

        # ── KV block grid (physical layout) ─────────────────────────
        num_blocks = 32
        allocated_blocks = min(
            num_blocks,
            max(0, (total_tokens // 16) + len(decodes))
        )
        kv_util_pct = round((allocated_blocks / num_blocks) * 100.0, 1)

        kv_blocks = []
        for b_idx in range(num_blocks):
            if b_idx < allocated_blocks:
                if preempts:
                    status = "PREEMPTED"
                elif prefills:
                    status = "PREFILL"
                else:
                    status = "DECODE"
                req_owner = (prefills[0][0] if prefills
                             else (decodes[0] if decodes else "ACTIVE"))
            else:
                status = "FREE"
                req_owner = "NONE"

            kv_blocks.append({
                "block_id": b_idx,
                "status": status,
                "request_id": req_owner,
                "tokens_stored": 16 if status != "FREE" else 0,
            })

        # ── Primary latency metrics for the UI ───────────────────────
        # ttft_p99_ms: real p99 from window, or modelled estimate for current step
        # when the window doesn't yet have enough samples.
        ttft_p99 = pct["ttft_p99_ms"]
        if ttft_p99 is None and prefills:
            # Not enough samples yet — use the current step estimate directly
            arrival = self._arrival_step.get(prefills[0][0], step)
            wait_steps = max(0, step - arrival)
            ttft_p99 = round(wait_steps * self.tick_interval_ms + prefill_ms, 2)

        tpot_avg = pct["tpot_p50_ms"]
        if tpot_avg is None and decode_ms > 0:
            tpot_avg = round(decode_ms, 2)

        return {
            "step": step,
            "timestamp": time.time(),
            "strategy": self.strategy,
            "strategy_label": STRATEGY_MAP[self.strategy][1],
            "hardware": hw.display_name,
            # Every consumer of this payload can check telemetry_kind to know
            # these are modelled estimates, not hardware measurements.
            "telemetry_kind": "modeled_estimate",
            "metrics": {
                "ttft_p99_ms": ttft_p99,
                "tpot_avg_ms": tpot_avg,
                "throughput_tokens_sec": tokens_per_sec,
                "sm_compute_util_pct": round(sm_util * 100.0, 1),
                "hbm_bandwidth_util_pct": round(hbm_util * 100.0, 1),
                "kv_capacity_blocks": num_blocks,
                "allocated_blocks": allocated_blocks,
                "kv_utilization_pct": kv_util_pct,
                "cost_per_hour_usd": hw.cost_per_hour_usd,
                # Full percentile set for advanced consumers
                "ttft_p50_ms": pct["ttft_p50_ms"],
                "ttft_p95_ms": pct["ttft_p95_ms"],
                "tpot_p50_ms": pct["tpot_p50_ms"],
                "tpot_p95_ms": pct["tpot_p95_ms"],
                "tpot_p99_ms": pct["tpot_p99_ms"],
            },
            "step_actions": {
                "prefill": prefills,
                "decode": decodes,
                "preempt": preempts,
                "finished": finished,
            },
            "kv_blocks": kv_blocks,
        }

    # ------------------------------------------------------------------
    # Webhooks & broadcast
    # ------------------------------------------------------------------

    async def _check_webhooks(self, step_entry: Dict[str, list],
                               telemetry: Dict[str, Any]) -> None:
        """Trigger HMAC-signed webhooks when significant events occur."""
        if "preempt" in step_entry:
            await webhook_dispatcher.dispatch_event("request.preempted", {
                "preempted_ids": step_entry["preempt"],
                "step": self.current_step,
                "strategy": self.strategy,
            })

        if "finished" in step_entry:
            await webhook_dispatcher.dispatch_event("request.completed", {
                "completed_ids": step_entry["finished"],
                "step": self.current_step,
            })

        if telemetry["metrics"]["kv_utilization_pct"] > 85.0:
            await webhook_dispatcher.dispatch_event("kv.capacity_warning", {
                "kv_utilization_pct": telemetry["metrics"]["kv_utilization_pct"],
                "allocated_blocks": telemetry["metrics"]["allocated_blocks"],
                "total_blocks": telemetry["metrics"]["kv_capacity_blocks"],
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
            "telemetry_kind": "modeled_estimate",
            "status": "ready",
        }


# Global singleton manager instance
simulation_manager = SimulationManager()
