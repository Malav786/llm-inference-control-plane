"""Tests for backend/core/perf_model.py.

Verifies:
  - Prefill and decode time are monotonically increasing with token count.
  - Orders of magnitude are physically plausible (not absurdly large/small).
  - Percentile computation returns None on empty window.
  - Percentile computation returns correct values on a known window.
  - SM and HBM utilisation are in [0, 1].
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "python_core"))

import pytest
from backend.core.perf_model import PerfModel, LLAMA_7B_PROFILE
from backend.core.hardware_profiles import get_hardware_profile


@pytest.fixture()
def hw():
    return get_hardware_profile("h100_sxm")


@pytest.fixture()
def model(hw):
    return PerfModel(profile=LLAMA_7B_PROFILE, tick_ms=250.0)


# ---------------------------------------------------------------------------
# Prefill estimates
# ---------------------------------------------------------------------------

class TestPrefillEstimate:
    def test_monotonic(self, model, hw):
        """Longer prompt → longer prefill time."""
        t64  = model.estimate_prefill_ms(64,   hw)
        t128 = model.estimate_prefill_ms(128,  hw)
        t512 = model.estimate_prefill_ms(512,  hw)
        assert t64 < t128 < t512, "Prefill time must increase with token count"

    def test_order_of_magnitude(self, model, hw):
        """128-token prefill on H100 should be between 0.01 ms and 50 ms.

        Sanity check: 7B model @ 40% MFU on H100 (989 TFLOPS).
        FLOPs = 2 * 7e9 * 128 = 1.792e12; achievable = 989e12 * 0.4 = 395.6e12 FLOPS/s
        Expected ≈ 1.792e12 / 395.6e12 * 1000 ≈ 4.5 ms → well within [0.01, 50].
        """
        t = model.estimate_prefill_ms(128, hw)
        assert 0.01 < t < 50.0, f"Prefill estimate out of plausible range: {t:.3f} ms"

    def test_zero_tokens(self, model, hw):
        """Zero tokens should not raise (result may be 0)."""
        t = model.estimate_prefill_ms(0, hw)
        assert t == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# Decode estimates
# ---------------------------------------------------------------------------

class TestDecodeEstimate:
    def test_monotonic(self, model, hw):
        """More context tokens → more KV bytes to read → longer decode."""
        t1   = model.estimate_decode_ms(1,    hw)
        t256 = model.estimate_decode_ms(256,  hw)
        t2k  = model.estimate_decode_ms(2048, hw)
        assert t1 <= t256 < t2k, "Decode time must increase with context length"

    def test_order_of_magnitude(self, model, hw):
        """Single decode step on H100 should be between 0.01 ms and 20 ms.

        Sanity: weight_bytes ≈ 7e9*2 = 14 GB; HBM BW = 3.35 TB/s.
        Expected ≈ 14e9 / (3.35e12) * 1000 ≈ 4.2 ms → within [0.01, 20].
        """
        t = model.estimate_decode_ms(1, hw)
        assert 0.01 < t < 20.0, f"Decode estimate out of plausible range: {t:.3f} ms"

    def test_weight_dominated_at_low_context(self, model, hw):
        """At context=1 the weight reload should dominate (result still > 0)."""
        t = model.estimate_decode_ms(1, hw)
        assert t > 0


# ---------------------------------------------------------------------------
# Percentiles
# ---------------------------------------------------------------------------

class TestPercentiles:
    def test_empty_window_returns_none(self, model):
        """All percentile values must be None when no samples have been recorded."""
        pct = model.get_percentiles()
        for key, val in pct.items():
            assert val is None, f"{key} should be None on empty window, got {val}"

    def test_known_window_ttft(self, model):
        """Record 100 known TTFT values and verify p99 is computed correctly."""
        # Values 1..100 ms — p99 by linear interpolation = 99.0 (index 98/99 → 99.0)
        for v in range(1, 101):
            model.record_ttft(float(v))
        pct = model.get_percentiles()
        # p50 of 1..100 should be ~50 ms; p99 should be ~99 ms
        assert pct["ttft_p50_ms"] is not None
        assert 49.0 <= pct["ttft_p50_ms"] <= 51.0, f"p50 off: {pct['ttft_p50_ms']}"
        assert pct["ttft_p99_ms"] is not None
        assert 97.0 <= pct["ttft_p99_ms"] <= 100.0, f"p99 off: {pct['ttft_p99_ms']}"

    def test_known_window_tpot(self, model):
        """Record 50 identical TPOT values and verify p99 returns that value."""
        for _ in range(50):
            model.record_tpot(5.0)
        pct = model.get_percentiles()
        assert pct["tpot_p99_ms"] == pytest.approx(5.0)
        assert pct["tpot_p50_ms"] == pytest.approx(5.0)

    def test_partial_window(self, model):
        """With a single sample, all percentiles should return that value."""
        model.record_ttft(42.0)
        pct = model.get_percentiles()
        assert pct["ttft_p50_ms"] == pytest.approx(42.0)
        assert pct["ttft_p99_ms"] == pytest.approx(42.0)


# ---------------------------------------------------------------------------
# Utilisation
# ---------------------------------------------------------------------------

class TestUtilisation:
    def test_sm_utilisation_range(self, model, hw):
        """SM utilisation must be in [0, 1]."""
        assert model.estimate_sm_utilization(0, hw) == pytest.approx(0.0)
        assert 0.0 <= model.estimate_sm_utilization(128, hw) <= 1.0
        # Very large number should clamp to 1.0
        assert model.estimate_sm_utilization(10_000_000, hw) == pytest.approx(1.0)

    def test_hbm_utilisation_range(self, model, hw):
        """HBM utilisation must be in [0, 1]."""
        assert model.estimate_hbm_utilization(0, 256, hw) == pytest.approx(0.0)
        assert 0.0 <= model.estimate_hbm_utilization(4, 256, hw) <= 1.0
        # Very large decode count should clamp to 1.0
        assert model.estimate_hbm_utilization(1_000_000, 256, hw) == pytest.approx(1.0)

    def test_sm_monotonic(self, model, hw):
        """More prefill tokens → higher SM utilisation."""
        u64 = model.estimate_sm_utilization(64, hw)
        u512 = model.estimate_sm_utilization(512, hw)
        assert u64 <= u512

    def test_hbm_monotonic(self, model, hw):
        """More decode ops → higher HBM utilisation."""
        u1 = model.estimate_hbm_utilization(1, 256, hw)
        u8 = model.estimate_hbm_utilization(8, 256, hw)
        assert u1 <= u8
