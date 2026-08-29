import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw, AlertTriangle, Clock, CheckCircle2, Cpu } from 'lucide-react';
import { StoryPageTemplate } from '../components/story/StoryPageTemplate';
import { useMode } from '../context/ModeContext';

interface FCFSJob {
  id: string;
  name: string;
  category: string;
  tokens: number;
  isMonster?: boolean;
  color: string;
}

const INITIAL_JOBS: FCFSJob[] = [
  { id: 'job-1', name: 'Translate "Good morning" into Japanese 🌐', category: 'Translation', tokens: 48, color: 'border-blue-200 bg-blue-50/80 text-blue-900' },
  { id: 'job-2', name: 'Analyze 100-Page Legal Merger Agreement 📄', category: 'Deep Document Analysis', tokens: 512, isMonster: true, color: 'border-amber-300 bg-amber-50 text-amber-950' },
  { id: 'job-3', name: 'Debug Python Async Memory Leak 💻', category: 'Code Fix', tokens: 64, color: 'border-purple-200 bg-purple-50/80 text-purple-900' },
  { id: 'job-4', name: 'Draft Executive LinkedIn Bio ✍️', category: 'Content Writing', tokens: 36, color: 'border-emerald-200 bg-emerald-50/80 text-emerald-900' },
  { id: 'job-5', name: 'Write SQL Query for Revenue Analytics 📊', category: 'Database Query', tokens: 80, color: 'border-indigo-200 bg-indigo-50/80 text-indigo-900' },
];

const FCFSIllustration: React.FC = () => {
  const { t } = useMode();
  const [queue, setQueue] = useState<FCFSJob[]>(INITIAL_JOBS);
  const [activeJob, setActiveJob] = useState<FCFSJob | null>(null);
  const [completedJobs, setCompletedJobs] = useState<{ job: FCFSJob; waitTimeSec: number }[]>([]);
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [totalElapsedTime, setTotalElapsedTime] = useState(0);

  const queueRef = useRef(queue);
  queueRef.current = queue;
  const completedRef = useRef(completedJobs);
  completedRef.current = completedJobs;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Global stopwatch while running
  useEffect(() => {
    let watch: ReturnType<typeof setInterval>;
    if (isRunning) {
      watch = setInterval(() => {
        setTotalElapsedTime(t => Number((t + 0.1).toFixed(1)));
      }, 100);
    }
    return () => clearInterval(watch);
  }, [isRunning]);

  const runJob = (jobToProcess: FCFSJob, remainingQueue: FCFSJob[]) => {
    setActiveJob(jobToProcess);
    setProgress(0);

    const durationMs = jobToProcess.isMonster ? 5000 : 1800;
    const intervalStep = 50;
    const increment = (intervalStep / durationMs) * 100;

    let currentProgress = 0;
    if (timerRef.current) clearInterval(timerRef.current);

    const startWaitTime = totalElapsedTime;

    timerRef.current = setInterval(() => {
      currentProgress += increment;
      if (currentProgress >= 100) {
        if (timerRef.current) clearInterval(timerRef.current);
        setProgress(100);

        setTimeout(() => {
          const finalWait = Number((totalElapsedTime - startWaitTime + (durationMs / 1000)).toFixed(1));
          const newCompleted = [{ job: jobToProcess, waitTimeSec: finalWait }, ...completedRef.current];
          setCompletedJobs(newCompleted);
          completedRef.current = newCompleted;

          if (remainingQueue.length > 0) {
            const [nextJob, ...rest] = remainingQueue;
            setQueue(rest);
            queueRef.current = rest;
            runJob(nextJob, rest);
          } else {
            setActiveJob(null);
            setIsRunning(false);
          }
        }, 150);
      } else {
        setProgress(Math.min(Math.round(currentProgress), 99));
      }
    }, intervalStep);
  };

  const handleStart = () => {
    if (isRunning || queue.length === 0) return;
    setIsRunning(true);
    const [firstJob, ...rest] = queue;
    setQueue(rest);
    queueRef.current = rest;
    runJob(firstJob, rest);
  };

  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRunning(false);
    setQueue(INITIAL_JOBS);
    setActiveJob(null);
    setCompletedJobs([]);
    setProgress(0);
    setTotalElapsedTime(0);
  };

  return (
    <div className="w-full space-y-6 text-[#0f172a]">
      {/* Top Banner Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('⏱️ Factory Clock', 'Simulation Time')}
            </p>
            <p className="text-lg font-black text-[#0f172a] font-mono">{totalElapsedTime}s</p>
          </div>
        </div>

        {activeJob?.isMonster && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold animate-pulse shadow-sm"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{t('⚠️ Huge 512-word job is blocking everyone behind it!', '⚠️ Head-of-Line Blocking active: 512 tokens prefill')}</span>
          </motion.div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleStart}
            disabled={isRunning || (queue.length === 0 && !activeJob)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-40 transition-all cursor-pointer shadow-sm"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{t('Start Fair Queue', 'Run FCFS')}</span>
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

      {/* Main 3-Column Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ① Waiting Queue */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-700">
              {t('⏳ Waiting Room', 'FIFO Input Queue')}
            </span>
            <span className="text-xs font-mono font-bold text-blue-600">{queue.length} left</span>
          </div>

          <div className="space-y-2 min-h-[260px]">
            <AnimatePresence>
              {queue.map((item, idx) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 40, opacity: 0 }}
                  className={`p-3 rounded-xl border shadow-xs ${item.color} ${idx === 0 && isRunning ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">{item.category}</span>
                    <span className="text-[10px] font-mono font-bold bg-white/80 px-1.5 py-0.5 rounded border border-black/10">
                      {item.tokens} tokens {item.isMonster ? '🔥 GIANT' : ''}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#0f172a] mt-1 leading-snug">{item.name}</p>
                  {isRunning && (
                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{t('Waiting behind current job...', 'Blocked in FIFO queue')}</span>
                    </p>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {queue.length === 0 && !activeJob && (
              <div className="h-full flex flex-col items-center justify-center py-10 text-center text-slate-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-2" />
                <p className="text-xs font-bold text-slate-800">{t('All requests processed!', 'Queue drained')}</p>
              </div>
            )}
          </div>
        </div>

        {/* ② Active Processing Stage (GPU) */}
        <div className="flex flex-col rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
            <span className="text-xs font-black uppercase tracking-widest text-blue-900 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-blue-600" />
              {t('🖥️ GPU Processing Room', 'GPU Execution Engine')}
            </span>
            {activeJob && (
              <span className="text-xs font-mono font-bold text-blue-700">{progress}%</span>
            )}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center min-h-[260px]">
            <AnimatePresence mode="wait">
              {activeJob ? (
                <motion.div
                  key={activeJob.id}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="w-full space-y-4 text-center p-4 rounded-xl bg-white border border-slate-200 shadow-md"
                >
                  <span className="text-4xl">⚙️</span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                      {activeJob.category}
                    </span>
                    <p className="text-sm font-black text-[#0f172a] mt-0.5">{activeJob.name}</p>
                    <p className="text-xs font-mono text-slate-600 mt-1">
                      {activeJob.tokens} tokens · {activeJob.isMonster ? t('Takes ~5.0s to compute', '512t prefill compute bound') : t('Takes ~1.8s to compute', 'Short context prefill')}
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                    <motion.div
                      className={`h-full rounded-full ${activeJob.isMonster ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </motion.div>
              ) : (
                <div className="text-center text-slate-500 space-y-2">
                  <span className="text-3xl opacity-40">💤</span>
                  <p className="text-xs font-bold text-slate-600">{t('GPU is idle. Press Start above!', 'No active job in compute pipeline')}</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ③ Completed / Delivered */}
        <div className="flex flex-col rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-900">
              {t('✅ Delivered to Users', 'Completed Stream')}
            </span>
            <span className="text-xs font-mono font-bold text-emerald-700">{completedJobs.length} done</span>
          </div>

          <div className="space-y-2 min-h-[260px] max-h-[360px] overflow-y-auto">
            <AnimatePresence>
              {completedJobs.map(({ job, waitTimeSec }) => (
                <motion.div
                  key={job.id}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="p-3 rounded-xl border border-emerald-200 bg-white shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-700">{job.category}</span>
                    <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      ⏱️ {waitTimeSec}s
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#0f172a] mt-1 leading-snug">{job.name}</p>
                </motion.div>
              ))}
            </AnimatePresence>
            {completedJobs.length === 0 && (
              <div className="h-full flex items-center justify-center py-10 text-center text-slate-500 text-xs font-semibold">
                {t('Finished jobs will appear here', 'Awaiting completed requests')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Page2FCFS: React.FC = () => (
  <StoryPageTemplate
    chapterNum={2}
    emoji="📋"
    eli5Title="The Fair Queue"
    techTitle="FCFS Scheduler"
    eli5Subtitle="First come, first served — totally fair, but with one fatal flaw"
    techSubtitle="First-Come-First-Served: no preemption, no chunking, head-of-line blocking guaranteed"
    illustration={<FCFSIllustration />}
    eli5Body={
      <div className="space-y-4 text-slate-800">
        <p>Imagine a deli counter where everyone gets a ticket in order. That sounds completely fair! But what happens when Person #2 orders a massive 50-course meal for an entire wedding?</p>
        <p>Everyone behind them — Person #3 who only wanted a cup of coffee, Person #4 who just needed a napkin — is forced to wait for all 50 courses to be cooked first.</p>
        <p><strong className="text-slate-950 font-black">This is called Head-of-Line Blocking.</strong> In AI, a single 100-page document analysis request freezes the AI GPU for seconds, making lightning-fast 1-word translation requests wait unnecessarily long.</p>
        <p>👆 <em>Click "Start Fair Queue" above and watch how the 512-word contract freezes everyone behind it!</em></p>
      </div>
    }
    techBody={
      <div className="space-y-4 font-mono text-sm text-slate-800">
        <p>FCFS processes incoming prompts strictly in arrival order (FIFO). It computes the entire prefill phase of request <code>N</code> before admitting request <code>N+1</code>.</p>
        <p>Prefilling a 512-token prompt requires high tensor compute and memory allocation. Shorter requests (36t, 64t) stuck behind it suffer massive <strong className="text-slate-950 font-black">p99 TTFT inflation</strong> (up to 10× worse).</p>
        <p>Chapter 3 solves this problem by introducing <strong className="text-blue-700 font-bold">Chunked Prefill</strong>: slicing large prefills into digestible pieces.</p>
      </div>
    }
    insight="FCFS is fair in order, but unfair in time. One massive request causes everyone behind it to wait, creating frustrating delays for quick questions."
    techInsight="FCFS guarantees head-of-line blocking. Any request with prompt_len >> median inflates p99 TTFT across the system. The solution is Chunked Prefill (Chapter 3)."
  />
);

export default Page2FCFS;
