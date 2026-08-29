import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Gauge, Sparkles, ExternalLink } from 'lucide-react';
import { useMode } from '../../context/ModeContext';
import type { ScenarioData } from '../../types';

interface FactoryControlPanelProps {
  scenarios: ScenarioData;
  activeStrategy: string;
  activeHardware: string;
  activeScenario: string;
  speedMs: number;
  isRunning: boolean;
  onSelectStrategy: (s: string) => void;
  onSelectHardware: (h: string) => void;
  onSelectScenario: (s: string) => void;
  onSpeedChange: (ms: number) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}

const SPEED_OPTIONS = [
  { label: '🐢 Slow', ms: 1200, eli5: 'Slow (easy to follow)', tech: 'Slow (1200ms/tick)' },
  { label: '🚶 Normal', ms: 600,  eli5: 'Normal speed',        tech: 'Normal (600ms/tick)' },
  { label: '🏃 Fast',  ms: 250,  eli5: 'Fast',                tech: 'Fast (250ms/tick)' },
  { label: '⚡ Turbo', ms: 100,  eli5: 'Turbo (pro mode!)',   tech: 'Turbo (100ms/tick)' },
];

const ALL_LEVEL_STRATEGIES = [
  {
    id: 'naive',
    level: 1,
    emoji: '💥',
    eli5Name: 'Level 1: No Rules (OOM Crash)',
    techName: 'Level 1: Naive (CUDA OOM)',
    eli5Desc: 'No line, no slicing! Watch what happens when big prompts crash the GPU.',
    techDesc: 'Unmanaged forward pass admitting unbounded requests leading to memory pool exhaustion.',
    chapterPath: '/problem',
  },
  {
    id: 'fcfs',
    level: 2,
    emoji: '📋',
    eli5Name: 'Level 2: Fair Line (FCFS)',
    techName: 'Level 2: FCFS Queue',
    eli5Desc: 'FIFO queue stops crashes, but a monster prompt blocks everyone behind it.',
    techDesc: 'Strict arrival-order admission with Head-of-Line prefill blocking latency.',
    chapterPath: '/fcfs',
  },
  {
    id: 'chunked_prefill',
    level: 3,
    emoji: '🧩',
    eli5Name: 'Level 3: Smart Chunks',
    techName: 'Level 3: Chunked Prefill',
    eli5Desc: '128-token budget slices. Small questions slip in between large prompt chunks.',
    techDesc: 'Budget-bounded prefill prompt slicing preventing decode pipeline compute stalls.',
    chapterPath: '/chunked-prefill',
  },
  {
    id: 'paged_kv',
    level: 4,
    emoji: '📦',
    eli5Name: 'Level 4: Memory Saver',
    techName: 'Level 4: PagedAttention',
    eli5Desc: 'Zero wasted shelf space. Virtual block tables allocate 16-token memory slots.',
    techDesc: 'Non-contiguous physical KV block allocation eliminating internal fragmentation.',
    chapterPath: '/kv-capacity',
  },
  {
    id: 'preemption',
    level: 5,
    emoji: '🚨',
    eli5Name: 'Level 5: Emergency Evict',
    techName: 'Level 5: Victim Preemption',
    eli5Desc: 'When shelves fill 100%, lowest-priority requests are paused to make room.',
    techDesc: 'Dynamic victim selection and KV block reclamation under memory saturation.',
    chapterPath: '/preemption',
  },
  {
    id: 'priority',
    level: 6,
    emoji: '⭐',
    eli5Name: 'Level 6: VIP Fast Lane',
    techName: 'Level 6: Priority Preempt (vLLM)',
    eli5Desc: 'The complete enterprise system: VIP requests cut the line with guaranteed latency.',
    techDesc: 'Production priority-weighted preemption with strict sub-50ms TTFT SLO targets.',
    chapterPath: '/priority-preemption',
  },
];

export const FactoryControlPanel: React.FC<FactoryControlPanelProps> = ({
  scenarios,
  activeStrategy,
  activeHardware,
  activeScenario,
  speedMs,
  isRunning,
  onSelectStrategy,
  onSelectHardware,
  onSelectScenario,
  onSpeedChange,
  onStart,
  onPause,
  onReset,
}) => {
  const { t } = useMode();

  const currentMeta =
    ALL_LEVEL_STRATEGIES.find((s) => s.id === activeStrategy) ||
    ALL_LEVEL_STRATEGIES.find((s) => activeStrategy.includes(s.id)) ||
    ALL_LEVEL_STRATEGIES[5];

  return (
    <div className="card-elev p-5 bg-white border border-slate-200/90 shadow-sm space-y-4 text-[#0f172a]">
      {/* ── Title + Simulation Controls ───────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-black tracking-tight text-[#0f172a] flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <span>{t('🎮 Factory Master Controls', 'Control Plane Simulation Engine')}</span>
          </h3>
          <p className="text-[11px] text-[#64748b]">
            {t('Switch algorithms from all 6 story chapters in real time', 'Configure scheduler strategy, GPU architecture & traffic scenarios')}
          </p>
        </div>

        {/* Start / Pause / Reset buttons */}
        <div className="flex items-center gap-1.5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={isRunning ? onPause : onStart}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-white" />
                <span>{t('Pause', 'Pause')}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{t('Run Belt', 'Resume')}</span>
              </>
            )}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onReset}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('Clear Belt', 'Reset')}</span>
          </motion.button>
        </div>
      </div>

      {/* ── Speed Control ─────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black uppercase tracking-wider text-[#64748b] flex items-center gap-1">
            <Gauge className="w-3 h-3 text-blue-600" />
            <span>{t('Conveyor Belt Speed', 'Simulation Tick Rate')}</span>
          </label>
          <span className="text-[10px] font-mono font-bold text-blue-600">
            {speedMs}ms / tick
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.ms}
              onClick={() => onSpeedChange(opt.ms)}
              className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                speedMs === opt.ms
                  ? 'bg-blue-50 border-blue-400 text-blue-700 ring-1 ring-blue-400/30 shadow-sm font-black'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── ALL 6 STORY LEVEL STRATEGIES ───────────────────── */}
      <div className="space-y-2 pt-1 border-t border-slate-100">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-[#64748b]">
              {t('Active Level Algorithm (6 Levels)', 'Scheduler Strategy (Levels 1–6)')}
            </label>
            <span className="text-[10px] font-mono font-bold text-emerald-700">
              Level {currentMeta.level} Selected
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {ALL_LEVEL_STRATEGIES.map((meta) => {
              const id = meta.id;
              const isSelected = activeStrategy === id || (activeStrategy === 'chunked' && id === 'chunked_prefill');

              return (
                <motion.button
                  key={id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelectStrategy(id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-400/20 shadow-sm font-black'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span>{meta.emoji}</span>
                    <span className="truncate">{t(meta.eli5Name, meta.techName)}</span>
                  </div>

                  {isSelected && (
                    <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[8px] font-black uppercase flex-shrink-0">
                      ON
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── Active Level Concept Card ── */}
        <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200/80 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>{t(`Concept from Level ${currentMeta.level}`, `Level ${currentMeta.level} Policy`)}</span>
            </span>
            <Link
              to={currentMeta.chapterPath}
              className="text-[10px] font-bold text-blue-700 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
            >
              <span>Review Lesson {currentMeta.level}</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          </div>
          <p className="text-[11px] text-slate-700 leading-snug">
            {t(currentMeta.eli5Desc, currentMeta.techDesc)}
          </p>
        </div>
      </div>

      {/* ── Hardware & Scenario ──────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
        <div>
          <label className="block text-[10px] font-black text-[#64748b] uppercase tracking-wider mb-1">
            {t('Machine Type', 'GPU Hardware')}
          </label>
          <div className="space-y-1">
            {(scenarios.hardware_profiles.length > 0
              ? scenarios.hardware_profiles
              : [
                  { id: 'h100_sxm', display_name: 'H100 SXM', vram_gb: 80, tflops: 2000 },
                  { id: 'a100_80gb', display_name: 'A100 SXM', vram_gb: 80, tflops: 312 },
                  { id: 'l40s', display_name: 'L40S PCIe', vram_gb: 48, tflops: 733 },
                ]
            ).map((h) => (
              <button
                key={h.id}
                onClick={() => onSelectHardware(h.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  activeHardware === h.id
                    ? 'bg-blue-50 border-blue-400 text-blue-800 shadow-sm font-black'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{h.display_name}</span>
                <span className="text-[10px] opacity-75 font-mono">{h.vram_gb}GB</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-[#64748b] uppercase tracking-wider mb-1">
            {t('Traffic Pattern', 'Traffic Scenario')}
          </label>
          <div className="space-y-1">
            {(scenarios.scenarios.length > 0
              ? scenarios.scenarios
              : [
                  { id: 'rush_hour_spike', name: 'Rush Hour Spike', description: 'Morning traffic spike' },
                  { id: 'long_document_qa', name: 'Monster Documents', description: 'Long prompt workload' },
                  { id: 'mixed_chat_stream', name: 'Mixed Interactive', description: 'Real-world mixture' },
                ]
            ).map((s) => (
              <button
                key={s.id}
                onClick={() => onSelectScenario(s.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all truncate cursor-pointer ${
                  activeScenario === s.id
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-sm font-black'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="truncate">{s.name}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
