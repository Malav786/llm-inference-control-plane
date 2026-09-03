/**
 * Smoke test for the App (factory floor dashboard).
 *
 * Strategy: mock ALL heavy factory components and the WS/API services so the
 * test runs entirely in jsdom without framer-motion animations, recharts SVG,
 * or any canvas/animation APIs that are unavailable in a test environment.
 *
 * Checks:
 *  1. App renders without throwing.
 *  2. Loading state is shown before any telemetry snapshot arrives.
 *  3. After pushing a snapshot with telemetry_kind="modeled_estimate", the
 *     "Modeled Estimate" badge is rendered.
 *  4. After pushing isConnected=true, a "Live" / "Connected" indicator is rendered.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModeProvider } from '../context/ModeContext';
import type { TelemetrySnapshot } from '../types';

// ── Mock all heavy factory components with lightweight stubs ─────────────────
vi.mock('../components/factory/FactoryHeader', () => ({
  FactoryHeader: ({ isConnected, telemetryKind }: any) => (
    <div>
      <span data-testid="connection-status">{isConnected ? 'Live Connected' : 'Offline'}</span>
      {telemetryKind === 'modeled_estimate' && (
        <span data-testid="telemetry-badge">Modeled Estimate</span>
      )}
    </div>
  ),
}));

vi.mock('../components/factory/ConveyorBelt', () => ({
  ConveyorBelt: () => <div data-testid="conveyor-belt" />,
}));

vi.mock('../components/factory/FactoryControlPanel', () => ({
  FactoryControlPanel: () => <div data-testid="control-panel" />,
}));

vi.mock('../components/factory/InjectorStation', () => ({
  InjectorStation: () => <div data-testid="injector-station" />,
}));

vi.mock('../components/factory/FactoryMetrics', () => ({
  FactoryMetrics: ({ metrics }: any) => (
    <div data-testid="factory-metrics">
      <span data-testid="ttft">{metrics?.ttft_p99_ms ?? 'null'}</span>
    </div>
  ),
}));

vi.mock('../components/factory/WarehouseShelf', () => ({
  WarehouseShelf: () => <div data-testid="warehouse-shelf" />,
}));

// ── Mock WS client — capture subscribers so tests can push data ───────────────
let _telemetryListeners: ((s: TelemetrySnapshot) => void)[] = [];
let _statusListeners: ((c: boolean) => void)[] = [];

vi.mock('../services/websocket', () => ({
  wsClient: {
    connect: vi.fn(),
    subscribe: vi.fn((cb: (s: TelemetrySnapshot) => void) => {
      _telemetryListeners.push(cb);
      return () => {
        _telemetryListeners = _telemetryListeners.filter(l => l !== cb);
      };
    }),
    subscribeStatus: vi.fn((cb: (c: boolean) => void) => {
      _statusListeners.push(cb);
      return () => {
        _statusListeners = _statusListeners.filter(l => l !== cb);
      };
    }),
  },
}));

// ── Mock all REST API calls ──────────────────────────────────────────────────
vi.mock('../services/api', () => ({
  fetchScenarios: vi.fn().mockResolvedValue({
    strategies: [{ id: 'priority', label: 'Priority-Aware Preemption' }],
    hardware_profiles: [{ id: 'h100_sxm', display_name: 'H100', vram_gb: 80, tflops: 989 }],
    scenarios: [{ id: 'rush_hour_spike', name: 'Rush Hour', description: 'Test' }],
  }),
  startSimulation: vi.fn().mockResolvedValue({}),
  pauseSimulation: vi.fn().mockResolvedValue({}),
  resetSimulation: vi.fn().mockResolvedValue({}),
  injectRequest: vi.fn().mockResolvedValue({}),
  setSimulationSpeed: vi.fn().mockResolvedValue({}),
}));

// ── Minimal valid TelemetrySnapshot ─────────────────────────────────────────
function makeMockSnapshot(overrides: Partial<TelemetrySnapshot> = {}): TelemetrySnapshot {
  const total = 32;
  const allocated = 12;
  return {
    step: 5,
    timestamp: Date.now() / 1000,
    strategy: 'priority',
    strategy_label: 'Priority-Aware Preemption',
    hardware: 'NVIDIA H100 SXM (80GB HBM3)',
    telemetry_kind: 'modeled_estimate',
    metrics: {
      ttft_p99_ms: 18.5,
      tpot_avg_ms: 4.2,
      throughput_tokens_sec: 1800,
      sm_compute_util_pct: 62.0,
      hbm_bandwidth_util_pct: 71.5,
      kv_capacity_blocks: total,
      allocated_blocks: allocated,
      kv_utilization_pct: (allocated / total) * 100,
      cost_per_hour_usd: 4.5,
    },
    step_actions: {
      prefill: [['REQ-101', 128]],
      decode: ['REQ-102'],
      preempt: [],
      finished: [],
    },
    kv_blocks: Array.from({ length: total }, (_, i) => ({
      block_id: i,
      status: (i < allocated ? 'DECODE' : 'FREE') as 'DECODE' | 'FREE',
      request_id: i < allocated ? 'REQ-102' : 'NONE',
      tokens_stored: i < allocated ? 16 : 0,
    })),
    ...overrides,
  };
}

// ── Render helper ────────────────────────────────────────────────────────────
async function renderApp() {
  const { default: App } = await import('../App');
  let utils: ReturnType<typeof render> = undefined!;
  await act(async () => {
    utils = render(
      <MemoryRouter>
        <ModeProvider>
          <App />
        </ModeProvider>
      </MemoryRouter>
    );
  });
  return utils;
}

// ── Test suite ────────────────────────────────────────────────────────────────
describe('App smoke tests', () => {
  beforeEach(() => {
    _telemetryListeners = [];
    _statusListeners = [];
    vi.clearAllMocks();
  });

  it('mounts without crashing', async () => {
    await renderApp();
    expect(true).toBe(true);
  });

  it('shows loading state before first telemetry snapshot', async () => {
    await renderApp();
    // No snapshot has been pushed yet — the loading screen should show
    const loading = screen.queryByText(/Starting the Factory|Initializing Simulation Engine/i);
    expect(loading).not.toBeNull();
  });

  it('renders Grand Finale Arena after receiving a snapshot', async () => {
    await renderApp();
    await act(async () => {
      _telemetryListeners.forEach(cb => cb(makeMockSnapshot()));
    });
    expect(screen.queryByText(/Grand Finale Arena/i)).not.toBeNull();
  });

  it('surfaces "Modeled Estimate" badge when telemetry_kind is modeled_estimate', async () => {
    await renderApp();
    await act(async () => {
      _telemetryListeners.forEach(cb =>
        cb(makeMockSnapshot({ telemetry_kind: 'modeled_estimate' }))
      );
    });
    expect(screen.getByTestId('telemetry-badge')).toBeTruthy();
    expect(screen.getByTestId('telemetry-badge').textContent).toBe('Modeled Estimate');
  });

  it('shows Live Connected badge when WebSocket reports connected=true', async () => {
    await renderApp();
    await act(async () => {
      _statusListeners.forEach(cb => cb(true));
      _telemetryListeners.forEach(cb => cb(makeMockSnapshot()));
    });
    const statusEl = screen.getByTestId('connection-status');
    expect(statusEl.textContent).toBe('Live Connected');
  });

  it('metrics component receives the correct ttft value from snapshot', async () => {
    await renderApp();
    await act(async () => {
      _telemetryListeners.forEach(cb =>
        cb(makeMockSnapshot({ metrics: { ...makeMockSnapshot().metrics, ttft_p99_ms: 42.7 } }))
      );
    });
    // FactoryMetrics stub renders the ttft value
    expect(screen.getByTestId('ttft').textContent).toBe('42.7');
  });
});
