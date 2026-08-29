from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from backend.core.simulation_manager import simulation_manager, STRATEGY_MAP
from backend.core.hardware_profiles import HARDWARE_PROFILES
from backend.middleware.security import verify_api_key

router = APIRouter(prefix="/simulation", tags=["Simulation Engine"])

class StartSimulationRequest(BaseModel):
    strategy: Optional[str] = Field("priority", description="Strategy: fcfs, chunked, kv_capacity, preemption, priority")
    hardware: Optional[str] = Field("h100_sxm", description="Hardware: h100_sxm, a100_sxm, l40s")
    scenario: Optional[str] = Field("rush_hour_spike", description="Scenario: normal_traffic, rush_hour_spike, rag_heavy_prompt, vip_burst_preemption")
    max_work: Optional[int] = Field(4096, ge=16, le=16384)
    kv_capacity: Optional[int] = Field(8192, ge=16, le=32768)


class InjectRequestPayload(BaseModel):
    request_id: str = Field(..., example="REQ-VIP-999")
    prompt_len: int = Field(..., ge=1, example=256)
    max_tokens: int = Field(..., ge=1, example=128)
    priority: int = Field(1, ge=0, example=5)

@router.post("/start")
async def start_simulation(payload: StartSimulationRequest, api_key: str = Depends(verify_api_key)) -> Dict[str, Any]:
    """Start or restart a simulation run with custom hardware, strategy, and scenario presets."""
    return await simulation_manager.start_simulation(
        strategy=payload.strategy,
        hardware_name=payload.hardware,
        scenario_name=payload.scenario,
        max_work=payload.max_work,
        kv_capacity=payload.kv_capacity
    )

@router.post("/speed")
async def set_simulation_speed(interval_ms: int = Query(250, ge=50, le=3000), api_key: str = Depends(verify_api_key)) -> Dict[str, Any]:
    """Dynamically adjust simulation tick speed interval (50ms to 3000ms)."""
    return simulation_manager.set_speed(interval_ms)

@router.post("/pause")
async def pause_simulation(api_key: str = Depends(verify_api_key)) -> Dict[str, Any]:

    """Pause the currently running simulation loop."""
    return simulation_manager.pause_simulation()

@router.post("/reset")
async def reset_simulation(api_key: str = Depends(verify_api_key)) -> Dict[str, Any]:
    """Reset simulation step counter and metrics state."""
    return simulation_manager.reset_simulation()

@router.post("/inject")
async def inject_request(payload: InjectRequestPayload, api_key: str = Depends(verify_api_key)) -> Dict[str, Any]:
    """Dynamically inject an LLM request into the active queue during simulation execution."""
    return simulation_manager.inject_request(
        req_id=payload.request_id,
        prompt_len=payload.prompt_len,
        max_tokens=payload.max_tokens,
        priority=payload.priority
    )

@router.get("/metrics")
async def get_metrics() -> Dict[str, Any]:
    """Fetch current real-time telemetry snapshot and metrics HUD."""
    return simulation_manager.get_current_metrics()

@router.get("/scenarios")
async def get_available_scenarios() -> Dict[str, Any]:
    """List all available strategies, hardware presets, and workload traffic scenarios."""
    return {
        "strategies": [
            {"id": k, "label": v[1]} for k, v in STRATEGY_MAP.items()
        ],
        "hardware_profiles": [
            {"id": k, "display_name": v.display_name, "vram_gb": v.vram_gb, "tflops": v.fp16_tflops}
            for k, v in HARDWARE_PROFILES.items()
        ],
        "scenarios": [
            {"id": "normal_traffic", "name": "Normal Chat Traffic", "description": "Short prompts (64-256 tokens) with steady decode output."},
            {"id": "rush_hour_spike", "name": "Rush Hour Traffic Spike", "description": "High concurrency burst with mixed priorities."},
            {"id": "rag_heavy_prompt", "name": "RAG Heavy-Prompt Load", "description": "Long prompt context (2048-4096 tokens) testing chunked prefill."},
            {"id": "vip_burst_preemption", "name": "VIP Burst Preemption", "description": "Emergency high-priority requests evicting background jobs."}
        ]
    }
