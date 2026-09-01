import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Cpu,
  BookOpen,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Play,
  RotateCcw,
  Globe,
  Mail,
  ExternalLink,
  ShieldCheck,
  Code2,
  Compass
} from 'lucide-react';
import { useMode } from '../context/ModeContext';
import { OnboardingTour } from '../components/story/OnboardingTour';

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

const LinkedinIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
  </svg>
);

// ── Story Chapter Definitions ──────────────────────────────────
const CHAPTER_CARDS = [
  {
    path: '/problem',
    num: 1,
    emoji: '💥',
    eli5Title: '1. Why Servers Crash',
    techTitle: '1. Naive Execution & CUDA OOM',
    eli5Desc: 'What happens when 50 people ask huge questions at the exact same second with no rules.',
    techDesc: 'Unbounded concurrent memory allocation leading to catastrophic GPU memory overflow.',
    tag: 'The Root Problem',
    tagColor: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    path: '/fcfs',
    num: 2,
    emoji: '📋',
    eli5Title: '2. The Fair Queue',
    techTitle: '2. FCFS & Head-of-Line Blocking',
    eli5Desc: 'Taking turns in order! But watch how a giant 100-page job blocks everyone behind it.',
    techDesc: 'First-Come, First-Served queue policy and head-of-line blocking latency analysis.',
    tag: 'FIFO Scheduling',
    tagColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    path: '/chunked-prefill',
    num: 3,
    emoji: '🧩',
    eli5Title: '3. Smart Chunks',
    techTitle: '3. Chunked Prefill (vLLM / Sarathi)',
    eli5Desc: 'Slicing big questions into 128-word pieces so quick questions slip in between.',
    techDesc: 'Budget-aware prompt slicing to interleave compute and eliminate decode pipeline stalls.',
    tag: 'Prefill Slicing',
    tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    path: '/kv-capacity',
    num: 4,
    emoji: '📦',
    eli5Title: '4. Memory Saver',
    techTitle: '4. PagedAttention & Block Pools',
    eli5Desc: 'Organizing memory like warehouse shelves to completely eliminate wasted VRAM space.',
    techDesc: 'Non-contiguous physical KV block allocation preventing internal memory fragmentation.',
    tag: 'Paged Memory',
    tagColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    path: '/preemption',
    num: 5,
    emoji: '🚨',
    eli5Title: '5. Emergency Evict',
    techTitle: '5. Preemption & Victim Selection',
    eli5Desc: 'Shelves 100% full? Temporarily moving low-priority jobs to fit urgent emergencies.',
    techDesc: 'Dynamic KV-block reclamation and victim re-queueing under heavy VRAM saturation.',
    tag: 'Victim Eviction',
    tagColor: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    path: '/priority-preemption',
    num: 6,
    emoji: '⭐',
    eli5Title: '6. VIP Fast Lane',
    techTitle: '6. Priority Preemption (Production)',
    eli5Desc: 'The complete system: VIP jobs jump the line, background jobs degrade gracefully.',
    techDesc: 'Production-tier vLLM scheduling policy with strict SLO latency guarantees.',
    tag: 'Production Engine',
    tagColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
];

// ── Dual Character Chat Script ─────────────────────────────────
interface ChatMessage {
  id: number;
  speaker: 'alex' | 'riley';
  eli5Text: string;
  techText: string;
  time: string;
  isAction?: boolean;
}

const CHAT_SCRIPT: ChatMessage[] = [
  {
    id: 1,
    speaker: 'alex',
    time: '09:41 AM',
    eli5Text: "🚨 Riley!! The AI server crashed during the morning rush hour! Customers are seeing blank error screens everywhere!",
    techText: "🚨 Riley, our production H100 cluster threw RuntimeError: CUDA Out Of Memory. 42 concurrent streams crashed immediately.",
  },
  {
    id: 2,
    speaker: 'riley',
    time: '09:42 AM',
    eli5Text: "Looking at the monitors now... 50 users submitted giant 100-page questions simultaneously. The AI brain ran completely out of shelf space!",
    techText: "Investigating telemetry. We had a sudden burst of 4k-token prompts. Without an admission control plane, KV-cache allocations exceeded physical VRAM capacity.",
  },
  {
    id: 3,
    speaker: 'alex',
    time: '09:43 AM',
    eli5Text: "Can't we just make users wait in a single straight line like at the grocery store checkout?",
    techText: "What if we place an FCFS queue in front of the forward pass? Wouldn't FIFO admission prevent VRAM exhaustion?",
  },
  {
    id: 4,
    speaker: 'riley',
    time: '09:44 AM',
    eli5Text: "A simple line helps, but if someone with a massive 100-page document is at the front, quick 1-sentence questions get stuck waiting 30 seconds behind them! That's Head-of-Line blocking.",
    techText: "FCFS prevents OOM, but causes severe Head-of-Line blocking. Long prefills monopolize the SM compute cores, causing p99 TTFT to spike by over 800% for short queries.",
  },
  {
    id: 5,
    speaker: 'alex',
    time: '09:45 AM',
    eli5Text: "So what's the real industrial solution used by OpenAI and vLLM?",
    techText: "What scheduler architecture eliminates both OOM crashes and head-of-line latency jitter in production?",
  },
  {
    id: 6,
    speaker: 'riley',
    time: '09:46 AM',
    eli5Text: "We need an intelligent Control Plane! It slices big questions into 128-word pizzas (Chunked Prefill), organizes memory into slots (PagedAttention), and lets VIP jobs jump ahead (Priority Preemption).",
    techText: "An LLM Inference Control Plane: Chunked Prefill interleaving, PagedAttention block tables, and priority-aware victim preemption with hard SLO guarantees.",
  },
  {
    id: 7,
    speaker: 'alex',
    time: '09:47 AM',
    isAction: true,
    eli5Text: "🚀 Let's start right here with Chapter 1: The Problem to see why the AI server crashed!",
    techText: "🚀 Let's analyze the failure mechanisms starting with Level 1: Naive Execution & CUDA OOM!",
  },
];

export const StoryHome: React.FC = () => {
  const { mode, setMode, t } = useMode();

  // Onboarding Tour state
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Chat conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([CHAT_SCRIPT[0], CHAT_SCRIPT[1]]);
  const [isTyping, setIsTyping] = useState(false);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleNextMessage = () => {
    if (messages.length >= CHAT_SCRIPT.length || isTyping) return;
    setIsTyping(true);
    setTimeout(() => {
      setMessages((prev) => [...prev, CHAT_SCRIPT[prev.length]]);
      setIsTyping(false);
    }, 600);
  };

  const handleAutoPlay = () => {
    if (autoPlaying) return;
    setAutoPlaying(true);
    let currentCount = messages.length;
    const interval = setInterval(() => {
      if (currentCount >= CHAT_SCRIPT.length) {
        clearInterval(interval);
        setAutoPlaying(false);
        return;
      }
      setIsTyping(true);
      setTimeout(() => {
        setMessages((prev) => {
          const next = [...prev, CHAT_SCRIPT[prev.length]];
          currentCount = next.length;
          return next;
        });
        setIsTyping(false);
      }, 450);
    }, 1200);
  };

  const handleResetChat = () => {
    setMessages([CHAT_SCRIPT[0], CHAT_SCRIPT[1]]);
    setAutoPlaying(false);
    setIsTyping(false);
  };

  return (
    <div className="min-h-screen max-w-[1300px] mx-auto px-4 py-8 md:px-8 space-y-12 text-[#0f172a]">
      {/* ── First-Time Visitor Interactive Spotlight Tour ── */}
      <OnboardingTour isOpen={isTourOpen ? true : undefined} onClose={() => setIsTourOpen(false)} />

      {/* ── Top Header & Mode Switcher (Silicon Studio Style) ── */}
      <header className="card-elev p-5 bg-white border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: Project Branding */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-[#0f172a] tracking-tight flex items-center gap-2">
              <span>LLM Inference Control Plane</span>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                Production Simulator
              </span>
            </h1>
            <p className="text-xs text-[#64748b]">
              Interactive systems engineering journey from Naive OOM to vLLM Priority Preemption
            </p>
          </div>
        </div>

        {/* Right: Tour, Docs Link & Interactive Mode Selector */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Guided Tour Replay Button */}
          <button
            onClick={() => setIsTourOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Start Guided Tour"
          >
            <Compass className="w-3.5 h-3.5 text-blue-600 animate-spin-slow" />
            <span>Guided Tour</span>
          </button>

          {/* Developer Docs & Specs */}
          <Link
            to="/docs"
            id="tour-docs-link"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Developer Docs &amp; Specs</span>
          </Link>

          {/* User Experience Mode Switcher */}
          <div id="tour-mode-switcher" className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setMode('eli5')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'eli5'
                  ? 'bg-amber-500 text-white shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>👶 ELI5 Mode</span>
              <span className="text-[10px] opacity-80">(Plain English)</span>
            </button>

            <button
              onClick={() => setMode('tech')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'tech'
                  ? 'bg-blue-600 text-white shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>⚡ Senior Dev</span>
              <span className="text-[10px] opacity-80">(Systems Spec)</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Title ── */}
      <div className="text-center space-y-3 max-w-3xl mx-auto pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Interactive Story &amp; Live Simulation</span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#0f172a] tracking-tight leading-tight">
          {t(
            'The Story of the AI Assembly Line',
            'Architecture of the LLM Inference Control Plane'
          )}
        </h2>
        <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
          {t(
            'Step into the shoes of Alex and Riley as they diagnose why an AI server crashed and construct the factory scheduling algorithms that power modern AI.',
            'A comprehensive exploration of autoregressive serving bottlenecks: KV-cache memory footprints, chunked prefill compute scheduling, PagedAttention block tables, and priority preemption.'
          )}
        </p>
      </div>

      {/* ── Dual-Character Comic Chat Centerpiece ── */}
      <section id="tour-comic-chat" className="relative">
        <div className="card-elev p-6 md:p-8 bg-white border border-slate-200/90 rounded-3xl shadow-lg space-y-6">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0f172a]">
                  #war-room-incident-diagnosis
                </h3>
                <p className="text-[11px] text-[#64748b]">
                  {t('Alex (Product Lead) & Riley (GPU Architect) investigating live outage', 'Production Incident Telemetry & Architecture Alignment')}
                </p>
              </div>
            </div>

            {/* Chat Action Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetChat}
                title="Restart Chat"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {messages.length < CHAT_SCRIPT.length && (
                <>
                  <button
                    onClick={handleNextMessage}
                    disabled={isTyping || autoPlaying}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-all cursor-pointer border border-blue-200"
                  >
                    <span>Next Reply ↓</span>
                  </button>
                  <button
                    onClick={handleAutoPlay}
                    disabled={autoPlaying}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all cursor-pointer shadow-sm"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>Auto Play ▶</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 3-Column Chat Stage: Alex (Left) | Scrollable Chat Window (Center) | Riley (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left Character: Alex */}
            <div className="hidden lg:flex lg:col-span-3 flex-col items-center text-center p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
              <div className="w-16 h-16 rounded-3xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-3xl shadow-sm">
                👩‍💼
              </div>
              <div>
                <h4 className="text-xs font-black text-amber-950">Alex</h4>
                <p className="text-[10px] font-bold text-amber-700">Product &amp; Operations Lead</p>
              </div>
              <p className="text-[11px] text-amber-900/80 leading-snug">
                "Our customers are getting error pages! We need fast, predictable AI replies now."
              </p>
            </div>

            {/* Center: Scrollable Chat Dialogue Box */}
            <div className="lg:col-span-6">
              <div
                ref={chatScrollRef}
                className="h-[380px] overflow-y-auto p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 shadow-inner"
              >
                {messages.map((msg) => {
                  const isAlex = msg.speaker === 'alex';
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-start gap-2.5 ${isAlex ? 'justify-start' : 'justify-end'}`}
                    >
                      {/* Avatar pill for small screens */}
                      {isAlex && (
                        <div className="w-7 h-7 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-xs flex-shrink-0 lg:hidden">
                          👩‍💼
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] p-3.5 rounded-2xl space-y-1 text-xs shadow-sm ${
                          isAlex
                            ? 'bg-white border border-slate-200 text-[#0f172a]'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 text-[10px] opacity-75 font-mono">
                          <span className="font-bold">{isAlex ? 'Alex · Operations' : 'Riley · GPU Architect'}</span>
                          <span>{msg.time}</span>
                        </div>
                        <p className="leading-relaxed">
                          {t(msg.eli5Text, msg.techText)}
                        </p>

                        {/* Final Alex CTA Message */}
                        {msg.isAction && (
                          <div className="pt-2">
                            <Link
                              to="/problem"
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                            >
                              <span>🔥 Start Chapter 1: The Problem →</span>
                            </Link>
                          </div>
                        )}
                      </div>

                      {!isAlex && (
                        <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs flex-shrink-0 lg:hidden">
                          🧑‍💻
                        </div>
                      )}
                    </motion.div>
                  );
                })}

                {isTyping && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono italic px-2">
                    <span className="animate-bounce">●</span>
                    <span className="animate-bounce delay-100">●</span>
                    <span className="animate-bounce delay-200">●</span>
                    <span>Riley is typing explanation...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Character: Riley */}
            <div className="hidden lg:flex lg:col-span-3 flex-col items-center text-center p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-2">
              <div className="w-16 h-16 rounded-3xl bg-blue-100 border-2 border-blue-300 flex items-center justify-center text-3xl shadow-sm">
                🧑‍💻
              </div>
              <div>
                <h4 className="text-xs font-black text-blue-950">Riley</h4>
                <p className="text-[10px] font-bold text-blue-700">Lead GPU Systems Architect</p>
              </div>
              <p className="text-[11px] text-blue-900/80 leading-snug">
                "We need chunked prompt slicing, PagedAttention block tables, and priority preemption."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6-Level Systems Curriculum ── */}
      <section id="tour-modules-grid" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600">
              The 6 Step Architectural Journey
            </span>
            <h3 className="text-2xl font-black text-[#0f172a]">
              From Server Crashes to Production Control Plane
            </h3>
          </div>

          <Link to="/problem" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
            <span>Begin Journey from Level 1</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 6 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {CHAPTER_CARDS.map((ch) => (
            <Link key={ch.path} to={ch.path} className="group">
              <motion.div
                whileHover={{ y: -4 }}
                className="card-elev p-6 bg-white rounded-3xl h-full flex flex-col justify-between space-y-4 border border-slate-200/90 shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{ch.emoji}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${ch.tagColor}`}>
                      {ch.tag}
                    </span>
                  </div>

                  <h4 className="text-base font-black text-[#0f172a] group-hover:text-blue-600 transition-colors">
                    {t(ch.eli5Title, ch.techTitle)}
                  </h4>

                  <p className="text-xs text-[#475569] leading-relaxed">
                    {t(ch.eli5Desc, ch.techDesc)}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#0f172a] group-hover:text-blue-600">
                  <span>Enter Level {ch.num}</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Grand Finale Live Factory Banner (Strictly the Last Destination) ── */}
      <section id="tour-factory-cta" className="pt-4">
        <div className="card-elev p-8 md:p-10 rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-700 text-white shadow-xl flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-[10px] font-mono font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span>Grand Finale Arena</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-black tracking-tight">
              The Live Factory Floor — All Levels Combined!
            </h3>
            <p className="text-xs md:text-sm text-emerald-50 max-w-2xl leading-relaxed">
              Experience the full real-time telemetry engine. Test all 6 schedulers, inject custom VIP requests, and inspect live PagedAttention memory shelves in 60Hz WebSocket animation.
            </p>
          </div>

          <Link
            to="/factory"
            className="px-7 py-4 rounded-2xl bg-white hover:bg-emerald-50 text-emerald-950 font-black text-sm shadow-lg hover:shadow-xl transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer"
          >
            <Cpu className="w-5 h-5 text-emerald-600" />
            <span>Launch Live Factory Floor →</span>
          </Link>
        </div>
      </section>

      {/* ── High-End Product Footer ── */}
      <footer className="mt-12 pt-12 pb-8 border-t border-slate-200 text-[#0f172a] space-y-10">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand & Creator Bio */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black tracking-tight text-[#0f172a]">
                  LLM Inference Control Plane
                </h4>
                <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                  Open-Source GPU Scheduling Simulator
                </p>
              </div>
            </div>

            <p className="text-xs text-[#475569] leading-relaxed max-w-sm">
              An interactive visual systems control plane demonstrating modern Large Language Model serving architectures: PagedAttention KV-cache block tables, chunked prefill pipelining, and priority-aware preemption.
            </p>

            <div className="flex items-center gap-3 pt-1">
              <a
                href="https://github.com/Malav786"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[#0f172a] transition-all cursor-pointer shadow-xs"
                title="GitHub @Malav786"
              >
                <GithubIcon className="w-4 h-4" />
              </a>

              <a
                href="https://www.linkedin.com/in/malav-champaneria"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-blue-600 transition-all cursor-pointer shadow-xs"
                title="LinkedIn /malav-champaneria"
              >
                <LinkedinIcon className="w-4 h-4" />
              </a>

              <a
                href="https://malavchampaneria.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-emerald-600 transition-all cursor-pointer shadow-xs"
                title="Portfolio Website"
              >
                <Globe className="w-4 h-4" />
              </a>

              <a
                href="mailto:mchamp.2509@gmail.com"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-rose-600 transition-all cursor-pointer shadow-xs"
                title="Contact via Email"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Column 1: Core Architecture Modules */}
          <div className="space-y-3">
            <h5 className="text-xs font-black uppercase tracking-wider text-[#0f172a]">
              Architecture Modules
            </h5>
            <ul className="space-y-2 text-xs font-semibold text-[#475569]">
              <li>
                <Link to="/problem" className="hover:text-blue-600 transition-colors flex items-center gap-1.5">
                  <span>1. Naive OOM Crashes</span>
                </Link>
              </li>
              <li>
                <Link to="/fcfs" className="hover:text-blue-600 transition-colors flex items-center gap-1.5">
                  <span>2. Fair Queue &amp; Head-of-Line</span>
                </Link>
              </li>
              <li>
                <Link to="/chunked-prefill" className="hover:text-blue-600 transition-colors flex items-center gap-1.5">
                  <span>3. Chunked Prefill Slicing</span>
                </Link>
              </li>
              <li>
                <Link to="/kv-capacity" className="hover:text-blue-600 transition-colors flex items-center gap-1.5">
                  <span>4. Paged KV-Cache Capacity</span>
                </Link>
              </li>
              <li>
                <Link to="/preemption" className="hover:text-blue-600 transition-colors flex items-center gap-1.5">
                  <span>5. Emergency Preemption</span>
                </Link>
              </li>
              <li>
                <Link to="/priority-preemption" className="hover:text-blue-600 transition-colors flex items-center gap-1.5">
                  <span>6. Priority VIP Fast Lane</span>
                </Link>
              </li>
              <li>
                <Link to="/factory" className="hover:text-emerald-600 font-bold transition-colors flex items-center gap-1.5 text-emerald-700">
                  <span>🏭 Live Factory Arena</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Documentation & Specs */}
          <div className="space-y-3">
            <h5 className="text-xs font-black uppercase tracking-wider text-[#0f172a]">
              Developer Specs
            </h5>
            <ul className="space-y-2 text-xs font-semibold text-[#475569]">
              <li>
                <Link to="/docs" className="hover:text-blue-600 transition-colors flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                  <span>Documentation Overview</span>
                </Link>
              </li>
              <li>
                <Link to="/docs" className="hover:text-blue-600 transition-colors">
                  PagedAttention Block Spec
                </Link>
              </li>
              <li>
                <Link to="/docs" className="hover:text-blue-600 transition-colors">
                  Chunked Prefill Slicing
                </Link>
              </li>
              <li>
                <Link to="/docs" className="hover:text-blue-600 transition-colors">
                  Priority Victim Preemption
                </Link>
              </li>
              <li>
                <Link to="/docs" className="hover:text-blue-600 transition-colors">
                  FastAPI WebSocket Specs
                </Link>
              </li>
              <li>
                <Link to="/docs" className="hover:text-blue-600 transition-colors">
                  Glossary &amp; Formulas
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Creator & Contact */}
          <div className="space-y-3">
            <h5 className="text-xs font-black uppercase tracking-wider text-[#0f172a]">
              Creator &amp; Contact
            </h5>
            <ul className="space-y-2 text-xs font-semibold text-[#475569]">
              <li>
                <a
                  href="https://malavchampaneria.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-600 transition-colors flex items-center gap-1.5 text-[#0f172a] font-bold"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Malav Champaneria</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/in/malav-champaneria"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 transition-colors flex items-center gap-1.5"
                >
                  <LinkedinIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>LinkedIn Profile</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Malav786"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#0f172a] transition-colors flex items-center gap-1.5"
                >
                  <GithubIcon className="w-3.5 h-3.5 text-slate-800" />
                  <span>GitHub Profile</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Malav786/llm-inference-control-plane"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 transition-colors flex items-center gap-1.5"
                >
                  <Code2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Source Repository</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              </li>
              <li>
                <a
                  href="mailto:mchamp.2509@gmail.com"
                  className="hover:text-rose-600 transition-colors flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-rose-600" />
                  <span>mchamp.2509@gmail.com</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright, License, Tech Stack Badges */}
        <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64748b]">
          <div className="flex flex-wrap items-center gap-2 text-center sm:text-left">
            <span>© {new Date().getFullYear()} <strong className="text-[#0f172a]">Malav Champaneria</strong>.</span>
            <span>All rights reserved.</span>
            <span className="hidden sm:inline">·</span>
            <span className="inline-flex items-center gap-1 text-[#0f172a] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              MIT Open Source License
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Engine Online · 60Hz Telemetry
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default StoryHome;
