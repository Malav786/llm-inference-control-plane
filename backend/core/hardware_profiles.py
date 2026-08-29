from dataclasses import dataclass
from typing import Dict

@dataclass(frozen=True)
class HardwareProfile:
    name: str
    display_name: str
    vram_gb: int
    hbm_bandwidth_tb_s: float
    fp16_tflops: float
    cost_per_hour_usd: float
    default_kv_capacity: int  # Default 16-token PagedAttention blocks

HARDWARE_PROFILES: Dict[str, HardwareProfile] = {
    "h100_sxm": HardwareProfile(
        name="h100_sxm",
        display_name="NVIDIA H100 SXM (80GB HBM3)",
        vram_gb=80,
        hbm_bandwidth_tb_s=3.35,
        fp16_tflops=989.0,
        cost_per_hour_usd=4.50,
        default_kv_capacity=32
    ),
    "a100_sxm": HardwareProfile(
        name="a100_sxm",
        display_name="NVIDIA A100 SXM4 (80GB HBM2e)",
        vram_gb=80,
        hbm_bandwidth_tb_s=2.03,
        fp16_tflops=312.0,
        cost_per_hour_usd=2.80,
        default_kv_capacity=24
    ),
    "l40s": HardwareProfile(
        name="l40s",
        display_name="NVIDIA L40S (48GB GDDR6)",
        vram_gb=48,
        hbm_bandwidth_tb_s=0.86,
        fp16_tflops=366.0,
        cost_per_hour_usd=1.65,
        default_kv_capacity=16
    )
}

def get_hardware_profile(name: str) -> HardwareProfile:
    return HARDWARE_PROFILES.get(name, HARDWARE_PROFILES["h100_sxm"])
