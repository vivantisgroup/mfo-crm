'use client';

import React, { useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';

export function RevenueOpexChart({ mrr, opex, gp }: { mrr: number, opex: number, gp: number }) {
  const chartRef = useRef<ReactECharts>(null);

  const option = {
    color: ['#6366f1', '#ef4444', '#22c55e'],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'var(--bg-surface)',
      textStyle: { color: 'var(--text-primary)', fontFamily: 'Inter' },
      formatter: (params: any[]) => {
        let res = `<div style="font-weight:bold;margin-bottom:4px">Value</div>`;
        params.forEach(p => {
          res += `<div>${p.marker} ${p.seriesName}: $${p.value.toLocaleString()}</div>`;
        });
        return res;
      }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: ['Financials'],
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false }
    },
    legend: { show: false },
    series: [
      {
        name: 'MRR',
        type: 'bar',
        top: 0,
        stack: 'total',
        label: { show: true, formatter: 'MRR', position: 'inside' },
        itemStyle: { borderRadius: [4, 0, 0, 4] },
        data: [mrr]
      },
      {
        name: 'OPEX',
        type: 'bar',
        stack: 'total',
        label: { show: true, formatter: 'OPEX', position: 'inside' },
        data: [opex]
      },
      {
        name: 'Gross Profit',
        type: 'bar',
        stack: 'total',
        label: { show: true, formatter: 'Gross Profit', position: 'inside' },
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        data: [gp]
      }
    ]
  };

  return (
    <div className="w-full h-24 mb-5">
      <ReactECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}

export function MrrTrendChart({ data }: { data: number[] }) {
  const chartRef = useRef<ReactECharts>(null);

  const option = {
    color: ['#6366f1'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'var(--bg-surface)',
      textStyle: { color: 'var(--text-primary)', fontFamily: 'Inter' },
      formatter: (params: any[]) => {
        const p = params[0];
        return `Month ${p.dataIndex + 1}: $${p.value.toLocaleString()}`;
      }
    },
    grid: { left: '0%', right: '0%', bottom: '0%', top: '10%', containLabel: false },
    xAxis: { type: 'category', data: data.map((_, i) => `M${i+1}`), show: false },
    yAxis: { type: 'value', show: false },
    series: [
      {
        data: data,
        type: 'bar',
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        emphasis: { itemStyle: { color: '#4f46e5' } }
      }
    ]
  };

  return (
    <div className="w-full h-20">
      <ReactECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}

export function PipelineFunnelChart({ openOpps, totalAum, stages }: { openOpps: number, totalAum: number, stages: {name: string, value: number, color: string}[] }) {
  const chartRef = useRef<ReactECharts>(null);
  const data = stages.filter(s => s.value > 0);

  const option = {
    color: stages.map(s => s.color),
    tooltip: {
      trigger: 'item',
      formatter: '{b} : {c}',
      backgroundColor: 'var(--bg-surface)',
      textStyle: { color: 'var(--text-primary)', fontFamily: 'Inter' }
    },
    series: [
      {
        name: 'Funnel',
        type: 'funnel',
        left: '5%',
        top: '5%',
        bottom: '5%',
        width: '90%',
        minSize: '10%',
        maxSize: '100%',
        sort: 'descending',
        gap: 2,
        label: { show: true, position: 'inside', formatter: '{b}', textBorderWidth: 0 },
        itemStyle: { borderColor: '#fff', borderWidth: 1, borderRadius: 2 },
        data: data
      }
    ]
  };

  return (
    <div className="w-full h-64 mt-4">
      <ReactECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}

export function SubscriptionPlanPie({ data }: { data: { name: string, value: number, color: string, count: number }[] }) {
  const chartRef = useRef<ReactECharts>(null);
  const validData = data.filter(d => d.value > 0);
  
  const option = {
    color: validData.map(d => d.color),
    tooltip: { trigger: 'item', formatter: '{b}: ${c} ({d}%)' },
    legend: { top: 'bottom', align: 'left', icon: 'circle' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        itemStyle: { borderRadius: 5, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: validData
      }
    ]
  };

  return (
    <div className="w-full h-64 mt-2">
      <ReactECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}

export function CategoryBarChart({ data, title }: { data: { name: string, value: number, color: string }[], title?: string }) {
  const chartRef = useRef<ReactECharts>(null);
  const validData = data.filter(d => d.value > 0).sort((a,b) => b.value - a.value);

  const option = {
    color: validData.map(d => d.color),
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b} : ${c}' },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '5%', containLabel: true },
    xAxis: { type: 'value', show: false },
    yAxis: { type: 'category', data: validData.map(d => d.name).reverse(), axisLine: { show: false }, axisTick: { show: false } },
    series: [
      {
        type: 'bar',
        data: validData.map(d => d.value).reverse(),
        itemStyle: { 
          borderRadius: [0, 4, 4, 0],
          color: (params: any) => validData[validData.length - 1 - params.dataIndex]?.color || '#cbd5e1'
        },
        label: { show: true, position: 'right', formatter: (p: any) => '$' + p.value.toLocaleString() }
      }
    ]
  };

  return (
    <div className="w-full h-64 mt-2">
      <ReactECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
