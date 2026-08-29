import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Send, RotateCcw } from 'lucide-react';

import { StoryPageTemplate } from '../components/story/StoryPageTemplate';
import { useMode } from '../context/ModeContext';
import { getRandomRequestName, getRequestEmoji, shortName } from '../utils/requestNames';

interface MiniJob {
  id: string;
  label: string;
  priority: number;
  stage: 'queue' | 'prefill' | 'decode' | 'done';
  emoji: string;
}

const VIPIllustration: React.FC = () => {
  const { t } = useMode();
  const [jobs, setJobs] = useState<MiniJob[]>([]);
  const [running, setRunning] = useState(false);
  const [throughput, setThroughput] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateJob = (priority: number): MiniJob => {
    const name = getRandomRequestName();
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: shortName(name, 24),
      priority,
      stage: 'queue',
      emoji: getRequestEmoji(name),
    };
  };

  const start = () => {
    setRunning(true);
    const seed: MiniJob[] = [
      generateJob(3),
      generateJob(2),
      generateJob(4),
      generateJob(1),
    ];
    setJobs(seed);
  };

  const injectVIP = () => {
    const vip = generateJob(10);
    vip.label = '🚨 VIP ' + vip.label;
    setJobs(j => [vip, ...j.filter(x => x.stage === 'queue' || x.stage === 'prefill' || x.stage === 'decode')]);
  };

  const reset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setJobs([]);
    setThroughput(0);
  };

  // Tick loop
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setJobs(prev => {
        let updated = [...prev];
        // Move done jobs out
        updated = updated.filter(j => j.stage !== 'done' || Math.random() > 0.5);

        // Finish decoding → done
        updated = updated.map(j =>
          j.stage === 'decode' && Math.random() > 0.65 ? { ...j, stage: 'done' } : j
        );

        // Move prefill → decode (high priority first)
        const inPrefill = updated.filter(j => j.stage === 'prefill');
        if (inPrefill.length > 0 && Math.random() > 0.4) {
          const highestP = inPrefill.sort((a, b) => b.priority - a.priority)[0];
          updated = updated.map(j => j.id === highestP.id ? { ...j, stage: 'decode' } : j);
        }

        // Admit from queue (strict priority order)
        const inQueue = updated.filter(j => j.stage === 'queue').sort((a, b) => b.priority - a.priority);
        if (inQueue.length > 0 && updated.filter(j => j.stage === 'prefill').length < 3) {
          updated = updated.map(j => j.id === inQueue[0].id ? { ...j, stage: 'prefill' } : j);
        }

        // Add new random job occasionally
        if (Math.random() > 0.7 && updated.filter(j => j.stage === 'queue').length < 6) {
          updated.push(generateJob(Math.ceil(Math.random() * 7)));
        }

        setThroughput(t => Math.min(t + (updated.filter(j => j.stage === 'done').length > 0 ? 12 : 0), 3200));
        return updated.slice(0, 14);
      });
    }, 800);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const queueJobs = jobs.filter(j => j.stage === 'queue').sort((a, b) => b.priority - a.priority);
  const prefillJobs = jobs.filter(j => j.stage === 'prefill');
  const decodeJobs = jobs.filter(j => j.stage === 'decode');
  const doneJobs = jobs.filter(j => j.stage === 'done').slice(-3);

  const priorityColor = (p: number) =>
    p >= 8 ? 'bg-rose-50 border-rose-300 text-rose-950 font-black ring-1 ring-rose-400' :
      p >= 5 ? 'bg-amber-50 border-amber-300 text-amber-950 font-bold' :
        'bg-blue-50 border-blue-200 text-blue-950 font-medium';

  return (
    <div className="w-full space-y-4 text-[#0f172a]">
      {/* Live metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: t('🔴 VIP Jobs', 'Priority 8–10'), val: jobs.filter(j => j.priority >= 8).length, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
          { label: t('⚙️ Processing', 'Prefill + Decode'), val: prefillJobs.length + decodeJobs.length, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
          { label: t('✅ Delivered', 'Completed'), val: jobs.filter(j => j.stage === 'done').length, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
          { label: t('📈 Tok/sec', 'Throughput'), val: throughput, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
        ].map(m => (
          <div key={m.label} className={`px-3 py-2.5 rounded-2xl border ${m.bg} text-center shadow-xs`}>
            <p className={`text-xl font-black ${m.color}`}>{m.val}</p>
            <p className="text-[10px] font-bold text-slate-700 leading-tight mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* 4-column pipeline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { key: 'queue', label: t('⏳ Waiting Queue', 'Queue'), items: queueJobs, color: 'border-slate-200 bg-slate-50/70', badgeColor: 'text-slate-700' },
          { key: 'prefill', label: t('📖 Reading (Prefill)', 'Prefill'), items: prefillJobs, color: 'border-blue-200 bg-blue-50/40', badgeColor: 'text-blue-700' },
          { key: 'decode', label: t('✍️ Writing (Decode)', 'Decode'), items: decodeJobs, color: 'border-purple-200 bg-purple-50/40', badgeColor: 'text-purple-700' },
          { key: 'done', label: t('✅ Done & Sent', 'Completed'), items: doneJobs, color: 'border-emerald-200 bg-emerald-50/40', badgeColor: 'text-emerald-700' },
        ].map(col => (
          <div key={col.key} className={`rounded-2xl border ${col.color} p-3 min-h-[160px] shadow-xs flex flex-col justify-between`}>
            <div>
              <p className={`text-[11px] font-black uppercase tracking-wider text-center mb-2 ${col.badgeColor}`}>{col.label}</p>
              <div className="space-y-1.5">
                <AnimatePresence>
                  {col.items.map(job => (
                    <motion.div
                      key={job.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                      className={`px-2.5 py-1.5 rounded-xl border text-[10px] shadow-xs flex items-center justify-between gap-1.5 ${priorityColor(job.priority)}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs">{job.emoji}</span>
                        <span className="truncate">{job.label}</span>
                      </div>
                      <span className="text-[8px] font-mono font-black opacity-80 px-1 py-0.5 bg-white/70 rounded border border-black/10">P{job.priority}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {col.items.length === 0 && (
                  <p className="text-[10px] text-slate-400 font-semibold text-center py-4 italic">Empty</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 justify-center pt-2">
        {!running ? (
          <button onClick={start}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-sm transition-all cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            <span>{t('Start Full Factory', 'Start Priority Preemption Engine')}</span>
          </button>
        ) : (
          <>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={injectVIP}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm shadow-md transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>🚨 {t('Inject VIP Job (P10)!', 'Inject Priority-10 Request')}</span>
            </motion.button>
            <button onClick={reset} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all cursor-pointer">
              <RotateCcw className="w-4 h-4" />
              <span>{t('Reset', 'Reset')}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const Page6VIP: React.FC = () => (
  <StoryPageTemplate
    chapterNum={6}
    emoji="⭐"
    eli5Title="VIP Fast Lane"
    techTitle="Priority Preemption"
    eli5Subtitle="The complete system — VIP jobs jump the queue, everyone else gets served fairly"
    techSubtitle="Priority-aware preemption: victim selection = lowest priority, instant VIP admission"
    illustration={<VIPIllustration />}
    eli5Body={
      <div className="space-y-4 text-slate-800">
        <p>Now we have the complete system! It's like an airport with a VIP lane and a regular queue. Priority 10 passengers (paying customers, emergencies) board first. Priority 1–4 passengers wait respectfully.</p>
        <p>But nobody ever crashes the whole airport. Memory limits are enforced, chunks are used to prevent big jobs from blocking small ones, and eviction keeps things moving.</p>
        <p>👆 <em>Start the factory, then inject a VIP job and watch it cut to the front of the queue instantly!</em></p>
      </div>
    }
    techBody={
      <div className="space-y-4 font-mono text-sm text-slate-800">
        <p>Priority preemption combines all previous techniques: chunked prefill + KV-capacity admission + priority-ordered victim selection for eviction.</p>
        <p>On admission: sort waiting requests by priority descending. If capacity is insufficient, evict the lowest-priority decoding request, free its blocks, admit the high-priority request.</p>
        <p>Result: <code className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">TTFT(priority=10) &lt; 30ms</code> guaranteed even under full load. Background requests (priority=1) degrade gracefully but never starve (aging can be applied).</p>
      </div>
    }
    insight="Priority Preemption is the full solution: fast for VIPs, fair for everyone, and the factory never crashes. This is how production LLM systems like vLLM work at scale."
    techInsight="This is vLLM's core scheduling policy. Combined with PagedAttention's virtual block paging, it achieves >85% HBM bandwidth utilization with sub-30ms TTFT SLAs for priority traffic."
  />
);

export default Page6VIP;
