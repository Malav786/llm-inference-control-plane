import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, RotateCcw, Lock, Warehouse, CheckCircle2 } from 'lucide-react';
import { StoryPageTemplate } from '../components/story/StoryPageTemplate';
import { useMode } from '../context/ModeContext';

interface PromptItem {
  id: string;
  label: string;
  category: string;
  slotsNeeded: number;
}

const DEFAULT_PROMPTS: PromptItem[] = [
  { id: 'p-1', label: '100-Page Financial Due Diligence Audit 📄', category: 'Heavy Doc Analysis', slotsNeeded: 3 },
  { id: 'p-2', label: 'Translate "Hello World" into French 🌐', category: 'Quick Translation', slotsNeeded: 1 },
  { id: 'p-3', label: 'Generate React 19 Kanban Board Code 💻', category: 'Code Generation', slotsNeeded: 2 },
  { id: 'p-4', label: 'Summarize 50-Page Legal Contract ⚖️', category: 'Legal Summary', slotsNeeded: 3 },
  { id: 'p-5', label: 'Draft Customer Apology Email ✉️', category: 'Quick Support', slotsNeeded: 1 },
  { id: 'p-6', label: 'Write Full Python Async Microservice 🐍', category: 'Backend Coding', slotsNeeded: 2 },
  { id: 'p-7', label: 'Extract Entities from Medical Record 🏥', category: 'Clinical NLP', slotsNeeded: 2 },
  { id: 'p-8', label: 'Grammar Polish on 1 Paragraph 📝', category: 'Quick Edit', slotsNeeded: 1 },
  { id: 'p-9', label: 'Analyze Corporate Q3 Earnings Call 📈', category: 'Audio Transcript', slotsNeeded: 3 },
  { id: 'p-10', label: 'Generate Unit Tests for Stripe Webhook 🔬', category: 'Test Generation', slotsNeeded: 2 },
];

const SHELF_COLORS = [
  'bg-blue-600 border-blue-700 text-white',
  'bg-emerald-600 border-emerald-700 text-white',
  'bg-purple-600 border-purple-700 text-white',
  'bg-amber-600 border-amber-700 text-white',
  'bg-indigo-600 border-indigo-700 text-white',
  'bg-rose-600 border-rose-700 text-white',
  'bg-teal-600 border-teal-700 text-white',
];

const MemoryIllustration: React.FC = () => {
  const { t } = useMode();
  const [capacity, setCapacity] = useState<number>(8);
  const [shelves, setShelves] = useState<{ id: string; label: string; color: string }[]>([]);
  const [waitList, setWaitList] = useState<PromptItem[]>(DEFAULT_PROMPTS);
  const [blockedPrompt, setBlockedPrompt] = useState<PromptItem | null>(null);

  const admitNext = () => {
    if (waitList.length === 0) return;
    const next = waitList[0];
    const freeSlots = capacity - shelves.length;

    if (next.slotsNeeded <= freeSlots) {
      const color = SHELF_COLORS[shelves.length % SHELF_COLORS.length];
      const newOccupied = Array.from({ length: next.slotsNeeded }).map((_, i) => ({
        id: `${next.id}-${i}-${Date.now()}`,
        label: next.label,
        color,
      }));
      setShelves((prev) => [...prev, ...newOccupied]);
      setWaitList((prev) => prev.slice(1));
      setBlockedPrompt(null);
    } else {
      setBlockedPrompt(next);
    }
  };

  const freeSlots = () => {
    if (shelves.length === 0) return;
    setShelves((prev) => prev.slice(2));
    setBlockedPrompt(null);
  };

  const addMoreRandomPrompts = () => {
    const extra: PromptItem[] = [
      { id: `p-extra-1-${Date.now()}`, label: 'Translate Sales Presentation to German 🇩🇪', category: 'Translation', slotsNeeded: 1 },
      { id: `p-extra-2-${Date.now()}`, label: 'Review 40-Page Architecture RFP 🏗️', category: 'Deep Document', slotsNeeded: 3 },
      { id: `p-extra-3-${Date.now()}`, label: 'Generate SQL Migration Script 💾', category: 'Database', slotsNeeded: 2 },
    ];
    setWaitList(w => [...w, ...extra]);
  };

  const handleReset = () => {
    setShelves([]);
    setBlockedPrompt(null);
    setWaitList(DEFAULT_PROMPTS);
  };

  const usedPct = Math.min(100, Math.round((shelves.length / capacity) * 100));

  return (
    <div className="w-full space-y-6 text-[#0f172a]">
      {/* ── Capacity Controls Header ── */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
            <Warehouse className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-black text-[#0f172a] uppercase tracking-wider">
              {t('📦 Memory Warehouse Shelf Size', 'KV-Cache Capacity Ceiling')}
            </p>
            <p className="text-xs text-slate-500">
              {t('Total storage slots in the GPU memory bank', 'Hard upper bound on physical KV-blocks')}
            </p>
          </div>
        </div>

        {/* Capacity Size Selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-blue-700">{capacity} {t('shelves', 'blocks')}</span>
          <div className="flex gap-1.5">
            {[6, 8, 12].map(c => (
              <button
                key={c}
                onClick={() => { setCapacity(c); handleReset(); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${capacity === c
                    ? 'bg-blue-600 border-blue-700 text-white shadow-sm font-black'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                {c} {t('slots', 'blocks')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Visual Layout: Memory Grid (Left) + Queue List (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Memory Warehouse Shelves */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <span className="text-xs font-black uppercase tracking-widest text-[#0f172a] flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-blue-600" />
                {t('🏗️ Memory Shelves in GPU', 'Allocated KV-Cache Blocks')}
              </span>
              <span className={`text-xs font-mono font-bold ${usedPct >= 100 ? 'text-rose-600' : usedPct >= 75 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {shelves.length}/{capacity} {t('slots used', 'allocated')} ({usedPct}%)
              </span>
            </div>

            {/* Shelf Grid */}
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${capacity <= 8 ? 4 : 6}, 1fr)` }}
            >
              {Array.from({ length: capacity }).map((_, i) => {
                const slot = shelves[i];
                return (
                  <motion.div
                    key={i}
                    className={`h-16 rounded-xl border p-1.5 flex flex-col justify-between text-center transition-all shadow-xs ${slot
                        ? `${slot.color} shadow-sm`
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    animate={slot ? { scale: [0.95, 1.02, 1] } : { scale: 1 }}
                  >
                    <span className="text-[9px] font-mono font-bold opacity-75 text-left">#{i + 1}</span>
                    {slot ? (
                      <span className="text-[9px] font-bold leading-tight line-clamp-2 text-white">
                        {slot.label}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-semibold">Empty</span>
                    )}
                    <div />
                  </motion.div>
                );
              })}
            </div>

            {/* Capacity Saturation Gauge */}
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-slate-600">
                <span>{t('Shelf Fill Rate', 'KV Memory Utilization')}</span>
                <span className={usedPct >= 100 ? 'text-rose-600 font-black' : ''}>{usedPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                <motion.div
                  className={`h-full rounded-full transition-all duration-300 ${usedPct >= 100 ? 'bg-rose-500' : usedPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  style={{ width: `${usedPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Shelf Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={admitNext}
              disabled={waitList.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs disabled:opacity-40 transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('Admit Next Job', 'Admit Next Request')}</span>
            </button>
            <button
              onClick={freeSlots}
              disabled={shelves.length === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs disabled:opacity-40 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('✅ Finish & Free 1 Job', 'Free Oldest KV Blocks')}</span>
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Admission Queue (10 Real Prompts) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <span className="text-xs font-black uppercase tracking-widest text-[#0f172a]">
                {t('⏳ Waiting at the Door (Queue)', 'Incoming Request Queue')}
              </span>
              <span className="text-xs font-mono font-bold text-blue-600">{waitList.length} prompts left</span>
            </div>

            {/* Blocked Alert Banner if full */}
            <AnimatePresence>
              {blockedPrompt && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5"
                >
                  <Lock className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-rose-800">
                      {t('🛑 Cannot Admit: Memory Shelves Full!', 'Admission Rejected: KV Capacity Exceeded')}
                    </p>
                    <p className="text-[11px] text-rose-700/90 mt-0.5">
                      "{blockedPrompt.label}" needs {blockedPrompt.slotsNeeded} slots, but only {capacity - shelves.length} available.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Prompt List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              <AnimatePresence>
                {waitList.map((prompt, idx) => (
                  <motion.div
                    key={prompt.id}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 shadow-xs ${idx === 0
                        ? 'border-blue-300 bg-blue-50/70 text-blue-950 ring-1 ring-blue-300'
                        : 'border-slate-200 bg-slate-50 text-slate-800'
                      }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {prompt.category}
                        </span>
                        {idx === 0 && (
                          <span className="text-[9px] font-bold text-blue-700">👉 Next Up</span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-[#0f172a] mt-1 truncate">{prompt.label}</p>
                    </div>

                    <span className="text-[10px] font-mono font-bold bg-white px-2 py-1 rounded border border-slate-200 text-slate-700 flex-shrink-0">
                      📦 {prompt.slotsNeeded} {t('slots', 'blocks')}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {waitList.length === 0 && (
                <div className="py-8 text-center text-slate-500 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-xs font-bold text-emerald-800">{t('All 10 prompts admitted into memory!', 'Queue successfully admitted')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <button
              onClick={addMoreRandomPrompts}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('Add 3 More Sample Prompts', 'Enqueue +3 Synthetic Requests')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Page4Memory: React.FC = () => (
  <StoryPageTemplate
    chapterNum={4}
    emoji="📦"
    eli5Title="The Memory Warehouse"
    techTitle="KV-Capacity Scheduler"
    eli5Subtitle="When the shelves are full, new jobs wait at the door — no crashing, just waiting"
    techSubtitle="Hard KV-cache admission control: admit only if capacity allows, otherwise block (no preemption)"
    illustration={<MemoryIllustration />}
    eli5Body={
      <div className="space-y-4 text-slate-800">
        <p>Imagine an Amazon fulfillment center with exactly 8 storage shelves. Each incoming order needs 1 to 4 shelf slots to hold its items while being packaged.</p>
        <p>When all shelves are occupied, the security guard politely tells the next delivery truck to <strong className="text-slate-950 font-black">wait outside in the parking lot</strong>. No boxes are thrown away. The server does not crash.</p>
        <p>Once a worker finishes an order and frees up 2 shelves, the next truck is welcomed inside.</p>
        <p>👆 <em>Click "Admit Next Job" repeatedly above until you fill the shelves and see the security guard block new admissions!</em></p>
      </div>
    }
    techBody={
      <div className="space-y-4 font-mono text-sm text-slate-800">
        <p>The KV-capacity scheduler enforces a strict ceiling on total allocated physical memory blocks: <code className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">if (used_blocks + prompt_blocks &gt; max_kv_blocks) =&gt; reject / queue</code>.</p>
        <p>Requests are never admitted if they would induce CUDA OOM. Blocked requests wait in the prefill queue with zero GPU VRAM consumption.</p>
        <p>In Chapter 5, we explore <strong className="text-amber-700 font-bold">Preemption</strong>: what happens when an emergency VIP request arrives and the shelves are already full.</p>
      </div>
    }
    insight="KV-Capacity admission control stops memory crashes completely. By keeping waiting jobs in regular memory until GPU space is free, the system stays 100% stable."
    techInsight="KV-capacity guarantees memory safety without preemption overhead. It bounds active KV-cache allocation to physical VRAM limits, eliminating CUDA OOM errors under extreme load."
  />
);

export default Page4Memory;
