import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Zap, RotateCcw } from 'lucide-react';
import { StoryPageTemplate } from '../components/story/StoryPageTemplate';
import { useMode } from '../context/ModeContext';

const SHELVES_COUNT = 8;
interface Job { id: string; label: string; blocks: number; color: string }

const INITIAL_JOBS: Job[] = [
  { id: 'j1', label: 'Legal summary 📄', blocks: 3, color: 'bg-blue-50 border-blue-300 text-blue-950' },
  { id: 'j2', label: 'SQL review 📊', blocks: 2, color: 'bg-purple-50 border-purple-300 text-purple-950' },
  { id: 'j3', label: 'Story writer ✍️', blocks: 3, color: 'bg-emerald-50 border-emerald-300 text-emerald-950' },
];

const PreemptionIllustration: React.FC = () => {
  const { t } = useMode();
  const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
  const [evicted, setEvicted] = useState<Job | null>(null);
  const [newJob, setNewJob] = useState<Job | null>(null);
  const [stage, setStage] = useState<'idle' | 'full' | 'choose' | 'evicting' | 'admitted'>('idle');

  const usedBlocks = jobs.reduce((a, j) => a + j.blocks, 0);

  const triggerEmergency = () => {
    setStage('full');
    setTimeout(() => setStage('choose'), 600);
    setNewJob({ id: 'emergency', label: 'URGENT: Server debug 🚨', blocks: 2, color: 'bg-rose-50 border-rose-400 text-rose-950 font-black ring-2 ring-rose-500' });
  };

  const evictJob = (job: Job) => {
    if (stage !== 'choose') return;
    setStage('evicting');
    setEvicted(job);
    setTimeout(() => {
      setJobs(j => j.filter(x => x.id !== job.id));
      setTimeout(() => {
        setJobs(j => [...j, newJob!]);
        setNewJob(null);
        setEvicted(null);
        setStage('admitted');
      }, 600);
    }, 600);
  };

  const reset = () => {
    setJobs(INITIAL_JOBS);
    setEvicted(null);
    setNewJob(null);
    setStage('idle');
  };

  const allBlocks = Array.from({ length: SHELVES_COUNT }, (_, i) => {
    let blockOwner = null;
    let count = 0;
    for (const job of jobs) {
      if (i >= count && i < count + job.blocks) { blockOwner = job; break; }
      count += job.blocks;
    }
    return { index: i, job: blockOwner };
  });

  return (
    <div className="w-full space-y-4 text-[#0f172a]">
      {/* Shelf visualization */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black text-[#0f172a] uppercase tracking-wider">
            🏗️ {t('Memory Shelves', 'KV-Cache Blocks')} ({usedBlocks}/{SHELVES_COUNT} {t('used', 'allocated')})
          </p>
          <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${usedBlocks >= SHELVES_COUNT ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-emerald-50 border-emerald-300 text-emerald-800'}`}>
            {usedBlocks >= SHELVES_COUNT ? (t('FULL', 'AT CAPACITY')) : (t('Has space', 'Capacity available'))}
          </div>
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {allBlocks.map((block, i) => (
            <motion.div
              key={i}
              className={`h-12 rounded-xl border flex items-center justify-center text-[10px] font-bold shadow-xs ${block.job ? block.job.color : 'bg-slate-50 border-slate-200 text-slate-400'
                } ${evicted && block.job?.id === evicted.id ? 'ring-2 ring-amber-500 ring-offset-1' : ''}`}
              animate={evicted && block.job?.id === evicted.id ? { x: [0, 10, -80], opacity: [1, 1, 0] } : { x: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {block.job && i === allBlocks.findIndex(b => b.job?.id === block.job?.id) ? '📁' : ''}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Job list */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
        <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
          {t('📋 Jobs In Memory', '📋 Active Requests in KV-Cache')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <AnimatePresence>
            {jobs.map((job) => (
              <motion.div
                key={job.id}
                layout
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0, x: -40 }}
                className={`p-3 rounded-xl border text-xs font-bold shadow-xs ${job.color} ${stage === 'choose' ? 'cursor-pointer hover:ring-2 hover:ring-amber-500 shadow-md' : ''}`}
                onClick={() => evictJob(job)}
                title={stage === 'choose' ? 'Click to evict this job' : ''}
              >
                <p className="truncate font-black">{job.label}</p>
                <p className="text-[10px] opacity-75 mt-1 font-semibold">{job.blocks} {t('shelf slots', 'KV blocks')}</p>
                {stage === 'choose' && (
                  <p className="text-[10px] text-amber-700 font-bold mt-1">👆 {t('Click to evict', 'Click to preempt')}</p>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* New emergency job banner */}
      <AnimatePresence>
        {newJob && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-rose-50 border border-rose-300 shadow-sm"
          >
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 animate-bounce" />
            <div className="flex-1">
              <p className="text-sm font-black text-rose-900">
                🚨 {t('Emergency job arrived — but shelves are full!', 'High-priority request — KV-cache at capacity!')}
              </p>
              <p className="text-xs text-rose-800 mt-0.5">{newJob.label} — needs {newJob.blocks} {t('slots', 'blocks')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {stage === 'admitted' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 shadow-xs"
        >
          <Zap className="w-4 h-4 text-emerald-600" />
          <p className="text-xs font-bold text-emerald-900">
            {t('✅ Emergency job admitted! Evicted job goes back to waiting room.', '✅ Preemption complete — KV blocks reclaimed, victim re-queued')}
          </p>
        </motion.div>
      )}

      <div className="flex gap-3 justify-center pt-2">
        {stage === 'idle' && (
          <button onClick={triggerEmergency}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm shadow-sm transition-all cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>{t('Trigger Emergency Job!', 'Inject High-Priority Request')}</span>
          </button>
        )}
        {(stage === 'admitted' || stage === 'idle') && (
          <button onClick={reset} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all cursor-pointer">
            <RotateCcw className="w-4 h-4" />
            <span>{t('Reset', 'Reset')}</span>
          </button>
        )}
        {stage === 'choose' && (
          <p className="text-sm font-black text-amber-800 animate-pulse">
            👆 {t('Click a job above to evict it!', 'Select a victim request to preempt')}
          </p>
        )}
      </div>
    </div>
  );
};

const Page5Eviction: React.FC = () => (
  <StoryPageTemplate
    chapterNum={5}
    emoji="🚨"
    eli5Title="Emergency Eviction"
    techTitle="Request Preemption"
    eli5Subtitle="When urgent work arrives and all shelves are full — someone has to move out"
    techSubtitle="Preemption: evict a victim request's KV blocks to admit a new high-priority request"
    illustration={<PreemptionIllustration />}
    eli5Body={
      <div className="space-y-4 text-slate-800">
        <p>Imagine a hospital where all ICU beds are taken by stable patients. Then a critical emergency patient arrives. The doctor moves the most stable patient to a regular ward to free up the ICU bed.</p>
        <p>The evicted patient doesn't lose their progress — their medical notes are saved. They just wait in a normal room until a bed frees up again.</p>
        <p>👆 <em>Click "Trigger Emergency Job!" then choose which job to evict from memory!</em></p>
      </div>
    }
    techBody={
      <div className="space-y-4 font-mono text-sm text-slate-800">
        <p>When <code className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">used_blocks + new_blocks &gt; capacity</code>, the preemption scheduler selects a victim request (e.g. oldest, or lowest priority) and calls <code className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">evict(victim)</code>.</p>
        <p>Eviction: the victim's KV-cache blocks are freed, and the victim is re-inserted into the prefill queue with its original sequence preserved. Next time it's scheduled, it re-runs prefill from scratch.</p>
        <p>Cost: re-prefill of evicted request. Benefit: new high-priority request admitted immediately. Trade-off: latency spike for victim vs. SLA for urgent request.</p>
      </div>
    }
    insight="When the warehouse is full, we temporarily remove the lowest-priority job to make room for the most urgent one. The removed job waits and re-enters when space is available."
    techInsight="Preemption is the core mechanism enabling PagedAttention's high utilization. Victim selection policy (LRU, lowest-priority, longest-remaining) determines fairness and latency impact."
  />
);

export default Page5Eviction;
