import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, ArrowLeft, X } from 'lucide-react';

export interface TourStep {
  targetId: string;
  title: string;
  badge: string;
  description: string;
  tip?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'tour-mode-switcher',
    badge: 'Step 1 of 5',
    title: '👶 Dual-Mode Experience Toggle',
    description:
      'Switch between ELI5 Mode (beginner-friendly analogies) and Senior Dev Mode (kernel equations, HBM3 bandwidth, VRAM tables). The entire app adapts in real-time.',
    tip: '💡 Try toggling anytime to see all explanations instantly change!',
  },
  {
    targetId: 'tour-comic-chat',
    badge: 'Step 2 of 5',
    title: '💬 Interactive Systems Dialogue',
    description:
      'Follow Alex & Riley as they diagnose a catastrophic GPU crash and walk through each fix — chunking, memory pooling, and preemption.',
    tip: '💡 Click "Next Reply ↓" to advance or hit "Auto Play ▶" for hands-free narrative.',
  },
  {
    targetId: 'tour-modules-grid',
    badge: 'Step 3 of 5',
    title: '💥 The 6 Architectural Modules',
    description:
      'Explore 6 key milestones: Naive OOM crashes → FCFS → Chunked Prefill → PagedAttention → Preemption → VIP Priority Fast-Lane.',
    tip: '💡 Click any card to launch its dedicated interactive visualizer.',
  },
  {
    targetId: 'tour-factory-cta',
    badge: 'Step 4 of 5',
    title: '🏭 Grand Finale Live Factory Arena',
    description:
      'The full production control plane with 60Hz real-time telemetry, simulated H100 GPU compute, KV warehouse shelves, and live prompt injection.',
    tip: '💡 All 6 architectural techniques running in unison — the ultimate sandbox!',
  },
  {
    targetId: 'tour-docs-link',
    badge: 'Step 5 of 5',
    title: '📚 Developer Specs & Documentation',
    description:
      'Full mathematical formulas, PagedAttention block specs, WebSocket schemas, and engineering deep-dives — perfect for interviews and architecture review.',
    tip: '💡 Everything referenced in this simulator is backed by precise specs here.',
  },
];

const STORAGE_KEY = 'llm_control_plane_tour_completed_v1';

// Padding around the spotlight element (px)
const PAD = 10;

interface OnboardingTourProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const isTourActive = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  // Auto-launch for first-time visitors
  useEffect(() => {
    if (controlledIsOpen === undefined) {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) {
        const t = setTimeout(() => setInternalIsOpen(true), 800);
        return () => clearTimeout(t);
      }
    }
  }, [controlledIsOpen]);

  // Reset to step 0 when tour opens via controlled prop
  useEffect(() => {
    if (controlledIsOpen) setCurrentStepIndex(0);
  }, [controlledIsOpen]);

  // Measure the rect of the current target element
  const measureRect = useCallback(() => {
    if (!isTourActive) return;
    const step = TOUR_STEPS[currentStepIndex];
    if (!step) return;
    const el = document.getElementById(step.targetId);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [isTourActive, currentStepIndex]);

  // Scroll into view + measure, and keep measuring on scroll/resize
  useEffect(() => {
    if (!isTourActive) return;
    const step = TOUR_STEPS[currentStepIndex];
    if (!step) return;
    const el = document.getElementById(step.targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const t = setTimeout(() => {
      measureRect();
    }, 420);
    window.addEventListener('scroll', measureRect, true);
    window.addEventListener('resize', measureRect);
    return () => {
      clearTimeout(t);
      window.removeEventListener('scroll', measureRect, true);
      window.removeEventListener('resize', measureRect);
    };
  }, [isTourActive, currentStepIndex, measureRect]);

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((p) => p + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) setCurrentStepIndex((p) => p - 1);
  };

  const handleComplete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setInternalIsOpen(false);
    if (controlledOnClose) controlledOnClose();
  }, [controlledOnClose]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isTourActive) return;
      if (e.key === 'Escape') handleComplete();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isTourActive, currentStepIndex, handleComplete]);

  if (!isTourActive) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];

  // Spotlight geometry
  const sTop    = targetRect ? targetRect.top    - PAD : 0;
  const sLeft   = targetRect ? targetRect.left   - PAD : 0;
  const sWidth  = targetRect ? targetRect.width  + PAD * 2 : 0;
  const sHeight = targetRect ? targetRect.height + PAD * 2 : 0;

  // Smart card placement: below if there's space, otherwise above
  const winH = window.innerHeight;
  const cardH = 260;
  const spaceBelow = winH - (sTop + sHeight);
  const placeBelow = spaceBelow > cardH + 20;

  // Card top position clamped to viewport
  const cardTopBelow = Math.min(sTop + sHeight + 16, winH - cardH - 16);
  const cardTopAbove = Math.max(sTop - cardH - 16, 16);
  const cardTop = targetRect ? (placeBelow ? cardTopBelow : cardTopAbove) : winH / 2 - cardH / 2;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] pointer-events-none">

        {/* Light scrim — screen stays fully visible */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-950/25"
          style={{ pointerEvents: 'auto' }}
          onClick={handleComplete}
        />

        {/* Spotlight punch-through with shadow mask */}
        {targetRect && (
          <motion.div
            initial={false}
            animate={{ top: sTop, left: sLeft, width: sWidth, height: sHeight }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            className="absolute z-10 rounded-2xl pointer-events-none"
            style={{
              boxShadow: '0 0 0 9999px rgba(15,23,42,0.25)',
              background: 'transparent',
            }}
          />
        )}

        {/* Animated glowing border ring */}
        {targetRect && (
          <motion.div
            initial={false}
            animate={{ top: sTop, left: sLeft, width: sWidth, height: sHeight }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            className="absolute z-20 rounded-2xl pointer-events-none"
            style={{
              border: '2.5px solid #3b82f6',
              boxShadow:
                '0 0 0 3px rgba(59,130,246,0.2), 0 0 24px rgba(59,130,246,0.55), inset 0 0 16px rgba(59,130,246,0.06)',
            }}
          >
            {/* Corner brackets */}
            {[
              { top: -5, left: -5, borderTop: '3px solid #60a5fa', borderLeft: '3px solid #60a5fa' },
              { top: -5, right: -5, borderTop: '3px solid #60a5fa', borderRight: '3px solid #60a5fa' },
              { bottom: -5, left: -5, borderBottom: '3px solid #60a5fa', borderLeft: '3px solid #60a5fa' },
              { bottom: -5, right: -5, borderBottom: '3px solid #60a5fa', borderRight: '3px solid #60a5fa' },
            ].map((s, i) => (
              <motion.div
                key={i}
                className="absolute w-4 h-4"
                style={{ borderRadius: 2, ...s }}
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.18 }}
              />
            ))}
          </motion.div>
        )}

        {/* Bouncing arrow pointing toward the element */}
        {targetRect && (
          <motion.div
            initial={false}
            animate={{
              top: sTop + sHeight / 2 - 12,
              left: Math.max(sLeft - 38, 8),
            }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            className="absolute z-30 pointer-events-none"
          >
            <motion.div
              animate={{ x: [0, 7, 0] }}
              transition={{ duration: 0.85, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ArrowRight className="w-6 h-6 text-blue-400 drop-shadow-lg" strokeWidth={2.5} />
            </motion.div>
          </motion.div>
        )}

        {/* Guidance Card */}
        <div
          className="fixed z-40 pointer-events-auto"
          style={{
            top: cardTop,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(460px, calc(100vw - 32px))',
          }}
        >
          <motion.div
            key={currentStepIndex}
            initial={{ opacity: 0, scale: 0.92, y: placeBelow ? 14 : -14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: placeBelow ? -14 : 14 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            className="bg-white rounded-3xl p-5 space-y-4 text-[#0f172a]"
            style={{
              border: '2px solid rgba(59,130,246,0.35)',
              boxShadow:
                '0 8px 48px rgba(59,130,246,0.22), 0 2px 16px rgba(0,0,0,0.14)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" />
                  {currentStep.badge}
                </span>
                <span className="text-[11px] font-bold text-slate-400">Guided Tour</span>
              </div>
              <button
                onClick={handleComplete}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Skip Tour (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <h3 className="text-sm font-black text-[#0f172a] tracking-tight leading-snug">
                {currentStep.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {currentStep.description}
              </p>
              {currentStep.tip && (
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] font-semibold leading-snug">
                  {currentStep.tip}
                </div>
              )}
            </div>

            {/* Footer: dots + nav */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
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
                    title={`Step ${idx + 1}`}
                  />
                ))}
              </div>
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
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-600/30 transition-all cursor-pointer"
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
