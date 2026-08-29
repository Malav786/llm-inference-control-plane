import type { ScenarioData, TelemetrySnapshot, WebhookSubscription, WebhookLog } from '../types';

const API_BASE = 'http://localhost:8000/api/v1';

export async function fetchScenarios(): Promise<ScenarioData> {
  try {
    const res = await fetch(`${API_BASE}/simulation/scenarios`);
    if (!res.ok) throw new Error('Failed to fetch scenarios');
    return await res.json();
  } catch (err) {
    console.warn('Backend unavailable, using fallback scenario options:', err);
    return {
      strategies: [
        { id: 'naive', label: 'Naive Baseline (Unmanaged Queue)' },
        { id: 'fcfs', label: 'FCFS Basic Prefill/Decode' },
        { id: 'chunked_prefill', label: 'Chunked Prefill Scheduling' },
        { id: 'kv_capacity', label: 'KV-Cache Capacity Pool Management' },
        { id: 'preemption', label: 'Request Preemption & Eviction' },
        { id: 'priority', label: 'Priority-Aware Preemption' },
      ],
      hardware_profiles: [
        { id: 'h100_sxm', display_name: 'NVIDIA H100 SXM (80GB HBM3)', vram_gb: 80, tflops: 989 },
        { id: 'a100_sxm', display_name: 'NVIDIA A100 SXM4 (80GB HBM2e)', vram_gb: 80, tflops: 312 },
        { id: 'l40s', display_name: 'NVIDIA L40S (48GB GDDR6)', vram_gb: 48, tflops: 366 },
      ],
      scenarios: [
        { id: 'rush_hour_spike', name: 'Rush Hour Traffic Spike', description: 'High concurrency burst with mixed priorities.' },
        { id: 'normal_traffic', name: 'Normal Chat Traffic', description: 'Short prompts with steady decode output.' },
        { id: 'rag_heavy_prompt', name: 'RAG Heavy-Prompt Load', description: 'Long context (2048-4096 tokens) testing chunked prefill.' },
        { id: 'vip_burst_preemption', name: 'VIP Burst Preemption', description: 'Emergency high-priority requests evicting background jobs.' },
      ],
    };
  }
}

export async function startSimulation(params: {
  strategy: string;
  hardware: string;
  scenario: string;
  max_work: number;
  kv_capacity: number;
}): Promise<TelemetrySnapshot> {
  const res = await fetch(`${API_BASE}/simulation/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      strategy: params.strategy,
      hardware: params.hardware,
      scenario: params.scenario,
      max_work: params.max_work,
      kv_capacity: params.kv_capacity,
    }),
  });
  if (!res.ok) throw new Error('Failed to start simulation');
  return await res.json();
}

export async function pauseSimulation(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/simulation/pause`, {
    method: 'POST',
  });
  return await res.json();
}

export async function setSimulationSpeed(intervalMs: number): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/simulation/speed?interval_ms=${intervalMs}`, {
    method: 'POST',
  });
  return await res.json();
}

export async function resetSimulation(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/simulation/reset`, {
    method: 'POST',
  });
  return await res.json();
}

export async function injectRequest(payload: {
  request_id: string;
  prompt_len: number;
  max_tokens: number;
  priority: number;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/simulation/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request_id: payload.request_id,
      prompt_len: payload.prompt_len,
      max_tokens: payload.max_tokens,
      priority: payload.priority,
    }),
  });
  return await res.json();
}

export async function registerWebhook(payload: {
  target_url: string;
  secret?: string;
  events?: string[];
}): Promise<WebhookSubscription> {
  const res = await fetch(`${API_BASE}/webhooks/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

export async function testWebhook(payload: {
  target_url: string;
  secret?: string;
  event?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/webhooks/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

export async function fetchWebhookLogs(): Promise<{ logs: WebhookLog[] }> {
  const res = await fetch(`${API_BASE}/webhooks/logs`);
  return await res.json();
}
