import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Clock, Activity, Thermometer, Database, DollarSign } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { useMode } from '../../context/ModeContext';
import type { Metrics } from '../../types';

interface FactoryMetricsProps {
  metrics?: Metrics;
}

function useHistory<T>(value: T, max = 30): T[] {
  const ref = useRef<T[]>([]);
  if (value !== undefined && value !== null) {
    ref.current = [...ref.current.slice(-(max - 1)), value];
  }
  return ref.current;
}

function AnimatedNumber({ value = 0, decimals = 0 }: { value?: number; decimals?: number }) {
  const safeVal = typeof value === 'number' && !isNaN(value) ? value : 0;
  const [display, setDisplay] = useState(safeVal);
  const [pop, setPop] = useState(false);
  const prev = useRef(safeVal);

  useEffect(() => {
    if (prev.current !== safeVal) {
      setDisplay(safeVal);
      setPop(true);
      prev.current = safeVal;
      const t = setTimeout(() => setPop(false), 400);
      return () => clearTimeout(t);
    }
  }, [safeVal]);

  return (
    <span className={pop ? 'number-pop inline-block' : 'inline-block'}>
      {display.toFixed(decimals)}
    </span>
  );
}

export const FactoryMetrics: React.FC<FactoryMetricsProps> = ({ metrics }) => {
  const { t } = useMode();

  const ttft = metrics?.ttft_p99_ms ?? 0;
  const tput = metrics?.throughput_tokens_sec ?? 0;
  const smCompute = metrics?.sm_compute_util_pct ?? 0;
  const hbmUtil = metrics?.hbm_bandwidth_util_pct ?? 0;
  const kvUtil = metrics?.kv_utilization_pct ?? 0;
  const cost = metrics?.cost_per_hour_usd ?? 3.50;

  const ttftHistory = useHistory(ttft);
  const tputHistory = useHistory(tput);

  const cards = [
    {
      icon: Clock,
      color: 'blue',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      bgColor: 'bg-blue-50/40',
      eli5Label: '⏱️ Time to First Word',
      techLabel: 'TTFT p99',
      eli5Desc: 'How fast the AI starts talking',
      techDesc: 'Time To First Token — p99 latency',
      value: ttft,
      unit: 'ms',
      decimals: 1,
      sparkData: ttftHistory.map((v, i) => ({ i, v })),
      sparkKey: 'v',
      sparkColor: '#2563eb',
      threshold: 30,
      good: ttft < 30,
    },
    {
      icon: Activity,
      color: 'purple',
      iconColor: 'text-purple-600',
      borderColor: 'border-purple-200',
      bgColor: 'bg-purple-50/40',
      eli5Label: '🔤 Words Per Second',
      techLabel: 'Throughput',
      eli5Desc: 'Tokens generated per second',
      techDesc: 'Total throughput tokens/sec',
      value: tput,
      unit: 'tok/s',
      decimals: 0,
      sparkData: tputHistory.map((v, i) => ({ i, v })),
      sparkKey: 'v',
      sparkColor: '#7c3aed',
      threshold: null,
      good: true,
    },
    {
      icon: Thermometer,
      color: 'orange',
      iconColor: 'text-orange-600',
      borderColor: 'border-orange-200',
      bgColor: 'bg-orange-50/40',
      eli5Label: '🌡️ Factory Heat',
      techLabel: 'SM Compute %',
      eli5Desc: 'How hard the AI brain is working',
      techDesc: 'GPU Streaming Multiprocessor utilisation',
      value: smCompute,
      unit: '%',
      decimals: 1,
      sparkData: [],
      sparkKey: 'v',
      sparkColor: '#ea580c',
      threshold: 85,
      good: smCompute < 95,
    },
    {
      icon: Database,
      color: 'amber',
      iconColor: 'text-amber-600',
      borderColor: 'border-amber-200',
      bgColor: 'bg-amber-50/40',
      eli5Label: '🏦 Warehouse Space',
      techLabel: 'HBM Bandwidth',
      eli5Desc: 'Memory shelves being used',
      techDesc: 'HBM3 memory bandwidth utilisation',
      value: hbmUtil,
      unit: '%',
      decimals: 1,
      sparkData: [],
      sparkKey: 'v',
      sparkColor: '#d97706',
      threshold: 90,
      good: hbmUtil < 90,
    },
    {
      icon: Database,
      color: 'indigo',
      iconColor: 'text-indigo-600',
      borderColor: 'border-indigo-200',
      bgColor: 'bg-indigo-50/40',
      eli5Label: '📦 Shelf Fill Rate',
      techLabel: 'KV Utilisation',
      eli5Desc: 'How full the memory shelves are',
      techDesc: 'KV-cache block utilisation %',
      value: kvUtil,
      unit: '%',
      decimals: 1,
      sparkData: [],
      sparkKey: 'v',
      sparkColor: '#4f46e5',
      threshold: 90,
      good: kvUtil < 90,
    },
    {
      icon: DollarSign,
      color: 'emerald',
      iconColor: 'text-emerald-600',
      borderColor: 'border-emerald-200',
      bgColor: 'bg-emerald-50/40',
      eli5Label: '💰 Cost Per Hour',
      techLabel: 'GPU Cost/hr',
      eli5Desc: 'How much the GPU costs to run',
      techDesc: 'NVIDIA H100 SXM estimated cost/hr (USD)',
      value: cost,
      unit: '/hr',
      prefix: '$',
      decimals: 2,
      sparkData: [],
      sparkKey: 'v',
      sparkColor: '#059669',
      threshold: null,
      good: true,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <TrendingUp className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-black text-[#0f172a] uppercase tracking-wider">
          {t('📊 Factory Dashboard', '📊 Live Telemetry Metrics')}
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.eli5Label}
              whileHover={{ y: -2 }}
              className={`card-elev p-4 bg-white border ${card.borderColor} shadow-sm space-y-2 rounded-2xl`}
            >
              <div className="flex items-center justify-between">
                <div className={`p-1.5 rounded-lg ${card.bgColor}`}>
                  <Icon className={`w-4 h-4 ${card.iconColor}`} />
                </div>
                {card.threshold && (
                  <span className={`w-2 h-2 rounded-full ${card.good ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                )}
              </div>

              <div>
                <p className={`text-2xl font-black ${card.iconColor} leading-none`}>
                  {card.prefix ?? ''}
                  <AnimatedNumber value={card.value} decimals={card.decimals} />
                  <span className="text-xs font-semibold ml-0.5 text-slate-500">{card.unit}</span>
                </p>
              </div>

              <div>
                <p className="text-[11px] font-bold text-[#0f172a] leading-tight">
                  {t(card.eli5Label, card.techLabel)}
                </p>
                <p className="text-[10px] text-[#64748b] leading-snug mt-0.5 truncate">
                  {t(card.eli5Desc, card.techDesc)}
                </p>
              </div>

              {card.sparkData.length > 4 && (
                <div className="h-7 pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={card.sparkData}>
                      <Line
                        type="monotone"
                        dataKey={card.sparkKey}
                        stroke={card.sparkColor}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Tooltip contentStyle={{ display: 'none' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
