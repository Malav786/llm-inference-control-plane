"""Tests for the additive Engine.run_stepwise() API (Task 3) and live injection (Task 4).

Verifies:
  - run_stepwise() produces the same log as run() on a fixed workload.
  - An injected request appears in a subsequent step's actions.
  - run() (original API) still passes all its assertions unchanged.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "python_core"))

import pytest
from api import Request, PrefillOp, StepPlan, EngineView
from engine import Engine, SimResult
import fcfs_scheduler
import priority_preemption_scheduler


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_basic_requests():
    """Simple 3-request workload identical to TestLevel1.test_worked_example."""
    return [
        (0, Request("A", prompt_len=6, max_tokens=3)),
        (0, Request("B", prompt_len=3, max_tokens=2)),
        (0, Request("C", prompt_len=5, max_tokens=2)),
    ]


# ---------------------------------------------------------------------------
# Parity: run_stepwise must produce the same log as run()
# ---------------------------------------------------------------------------

class TestStepwiseParity:
    def test_same_log_as_run(self):
        """run_stepwise() must yield the same sequence of step entries as run().log."""
        requests = _make_basic_requests()

        # --- reference: original run() ---
        eng_ref = Engine(requests, fcfs_scheduler.plan_step, max_work=10)
        ref_result = eng_ref.run()

        # --- stepwise ---
        eng_sw = Engine(requests, fcfs_scheduler.plan_step, max_work=10)
        sw_log = [(step_idx, entry) for step_idx, entry in eng_sw.run_stepwise()]

        assert len(sw_log) == ref_result.steps, (
            f"Stepwise produced {len(sw_log)} steps; run() produced {ref_result.steps}"
        )
        for (sw_step, sw_entry), ref_entry in zip(sw_log, ref_result.log):
            assert sw_entry == ref_entry, (
                f"Step {sw_step}: stepwise entry {sw_entry!r} != run() entry {ref_entry!r}"
            )

    def test_same_log_kv_capacity(self):
        """Parity test with KV capacity and preemption (TestLevel3b scenario)."""
        requests = [
            (0, Request("A", prompt_len=2, max_tokens=2)),
            (0, Request("B", prompt_len=4, max_tokens=2)),
            (0, Request("C", prompt_len=2, max_tokens=2)),
        ]
        eng_ref = Engine(requests, priority_preemption_scheduler.plan_step,
                         max_work=10, kv_capacity=6)
        ref_result = eng_ref.run()

        eng_sw = Engine(requests, priority_preemption_scheduler.plan_step,
                        max_work=10, kv_capacity=6)
        sw_log = list(eng_sw.run_stepwise())

        assert len(sw_log) == ref_result.steps
        for (sw_step, sw_entry), ref_entry in zip(sw_log, ref_result.log):
            assert sw_entry == ref_entry

    def test_original_run_still_works(self):
        """The original run() API must return a SimResult unchanged."""
        requests = _make_basic_requests()
        eng = Engine(requests, fcfs_scheduler.plan_step, max_work=10)
        result = eng.run()
        assert isinstance(result, SimResult)
        assert result.steps == 3   # same as TestLevel1.test_worked_example_level1


# ---------------------------------------------------------------------------
# Live injection via extra_requests_source
# ---------------------------------------------------------------------------

class TestLiveInjection:
    def test_injected_request_appears_in_subsequent_step(self):
        """An injected request (arrival_offset=0 at step 2) must appear in step 2+."""
        # Slow workload: one long-running request so the sim runs many steps
        base_requests = [
            (0, Request("LONG", prompt_len=4, max_tokens=8)),
        ]

        injected: list = []

        call_count = [0]

        def source(step):
            call_count[0] += 1
            if step == 2 and not injected:
                r = Request("INJECTED", prompt_len=2, max_tokens=2)
                injected.append(r)
                return [(0, r)]   # arrives at step 2
            return []

        eng = Engine(base_requests, fcfs_scheduler.plan_step, max_work=10)
        all_entries = list(eng.run_stepwise(extra_requests_source=source))

        # Gather all step entries from step 2 onwards
        entries_after_injection = [
            entry for step_idx, entry in all_entries if step_idx >= 2
        ]

        # The injected request must appear in at least one step's prefill or decode
        req_ids_seen = set()
        for entry in entries_after_injection:
            for req_id, _tok in entry.get("prefill", []):
                req_ids_seen.add(req_id)
            for req_id in entry.get("decode", []):
                req_ids_seen.add(req_id)
            for req_id in entry.get("finished", []):
                req_ids_seen.add(req_id)

        assert "INJECTED" in req_ids_seen, (
            f"Injected request 'INJECTED' not found in steps after injection. "
            f"Saw: {req_ids_seen}"
        )

    def test_injection_does_not_corrupt_original_workload(self):
        """Injecting a request must not cause the original workload to be skipped."""
        base_requests = [
            (0, Request("A", prompt_len=2, max_tokens=2)),
        ]
        injected_flag = [False]

        def source(step):
            if step == 0 and not injected_flag[0]:
                injected_flag[0] = True
                return [(0, Request("EXTRA", prompt_len=2, max_tokens=2))]
            return []

        eng = Engine(base_requests, fcfs_scheduler.plan_step, max_work=10)
        all_entries = list(eng.run_stepwise(extra_requests_source=source))

        finished = set()
        for _, entry in all_entries:
            finished.update(entry.get("finished", []))

        assert "A" in finished, "Original request A must finish"
        assert "EXTRA" in finished, "Injected request EXTRA must finish"

    def test_no_injection_source_behaves_like_run(self):
        """run_stepwise(extra_requests_source=None) must behave identically to run()."""
        requests = _make_basic_requests()
        eng_ref = Engine(requests, fcfs_scheduler.plan_step, max_work=10)
        ref = eng_ref.run()

        eng_sw = Engine(requests, fcfs_scheduler.plan_step, max_work=10)
        sw = list(eng_sw.run_stepwise(extra_requests_source=None))

        assert len(sw) == ref.steps
        for (_, sw_entry), ref_entry in zip(sw, ref.log):
            assert sw_entry == ref_entry
