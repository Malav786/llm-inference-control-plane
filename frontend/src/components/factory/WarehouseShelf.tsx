import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Warehouse } from 'lucide-react';
import { useMode } from '../../context/ModeContext';
import type { KVBlock, Metrics } from '../../types';

interface WarehouseShelfProps {
  blocks?: KVBlock[];
  metrics?: Metrics;
}

const STATUS_CONFIG = {
  FREE:      { color: 'bg-slate-50 border-slate-200 text-slate-400', icon: '⬜', eli5: 'Empty shelf', tech: 'FREE' },
  PREFILL:   { color: 'bg-blue-50 border-blue-400 text-blue-800', icon: '📖', eli5: 'Reading in', tech: 'PREFILL' },
  DECODE:    { color: 'bg-purple-50 border-purple-400 text-purple-800', icon: '✍️', eli5: 'Writing out', tech: 'DECODE' },
  PREEMPTED: { color: 'bg-amber-50 border-amber-400 text-amber-800', icon: '📤', eli5: 'Moved out', tech: 'PREEMPT' },
};

export const WarehouseShelf: React.FC<WarehouseShelfProps> = ({ blocks = [], metrics }) => {
  const { t } = useMode();

  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  const usedPct = typeof metrics?.kv_utilization_pct === 'number' ? metrics.kv_utilization_pct : 0;
  const usedBlocks = typeof metrics?.allocated_blocks === 'number' ? metrics.allocated_blocks : 0;
  const totalBlocks = typeof metrics?.kv_capacity_blocks === 'number' ? metrics.kv_capacity_blocks : 32;

  // Gauge bar color
  const barColor =
    usedPct > 90 ? 'bg-rose-500' :
    usedPct > 70 ? 'bg-amber-500' :
    'bg-emerald-500';

  return (
    <div className="card-elev p-5 bg-white border border-slate-200/90 shadow-sm space-y-5 text-[#0f172a]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
            <Warehouse className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-[#0f172a]">
              {t('🏗️ Memory Warehouse', '🧠 PagedAttention KV-Cache')}
            </h3>
            <p className="text-xs text-[#64748b]">
              {t(
                'Each square = one memory shelf slot. Watch them fill up!',
                `Physical KV-cache blocks · ${usedBlocks}/${totalBlocks} allocated · ${usedPct.toFixed(1)}% utilisation`
              )}
            </p>
          </div>
        </div>

        {/* Capacity gauge */}
        <div className="flex flex-col gap-1.5 min-w-[180px]">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-[#64748b]">{t('Space Used', 'KV Utilisation')}</span>
            <span className={usedPct > 90 ? 'text-rose-600' : usedPct > 70 ? 'text-amber-600' : 'text-emerald-600'}>
              {usedPct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${barColor}`}
              animate={{ width: `${Math.min(usedPct, 100)}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>{usedBlocks} {t('used', 'allocated')}</span>
            <span>{totalBlocks} {t('total', 'capacity')}</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`w-3.5 h-3.5 rounded border ${cfg.color}`} />
            <span className="text-xs font-semibold text-slate-600">
              {cfg.icon} {t(cfg.eli5, cfg.tech)}
            </span>
          </div>
        ))}
      </div>

      {/* ── The Shelf Grid ─────────────────────────────────── */}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))' }}>
        <AnimatePresence mode="popLayout">
          {safeBlocks.map((block) => {
            const cfg = STATUS_CONFIG[block?.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.FREE;
            return (
              <motion.div
                key={`block-${block?.block_id ?? Math.random()}`}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                title={`Block ${block?.block_id}: ${block?.status} — ${block?.request_id || 'free'} (${block?.tokens_stored ?? 0} tokens)`}
                className={`shelf-block border aspect-square flex flex-col items-center justify-center gap-0.5 p-1 cursor-default select-none rounded-xl shadow-xs ${cfg.color}`}
              >
                <span className="text-[10px] leading-none">{cfg.icon}</span>
                <span className="text-[8px] font-bold opacity-75 leading-none font-mono">
                  #{block?.block_id ?? 0}
                </span>
                {(block?.tokens_stored ?? 0) > 0 && (
                  <span className="text-[7px] opacity-90 leading-none font-mono font-bold">
                    {block.tokens_stored}t
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Factory floor summary */}
      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100">
        {['FREE', 'PREFILL', 'DECODE', 'PREEMPTED'].map((status) => {
          const count = safeBlocks.filter((b) => b?.status === status).length;
          const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.FREE;
          return (
            <div key={status} className={`rounded-2xl border px-3 py-2 text-center shadow-xs ${cfg.color}`}>
              <p className="text-lg font-black">{count}</p>
              <p className="text-[10px] font-bold opacity-80">{t(cfg.eli5, cfg.tech)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
