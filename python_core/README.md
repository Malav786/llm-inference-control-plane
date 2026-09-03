# python_core — Attribution Note

## Authorship

The **scheduler implementations** in this directory are original work:

- `fcfs_scheduler.py` — First-Come-First-Served scheduler
- `chunked_prefill_scheduler.py` — Chunked-prefill interleaving scheduler
- `kv_capacity_scheduler.py` — KV-cache capacity-aware scheduler
- `preemption_scheduler.py` — Victim-selection preemption scheduler
- `priority_preemption_scheduler.py` — Priority-aware preemption scheduler

The **simulation harness** (`engine.py` and the types in `api.py`) is adapted from a
provided exercise framework. Its docstring explicitly states it should not need to be
edited; the schedulers above are the intended deliverable. An additive stepwise-generator
API (`Engine.run_stepwise`) was added to support real-time simulation in the backend
without modifying any existing engine behaviour or breaking any existing tests.

## Running Tests

```bash
# From the repo root:
uv run python python_core/test_runner.py all
```
