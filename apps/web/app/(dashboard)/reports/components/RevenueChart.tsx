'use client';

import React, { useEffect, useState, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { getAllSubscriptions, planMonthlyTotal } from '@/lib/subscriptionService';
import { TrendingUp } from 'lucide-react';

export default function RevenueChart() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<{ name: string; value: number }[]>([]);
  const [totalMrr, setTotalMrr] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReactECharts>(null);

  useEffect(() => {
    async function load() {
      try {
        const subs = await getAllSubscriptions();
        
        let mrr = 0;
        const planTotals: Record<string, number> = {};

        subs.forEach(sub => {
          if (sub.status === 'active' || sub.status === 'past_due') {
            const val = planMonthlyTotal(sub);
            mrr += val;
            planTotals[sub.planId] = (planTotals[sub.planId] || 0) + val;
          }
        });

        const data = Object.keys(planTotals).map(planId => ({
          name: planId.charAt(0).toUpperCase() + planId.slice(1),
          value: planTotals[planId]
        })).sort((a,b) => b.value - a.value);

        setTotalMrr(mrr);
        setChartData(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!containerRef.current || !chartRef.current) return;
    let timer: NodeJS.Timeout;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        chartRef.current?.getEchartsInstance()?.resize();
      }, 50);
    });
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, [loading]);

  const option = {
    color: ['#004b44', '#10b981', '#3b82f6', '#475569', '#cbd5e1'],
    textStyle: { fontFamily: 'Inter, sans-serif' },
    tooltip: { 
      trigger: 'item', 
      formatter: '{b}: ${c} ({d}%)',
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: { color: '#0f172a', fontSize: 13, fontWeight: 600 },
      extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border-radius: 8px;'
    },
    legend: { top: 'bottom', textStyle: { color: '#475569', fontSize: 12, fontWeight: 500 } },
    series: [
      {
        name: 'MRR by Plan',
        type: 'pie',
        radius: ['40%', '75%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 6, borderColor: '#ffffff', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: {
          label: { show: true, fontSize: 16, fontWeight: 'bold', color: '#0f172a' }
        },
        labelLine: { show: false },
        data: chartData
      }
    ]
  };

  if (loading) return <div className="animate-pulse h-96 bg-white border border-slate-200 rounded-xl shadow-sm"></div>;

  return (
    <div ref={containerRef} className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 md:p-6 flex flex-col w-full h-full relative">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 tracking-tight">SaaS Monthly Recurring Revenue (MRR)</h2>
          <p className="text-xs font-semibold text-slate-400 mt-1">Revenue distribution by active plan</p>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-2xl font-black text-[#004b44] tracking-tight">
            ${totalMrr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 uppercase tracking-wider mt-1">
            <TrendingUp size={12} strokeWidth={2.5} />
            +3.2%
          </div>
        </div>
      </div>
      <div className="mt-6 flex-1 min-h-[320px] w-full relative">
        <ReactECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }} />
      </div>
    </div>
  );
}
