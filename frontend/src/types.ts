export interface Metrics {
  ttft_p99_ms: number | null;
  tpot_avg_ms: number | null;
  throughput_tokens_sec: number;
  sm_compute_util_pct: number;
  hbm_bandwidth_util_pct: number;
  kv_capacity_blocks: number;
  allocated_blocks: number;
  kv_utilization_pct: number;
  cost_per_hour_usd: number;
  // Extended percentiles (present when rolling window has data)
  ttft_p50_ms?: number | null;
  ttft_p95_ms?: number | null;
  tpot_p50_ms?: number | null;
  tpot_p95_ms?: number | null;
  tpot_p99_ms?: number | null;
}

export interface KVBlock {
  block_id: number;
  status: 'FREE' | 'PREFILL' | 'DECODE' | 'PREEMPTED';
  request_id: string;
  tokens_stored: number;
}

export interface StepActions {
  prefill?: [string, number][];
  decode?: string[];
  preempt?: string[];
  finished?: string[];
}

export interface TelemetrySnapshot {
  step: number;
  timestamp: number;
  strategy: string;
  strategy_label: string;
  hardware: string;
  /** "modeled_estimate" when numbers come from the roofline model;
   *  "fallback_offline" when the WS client is running its offline demo. */
  telemetry_kind?: string;
  metrics: Metrics;
  step_actions: StepActions;
  kv_blocks: KVBlock[];
}

export interface StrategyOption {
  id: string;
  label: string;
}

export interface HardwareOption {
  id: string;
  display_name: string;
  vram_gb: number;
  tflops: number;
}

export interface ScenarioOption {
  id: string;
  name: string;
  description: string;
}

export interface ScenarioData {
  strategies: StrategyOption[];
  hardware_profiles: HardwareOption[];
  scenarios: ScenarioOption[];
}

export interface WebhookSubscription {
  id: string;
  target_url: string;
  secret: string;
  events: string[];
  created_at: number;
  active: boolean;
}


export interface WebhookLog {
  id: string;
  subscription_id: string;
  target_url: string;
  event: string;
  status_code: number | null;
  success: boolean;
  attempt: number;
  duration_ms: number;
  timestamp: number;
  error_message?: string;
}
