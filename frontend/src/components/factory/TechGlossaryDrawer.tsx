import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, HelpCircle } from 'lucide-react';
import { useMode } from '../../context/ModeContext';

interface TechGlossaryDrawerProps {
  open: boolean;
  onClose: () => void;
}

const ELI5_GLOSSARY = [
  {
    term: '🏭 Factory (LLM Engine)',
    def: 'The AI brain that answers your questions. Like a factory that takes in raw requests and produces answers.',
  },
  {
    term: '📦 Job / Request',
    def: 'One question or task sent to the AI. Like a work order dropped off at the factory.',
  },
  {
    term: '⚙️ Reading the Question (Prefill)',
    def: 'The factory reads and understands your question. The longer the question, the more time this takes.',
  },
  {
    term: '✍️ Writing the Answer (Decode)',
    def: 'The factory writes the answer one word at a time. Like a worker typing a reply letter.',
  },
  {
    term: '🚨 Sent Back (Preemption)',
    def: 'A lower-priority job gets moved back to the waiting room to make space for an emergency job.',
  },
  {
    term: '📋 Queue Style (Strategy)',
    def: 'Rules for who gets served first. Like a deli number system (fair) vs. VIP priority line.',
  },
  {
    term: '🏦 Memory Shelves (VRAM)',
    def: 'The factory\'s storage space. Each job needs shelf space while it\'s being processed.',
  },
  {
    term: '💰 Cost Per Hour',
    def: 'Running AI on a powerful GPU card costs ~$4.50 per hour to rent from the cloud.',
  },
];

const TECH_GLOSSARY = [
  {
    term: 'Prefill Phase',
    def: 'Processes the entire input prompt in parallel. Dominant cost: O(n²) attention over sequence length. Produces KV-cache entries for all prompt tokens.',
  },
  {
    term: 'Decode Phase',
    def: 'Autoregressive generation — one token per forward pass. Memory-bound on HBM bandwidth. Throughput bottleneck.',
  },
  {
    term: 'PagedAttention',
    def: 'Virtual memory paging for KV-cache. Physical blocks allocated on demand, eliminating fragmentation. Block size configurable (default 16 tokens).',
  },
  {
    term: 'Preemption',
    def: 'When KV-cache capacity is exhausted, a victim request\'s KV blocks are evicted and it re-enters the prefill queue. Victim selection = lowest priority.',
  },
  {
    term: 'TTFT (p99)',
    def: 'Time To First Token — 99th percentile. Critical SLA metric for chat UX. Target: <30ms. Dominated by prefill compute time.',
  },
  {
    term: 'TPOT',
    def: 'Time Per Output Token (avg). Measures decode throughput. Target: <15ms. Bottlenecked by HBM3 memory bandwidth.',
  },
  {
    term: 'HBM Bandwidth Utilisation',
    def: 'Fraction of peak HBM3 bandwidth used. H100 SXM: 3.35 TB/s peak. >85% = efficient decode batching.',
  },
  {
    term: 'SM Compute Utilisation',
    def: 'GPU Streaming Multiprocessor utilisation %. High during prefill (compute-bound). Low during small-batch decode (memory-bound).',
  },
  {
    term: 'X-API-Key / HMAC Webhook',
    def: 'REST API uses X-API-Key header for authentication. Outgoing webhook events carry X-Signature-SHA256 = HMAC-SHA256(secret, body) for integrity verification.',
  },
];

export const TechGlossaryDrawer: React.FC<TechGlossaryDrawerProps> = ({ open, onClose }) => {
  const { mode, t } = useMode();

  const entries = mode === 'eli5' ? ELI5_GLOSSARY : TECH_GLOSSARY;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 modal-backdrop"
          />

          {/* Drawer */}
          <motion.aside
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="drawer fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                {mode === 'eli5'
                  ? <HelpCircle className="w-5 h-5 text-amber-400" />
                  : <BookOpen className="w-5 h-5 text-sky-400" />
                }
                <div>
                  <h2 className="text-base font-black text-white">
                    {t('📖 Plain English Guide', '📚 Technical Reference')}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {t('Simple explanations for everything on screen', 'API contracts, metrics, and architecture terms')}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Glossary Entries */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {entries.map((entry) => (
                <div
                  key={entry.term}
                  className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-sky-500/20 transition-all"
                >
                  <p className="text-sm font-bold text-white mb-1">{entry.term}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{entry.def}</p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 flex-shrink-0">
              <p className="text-[10px] text-slate-600 text-center">
                {t(
                  'Switch to ⚡ Tech Mode for deeper explanations',
                  'Switch to 👶 ELI5 Mode for everyday analogies'
                )}
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
