import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, RefreshCw } from 'lucide-react';
import { StoryPageTemplate } from '../components/story/StoryPageTemplate';
import { useMode } from '../context/ModeContext';

// Chaos animation: requests pile up and crash
const ChaosIllustration: React.FC = () => {
  const { t } = useMode();
  const [jobs, setJobs] = useState<{ id: number; x: number; y: number; label: string; crashed: boolean }[]>([]);
  const [crashed, setCrashed] = useState(false);
  const [count, setCount] = useState(0);

  const LABELS = [
    'Write a poem 🎨', 'Debug my code 💻', 'Translate text 🌐',
    'Explain AI 🧠', 'Legal summary 📄', 'Write story ✍️',
    'SQL review 📊', 'Unit tests 🔬', 'Cover letter 📝',
    'Data analysis 📈', 'Chat reply 💬', 'Code review 🔍',
  ];

  const addJob = () => {
    if (crashed) { setJobs([]); setCrashed(false); setCount(0); return; }
    const next = count + 1;
    setCount(next);
    const newJob = {
      id: Date.now(),
      x: Math.random() * 60 + 5,
      y: Math.random() * 40 + 10,
      label: LABELS[next % LABELS.length],
      crashed: false,
    };
    const updated = [...jobs, newJob];
    setJobs(updated);
    if (updated.length >= 8) {
      setTimeout(() => setCrashed(true), 400);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="relative h-64 rounded-2xl border border-slate-200 bg-slate-50/80 overflow-hidden shadow-inner">
        {/* GPU icon in center */}
        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${crashed ? 'scale-110' : 'scale-100'}`}>
          <div className={`relative flex flex-col items-center gap-2 ${crashed ? 'opacity-0 scale-0' : 'opacity-100'} transition-all duration-300`}>
            <div className="p-4 rounded-2xl bg-blue-50 border-2 border-blue-300 shadow-sm">
              <span className="text-4xl">🖥️</span>
            </div>
            <span className="text-xs font-black text-blue-900">{t('AI Brain (GPU)', 'NVIDIA H100 SXM GPU')}</span>
          </div>

          <AnimatePresence>
            {crashed && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute flex flex-col items-center gap-3"
              >
                <motion.div
                  animate={{ rotate: [0, -5, 5, -5, 5, 0] }}
                  transition={{ duration: 0.5, repeat: 3 }}
                  className="text-6xl"
                >
                  💥
                </motion.div>
                <div className="px-4 py-2 rounded-xl bg-rose-50 border-2 border-rose-400 shadow-md">
                  <p className="text-sm font-black text-rose-800">
                    {t('OUT OF MEMORY — CRASHED!', 'CUDA OOM Error — Kernel Panic')}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Flying requests */}
        <AnimatePresence>
          {jobs.map((job) => (
            <motion.div
              key={job.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={crashed
                ? { scale: [1, 1.2, 0], opacity: [1, 1, 0], rotate: [0, 15, -15, 0] }
                : { scale: 1, opacity: 1 }
              }
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute"
              style={{ left: `${job.x}%`, top: `${job.y}%` }}
            >
              <div className="px-2.5 py-1.5 rounded-xl bg-blue-600 border border-blue-500 text-xs font-bold text-white whitespace-nowrap shadow-md">
                {job.label}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={addJob}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all cursor-pointer shadow-sm ${
            crashed
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
          }`}
        >
          {crashed ? <RefreshCw className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {crashed
            ? t('🔄 Start Over', 'Reset Simulation')
            : `${t('➕ Add Another Job', 'Add Request')} (${jobs.length}/8 — crash at 8!)`
          }
        </motion.button>
      </div>

      {!crashed && jobs.length > 0 && (
        <div className="flex justify-center">
          <div className="px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-xs font-bold text-amber-900 shadow-xs">
            ⚠️ {t(`${jobs.length} jobs queued — GPU memory filling fast!`, `${jobs.length} concurrent requests — KV-cache: ${jobs.length * 12}% utilized`)}
          </div>
        </div>
      )}
    </div>
  );
};

const Page1Problem: React.FC = () => {
  return (
    <StoryPageTemplate
      chapterNum={1}
      emoji="🔥"
      eli5Title="Why AI Servers Crash"
      techTitle="The Naive Inference Problem"
      eli5Subtitle="What happens when too many people talk to AI at once — without a smart queue"
      techSubtitle="Naive FCFS without KV-cache limits leads to OOM crashes, GPU idle bubbles, and head-of-line blocking"
      illustration={<ChaosIllustration />}
      eli5Body={
        <div className="space-y-4 text-slate-800">
          <p>Imagine a single doctor (the GPU) who has to answer every patient's question. Without a receptionist managing the waiting room, all 50 patients run straight into the office at once.</p>
          <p>The doctor's desk overflows with papers 📄📄📄 — there's no more space to write — and everything collapses. <strong className="text-slate-950 font-black">This is exactly what happens to AI servers without smart scheduling.</strong></p>
          <p>👆 <em>Click the button above and watch what happens when too many jobs arrive at once!</em></p>
        </div>
      }
      techBody={
        <div className="space-y-4 font-mono text-sm text-slate-800">
          <p>Without a KV-cache scheduler, every incoming request immediately allocates <code className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">prompt_len × d_head × n_layers × 2</code> bytes of HBM3 memory for Key-Value tensors.</p>
          <p>With 50 concurrent requests of 512 tokens on an H100 (80GB VRAM): <code className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">50 × 512 × 128 × 32 × 2 × bf16 ≈ 107 GB</code> — exceeds VRAM. <strong className="text-slate-950 font-black">Result: CUDA OOM → kernel panic → full restart.</strong></p>
          <p>Even before OOM, head-of-line blocking means a 4096-token prompt stalls 512-token requests behind it for 2–3 seconds.</p>
        </div>
      }
      insight="Without a scheduling strategy, one long request can crash the entire AI server for all users."
      techInsight="Naive concurrent KV allocation without capacity bounds guarantees OOM errors under load. The solution: a scheduler that controls admission and memory allocation."
    />
  );
};

export default Page1Problem;
