'use client';

import React, { useEffect, useState, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { getAllOpportunities, STAGE_LABELS } from '@/lib/crmService';

export default function PipelineFunnel() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<{ name: string; value: number }[]>([]);
  const [totalValue, setTotalValue] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReactECharts>(null);

  useEffect(() => {
    async function load() {
      try {
        const opps = await getAllOpportunities();
        
        let total = 0;
        const stageTotals: Record<string, number> = {
          'lead': 0, 'qualification': 0, 'demo': 0, 
          'proposal': 0, 'negotiation': 0, 'closed_won': 0
        };

        opps.forEach(opp => {
          if (opp.stage !== 'closed_lost') {
            total += opp.valueUsd;
            if (stageTotals[opp.stage] !== undefined) {
              stageTotals[opp.stage] += opp.valueUsd;
            }
          }
        });

        const data = [
          { name: STAGE_LABELS['lead'] || 'Lead', value: stageTotals['lead'] },
          { name: STAGE_LABELS['qualification'] || 'Qualification', value: stageTotals['qualification'] },
          { name: STAGE_LABELS['demo'] || 'Demo', value: stageTotals['demo'] },
          { name: STAGE_LABELS['proposal'] || 'Proposal', value: stageTotals['proposal'] },
          { name: STAGE_LABELS['negotiation'] || 'Negotiation', value: stageTotals['negotiation'] },
          { name: STAGE_LABELS['closed_won'] || 'Closed Won', value: stageTotals['closed_won'] }
        ].filter(d => d.value > 0).sort((a,b) => b.value - a.value);

        setTotalValue(total);
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
      formatter: '{b} : ${c}',
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: { color: '#0f172a', fontSize: 13, fontWeight: 600 },
      extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border-radius: 8px;'
    },
    series: [
      {
        name: 'Sales Pipeline',
        type: 'funnel',
        left: '10%',
        top: 20,
        bottom: 20,
        width: '80%',
        min: 0,
        max: Math.max(...chartData.map(d => d.value), 1),
        minSize: '10%',
        maxSize: '100%',
        sort: 'descending',
        gap: 2,
        label: {
          show: true,
          position: 'inside',
          formatter: '{b}',
          color: '#ffffff',
          fontWeight: 600
        },
        labelLine: {
          length: 10,
          lineStyle: { width: 1, type: 'solid', color: '#cbd5e1' }
        },
        itemStyle: { borderColor: '#ffffff', borderWidth: 2, borderRadius: 4 },
        emphasis: { label: { fontSize: 16 } },
        data: chartData
      }
    ]
  };

  if (loading) return <div className="animate-pulse h-96 bg-white border border-slate-200 rounded-xl shadow-sm"></div>;

  return (
    <div ref={containerRef} className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 md:p-6 flex flex-col w-full h-full relative">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 tracking-tight">Sales Pipeline Funnel</h2>
          <p className="text-xs font-semibold text-slate-400 mt-1">Opportunity values across stages</p>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-2xl font-black text-[#004b44] tracking-tight">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
      <div className="mt-6 flex-1 min-h-[320px] w-full relative">
        <ReactECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }} />
      </div>
    </div>
  );
}
