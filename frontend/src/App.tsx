import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FactoryHeader } from './components/factory/FactoryHeader';
import { ConveyorBelt } from './components/factory/ConveyorBelt';
import { FactoryControlPanel } from './components/factory/FactoryControlPanel';
import { InjectorStation } from './components/factory/InjectorStation';
import { FactoryMetrics } from './components/factory/FactoryMetrics';
import { WarehouseShelf } from './components/factory/WarehouseShelf';
import { wsClient } from './services/websocket';
import {
  fetchScenarios,
  startSimulation,
  pauseSimulation,
  resetSimulation,
  injectRequest,
  setSimulationSpeed,
} from './services/api';
import type { TelemetrySnapshot, ScenarioData } from './types';
import { RefreshCw, BookOpen, X, Trophy } from 'lucide-react';
import { useMode } from './context/ModeContext';

const STORY_LINKS = [
  { path: '/problem', num: 1, emoji: '🔥', label: '1. Problem' },
  { path: '/fcfs', num: 2, emoji: '📋', label: '2. FCFS' },
  { path: '/chunked-prefill', num: 3, emoji: '🧩', label: '3. Chunks' },
  { path: '/kv-capacity', num: 4, emoji: '📦', label: '4. Memory' },
  { path: '/preemption', num: 5, emoji: '🚨', label: '5. Evict' },
  { path: '/priority-preemption', num: 6, emoji: '⭐', label: '6. VIP' },
];

// ── Injection Toast ───────────────────────────────────────────
interface ToastData {
  id: number;
  jobName: string;
  priority: number;
  promptLen: number;
}

const InjectionToast: React.FC<{ toast: ToastData; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const { t } = useMode();
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const priorityColor = toast.priority >= 8 ? 'from-red-600 to-rose-600' :
    toast.priority >= 5 ? 'from-amber-500 to-orange-500' :
    'from-emerald-600 to-teal-600';

  return (
    <motion.div
      initial={{ y: -80, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -80, opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4"
    >
      <div className={`bg-gradient-to-r ${priorityColor} rounded-2xl p-[2px] shadow-2xl shadow-black/50`}>
        <div className="bg-[#07101e] rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="text-3xl animate-bounce">🚀</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-white uppercase tracking-widest mb-0.5">
              {t('🏭 NEW JOB DROPPED ONTO FACTORY FLOOR!', '🔴 Live Request Injected into Engine')}
            </p>
            <p className="text-sm font-bold text-slate-200 truncate">"{toast.jobName}"</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {t(
                `Urgency ${toast.priority}/10 · ${toast.promptLen} words · Watch the conveyor belt!`,
                `priority=${toast.priority} · prompt_len=${toast.promptLen}t`
              )}
            </p>
          </div>
          <button onClick={onDismiss} className="text-slate-500 hover:text-white transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const App: React.FC = () => {
  const { t } = useMode();

  // ── Telemetry state ──────────────────────────────────────────
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(true);

  // ── UI state ─────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastData | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // ── Simulation config ────────────────────────────────────────
  const [activeStrategy, setActiveStrategy] = useState('priority');
  const [activeHardware, setActiveHardware] = useState('h100_sxm');
  const [activeScenario, setActiveScenario] = useState('rush_hour_spike');
  const [speedMs, setSpeedMs] = useState(600);
  const [scenariosData, setScenariosData] = useState<ScenarioData>({
    strategies: [],
    hardware_profiles: [],
    scenarios: [],
  });

  useEffect(() => {
    fetchScenarios().then((data) => setScenariosData(data)).catch(() => {});
  }, []);

  useEffect(() => {
    const unsubTelemetry = wsClient.subscribe((data) => setSnapshot(data));
    const unsubStatus = wsClient.subscribeStatus((connected) => setIsConnected(connected));
    return () => { unsubTelemetry(); unsubStatus(); };
  }, []);

  // ── Engine handlers ──────────────────────────────────────────
  interface SimOverrides { strategy?: string; hardware?: string; scenario?: string; }
  const startSim = useCallback((overrides: SimOverrides = {}) =>
    startSimulation({
      strategy: overrides.strategy ?? activeStrategy,
      hardware:  overrides.hardware  ?? activeHardware,
      scenario:  overrides.scenario  ?? activeScenario,
      max_work: 4096,
      kv_capacity: 8192,
    }).catch(() => {}),
  [activeStrategy, activeHardware, activeScenario]);

  const handleStart = async () => { setIsRunning(true); await startSim(); };
  const handlePause = async () => { setIsRunning(false); await pauseSimulation().catch(() => {}); };
  const handleReset = async () => { await resetSimulation().catch(() => {}); };

  const handleStrategyChange = (s: string) => { setActiveStrategy(s); startSim({ strategy: s }); };
  const handleHardwareChange = (h: string) => { setActiveHardware(h); startSim({ hardware: h }); };
  const handleScenarioChange = (sc: string) => { setActiveScenario(sc); startSim({ scenario: sc }); };

  const handleSpeedChange = (ms: number) => {
    setSpeedMs(ms);
    setSimulationSpeed(ms).catch(() => {});
  };

  const handleInject = useCallback((reqId: string, jobName: string, promptLen: number, maxTokens: number, priority: number) => {
    injectRequest({ request_id: reqId, prompt_len: promptLen, max_tokens: maxTokens, priority })
      .catch(() => {});
    setToast({ id: Date.now(), jobName, priority, promptLen });
    setHighlightedId(reqId);
    setTimeout(() => setHighlightedId(null), 4000);
  }, []);

  // ── Loading screen ───────────────────────────────────────────
  if (!snapshot) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="p-5 rounded-3xl bg-sky-500/10 border border-sky-500/20">
          <RefreshCw className="w-10 h-10 text-sky-400 animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-base font-bold text-white">🏭 {t('Starting the Factory...', 'Initializing Simulation Engine...')}</p>
          <p className="text-sm text-slate-400">{t('Connecting to AI engine', 'Connecting to FastAPI WebSocket stream')}</p>
        </div>
        <div className="w-80 overflow-hidden rounded-2xl mt-4">
          <div className="conveyor-belt h-14" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-[1600px] mx-auto px-4 py-6 md:px-6 space-y-6">

      {/* Injection Toast (top center) */}
      <AnimatePresence>
        {toast && <InjectionToast key={toast.id} toast={toast} onDismiss={() => setToast(null)} />}
      </AnimatePresence>

      {/* ① Header */}
      <FactoryHeader
        isConnected={isConnected}
      />

      {/* ── GRAND FINALE ARENA: ALL-LEVELS STORY BAR ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-elev p-4 rounded-3xl border border-emerald-300 bg-emerald-50/70 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                Grand Finale Arena
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <h2 className="text-base md:text-lg font-black text-[#0f172a]">
              {t('🏭 The Live Factory Floor — All Levels Combined!', 'Live Production Telemetry Simulator')}
            </h2>
            <p className="text-xs text-[#475569]">
              {t('You unlocked the full engine! Switch strategies or jump back to review any chapter below:', 'Full WebSocket telemetry pipeline incorporating chunked prefill, paged memory & preemption')}
            </p>
          </div>
        </div>

        {/* Story Chapter Quick Jumps */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Link to="/">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[#0f172a] font-bold text-xs transition-all cursor-pointer shadow-sm">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>Story Home</span>
            </button>
          </Link>

          <Link to="/docs">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[#0f172a] font-bold text-xs transition-all cursor-pointer shadow-sm">
              <span className="text-blue-600">📚</span>
              <span>Docs</span>
            </button>
          </Link>

          <div className="w-px h-5 bg-slate-200 hidden sm:block" />

          {STORY_LINKS.map((sl) => (
            <Link key={sl.path} to={sl.path}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[#0f172a] text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <span>{sl.emoji}</span>
                <span className="hidden xl:inline">{sl.label}</span>
                <span className="xl:hidden">L{sl.num}</span>
              </motion.button>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* ② Conveyor Belt */}
      <ConveyorBelt
        stepActions={snapshot.step_actions}
        step={snapshot.step}
        speedMs={speedMs}
        isRunning={isRunning}
        highlightedId={highlightedId}
      />

      {/* ③ Controls + Injector (Aligned with all levels) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FactoryControlPanel
          scenarios={scenariosData}
          activeStrategy={activeStrategy}
          activeHardware={activeHardware}
          activeScenario={activeScenario}
          speedMs={speedMs}
          isRunning={isRunning}
          onSelectStrategy={handleStrategyChange}
          onSelectHardware={handleHardwareChange}
          onSelectScenario={handleScenarioChange}
          onSpeedChange={handleSpeedChange}
          onStart={handleStart}
          onPause={handlePause}
          onReset={handleReset}
        />
        <InjectorStation onInject={handleInject} />
      </div>

      {/* ④ Live Metrics */}
      <FactoryMetrics metrics={snapshot.metrics} />

      {/* ⑤ Warehouse Shelf */}
      <WarehouseShelf blocks={snapshot.kv_blocks} metrics={snapshot.metrics} />

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 pb-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p>© {new Date().getFullYear()} <strong className="text-[#0f172a]">Malav Champaneria</strong>. All rights reserved.</p>
        <p className="font-semibold text-slate-600">MIT Open Source License</p>
      </footer>
    </div>
  );
};

export default App;
