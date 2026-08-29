import React, { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StoryNav, CHAPTERS } from './StoryNav';
import { useMode } from '../../context/ModeContext';

interface StoryPageTemplateProps {
  chapterNum: number;        // 1–6
  emoji: string;
  eli5Title: string;
  techTitle: string;
  eli5Subtitle: string;
  techSubtitle: string;
  illustration: ReactNode;   // The interactive centerpiece
  eli5Body: ReactNode;
  techBody: ReactNode;
  insight: string;           // The yellow "key takeaway" callout
  techInsight?: string;
}

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

export const StoryPageTemplate: React.FC<StoryPageTemplateProps> = ({
  chapterNum,
  emoji,
  eli5Title,
  techTitle,
  eli5Subtitle,
  techSubtitle,
  illustration,
  eli5Body,
  techBody,
  insight,
  techInsight,
}) => {
  const { mode, t } = useMode();

  const prevChapter = CHAPTERS[chapterNum - 2];
  const nextChapter = CHAPTERS[chapterNum];  // 0-indexed, chapterNum is 1-based

  return (
    <div className="min-h-screen max-w-[1200px] mx-auto px-4 py-6 md:px-6 text-[#0f172a]">
      {/* Progress Nav */}
      <StoryNav />

      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="space-y-8"
      >
        {/* Chapter badge + Title */}
        <div className="text-center space-y-3 py-4">
          <div className="flex items-center justify-center gap-3">
            <span className="px-3.5 py-1 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-600 tracking-widest uppercase shadow-sm">
              Chapter {chapterNum} of 6
            </span>
          </div>
          <div className="text-6xl md:text-7xl">{emoji}</div>
          <h1 className="text-3xl md:text-5xl font-black text-[#0f172a] tracking-tight leading-tight">
            {t(eli5Title, techTitle)}
          </h1>
          <p className="text-base md:text-lg text-[#475569] max-w-2xl mx-auto leading-relaxed">
            {t(eli5Subtitle, techSubtitle)}
          </p>
        </div>

        {/* Interactive Illustration — the centerpiece */}
        <div className="card-elev p-6 md:p-8 min-h-[320px] bg-white border border-slate-200/90 rounded-3xl flex items-center justify-center shadow-md">
          {illustration}
        </div>

        {/* Narrative Body */}
        <div className="card-elev p-6 md:p-8 space-y-4 text-[#334155] leading-relaxed text-base bg-white border border-slate-200/90 rounded-3xl shadow-sm">
          {mode === 'eli5' ? eli5Body : techBody}
        </div>

        {/* Key Insight callout */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-300 bg-amber-50/80 p-6 shadow-sm">
          <div className="flex items-start gap-4 relative z-10">
            <span className="text-3xl flex-shrink-0">💡</span>
            <div>
              <p className="text-xs font-black text-amber-800 uppercase tracking-widest mb-1.5">
                {t('Key Takeaway', 'Key Insight')}
              </p>
              <p className="text-sm md:text-base text-amber-950 font-semibold leading-relaxed">
                {t(insight, techInsight ?? insight)}
              </p>
            </div>
          </div>
        </div>

        {/* Prev / Next navigation */}
        <div className="flex items-center justify-between pt-4">
          {prevChapter ? (
            <Link to={prevChapter.path}>
              <motion.button
                whileHover={{ x: -4 }}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-[#0f172a] font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{t(prevChapter.eli5, prevChapter.tech)}</span>
              </motion.button>
            </Link>
          ) : (
            <Link to="/">
              <motion.button
                whileHover={{ x: -4 }}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-[#0f172a] font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{t('Story Home', 'Architecture Home')}</span>
              </motion.button>
            </Link>
          )}

          <div className="flex gap-1.5">
            {CHAPTERS.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === chapterNum - 1 ? 'bg-blue-600 w-5' : 'bg-slate-300 w-2'
                }`}
              />
            ))}
          </div>

          {nextChapter ? (
            <Link to={nextChapter.path}>
              <motion.button
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
              >
                <span>{t(nextChapter.eli5, nextChapter.tech)}</span>
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </Link>
          ) : (
            <Link to="/factory">
              <motion.button
                whileHover={{ x: 4, scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <span>🏭 {t('Enter Live Factory Floor (Grand Finale!)', 'Launch Live Simulation Engine')}</span>
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </Link>
          )}
        </div>
      </motion.div>
    </div>
  );
};
