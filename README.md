# ⚡ LLM Inference Scheduler Engine & Observability Platform

An enterprise-grade, high-performance **LLM Request Scheduling Engine & Telemetry Observability Platform**. This project simulates production LLM inference scheduling strategies (matching engine behaviors like **vLLM**, **TGI**, and **SGLang** on NVIDIA H100 / A100 GPUs) including **FCFS, Chunked Prefill, PagedAttention KV-Cache Management, Request Preemption, and Priority-Aware Scheduling**.

---

## 📁 Repository Structure

```
.
├── .env.example         # Environment variables configuration template
├── .gitignore           # Git ignore rules for Python, Node, environment secrets & builds
├── pyproject.toml       # Project configuration managed by UV Astral
├── uv.lock              # Lockfile for reproducible Python dependencies
├── README.md            # Comprehensive project documentation
├── test.sh              # Shell script wrapper to execute test runner via UV
└── python_core/         # Core Python simulation engine & scheduler algorithms
    ├── api.py                            # Engine data structures (Request, StepPlan, EngineView, KvEngineView)
    ├── engine.py                         # Simulation harness & rule validation engine
    ├── fcfs_scheduler.py                 # FCFS decode/prefill scheduling strategy
    ├── chunked_prefill_scheduler.py      # Chunked prefill scheduling strategy
    ├── kv_capacity_scheduler.py          # Peak KV-cache capacity management strategy
    ├── preemption_scheduler.py           # Request preemption & re-prefill strategy
    ├── priority_preemption_scheduler.py  # Priority-aware preemption strategy
    ├── test_levels.py                    # Unit test suite verifying all 5 scheduler strategies
    └── test_runner.py                    # CLI test runner entrypoint
```

---

## 🎯 Scheduler Strategies Overview

The core engine implements 5 progressive scheduling strategies:

| Strategy File | Strategy Name | Description | Key Mechanism |
| :--- | :--- | :--- | :--- |
| [`fcfs_scheduler.py`](file:///e:/TRIAL/python_core/fcfs_scheduler.py) | **FCFS Prefill & Decode** | Basic First-Come-First-Served scheduling. | Prioritizes active decodes; schedules prefills when `max_work` allows. |
| [`chunked_prefill_scheduler.py`](file:///e:/TRIAL/python_core/chunked_prefill_scheduler.py) | **Chunked Prefill** | Splits long prompt contexts across multiple steps. | Prevents decode starvation during large prompt processing. |
| [`kv_capacity_scheduler.py`](file:///e:/TRIAL/python_core/kv_capacity_scheduler.py) | **KV-Cache Capacity** | Enforces physical VRAM KV memory limits. | Admits requests only when KV slots fit within `kv_capacity`. |
| [`preemption_scheduler.py`](file:///e:/TRIAL/python_core/preemption_scheduler.py) | **Request Preemption** | Evicts admitted requests when VRAM is exhausted. | Preempts victim requests (reclaiming KV slots) and re-queues them. |
| [`priority_preemption_scheduler.py`](file:///e:/TRIAL/python_core/priority_preemption_scheduler.py) | **Priority Preemption** | Priority-aware eviction and scheduling. | Evicts lowest-priority requests to admit urgent, high-priority workloads. |

---

## ⚡ Quickstart & Testing

This project uses [Astral UV](https://astral.sh/uv) for fast, reproducible Python virtual environment management.

### 1. Initialize Virtual Environment

```bash
uv venv
```

### 2. Run Scheduler Unit Tests

Execute the full verification test suite (all strategies):

```bash
uv run python python_core/test_runner.py all
```

Or run individual strategy tests:

```bash
uv run python python_core/test_runner.py fcfs
uv run python python_core/test_runner.py priority
```


Or use the wrapper script:

```bash
bash test.sh all
```

---

## 🔒 Planned Industrial Platform Features

- **FastAPI Async Engine**: REST endpoints & full-duplex WebSockets for streaming step telemetry.
- **HMAC Signed Webhooks**: Asynchronous event notifications (`request.preempted`, `request.completed`, `kv.capacity_alert`).
- **Security & Gateway**: API Key & JWT Bearer authentication, rate-limiting, CORS policy, and security headers.
- **Interactive Dual-Layer Dashboard**: Real-time HUD gauges (TTFT/TPOT), PagedAttention KV block visualizer, animated assembly line, and ELI5 tooltips.
- **Public Cloud Hosting**: Prepared for containerized 1-click deployment on Render, Railway, Vercel, or Fly.io.

---

## 📄 License

MIT License. Developed for LLM inference telemetry benchmarking and scheduler research.

