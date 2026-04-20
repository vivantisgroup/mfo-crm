'use client';

import React, { useEffect, useState, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { getAllOrgs, REGION_LABELS, ORG_SIZE_LABELS, SalesRegion, OrgSize } from '@/lib/crmService';

export default function AccountDistribution() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [totalOrgs, setTotalOrgs] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReactECharts>(null);

  useEffect(() => {
    async function load() {
      try {
        const orgs = await getAllOrgs();
        const clients = orgs.filter(o => o.orgType === 'client');
        
        // Build Sunburst data: Region -> Size
        const regionMap = new Map<string, any[]>();
        clients.forEach(c => {
          const r = REGION_LABELS[c.region as SalesRegion] || (c.region || 'Unknown');
          const s = ORG_SIZE_LABELS[c.size as OrgSize] || (c.size || 'Unknown');
          
          if (!regionMap.has(r)) regionMap.set(r, []);
          regionMap.get(r)!.push(s);
        });

        const data = Array.from(regionMap.entries()).map(([region, sizes]) => {
          const sizeCounts = sizes.reduce((acc, curr) => {
            acc[curr] = (acc[curr] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          return {
            name: region,
            value: sizes.length,
            children: Object.entries(sizeCounts).map(([size, count]) => ({
              name: size,
              value: count
            }))
          };
        });

        setTotalOrgs(clients.length);
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
      formatter: '{b}: {c} accounts',
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: { color: '#0f172a', fontSize: 13, fontWeight: 600 },
      extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border-radius: 8px;'
    },
    series: {
      type: 'sunburst',
      data: chartData,
      radius: [0, '90%'],
      label: {
        rotate: 'radial'
      },
      itemStyle: {
        borderColor: '#ffffff',
        borderWidth: 2
      }
    }
  };

  if (loading) return <div className="animate-pulse h-96 bg-white border border-slate-200 rounded-xl shadow-sm"></div>;

  return (
    <div ref={containerRef} className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 md:p-6 flex flex-col w-full h-full relative">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 tracking-tight">Client Account Distribution</h2>
          <p className="text-xs font-semibold text-slate-400 mt-1">Geographical and Size segmentation</p>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-2xl font-black text-[#004b44] tracking-tight">
            {totalOrgs}
          </div>
        </div>
      </div>
      <div className="mt-6 flex-1 min-h-[320px] w-full relative">
        <ReactECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }} />
      </div>
    </div>
  );
}
