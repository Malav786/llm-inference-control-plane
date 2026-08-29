import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Cpu,
  Search,
  Code2,
  ChevronRight,
  Flame,
  Terminal,
  Award,
  Copy,
  Check,
  Sparkles
} from 'lucide-react';
import { useMode } from '../context/ModeContext';
import type { Mode } from '../context/ModeContext';

// ── Code Block Component with Copy Button ──────────────────────
const CodeSnippet: React.FC<{ code: string; language: string; filename?: string }> = ({
  code,
  language,
  filename,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-[#e5e0d8] bg-[#0f172a] text-slate-100 overflow-hidden my-3 shadow-md">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1e293b] border-b border-slate-700 text-xs font-mono text-slate-300">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-2 font-bold text-slate-200">{filename || language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-all cursor-pointer"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const DocumentationPage: React.FC = () => {
  const { mode, setMode, t } = useMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState('overview');

  // Documentation sections dataset
  const sections = useMemo(() => [
    {
      id: 'overview',
      category: '1. Fundamentals',
      title: 'Control Plane Architecture & Two-Phase Lifecycle',
      icon: Cpu,
      eli5Summary: 'The AI brain works in two distinct steps: Reading (Prefill) and Speaking (Decode). An intelligent scheduler manages both so neither hogs the machine.',
      techSummary: 'Architectural overview of the two-phase autoregressive transformer lifecycle: compute-bound Prefill phase versus memory-bandwidth-bound Decode phase.',
      content: (
        <div className="space-y-4">
          <p className="text-[#334155] text-sm leading-relaxed">
            Large Language Model (LLM) serving operates in two fundamentally distinct computational regimes:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
            <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 space-y-2">
              <span className="text-xs font-mono font-bold text-orange-700 uppercase">Phase 1: Prefill (Prompt Processing)</span>
              <p className="text-xs text-[#0f172a] leading-relaxed">
                Processes all input tokens simultaneously via dense matrix-matrix multiplication (GEMM). Highly <strong>compute-bound</strong> ($O(N^2)$ attention compute) and saturates Tensor Cores.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-2">
              <span className="text-xs font-mono font-bold text-sky-700 uppercase">Phase 2: Decode (Token Generation)</span>
              <p className="text-xs text-[#0f172a] leading-relaxed">
                Emits tokens sequentially one-by-one. Each forward pass loads all model weights and KV cache from HBM, making it strictly <strong>memory-bandwidth bound</strong> (GEMV).
              </p>
            </div>
          </div>

          <CodeSnippet
            filename="control_plane_loop.py"
            language="python"
            code={`# High-level control plane scheduling loop
while server_running:
    batch = scheduler.select_next_batch(
        waiting_queue=waiting_requests,
        running_batch=active_requests,
        available_kv_blocks=gpu_allocator.free_blocks,
        prefill_token_budget=512  # chunk limit
    )
    forward_pass_outputs = engine.step(batch)
    scheduler.update_kv_tables(forward_pass_outputs)`}
          />
        </div>
      ),
    },
    {
      id: 'level-1-naive',
      category: '2. Schedulers (Levels 1–6)',
      title: 'Level 1: Naive Unmanaged (CUDA OOM)',
      icon: Flame,
      eli5Summary: 'Without a manager, the server admits every prompt immediately until VRAM runs out and crashes with an Out-of-Memory error.',
      techSummary: 'Unmanaged admission without capacity bounds leading to GPU memory pool exhaustion and unrecoverable CUDA OOM runtime panics.',
      content: (
        <div className="space-y-4">
          <p className="text-[#334155] text-sm leading-relaxed">
            In naive serving, incoming requests are passed directly to the forward pass without tracking available VRAM or queueing:
          </p>

          <CodeSnippet
            filename="naive_scheduler.py"
            language="python"
            code={`def naive_schedule(incoming_requests):
    # DANGER: No capacity check! Immediately admits all requests
    for req in incoming_requests:
        req.state = "RUNNING"
        # Allocates contiguous tensor for max_seq_len (e.g. 4096 tokens)
        allocate_contiguous_kv_cache(req.max_tokens)
    return incoming_requests  # Crashes when sum(kv_allocations) > VRAM`}
          />
        </div>
      ),
    },
    {
      id: 'level-2-fcfs',
      category: '2. Schedulers (Levels 1–6)',
      title: 'Level 2: Fair Queue (FCFS & HOL Blocking)',
      icon: Code2,
      eli5Summary: 'A grocery line where people are served in order. Safe from crashes, but a giant 100-page job delays every 1-line question behind it.',
      techSummary: 'First-Come, First-Served queueing preventing OOM, but causing severe Head-of-Line (HOL) blocking and TTFT degradation for short queries.',
      content: (
        <div className="space-y-4">
          <p className="text-[#334155] text-sm leading-relaxed">
            FCFS enforces bounded admission using a simple FIFO queue, but long prompt prefills monopolize compute and block short requests:
          </p>

          <CodeSnippet
            filename="fcfs_scheduler.py"
            language="python"
            code={`def fcfs_schedule(queue, active_batch, vram_limit):
    while queue and has_vram_capacity(active_batch, queue[0], vram_limit):
        # Admits in strict arrival order
        next_req = queue.pop(0)
        active_batch.append(next_req)
    return active_batch`}
          />
        </div>
      ),
    },
    {
      id: 'level-3-chunked',
      category: '2. Schedulers (Levels 1–6)',
      title: 'Level 3: Smart Chunks (Chunked Prefill)',
      icon: Award,
      eli5Summary: 'Cutting huge prompts into 128-word slices so short questions can run between slices without waiting 30 seconds.',
      techSummary: 'Prompt budget slicing (Sarathi / vLLM Chunked Prefill) that bounds prefill GEMM latency and interleaves prefill with decode phases.',
      content: (
        <div className="space-y-4">
          <p className="text-[#334155] text-sm leading-relaxed">
            Chunked prefill enforces a global token budget (e.g., 512 tokens per forward pass). Large prompts are sliced across multiple iterations:
          </p>

          <CodeSnippet
            filename="chunked_prefill.py"
            language="python"
            code={`def chunked_prefill_schedule(queue, token_budget=512):
    tokens_allocated = 0
    batch = []
    
    for req in queue:
        remaining_prompt = req.prompt_len - req.prompt_tokens_processed
        if remaining_prompt > 0:
            slice_size = min(remaining_prompt, token_budget - tokens_allocated)
            req.current_chunk_size = slice_size
            tokens_allocated += slice_size
            batch.append(req)
            if tokens_allocated >= token_budget:
                break
    return batch`}
          />
        </div>
      ),
    },
    {
      id: 'level-4-paged',
      category: '2. Schedulers (Levels 1–6)',
      title: 'Level 4: Memory Saver (PagedAttention)',
      icon: Cpu,
      eli5Summary: 'Instead of reserving big empty storage rooms, memory is divided into small 16-word slots allocated only when needed.',
      techSummary: 'PagedAttention virtual memory architecture using non-contiguous physical KV block tables to eliminate internal and external memory fragmentation.',
      content: (
        <div className="space-y-4">
          <p className="text-[#334155] text-sm leading-relaxed">
            PagedAttention breaks KV cache storage into fixed-size physical blocks (e.g. 16 tokens). Logical blocks are mapped dynamically through a page table:
          </p>

          <CodeSnippet
            filename="paged_attention_allocator.py"
            language="python"
            code={`class BlockTableAllocator:
    def __init__(self, num_gpu_blocks, block_size=16):
        self.free_blocks = list(range(num_gpu_blocks))
        self.block_tables = {}  # req_id -> [block_idx_0, block_idx_1, ...]

    def allocate_slot(self, req_id, token_index):
        logical_block = token_index // 16
        if len(self.block_tables.get(req_id, [])) <= logical_block:
            physical_block = self.free_blocks.pop(0)
            self.block_tables.setdefault(req_id, []).append(physical_block)`}
          />
        </div>
      ),
    },
    {
      id: 'level-5-preemption',
      category: '2. Schedulers (Levels 1–6)',
      title: 'Level 5: Emergency Eviction (Preemption)',
      icon: Flame,
      eli5Summary: 'When memory is 100% full, the scheduler temporarily pauses lowest-priority jobs and saves them to handle urgent traffic.',
      techSummary: 'Victim selection and KV block deallocation under memory pressure with recompute or CPU swap restoration policies.',
      content: (
        <div className="space-y-4">
          <p className="text-[#334155] text-sm leading-relaxed">
            When VRAM is saturated, victim requests are selected to yield their physical KV blocks back to the free pool:
          </p>

          <CodeSnippet
            filename="preemption_engine.py"
            language="python"
            code={`def handle_vram_saturation(active_batch, free_blocks, needed_blocks):
    while len(free_blocks) < needed_blocks and active_batch:
        # Victim selection: pick lowest priority / newest request
        victim = sorted(active_batch, key=lambda r: (r.priority, -r.arrival_time))[0]
        active_batch.remove(victim)
        victim.state = "PREEMPTED"
        free_blocks.extend(victim.allocated_physical_blocks)`}
          />
        </div>
      ),
    },
    {
      id: 'level-6-priority',
      category: '2. Schedulers (Levels 1–6)',
      title: 'Level 6: VIP Fast Lane (Priority Preemption)',
      icon: Award,
      eli5Summary: 'The complete enterprise system: urgent requests jump the line with guaranteed sub-50ms latency, while background tasks yield.',
      techSummary: 'Production-grade priority-weighted preemption with strict TTFT SLO targets and graceful background workload degradation.',
      content: (
        <div className="space-y-4">
          <p className="text-[#334155] text-sm leading-relaxed">
            Combines Chunked Prefill, PagedAttention block tables, and priority queues to guarantee strict SLOs:
          </p>

          <CodeSnippet
            filename="priority_scheduler.py"
            language="python"
            code={`def priority_schedule(priority_queue, vram_pool, max_budget=512):
    # Sort queue by descending priority (10 = highest, 1 = background)
    sorted_queue = sorted(priority_queue, key=lambda r: -r.priority)
    return chunked_allocate_with_preemption(sorted_queue, vram_pool, max_budget)`}
          />
        </div>
      ),
    },
    {
      id: 'math-formulas',
      category: '3. Math & Formulas',
      title: 'KV Cache Sizing & Hardware Arithmetic Intensity',
      icon: Code2,
      eli5Summary: 'The exact math showing why AI uses so much memory: each token needs memory bytes across every single layer.',
      techSummary: 'Formal KV cache footprint calculation and GPU memory bandwidth roofline model formulas.',
      content: (
        <div className="space-y-4">
          <h4 className="text-sm font-black text-[#0f172a]">1. KV Cache Footprint Equation</h4>
          <div className="p-4 rounded-2xl bg-white border border-[#e5e0d8] font-mono text-xs text-[#0f172a] shadow-sm">
            KV Bytes = 2 × L × H × D × dtype_bytes × Seq_Length
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-white border border-[#e5e0d8] space-y-1 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Llama-3-70B Example (FP16)</span>
              <p className="text-[#0f172a]">80 layers × 8 KV heads × 128 dim × 2 bytes × 2 (K+V) = <strong>320 KB per token</strong></p>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-[#e5e0d8] space-y-1 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">TPOT Memory Bandwidth Formula</span>
              <p className="font-mono text-orange-600">TPOT = Model Weight Bytes / HBM3 Bandwidth (TB/s)</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'api-ref',
      category: '4. API & WebSockets',
      title: 'REST API & Telemetry Protocol',
      icon: Terminal,
      eli5Summary: 'How frontend and external services talk to the AI engine using HTTP and WebSockets.',
      techSummary: 'FastAPI REST endpoints and WebSocket telemetry frame specifications.',
      content: (
        <div className="space-y-4">
          <p className="text-[#334155] text-xs leading-relaxed">
            The control plane exposes standard REST endpoints and a real-time WebSocket telemetry stream:
          </p>

          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-white border border-[#e5e0d8] flex items-center justify-between font-mono text-xs shadow-sm">
              <span className="text-emerald-700 font-bold">POST /api/v1/simulation/start</span>
              <span className="text-[#64748b] text-[10px]">Start/restart simulation with hardware &amp; strategy</span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-[#e5e0d8] flex items-center justify-between font-mono text-xs shadow-sm">
              <span className="text-sky-700 font-bold">POST /api/v1/simulation/inject</span>
              <span className="text-[#64748b] text-[10px]">Inject custom request payload into live pipeline</span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-[#e5e0d8] flex items-center justify-between font-mono text-xs shadow-sm">
              <span className="text-orange-600 font-bold">WS /ws/telemetry</span>
              <span className="text-[#64748b] text-[10px]">Live step-by-step telemetry broadcast</span>
            </div>
          </div>

          <CodeSnippet
            filename="telemetry_frame.json"
            language="json"
            code={`{
  "step": 42,
  "timestamp": 1724873910.45,
  "strategy": "priority",
  "metrics": {
    "ttft_p99_ms": 28.4,
    "tpot_avg_ms": 14.8,
    "throughput_tokens_sec": 2450,
    "kv_utilization_pct": 68.5,
    "allocated_blocks": 22
  },
  "step_actions": {
    "prefill": [["REQ-101", 128]],
    "decode": ["REQ-102", "REQ-104"],
    "preempt": ["REQ-105"],
    "finished": ["REQ-100"]
  }
}`}
          />
        </div>
      ),
    },
    {
      id: 'glossary',
      category: '5. Glossary (A–Z)',
      title: 'Comprehensive Technical Glossary',
      icon: BookOpen,
      eli5Summary: 'Quick dictionary defining all AI inference terms in both plain English and technical specs.',
      techSummary: 'Exhaustive dictionary of systems engineering and LLM serving terminology.',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { term: 'Autoregressive Decoding', def: 'Generating one output token at a time by feeding past generated tokens back as inputs.' },
            { term: 'Chunked Prefill', def: 'Splitting long prompt prefills across multiple execution steps to interleave with decode passes.' },
            { term: 'Continuous Batching', def: 'Dynamically adding and removing requests at every iteration step rather than static batching.' },
            { term: 'Head-of-Line (HOL) Blocking', def: 'When a long prompt prefill stalls the execution of subsequent shorter requests.' },
            { term: 'KV Cache', def: 'In-memory storage of computed Key and Value attention tensors to avoid recomputing previous tokens.' },
            { term: 'PagedAttention', def: 'Virtual memory management allocating KV cache in non-contiguous physical blocks.' },
            { term: 'Preemption', def: 'Temporarily pausing a running request and releasing its memory blocks to prioritize higher-priority requests.' },
            { term: 'TPOT (Time Per Output Token)', def: 'The average latency between consecutive emitted tokens during the decode phase.' },
            { term: 'TTFT (Time To First Token)', def: 'The latency from request arrival to emitting the first output token.' },
          ].map((item) => (
            <div key={item.term} className="p-3.5 rounded-xl bg-white border border-[#e5e0d8] space-y-1 shadow-sm">
              <p className="text-xs font-bold text-orange-600 font-mono">{item.term}</p>
              <p className="text-[11px] text-[#475569] leading-relaxed">{item.def}</p>
            </div>
          ))}
        </div>
      ),
    },
  ], []);

  // Filter sections by search
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.eli5Summary.toLowerCase().includes(q) ||
        s.techSummary.toLowerCase().includes(q)
    );
  }, [searchQuery, sections]);

  const activeSection = sections.find((s) => s.id === activeSectionId) || sections[0];

  return (
    <div className="min-h-screen max-w-[1500px] mx-auto px-4 py-6 md:px-6 space-y-6 text-[#0f172a]">
      {/* ── Top Header Bar ── */}
      <header className="card-elev p-4 rounded-3xl border border-[#e5e0d8] bg-white shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-[#0f172a] tracking-tight flex items-center gap-2">
              <span>Developer Documentation &amp; Specs</span>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-mono font-bold uppercase">
                v2.0
              </span>
            </h1>
            <p className="text-xs text-[#64748b]">
              {t(
                'Complete architectural reference, algorithms, math, and glossary',
                'Systems engineering specifications, memory formulas, and scheduler implementations'
              )}
            </p>
          </div>
        </div>

        {/* Right Navigation Controls */}
        <div className="flex items-center gap-2.5">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[#0f172a] text-xs font-bold transition-all cursor-pointer"
          >
            <span>Story Home</span>
          </Link>

          <Link
            to="/factory"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold transition-all cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-600" />
            <span>🏭 Live Factory</span>
          </Link>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
            {(['eli5', 'tech'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mode === m
                    ? m === 'eli5'
                      ? 'bg-amber-500 text-white font-black shadow-sm'
                      : 'bg-blue-600 text-white font-black shadow-sm'
                    : 'text-[#64748b] hover:text-[#0f172a]'
                }`}
              >
                {m === 'eli5' ? '👶 ELI5' : '⚡ Tech'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main Documentation Layout: Sidebar + Content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar (Search + Nav Table of Contents) */}
        <aside className="lg:col-span-4 xl:col-span-3 card-elev p-4 rounded-3xl bg-white border border-slate-200 space-y-4 sticky top-6 shadow-sm">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search docs, math, APIs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Nav List grouped by category */}
          <nav className="space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
            {Array.from(new Set(filteredSections.map((s) => s.category))).map((cat) => (
              <div key={cat} className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#94a3b8] px-2">
                  {cat}
                </p>
                <div className="space-y-0.5">
                  {filteredSections
                    .filter((s) => s.category === cat)
                    .map((s) => {
                      const Icon = s.icon;
                      const isActive = activeSectionId === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setActiveSectionId(s.id)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                            isActive
                              ? 'bg-blue-50 border border-blue-200 text-blue-700 shadow-sm'
                              : 'text-[#475569] hover:text-[#0f172a] hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-[#64748b]'}`} />
                            <span className="truncate">{s.title}</span>
                          </div>
                          {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Right Main Article Content Area */}
        <main className="lg:col-span-8 xl:col-span-9 space-y-6">
          <AnimatePresence mode="wait">
            <motion.article
              key={activeSection.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="card-elev p-6 md:p-8 rounded-3xl bg-white border border-slate-200 space-y-6 shadow-sm"
            >
              {/* Category & Badge */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[#64748b]">
                  <span>{activeSection.category}</span>
                  <span>/</span>
                  <span className="text-blue-600">{activeSection.title}</span>
                </div>

                <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-[#475569] uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>{t('ELI5 Guide Active', 'Production Technical Spec')}</span>
                </span>
              </div>

              {/* Title & Overview Banner */}
              <div className="space-y-3">
                <h2 className="text-2xl md:text-3xl font-black text-[#0f172a] tracking-tight">
                  {activeSection.title}
                </h2>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-[#334155] leading-relaxed">
                  <span className="font-bold text-blue-600 block mb-1">
                    {t('💡 In Plain English:', '📐 Technical Summary:')}
                  </span>
                  {t(activeSection.eli5Summary, activeSection.techSummary)}
                </div>
              </div>

              {/* Body Content */}
              <div className="max-w-none text-[#334155] text-sm leading-relaxed">
                {activeSection.content}
              </div>

              {/* Next/Prev Section Navigation Footer */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-100 gap-4">
                {(() => {
                  const currIdx = sections.findIndex((s) => s.id === activeSection.id);
                  const prevSec = sections[currIdx - 1];
                  const nextSec = sections[currIdx + 1];

                  return (
                    <>
                      {prevSec ? (
                        <button
                          onClick={() => setActiveSectionId(prevSec.id)}
                          className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-[#0f172a] transition-all cursor-pointer shadow-sm"
                        >
                          ← {prevSec.title}
                        </button>
                      ) : <div />}

                      {nextSec && (
                        <button
                          onClick={() => setActiveSectionId(nextSec.id)}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition-all shadow-sm cursor-pointer"
                        >
                          {nextSec.title} →
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </motion.article>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default DocumentationPage;
