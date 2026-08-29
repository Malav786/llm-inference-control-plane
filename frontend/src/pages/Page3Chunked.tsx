import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scissors, Play, RotateCcw, Clock } from 'lucide-react';
import { StoryPageTemplate } from '../components/story/StoryPageTemplate';
import { useMode } from '../context/ModeContext';

interface TimelineItem {
  id: string;
  name: string;
  type: 'chunk' | 'quick_job';
  tokens: number;
  durationSec: number;
  color: string;
  status: 'pending' | 'active' | 'completed';
  deliveredAt?: number;
}

const ChunkedIllustration: React.FC = () => {
  const { t } = useMode();
  const [chunkSize, setChunkSize] = useState<number>(128);
  const [viewMode, setViewMode] = useState<'with_chunking' | 'without_chunking'>('with_chunking');
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [activeItems, setActiveItems] = useState<TimelineItem[]>([]);

  const BIG_JOB_TOTAL_TOKENS = 512;
  const numChunks = Math.ceil(BIG_JOB_TOTAL_TOKENS / chunkSize);

  // Generate sequence based on mode & chunk size
  const generateSequence = (mode: 'with_chunking' | 'without_chunking', size: number): TimelineItem[] => {
    if (mode === 'without_chunking') {
      return [
        { id: 'mon-full', name: '📄 Full 512-Token Legal Agreement (Uncut)', type: 'chunk', tokens: 512, durationSec: 5.0, color: 'bg-amber-50 border-amber-300 text-amber-950', status: 'pending' },
        { id: 'q-1', name: '🌐 Translate "Hello" (32 tokens)', type: 'quick_job', tokens: 32, durationSec: 1.0, color: 'bg-blue-50 border-blue-300 text-blue-950', status: 'pending' },
        { id: 'q-2', name: '✍️ Quick Email Subject (24 tokens)', type: 'quick_job', tokens: 24, durationSec: 1.0, color: 'bg-emerald-50 border-emerald-300 text-emerald-950', status: 'pending' },
      ];
    } else {
      const items: TimelineItem[] = [];
      const totalSlices = Math.ceil(BIG_JOB_TOTAL_TOKENS / size);

      for (let i = 0; i < totalSlices; i++) {
        const tokensInSlice = Math.min(size, BIG_JOB_TOTAL_TOKENS - i * size);
        items.push({
          id: `chunk-${i}`,
          name: `🍕 Contract Slice ${i + 1}/${totalSlices} (${tokensInSlice}t)`,
          type: 'chunk',
          tokens: tokensInSlice,
          durationSec: Number((5.0 / totalSlices).toFixed(1)),
          color: 'bg-blue-50/90 border-blue-200 text-blue-900',
          status: 'pending',
        });

        if (i === 0) {
          items.push({
            id: 'interleaved-q1',
            name: '🌐 Translate "Good morning" (Quick Job Sneaks In!)',
            type: 'quick_job',
            tokens: 32,
            durationSec: 1.0,
            color: 'bg-emerald-50 border-emerald-300 text-emerald-950 ring-2 ring-emerald-400',
            status: 'pending',
          });
        }
      }

      return items;
    }
  };

  useEffect(() => {
    setActiveItems(generateSequence(viewMode, chunkSize));
    setIsRunning(false);
    setCurrentStepIndex(-1);
    setElapsedSec(0);
  }, [viewMode, chunkSize]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSimulation = () => {
    if (isRunning) return;
    setIsRunning(true);
    setCurrentStepIndex(0);
    setElapsedSec(0);

    const items = generateSequence(viewMode, chunkSize);
    setActiveItems(items);

    let stepIdx = 0;
    let accumulatedTime = 0;

    const executeStep = (idx: number) => {
      if (idx >= items.length) {
        setIsRunning(false);
        return;
      }

      setCurrentStepIndex(idx);
      const curItem = items[idx];
      accumulatedTime = Number((accumulatedTime + curItem.durationSec).toFixed(1));
      setElapsedSec(accumulatedTime);

      setActiveItems((prev) =>
        prev.map((it, i) => (i === idx ? { ...it, status: 'active' } : it))
      );

      const delayMs = curItem.durationSec * 600;

      timerRef.current = setTimeout(() => {
        setActiveItems((prev) =>
          prev.map((it, i) => (i === idx ? { ...it, status: 'completed', deliveredAt: accumulatedTime } : it))
        );
        stepIdx++;
        executeStep(stepIdx);
      }, delayMs);
    };

    executeStep(stepIdx);
  };

  const handleReset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsRunning(false);
    setCurrentStepIndex(-1);
    setElapsedSec(0);
    setActiveItems(generateSequence(viewMode, chunkSize));
  };

  return (
    <div className="w-full space-y-6 text-[#0f172a]">
      {/* ── View Mode Selector (Without vs With Chunking) ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            onClick={() => { setViewMode('with_chunking'); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'with_chunking'
                ? 'bg-blue-600 text-white shadow-sm font-black'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            🧩 {t('WITH Smart Chunking (Smart)', 'Chunked Prefill Enabled')}
          </button>
          <button
            onClick={() => { setViewMode('without_chunking'); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'without_chunking'
                ? 'bg-rose-50 border border-rose-300 text-rose-800 font-black'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            ❌ {t('WITHOUT Chunking (Naive)', 'No Chunking (Head-of-Line Blocking)')}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={runSimulation}
            disabled={isRunning}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-40 transition-all cursor-pointer shadow-sm"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{t('Run Comparison', 'Simulate Pipeline')}</span>
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-sm transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t('Reset', 'Reset')}</span>
          </button>
        </div>
      </div>

      {/* Chunk Size Dial (Only in chunking mode) */}
      {viewMode === 'with_chunking' && (
        <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 border border-blue-300 text-blue-700">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-blue-950 uppercase tracking-wider">
                {t('🍕 Choose Pizza Slice Size', 'Chunk Size Configuration (max_work)')}
              </p>
              <p className="text-xs text-slate-600">
                {t(`512t prompt sliced into ${numChunks} pieces of ${chunkSize} tokens each`, `max_work=${chunkSize} tokens per step`)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {[64, 128, 256].map(sz => (
              <button
                key={sz}
                onClick={() => setChunkSize(sz)}
                disabled={isRunning}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${chunkSize === sz
                    ? 'bg-blue-600 border-blue-700 text-white shadow-sm font-black'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
              >
                {sz} tokens ({Math.ceil(BIG_JOB_TOTAL_TOKENS / sz)} slices)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Visual GPU Conveyor Track ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            {t('🏭 Timeline of GPU Execution', 'GPU Execution Sequence & Latency Timeline')}
          </span>
          <span className="text-xs font-mono font-bold text-blue-600">
            {t('Elapsed Time:', 'Time:')} {elapsedSec}s
          </span>
        </div>

        {/* Flow Blocks */}
        <div className="flex flex-col gap-2.5">
          <AnimatePresence>
            {activeItems.map((item, index) => {
              const isActive = index === currentStepIndex;
              const isCompleted = item.status === 'completed';

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3.5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all shadow-xs ${item.color} ${isActive ? 'ring-2 ring-blue-500 scale-[1.01] shadow-md' : ''
                    } ${isCompleted ? 'opacity-90' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {item.type === 'quick_job' ? (isCompleted ? '✅' : '⚡') : (isCompleted ? '🍕' : '⏳')}
                    </span>
                    <div>
                      <p className="text-xs font-black text-[#0f172a] leading-snug">{item.name}</p>
                      <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                        {item.tokens} tokens · {item.durationSec}s compute time
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isActive && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-600 text-white animate-pulse">
                        ⚙️ {t('PROCESSING NOW IN GPU', 'COMPUTING INFERENCE')}
                      </span>
                    )}
                    {isCompleted && item.deliveredAt !== undefined && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 border border-emerald-300 text-emerald-800">
                        {item.type === 'quick_job'
                          ? `🎉 ${t('DELIVERED in only', 'Finished at')} ${item.deliveredAt}s!`
                          : `✅ ${t('Finished at', 'Done at')} ${item.deliveredAt}s`
                        }
                      </span>
                    )}
                    {!isActive && !isCompleted && (
                      <span className="text-[10px] font-mono text-slate-500 font-semibold">
                        {t('Waiting in line...', 'Queued')}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Comparison Callout Box */}
        <div className={`p-4 rounded-2xl border ${viewMode === 'with_chunking' ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-rose-50 border-rose-200 text-rose-950'}`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">{viewMode === 'with_chunking' ? '🚀' : '🐢'}</span>
            <div>
              <p className={`text-xs font-black uppercase tracking-wider ${viewMode === 'with_chunking' ? 'text-emerald-800' : 'text-rose-800'}`}>
                {viewMode === 'with_chunking'
                  ? t('🎉 The Big Difference with Chunking:', 'Performance Analysis with Chunked Prefill:')
                  : t('🛑 The Problem Without Chunking:', 'Performance Analysis without Chunking:')}
              </p>
              <p className="text-xs mt-1 leading-relaxed">
                {viewMode === 'with_chunking'
                  ? t(
                    'The short translation job finished in just 1.5 seconds! It didn\'t have to wait for the entire 512-word contract to finish.',
                    'Short requests achieve sub-1.5s TTFT by interleaving between prefill chunks, eliminating decode/prefill starvation completely.'
                  )
                  : t(
                    'The short translation job had to wait a painful 6.0 seconds because the 512-word contract hogged the GPU all at once!',
                    'Short requests suffer 6.0s+ TTFT latency due to monolithic prefill execution blocking the pipeline.'
                  )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Page3Chunked: React.FC = () => (
  <StoryPageTemplate
    chapterNum={3}
    emoji="🧩"
    eli5Title="Smart Slicing"
    techTitle="Chunked Prefill Scheduler"
    eli5Subtitle="Break big jobs into pizza slices so small jobs can sneak in between!"
    techSubtitle="Chunked prefill: budgets max_work tokens per step, enabling prefill-decode interleaving"
    illustration={<ChunkedIllustration />}
    eli5Body={
      <div className="space-y-4 text-slate-800">
        <p>Imagine baking a huge 10-person pizza in the oven — without slicing, nobody else can use the oven for 30 minutes. But if you bake it in slices, a friend can quickly warm up garlic bread between each slice!</p>
        <p><strong className="text-slate-950 font-black">Chunked Prefill does exactly this in AI.</strong> A 512-word question gets sliced into 4 smaller pieces. Between each slice, quick jobs (like translating a greeting or checking a sentence) slip in and finish almost instantly.</p>
        <p>👆 <em>Toggle between "WITH Smart Chunking" and "WITHOUT Chunking" above, then click "Run Comparison" to see how quick jobs finish 4× faster!</em></p>
      </div>
    }
    techBody={
      <div className="space-y-4 font-mono text-sm text-slate-800">
        <p>Each scheduler step is budgeted to <code className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">max_work</code> total prefill tokens (e.g. 128 tokens). Monolithic prefill requests are split across multiple consecutive steps — <code className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">ceil(prompt_len / chunk_size)</code> steps total.</p>
        <p>Between prefill chunks, decode iterations and short context requests are scheduled with high priority. This eliminates decode starvation and bounds maximum prefill jitter.</p>
        <p>TTFT for short requests drops from <code className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">6.0s (blocked)</code> down to <code className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">~1.5s (interleaved)</code>.</p>
      </div>
    }
    insight="Slicing big jobs into chunks lets small jobs sneak through the gaps. Nobody has to wait for a massive job to fully complete before getting their answer."
    techInsight="Chunked prefill is the industry standard (vLLM, TGI default). It bounds prefill latency contribution per step to chunk_size / compute_throughput, preventing head-of-line blocking."
  />
);

export default Page3Chunked;
