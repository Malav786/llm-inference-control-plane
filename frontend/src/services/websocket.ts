import type { TelemetrySnapshot } from '../types';

type Listener = (snapshot: TelemetrySnapshot) => void;
type StatusListener = (connected: boolean) => void;

function createInitialSnapshot(): TelemetrySnapshot {
  const total = 32;
  const allocated = 16;
  const mockBlocks = Array.from({ length: total }, (_, idx) => ({
    block_id: idx,
    status: idx < allocated ? (idx % 5 === 0 ? 'PREEMPTED' : idx % 2 === 0 ? 'PREFILL' : 'DECODE') : 'FREE',
    request_id: idx < allocated ? `REQ-${100 + (idx % 6)}` : 'NONE',
    tokens_stored: idx < allocated ? 16 : 0,
  })) as any;

  return {
    step: 1,
    timestamp: Date.now() / 1000,
    strategy: 'priority',
    strategy_label: 'Priority-Aware Preemption Strategy',
    hardware: 'NVIDIA H100 SXM (80GB HBM3)',
    metrics: {
      ttft_p99_ms: 28.4,
      tpot_avg_ms: 14.8,
      throughput_tokens_sec: 2450,
      sm_compute_util_pct: 82.5,
      hbm_bandwidth_util_pct: 88.0,
      kv_capacity_blocks: total,
      allocated_blocks: allocated,
      kv_utilization_pct: 50.0,
      cost_per_hour_usd: 4.5,
    },
    step_actions: {
      prefill: [['REQ-101', 128], ['REQ-103', 256]],
      decode: ['REQ-102', 'REQ-104'],
      preempt: [],
      finished: ['REQ-100'],
    },
    kv_blocks: mockBlocks,
  };
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Listener[] = [];
  private statusListeners: StatusListener[] = [];
  private connected: boolean = false;
  private fallbackInterval: any = null;
  private fallbackStep: number = 1;
  private lastSnapshot: TelemetrySnapshot = createInitialSnapshot();

  constructor() {
    this.connect();
    // Start fallback ticks immediately so UI always updates live
    this.startFallbackSimulator();
  }

  public connect(): void {
    try {
      this.ws = new WebSocket('ws://localhost:8000/ws/telemetry');

      this.ws.onopen = () => {
        console.log('⚡ WebSocket Telemetry stream connected.');
        this.setConnected(true);
        this.stopFallbackSimulator();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.metrics) {
            this.lastSnapshot = data as TelemetrySnapshot;
            this.notifyListeners(this.lastSnapshot);
          } else if (data.event === 'connected' && data.initial_state) {
            this.lastSnapshot = data.initial_state as TelemetrySnapshot;
            this.notifyListeners(this.lastSnapshot);
          }
        } catch (e) {
          console.error('Error parsing WS frame:', e);
        }
      };

      this.ws.onerror = () => {
        this.setConnected(false);
        this.startFallbackSimulator();
      };

      this.ws.onclose = () => {
        this.setConnected(false);
        this.startFallbackSimulator();
        setTimeout(() => this.connect(), 3000);
      };
    } catch (e) {
      this.setConnected(false);
      this.startFallbackSimulator();
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    // Notify listener immediately with current snapshot
    listener(this.lastSnapshot);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.push(listener);
    listener(this.connected);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private setConnected(status: boolean): void {
    this.connected = status;
    this.statusListeners.forEach((l) => l(status));
  }

  private notifyListeners(snapshot: TelemetrySnapshot): void {
    this.listeners.forEach((l) => l(snapshot));
  }

  private startFallbackSimulator(): void {
    if (this.fallbackInterval) return;

    this.fallbackInterval = setInterval(() => {
      this.fallbackStep += 1;
      const allocated = Math.min(32, 14 + Math.floor(Math.sin(this.fallbackStep / 3) * 10));
      const total = 32;

      const mockBlocks = Array.from({ length: total }, (_, idx) => ({
        block_id: idx,
        status: idx < allocated ? (idx % 5 === 0 ? 'PREEMPTED' : idx % 2 === 0 ? 'PREFILL' : 'DECODE') : 'FREE',
        request_id: idx < allocated ? `REQ-${100 + (idx % 6)}` : 'NONE',
        tokens_stored: idx < allocated ? 16 : 0,
      })) as any;

      this.lastSnapshot = {
        step: this.fallbackStep,
        timestamp: Date.now() / 1000,
        strategy: 'priority',
        strategy_label: 'Priority-Aware Preemption Strategy',
        hardware: 'NVIDIA H100 SXM (80GB HBM3)',
        metrics: {
          ttft_p99_ms: Number((24.5 + Math.random() * 12).toFixed(1)),
          tpot_avg_ms: Number((14.2 + Math.random() * 4).toFixed(1)),
          throughput_tokens_sec: 2150 + Math.floor(Math.random() * 500),
          sm_compute_util_pct: Number((78.0 + Math.random() * 18).toFixed(1)),
          hbm_bandwidth_util_pct: Number((84.0 + Math.random() * 12).toFixed(1)),
          kv_capacity_blocks: total,
          allocated_blocks: allocated,
          kv_utilization_pct: Number(((allocated / total) * 100).toFixed(1)),
          cost_per_hour_usd: 4.5,
        },
        step_actions: {
          prefill: [['REQ-101', 128], ['REQ-103', 256]],
          decode: ['REQ-102', 'REQ-104'],
          preempt: this.fallbackStep % 6 === 0 ? ['REQ-105'] : [],
          finished: this.fallbackStep % 4 === 0 ? ['REQ-100'] : [],
        },
        kv_blocks: mockBlocks,
      };

      this.notifyListeners(this.lastSnapshot);
    }, 400);
  }

  private stopFallbackSimulator(): void {
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
  }
}

export const wsClient = new WebSocketClient();
