import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, ArrowLeft, X } from 'lucide-react';

export interface TourStep {
  targetId: string;
  title: string;
  badge: string;
  description: string;
  tip?: string;
  arrowPosition?: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'tour-mode-switcher',
    badge: 'Step 1 of 5',
    title: '👶 Dual-Mode Experience Toggle',
    description: 'Switch between ELI5 Mode (beginner-friendly hospital ER triage and warehouse analogies) and Tech Mode (senior-level kernel equations, HBM3 bandwidth, and physical VRAM tables).',
    tip: '💡 Tip: Try toggling this anytime to see the entire application adapt its explanations in real-time!',
    arrowPosition: 'top',
  },
  {
    targetId: 'tour-comic-chat',
    badge: 'Step 2 of 5',
    title: '💬 Interactive Systems Dialogue',
    description: 'Follow Alex (Junior Dev) and Riley (Lead Systems Architect) as they diagnose catastrophic server crashes and introduce chunking, memory pooling, and preemption.',
    tip: '💡 Tip: Click "Next Reply" to advance the comic chat, or hit "Auto-Play" for a hands-free narrative.',
    arrowPosition: 'top',
  },
  {
    targetId: 'tour-modules-grid',
    badge: 'Step 3 of 5',
    title: '💥 The 6 Architectural Modules',
    description: 'Explore the 6 key milestones of modern LLM serving: Naive OOM crashes, FCFS Fair Queue, Chunked Prefill, PagedAttention KV-Cache, Dynamic Preemption, and VIP Priority Fast-Lane.',
    tip: '💡 Tip: Click any card to launch its dedicated interactive visualizer and benchmark engine.',
    arrowPosition: 'top',
  },
  {
    targetId: 'tour-factory-cta',
    badge: 'Step 4 of 5',
    title: '🏭 Grand Finale Live Factory Arena',
    description: 'Experience the full production control plane with 60Hz real-time telemetry, simulated NVIDIA H100 GPU compute, physical KV warehouse shelves, and interactive prompt injectors.',
    tip: '💡 Tip: The culmination of all 6 architectural techniques running in unison!',
    arrowPosition: 'bottom',
  },
  {
    targetId: 'tour-docs-link',
    badge: 'Step 5 of 5',
    title: '📚 Developer Specs & Glossary',
    description: 'Deep-dive into full mathematical formulas, PagedAttention block virtualization specs, WebSocket payload schemas, and systems terminology.',
    tip: '💡 Tip: Perfect for engineering interviews, whitepaper references, and API architecture review.',
    arrowPosition: 'top',
  },
];

const STORAGE_KEY = 'llm_control_plane_tour_completed_v1';

interface OnboardingTourProps {
  isOpen?: boolean;
  onClose?: () => void;
  onRestart?: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const isTourActive = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  // Check unique visitor status on initial mount
  useEffect(() => {
    if (controlledIsOpen === undefined) {
      const hasCompletedTour = localStorage.getItem(STORAGE_KEY);
      if (!hasCompletedTour) {
        // Small delay to allow initial DOM elements to settle
        const timer = setTimeout(() => {
          setInternalIsOpen(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [controlledIsOpen]);

  // Update target rect coordinates
  const updateTargetRect = useCallback(() => {
    if (!isTourActive) return;
    const step = TOUR_STEPS[currentStepIndex];
    if (!step) return;

    const el = document.getElementById(step.targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Short delay for scroll animation to settle
      setTimeout(() => {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
      }, 350);
    } else {
      setTargetRect(null);
    }
  }, [isTourActive, currentStepIndex]);

  useEffect(() => {
    updateTargetRect();
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);
    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [updateTargetRect]);

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setInternalIsOpen(false);
    if (controlledOnClose) {
      controlledOnClose();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTourActive) return;
      if (e.key === 'Escape') handleSkip();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTourActive, currentStepIndex]);

  if (!isTourActive) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] pointer-events-auto">
        {/* ── Translucent Backdrop with Dark Dimming ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] transition-all"
          onClick={handleSkip}
        />

        {/* ── Glowing Spotlight Cutout around Active Element ── */}
        {targetRect && (
          <motion.div
            layoutId="tour-spotlight"
            initial={false}
            animate={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
            }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="absolute rounded-3xl pointer-events-none z-10 border-2 border-blue-400 bg-white/5 shadow-[0_0_0_9999px_rgba(15,23,42,0.72),0_0_35px_rgba(59,130,246,0.6)] ring-4 ring-blue-500/40"
          />
        )}

        {/* ── Floating Interactive Guidance Card & Directional Arrow ── */}
        <div className="fixed inset-x-4 bottom-8 sm:bottom-12 md:bottom-auto md:top-24 md:left-1/2 md:-translate-x-1/2 md:max-w-lg z-20 pointer-events-auto">
          <motion.div
            key={currentStepIndex}
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -15 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="card-elev p-6 bg-white/95 backdrop-blur-md rounded-3xl border-2 border-blue-500/30 shadow-2xl space-y-4 text-[#0f172a]"
          >
            {/* Header: Badge + Close Button */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider shadow-xs shadow-blue-500/30">
                  <Sparkles className="w-3.5 h-3.5" />
                  {currentStep.badge}
                </span>
                <span className="text-[11px] font-bold text-slate-500">Interactive Tour</span>
              </div>

              <button
                onClick={handleSkip}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Skip Tour (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h3 className="text-base font-black text-[#0f172a] tracking-tight">
                {currentStep.title}
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {currentStep.description}
              </p>
              {currentStep.tip && (
                <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/90 text-blue-950 text-[11px] font-semibold">
                  {currentStep.tip}
                </div>
              )}
            </div>

            {/* Step Progress Dots & Navigation Buttons */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
              {/* Progress Dots */}
              <div className="flex items-center gap-1.5">
                {TOUR_STEPS.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentStepIndex(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === currentStepIndex
                        ? 'w-6 bg-blue-600'
                        : idx < currentStepIndex
                        ? 'w-2 bg-blue-300'
                        : 'w-2 bg-slate-200'
                    }`}
                    title={`Jump to step ${idx + 1}`}
                  />
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {currentStepIndex > 0 && (
                  <button
                    onClick={handlePrev}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                )}

                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-600/25 transition-all cursor-pointer"
                >
                  <span>
                    {currentStepIndex === TOUR_STEPS.length - 1 ? 'Finish Tour 🚀' : 'Next Step'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
