"""First-order roofline performance model for LLM inference.

All numbers produced here are **modelled estimates**, not hardware measurements.
The model uses two well-known asymptotic limits for transformer inference:

  Prefill  — compute-bound (GEMM-dominated):
      flops ≈ 2 · num_params · prompt_tokens          (standard transformer estimate;
      time  = flops / (fp16_tflops · 1e12 · MFU)       attention O(n²) dominates only
                                                         at very long contexts, ignored here)

  Decode   — memory-bandwidth-bound (weight + KV reload):
      bytes = weight_bytes + kv_bytes_per_token · context_tokens
      time  = bytes / (hbm_bandwidth_tb_s · 1e12)
      where  weight_bytes    = num_params · dtype_bytes
             kv_bytes/token  = 2 · num_kv_heads · head_dim · dtype_bytes · num_layers
             (factor-2 for K and V tensors)

  TTFT     = queue_wait_steps · tick_ms + prefill_time_ms
  TPOT     = decode_time_ms   (per output token)

  SM util  = prefill_flops_this_tick / (fp16_tflops · 1e12 · tick_s), clamped [0,1]
  HBM util = decode_bw_this_tick   / (hbm_bw_tb_s · 1e12 · tick_s), clamped [0,1]

Assumed MFU: 0.40 (40 % of theoretical peak).  Real production systems with fused
kernels typically achieve 35–55 %; 0.40 is a conservative mid-point.

Model profile: a synthetic 7B-class causal decoder — representative of open-source
models such as LLaMA-7B / Mistral-7B.  Parameters are freely observable from public
model cards; they are NOT derived from proprietary sources.

Percentiles are computed from a rolling window (last WINDOW_SIZE samples).
If the window is empty, all percentile outputs are None (not a fabricated value).
"""
from __future__ import annotations

import statistics
from collections import deque
from dataclasses import dataclass
from typing import Optional

from backend.core.hardware_profiles import HardwareProfile

# ---------------------------------------------------------------------------
# Model assumptions
# ---------------------------------------------------------------------------

MFU: float = 0.40           # Model Flop Utilisation (dimensionless, 0–1)
WINDOW_SIZE: int = 200       # Rolling window for percentile computation


# ---------------------------------------------------------------------------
# Model profile dataclass
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ModelProfile:
    """Physical parameters of a decoder-only transformer model.

    Attributes
    ----------
    name        : Human-readable identifier.
    num_params  : Total parameter count (weights only, excluding embeddings/LM-head
                  for simplicity — they are a small fraction for large models).
    num_layers  : Number of transformer decoder layers.
    hidden_dim  : Model hidden dimension (d_model).
    num_kv_heads: Number of KV attention heads (may differ from Q heads with GQA).
    head_dim    : Dimension of each attention head.
    dtype_bytes : Bytes per parameter/activation element (default 2 = fp16/bf16).
    """
    name: str
    num_params: float           # e.g. 7e9
    num_layers: int
    hidden_dim: int
    num_kv_heads: int
    head_dim: int
    dtype_bytes: int = 2


# ---------------------------------------------------------------------------
# Concrete profiles
# ---------------------------------------------------------------------------

# 7B-class decoder — representative of publicly documented model families
# such as LLaMA-7B / Mistral-7B.  Numbers taken from public model cards.
LLAMA_7B_PROFILE = ModelProfile(
    name="llama_7b_class",
    num_params=7e9,
    num_layers=32,
    hidden_dim=4096,
    num_kv_heads=32,
    head_dim=128,
    dtype_bytes=2,          # bf16 / fp16
)


# ---------------------------------------------------------------------------
# Performance model
# ---------------------------------------------------------------------------

class PerfModel:
    """Stateful first-order roofline performance model.

    Parameters
    ----------
    profile     : ModelProfile describing the model being served.
    tick_ms     : Wall-clock duration of one simulation tick (milliseconds).
                  Must match SimulationManager.tick_interval_ms so TTFT queue-wait
                  converts correctly to real time.
    """

    def __init__(self, profile: ModelProfile = LLAMA_7B_PROFILE,
                 tick_ms: float = 250.0) -> None:
        self.profile = profile
        self.tick_ms = tick_ms

        # Pre-computed constants
        p = profile
        self._weight_bytes: float = p.num_params * p.dtype_bytes
        # KV bytes per token per layer: 2 tensors (K,V) × heads × head_dim × dtype
        self._kv_bytes_per_token_per_layer: float = (
            2 * p.num_kv_heads * p.head_dim * p.dtype_bytes
        )
        self._kv_bytes_per_token: float = (
            self._kv_bytes_per_token_per_layer * p.num_layers
        )

        # Rolling windows for percentile computation
        self._ttft_window: deque[float] = deque(maxlen=WINDOW_SIZE)
        self._tpot_window: deque[float] = deque(maxlen=WINDOW_SIZE)

    # ------------------------------------------------------------------
    # Latency estimators
    # ------------------------------------------------------------------

    def estimate_prefill_ms(self, prompt_tokens: int,
                            hw: HardwareProfile) -> float:
        """Estimate prefill latency (ms) for a batch of prompt_tokens.

        Assumption: prefill is compute-bound (GEMM-dominated).
        FLOPs ≈ 2 × num_params × prompt_tokens  (standard transformer estimate).
        """
        flops = 2.0 * self.profile.num_params * prompt_tokens
        peak_flops_per_s = hw.fp16_tflops * 1e12 * MFU
        return (flops / peak_flops_per_s) * 1_000.0   # convert s → ms

    def estimate_decode_ms(self, context_tokens: int,
                           hw: HardwareProfile) -> float:
        """Estimate per-token decode latency (ms) given current context length.

        Assumption: decode is memory-bandwidth-bound (weight + KV reload per step).
        bytes_read = weight_bytes + kv_bytes_per_token × context_tokens
        """
        bytes_to_read = (
            self._weight_bytes
            + self._kv_bytes_per_token * max(1, context_tokens)
        )
        peak_bw = hw.hbm_bandwidth_tb_s * 1e12
        return (bytes_to_read / peak_bw) * 1_000.0    # convert s → ms

    # ------------------------------------------------------------------
    # TTFT / TPOT recording
    # ------------------------------------------------------------------

    def record_ttft(self, ttft_ms: float) -> None:
        """Record a completed TTFT sample into the rolling window."""
        self._ttft_window.append(ttft_ms)

    def record_tpot(self, tpot_ms: float) -> None:
        """Record a per-token TPOT sample into the rolling window."""
        self._tpot_window.append(tpot_ms)

    # ------------------------------------------------------------------
    # Percentile computation
    # ------------------------------------------------------------------

    def get_percentiles(self) -> dict:
        """Return p50/p95/p99 for TTFT and TPOT from the rolling window.

        Returns None for all values when the window is empty, rather than
        fabricating a number.
        """
        def _pct(window: deque, p: float) -> Optional[float]:
            if not window:
                return None
            data = sorted(window)
            n = len(data)
            # Linear interpolation percentile (same as numpy's default)
            idx = (p / 100.0) * (n - 1)
            lo = int(idx)
            hi = lo + 1
            if hi >= n:
                return round(data[lo], 2)
            frac = idx - lo
            return round(data[lo] + frac * (data[hi] - data[lo]), 2)

        return {
            "ttft_p50_ms": _pct(self._ttft_window, 50),
            "ttft_p95_ms": _pct(self._ttft_window, 95),
            "ttft_p99_ms": _pct(self._ttft_window, 99),
            "tpot_p50_ms": _pct(self._tpot_window, 50),
            "tpot_p95_ms": _pct(self._tpot_window, 95),
            "tpot_p99_ms": _pct(self._tpot_window, 99),
        }

    # ------------------------------------------------------------------
    # Utilisation estimators (roofline-derived, not RNG)
    # ------------------------------------------------------------------

    def estimate_sm_utilization(self, prefill_tokens: int,
                                hw: HardwareProfile) -> float:
        """SM compute utilisation for this tick, as a fraction [0, 1].

        = FLOPs issued this tick / (peak_tflops × tick_duration × MFU)
        The MFU factor is already baked into the denominator so the result
        represents fraction of *achievable* compute consumed.
        """
        if prefill_tokens <= 0:
            return 0.0
        flops_issued = 2.0 * self.profile.num_params * prefill_tokens
        tick_s = self.tick_ms / 1_000.0
        achievable_flops = hw.fp16_tflops * 1e12 * MFU * tick_s
        return min(1.0, flops_issued / achievable_flops)

    def estimate_hbm_utilization(self, decode_count: int,
                                 avg_context_tokens: float,
                                 hw: HardwareProfile) -> float:
        """HBM bandwidth utilisation for this tick, as a fraction [0, 1].

        = bytes read for all decode ops / (peak_bw × tick_duration)
        """
        if decode_count <= 0:
            return 0.0
        bytes_per_decode = (
            self._weight_bytes
            + self._kv_bytes_per_token * max(1.0, avg_context_tokens)
        )
        total_bytes = bytes_per_decode * decode_count
        tick_s = self.tick_ms / 1_000.0
        peak_bw = hw.hbm_bandwidth_tb_s * 1e12
        return min(1.0, total_bytes / (peak_bw * tick_s))
