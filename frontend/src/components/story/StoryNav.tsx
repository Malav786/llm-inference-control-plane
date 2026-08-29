import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, CheckCircle2, Cpu } from 'lucide-react';
import { useMode } from '../../context/ModeContext';
import type { Mode } from '../../context/ModeContext';

const CHAPTERS = [
  { path: '/problem', num: 1, emoji: '💥', shortName: 'OOM Crash', eli5: '1. Why Servers Crash', tech: '1. Naive OOM' },
  { path: '/fcfs', num: 2, emoji: '📋', shortName: 'FCFS Queue', eli5: '2. The Fair Queue', tech: '2. FCFS Scheduler' },
  { path: '/chunked-prefill', num: 3, emoji: '🧩', shortName: 'Chunked', eli5: '3. Smart Chunks', tech: '3. Chunked Prefill' },
  { path: '/kv-capacity', num: 4, emoji: '📦', shortName: 'KV Limits', eli5: '4. Memory Saver', tech: '4. KV-Capacity' },
  { path: '/preemption', num: 5, emoji: '🚨', shortName: 'Preemption', eli5: '5. Emergency Evict', tech: '5. Preemption' },
  { path: '/priority-preemption', num: 6, emoji: '⭐', shortName: 'VIP Priority', eli5: '6. VIP Fast Lane', tech: '6. Priority Preempt' },
];

export const StoryNav: React.FC = () => {
  const { pathname } = useLocation();
  const { mode, setMode, t } = useMode();

  const currentIndex = CHAPTERS.findIndex(c => c.path === pathname);
  const activeChapter = CHAPTERS[currentIndex] || CHAPTERS[0];

  return (
    <header className="card-elev mb-8 p-4 rounded-3xl border border-slate-200/90 bg-white shadow-sm space-y-3.5">
      {/* ── Top Bar: Intro Link (Left), Live Factory (Right), Mode Switcher ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        {/* Left: Return to Story Home */}
        <Link
          to="/"
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
            pathname === '/'
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
          <span>{t('Story Home', 'Architecture Home')}</span>
        </Link>

        {/* Center: Active Level Indicator */}
        {currentIndex >= 0 && (
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold">
            <span className="text-slate-500 uppercase tracking-wider text-[10px]">Active Level:</span>
            <span className="text-blue-600 font-black">{activeChapter.emoji} {t(activeChapter.eli5, activeChapter.tech)}</span>
          </div>
        )}

        {/* Right: Docs Link + Live Factory Floor CTA + Mode Switcher */}
        <div className="flex items-center gap-2">
          <Link
            to="/docs"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Docs</span>
          </Link>

          <Link
            to="/factory"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold transition-all cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('🏭 Live Factory', '🏭 Simulation')}</span>
          </Link>

          {/* Mode toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
            {(['eli5', 'tech'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mode === m
                    ? m === 'eli5'
                      ? 'bg-amber-500 text-white shadow-sm font-black'
                      : 'bg-blue-600 text-white shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m === 'eli5' ? '👶 ELI5' : '⚡ Tech'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Stepper Track: 6 Discrete Step Nodes ── */}
      <div className="flex items-center justify-between gap-1 sm:gap-2 px-1">
        {CHAPTERS.map((ch, idx) => {
          const isActive = pathname === ch.path;
          const isDone = currentIndex > idx;

          return (
            <React.Fragment key={ch.path}>
              <Link to={ch.path} className="flex-1 max-w-[170px] min-w-0">
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className={`p-2 sm:p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    isActive
                      ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-400/30 text-blue-800 shadow-sm'
                      : isDone
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {isDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <span className="text-sm flex-shrink-0">{ch.emoji}</span>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-wider opacity-75">
                      L{ch.num}
                    </span>
                  </div>

                  <p className={`text-[11px] font-bold truncate max-w-full leading-tight ${isActive ? 'text-blue-950 font-black' : ''}`}>
                    {t(ch.eli5.replace(/^\d+\.\s*/, ''), ch.tech.replace(/^\d+\.\s*/, ''))}
                  </p>
                </motion.div>
              </Link>

              {idx < CHAPTERS.length - 1 && (
                <div
                  className={`hidden md:block h-0.5 w-3 lg:w-6 flex-shrink-0 rounded-full transition-all ${
                    isDone ? 'bg-emerald-400' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </header>
  );
};

export { CHAPTERS };
