import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cpu, BookOpen, ExternalLink, Wifi, WifiOff } from 'lucide-react';
import { useMode } from '../../context/ModeContext';
import type { Mode } from '../../context/ModeContext';

interface FactoryHeaderProps {
  isConnected: boolean;
}

export const FactoryHeader: React.FC<FactoryHeaderProps> = ({
  isConnected,
}) => {
  const { mode, setMode, t } = useMode();

  return (
    <header className="card-elev mb-6 p-4 bg-white border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 text-[#0f172a]">
      {/* Logo + Title */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <Cpu className="w-6 h-6" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-emerald-500" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#0f172a] tracking-tight leading-none">
            🏭 {t('AI Factory Floor', 'LLM Inference Control Plane')}
          </h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            {t(
              'Watch AI requests travel through a real factory assembly line',
              'PagedAttention · Chunked Prefill · Priority Preemption · FastAPI WebSocket'
            )}
          </p>
        </div>
      </div>

      {/* Center: BIG Mode Switcher */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner">
        {(['eli5', 'tech'] as Mode[]).map((m) => (
          <motion.button
            key={m}
            onClick={() => setMode(m)}
            whileTap={{ scale: 0.96 }}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === m
                ? m === 'eli5'
                  ? 'bg-amber-500 text-white shadow-sm font-black'
                  : 'bg-blue-600 text-white shadow-sm font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="text-sm">{m === 'eli5' ? '👶' : '⚡'}</span>
            <span>{m === 'eli5' ? 'ELI5 Mode' : 'Senior Dev Spec'}</span>
          </motion.button>
        ))}
      </div>

      {/* Right: Status + Actions */}
      <div className="flex items-center gap-2">
        {/* Connection status */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
          isConnected
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {isConnected ? 'Live Engine' : 'Offline'}
        </div>

        <Link
          to="/docs"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[#0f172a] text-xs font-bold transition-all cursor-pointer shadow-sm"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
          <span>{t('Docs & Glossary', 'Specs & API')}</span>
        </Link>

        <a
          href="https://github.com/Malav786/llm-inference-control-plane"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[#0f172a] text-xs font-bold transition-all cursor-pointer shadow-sm"
        >
          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
          <span>GitHub</span>
        </a>
      </div>
    </header>
  );
};
