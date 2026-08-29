import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useMode } from '../../context/ModeContext';
import type { StepActions } from '../../types';

interface ConveyorBeltProps {
  stepActions: StepActions;
  step: number;
  speedMs: number;
  isRunning: boolean;
  highlightedId?: string | null;
}

interface RequestBox {
  id: string;
  stage: 'waiting' | 'prefill' | 'decode' | 'done' | 'evicted';
  priority: number;
  tokens?: number;
}

const beltClass = (speedMs: number, running: boolean) => {
  if (!running) return 'conveyor-belt conveyor-belt-paused';
  if (speedMs >= 1000) return 'conveyor-belt conveyor-belt-slow';
  if (speedMs <= 100) return 'conveyor-belt conveyor-belt-turbo';
  if (speedMs <= 200) return 'conveyor-belt conveyor-belt-fast';
  return 'conveyor-belt';
};

export const ConveyorBelt: React.FC<ConveyorBeltProps> = ({
  stepActions = {},
  step = 0,
  speedMs = 600,
  isRunning = true,
  highlightedId = null,
}) => {
  const { t } = useMode();

  // ── Persistent Rolling History Buffers ───────────────────────
  const [deliveredHistory, setDeliveredHistory] = useState<string[]>([]);
  const [preemptedHistory, setPreemptedHistory] = useState<string[]>([]);
  const [totalDelivered, setTotalDelivered] = useState(0);
  const [totalPreempted, setTotalPreempted] = useState(0);

  // Update delivered & preempted rolling histories on each tick
  useEffect(() => {
    const newlyFinished = Array.isArray(stepActions?.finished) ? stepActions.finished : [];
    if (newlyFinished.length > 0) {
      setTotalDelivered(d => d + newlyFinished.length);
      setDeliveredHistory(prev => {
        const next = [...newlyFinished, ...prev];
        return Array.from(new Set(next)).slice(0, 10);
      });
    }

    const newlyPreempted = Array.isArray(stepActions?.preempt) ? stepActions.preempt : [];
    if (newlyPreempted.length > 0) {
      setTotalPreempted(p => p + newlyPreempted.length);
      setPreemptedHistory(prev => {
        const next = [...newlyPreempted, ...prev];
        return Array.from(new Set(next)).slice(0, 10);
      });
    }
  }, [step, stepActions]);

  // Derive active items on the belt
  const boxes = useMemo(() => {
    const result: RequestBox[] = [];
    const seenIds = new Set<string>();

    // 1. Prefill
    if (Array.isArray(stepActions?.prefill)) {
      stepActions.prefill.forEach((item) => {
        if (Array.isArray(item) && item.length >= 2) {
          const id = String(item[0]);
          if (!seenIds.has(id)) {
            result.push({ id, stage: 'prefill', priority: 5, tokens: item[1] });
            seenIds.add(id);
          }
        } else if (item) {
          const id = String(item);
          if (!seenIds.has(id)) {
            result.push({ id, stage: 'prefill', priority: 5 });
            seenIds.add(id);
          }
        }
      });
    }

    // 2. Decode
    if (Array.isArray(stepActions?.decode)) {
      stepActions.decode.forEach((item) => {
        if (item) {
          const id = String(item);
          if (!seenIds.has(id)) {
            result.push({ id, stage: 'decode', priority: 5 });
            seenIds.add(id);
          }
        }
      });
    }

    // 3. Preempted/evicted (recent active)
    const activePreempted = Array.isArray(stepActions?.preempt) && stepActions.preempt.length > 0
      ? stepActions.preempt
      : preemptedHistory.slice(0, 2);
    activePreempted.forEach((item) => {
      if (item) {
        const id = String(item);
        if (!seenIds.has(id)) {
          result.push({ id, stage: 'evicted', priority: 1 });
          seenIds.add(id);
        }
      }
    });

    // 4. Finished/delivered (recent active)
    const activeDone = Array.isArray(stepActions?.finished) && stepActions.finished.length > 0
      ? stepActions.finished
      : deliveredHistory.slice(0, 3);
    activeDone.forEach((item) => {
      if (item) {
        const id = String(item);
        if (!seenIds.has(id)) {
          result.push({ id, stage: 'done', priority: 3 });
          seenIds.add(id);
        }
      }
    });

    return result.slice(0, 14);
  }, [stepActions, deliveredHistory, preemptedHistory]);

  const prefillCount = Array.isArray(stepActions?.prefill) ? stepActions.prefill.length : 0;
  const decodeCount = Array.isArray(stepActions?.decode) ? stepActions.decode.length : 0;
  const preemptCount = Array.isArray(stepActions?.preempt) ? stepActions.preempt.length : 0;
  const finishedCount = Array.isArray(stepActions?.finished) ? stepActions.finished.length : 0;

  const stages = [
    {
      key: 'prefill',
      icon: '⚙️',
      eli5: 'Reading Question',
      tech: 'Prefill Phase',
      color: 'blue',
      borderColor: 'border-blue-200',
      bgColor: 'bg-blue-50/70',
      textColor: 'text-blue-700',
      count: prefillCount,
      sublabel: t('In prefill buffer', 'Active prefills'),
    },
    {
      key: 'decode',
      icon: '🔄',
      eli5: 'Writing Answer',
      tech: 'Decode Phase',
      color: 'purple',
      borderColor: 'border-purple-200',
      bgColor: 'bg-purple-50/70',
      textColor: 'text-purple-700',
      count: decodeCount,
      sublabel: t('Generating tokens', 'Active decodes'),
    },
    {
      key: 'evicted',
      icon: '🚨',
      eli5: 'Sent Back (Evicted)',
      tech: 'Preempted (Victims)',
      color: 'amber',
      borderColor: 'border-amber-200',
      bgColor: 'bg-amber-50/70',
      textColor: 'text-amber-700',
      count: totalPreempted > 0 ? totalPreempted : preemptCount,
      sublabel: totalPreempted > 0 ? t(`${totalPreempted} total evicted`, `${totalPreempted} total re-queued`) : t('0 evicted', 'None'),
    },
    {
      key: 'done',
      icon: '✅',
      eli5: 'Delivered',
      tech: 'Finished Requests',
      color: 'emerald',
      borderColor: 'border-emerald-200',
      bgColor: 'bg-emerald-50/70',
      textColor: 'text-emerald-700',
      count: totalDelivered > 0 ? totalDelivered : finishedCount,
      sublabel: totalDelivered > 0 ? t(`${totalDelivered} total delivered`, `${totalDelivered} total complete`) : t('0 delivered', '0 complete'),
    },
  ];

  return (
    <div className="card-elev p-5 bg-white border border-slate-200/90 shadow-sm space-y-4 text-[#0f172a]">
      {/* ── Header: Title & Step Counter ────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏭</span>
          <div>
            <h3 className="text-sm font-black tracking-tight text-[#0f172a]">
              {t('The AI Conveyor Belt', 'GPU Batch Execution Pipeline')}
            </h3>
            <p className="text-[11px] text-[#64748b]">
              {t('Watch questions move through reading, writing, and completion stages', 'Live step-by-step token generation and memory allocation')}
            </p>
          </div>
        </div>

        {/* Live Step Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 shadow-inner">
            <span className="text-slate-500">{t('Tick #', 'Step:')}</span>
            <span className="font-mono text-blue-700">{step}</span>
          </div>

          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
            isRunning
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{isRunning ? t('Running', 'Active') : t('Paused', 'Paused')}</span>
          </div>
        </div>
      </div>

      {/* ── 4 Stage Indicators ───────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {stages.map((s) => (
          <div
            key={s.key}
            className={`p-3 rounded-2xl border ${s.borderColor} ${s.bgColor} flex flex-col items-center justify-center gap-1 shadow-xs`}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base">{s.icon}</span>
              <span className={`text-[11px] font-black uppercase tracking-wider ${s.textColor}`}>
                {t(s.eli5, s.tech)}
              </span>
            </div>
            <AnimatePresence mode="popLayout">
              <motion.span
                key={s.count}
                initial={{ scale: 1.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`text-2xl font-black ${s.textColor}`}
              >
                {s.count}
              </motion.span>
            </AnimatePresence>
            <span className="text-[10px] text-slate-600 font-medium text-center truncate">
              {s.sublabel}
            </span>
          </div>
        ))}
      </div>

      {/* ── Conveyor Belt Track ─────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-300 shadow-inner">
        {/* Belt surface animation */}
        <div className={`h-24 w-full ${beltClass(speedMs, isRunning)}`} />

        {/* Boxes overlaid on the moving belt */}
        <div className="absolute inset-0 flex items-center px-4 gap-3 overflow-x-auto">
          <AnimatePresence mode="popLayout">
            {boxes.map((box, idx) => (
              <motion.div
                key={`box-${box.stage}-${box.id}-${idx}`}
                initial={{ x: -60, opacity: 0, scale: 0.8 }}
                animate={{
                  x: 0,
                  opacity: 1,
                  scale: 1,
                  rotate: box.stage === 'evicted' ? [-2, 2, -2] : 0,
                }}
                exit={{ x: 60, opacity: 0, scale: 0.7 }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 25,
                }}
                className={`flex-shrink-0 w-24 h-16 flex flex-col items-center justify-center gap-0.5 cursor-default select-none transition-all relative ${
                  box.stage === 'prefill' ? 'request-box request-box-prefill' : ''
                } ${
                  box.stage === 'decode'  ? 'request-box request-box-decode'  : ''
                } ${
                  box.stage === 'evicted' ? 'request-box bg-amber-50 border-2 border-amber-500 text-amber-900 shadow-md' : ''
                } ${
                  box.stage === 'done'    ? 'request-box bg-emerald-50 border-2 border-emerald-500 text-emerald-900 shadow-md' : ''
                } ${
                  box.stage === 'waiting' ? 'request-box bg-white border-slate-300' : ''
                } ${
                  highlightedId && box.id === highlightedId ? 'ring-2 ring-blue-600 ring-offset-2 scale-105 z-10' : ''
                }`}
                title={`${box.id} — ${box.stage}`}
              >
                {highlightedId && box.id === highlightedId && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-black text-white bg-blue-600 px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                    NEW
                  </span>
                )}
                {box.stage === 'done' && (
                  <span className="absolute -top-2 -right-1 text-[8px] font-black text-emerald-800 bg-emerald-100 px-1 rounded-full border border-emerald-300">
                    DELIVERED
                  </span>
                )}
                {box.stage === 'evicted' && (
                  <span className="absolute -top-2 -right-1 text-[8px] font-black text-amber-800 bg-amber-100 px-1 rounded-full border border-amber-300 animate-pulse">
                    EVICTED
                  </span>
                )}

                <span className="text-base">
                  {box.stage === 'prefill' ? '📖' :
                   box.stage === 'decode'  ? '✍️' :
                   box.stage === 'evicted' ? '🚨' :
                   box.stage === 'done'    ? '📦' : '📬'}
                </span>
                <span className="text-[9px] font-bold text-[#0f172a] font-mono truncate max-w-[80px] px-1 text-center leading-tight">
                  {box.id.length > 12 ? box.id.slice(-8) : box.id}
                </span>
                {box.tokens !== undefined && (
                  <span className="text-[8px] text-slate-500 font-mono font-semibold">{box.tokens}t</span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {boxes.length === 0 && (
            <div className="w-full flex items-center justify-center">
              <span className="text-xs text-slate-500 font-semibold">
                {t('⏳ Waiting for jobs to arrive...', '⏳ No active requests in pipeline')}
              </span>
            </div>
          )}
        </div>

        {/* Belt rollers at edges */}
        <div className="absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-slate-200 to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-slate-200 to-transparent pointer-events-none" />
      </div>

      {/* ── Stage Flow Arrows ───────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between px-2 gap-2 text-xs font-semibold">
        {stages.map((s, i) => (
          <React.Fragment key={s.key}>
            <div className={`flex items-center gap-1.5 ${s.textColor}`}>
              <span>{s.icon}</span>
              <span>{t(s.eli5, s.tech)}</span>
            </div>
            {i < stages.length - 1 && (
              <ChevronRight className="w-4 h-4 text-slate-400 hidden sm:block" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Preemption Alert Banner */}
      <AnimatePresence>
        {Array.isArray(stepActions?.preempt) && stepActions.preempt.length > 0 && (
          <motion.div
            key="preempt-alert"
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="rounded-2xl p-3 bg-amber-50 border border-amber-300 flex items-center gap-3 shadow-sm"
          >
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 animate-bounce" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-amber-900 uppercase tracking-wider">
                {t('🚨 EMERGENCY EVICTION IN ACTION (LEVEL 5)!', '🚨 REQUEST PREEMPTION TRIGGERED (LEVEL 5)')}
              </p>
              <p className="text-xs text-amber-800 truncate">
                {t(
                  `High-urgency job arrived! ${stepActions.preempt.join(', ')} evicted back to waiting room to free memory shelves.`,
                  `Preempted [${stepActions.preempt.join(', ')}] — KV blocks reclaimed and re-queued.`
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
