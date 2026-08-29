import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Send, Sparkles, SlidersHorizontal } from 'lucide-react';
import { useMode } from '../../context/ModeContext';
import { getRandomRequestName } from '../../utils/requestNames';

interface InjectorStationProps {
  onInject: (reqId: string, jobName: string, promptLen: number, maxTokens: number, priority: number) => void;
}

interface PromptPreset {
  id: string;
  name: string;
  category: string;
  promptLen: number;
  maxTokens: number;
  priority: number;
  lessonTag: string;
  color: string;
}

const STORY_PRESETS: PromptPreset[] = [
  {
    id: 'preset-monster',
    name: 'Analyze 100-Page Merger Contract 📄',
    category: 'Monster Prompt',
    promptLen: 512,
    maxTokens: 256,
    priority: 5,
    lessonTag: 'Tests Slicing (Level 3)',
    color: 'border-amber-200 bg-amber-50/80 text-amber-900 hover:bg-amber-100',
  },
  {
    id: 'preset-short',
    name: 'Translate "Good morning" to Japanese 🌐',
    category: 'Quick Prompt',
    promptLen: 48,
    maxTokens: 32,
    priority: 5,
    lessonTag: 'Tests Interleaving (Level 3)',
    color: 'border-blue-200 bg-blue-50/80 text-blue-900 hover:bg-blue-100',
  },
  {
    id: 'preset-code',
    name: 'Debug Python Async Memory Leak 💻',
    category: 'Standard Code',
    promptLen: 96,
    maxTokens: 96,
    priority: 6,
    lessonTag: 'Standard Workload',
    color: 'border-purple-200 bg-purple-50/80 text-purple-900 hover:bg-purple-100',
  },
  {
    id: 'preset-vip',
    name: '🚨 Emergency Security Patch (VIP P10)',
    category: 'VIP Emergency',
    promptLen: 64,
    maxTokens: 48,
    priority: 10,
    lessonTag: 'Tests Preemption (Level 5 & 6)',
    color: 'border-rose-200 bg-rose-50/80 text-rose-900 hover:bg-rose-100',
  },
];

export const InjectorStation: React.FC<InjectorStationProps> = ({ onInject }) => {
  const { t } = useMode();
  const [priority, setPriority] = useState(5);
  const [promptLen, setPromptLen] = useState(128);
  const [maxTokens, setMaxTokens] = useState(64);
  const [currentJobName, setCurrentJobName] = useState(() => getRandomRequestName());
  const [fired, setFired] = useState(false);
  const [lastId, setLastId] = useState('');

  const applyPreset = (p: PromptPreset) => {
    setCurrentJobName(p.name);
    setPromptLen(p.promptLen);
    setMaxTokens(p.maxTokens);
    setPriority(p.priority);
  };

  const handleInject = () => {
    const id = `REQ-${Date.now().toString().slice(-4)}`;
    setLastId(id);
    onInject(id, currentJobName, promptLen, maxTokens, priority);
    setFired(true);
    setCurrentJobName(getRandomRequestName());
    setTimeout(() => setFired(false), 2400);
  };

  const priorityColor =
    priority >= 8 ? 'text-rose-600' : priority >= 5 ? 'text-amber-600' : 'text-blue-600';

  const priorityLabel =
    priority >= 8
      ? t('🔥 Urgent VIP (evicts others!)', 'Critical P8–P10 (Preempts victim KV cache)')
      : priority >= 5
      ? t('⚡ Normal Priority', 'Standard Priority P4–P7')
      : t('🌱 Background Job (can be paused)', 'Batch / Low Priority P1–P3 (High victim score)');

  return (
    <div className="card-elev p-5 bg-white border border-slate-200/90 shadow-sm space-y-4 text-[#0f172a] flex flex-col justify-between">
      {/* ── Title ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black tracking-tight text-[#0f172a]">
              {t('🧪 Live Request Injector', 'Custom Payload Injector')}
            </h3>
            <p className="text-[11px] text-[#64748b]">
              {t('Create custom prompts or click story presets to test algorithms', 'Inject synthetic prompts into the live WebSocket pipeline')}
            </p>
          </div>
        </div>

        <button
          onClick={() => setCurrentJobName(getRandomRequestName())}
          className="text-[10px] font-bold text-blue-600 hover:text-blue-700 underline cursor-pointer"
        >
          {t('🎲 New Random Name', 'Randomise Job')}
        </button>
      </div>

      <div className="space-y-4">
        {/* ── Story Benchmark Presets ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#64748b] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>{t('Story Benchmark Presets', 'Scenario Benchmarks')}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {STORY_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer shadow-sm ${p.color}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-black uppercase tracking-wider opacity-75">{p.category}</span>
                  <span className="text-[8px] font-mono font-bold bg-white/70 px-1.5 py-0.5 rounded border border-black/10">{p.promptLen}t</span>
                </div>
                <p className="text-[11px] font-bold leading-tight line-clamp-1">{p.name}</p>
                <span className="text-[9px] opacity-75 block mt-1">🎯 {p.lessonTag}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Sliders Section ── */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-[#64748b] uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('Custom Parameters', 'Payload Dimensions')}</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]">{currentJobName}</span>
          </div>

          {/* Priority Slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                {t('Urgency / Priority', 'Priority Rating')}
              </label>
              <span className={`text-xs font-black ${priorityColor}`}>{priority}/10</span>
            </div>
            <input
              type="range" min={1} max={10} step={1}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full h-1.5 rounded-full accent-blue-600 cursor-pointer"
            />
            <p className={`text-[10px] font-semibold mt-0.5 ${priorityColor}`}>{priorityLabel}</p>
          </div>

          {/* Prompt Token Slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                {t('Prompt Input Length', 'Prompt Tokens')}
              </label>
              <span className="text-xs font-black text-blue-600">{promptLen} {t('words', 'tokens')}</span>
            </div>
            <input
              type="range" min={32} max={1024} step={32}
              value={promptLen}
              onChange={(e) => setPromptLen(Number(e.target.value))}
              className="w-full h-1.5 rounded-full accent-blue-600 cursor-pointer"
            />
          </div>

          {/* Max Tokens */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                {t('Max Output Answer Length', 'Max Output Tokens')}
              </label>
              <span className="text-xs font-black text-purple-600">{maxTokens} {t('words', 'tokens')}</span>
            </div>
            <input
              type="range" min={32} max={512} step={32}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              className="w-full h-1.5 rounded-full accent-purple-600 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* ── Action & Confirmation ── */}
      <div className="space-y-3 pt-3">
        {/* BIG INJECT BUTTON */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.01 }}
          onClick={handleInject}
          className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>{t('🚀 INJECT JOB ONTO FACTORY FLOOR', '🚀 INJECT REQUEST INTO ENGINE')}</span>
        </motion.button>

        {/* Fired confirmation */}
        <AnimatePresence>
          {fired && (
            <motion.div
              key="fired"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200"
            >
              <span className="text-base">🎉</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-emerald-800 truncate">
                  {t(`Injected "${currentJobName}"!`, `Injected ${lastId}`)}
                </p>
                <p className="text-[10px] text-emerald-700/90">
                  {t('Watch the highlighted box appear on the conveyor belt above ☝️', 'Active on pipeline')}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
