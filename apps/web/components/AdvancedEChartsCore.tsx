'use client';

import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { WidgetDefinition } from '@/lib/reportsService';

interface AdvancedEChartsCoreProps {
  widget: WidgetDefinition;
  data: any[];
  onChartClick?: (nodeId: string) => void;
}

export default function AdvancedEChartsCore({ widget, data, onChartClick }: AdvancedEChartsCoreProps) {
  if (!widget) return null;
  // Theme Color Configurations
  const getThemePalette = (theme: string) => {
    switch (theme) {
      case 'emerald': return ['#10b981', '#34d399', '#059669', '#6ee7b7', '#a7f3d0', '#047857'];
      case 'slate':   return ['#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#334155'];
      case 'blue':    return ['#3b82f6', '#60a5fa', '#2563eb', '#93c5fd', '#bfdbfe', '#1d4ed8'];
      case 'purple':  return ['#a855f7', '#c084fc', '#9333ea', '#d8b4fe', '#e9d5ff', '#7e22ce'];
      case 'rose':    return ['#f43f5e', '#fb7185', '#e11d48', '#fda4af', '#fecdd3', '#be123c'];
      case 'amber':   return ['#f59e0b', '#fbbf24', '#d97706', '#fcd34d', '#fde68a', '#b45309'];
      default:        return ['#10b981', '#3b82f6', '#f59e0b', '#f43f5e', '#a855f7', '#6366f1'];
    }
  };

  const colors = getThemePalette(widget?.theme || 'emerald');

  // Parse generic data arrays safely
  const xData = data?.map(d => d.name || d.label || d.x || 'N/A') || [];
  const yData = data?.map(d => typeof d.value === 'number' ? d.value : d.y || 0) || [];

  // Common tooltips and layouts
  const baseTooltip = {
    show: widget?.showLegend !== false,
    trigger: ['pie', 'funnel', 'doughnut', 'rose', 'treemap', 'sunburst', 'gauge'].includes(widget?.type || 'bar') ? 'item' : 'axis',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    textStyle: { color: '#0f172a', fontFamily: 'Inter', fontSize: 13 },
    extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border-radius: 8px;'
  };

  let option: any = {
    color: colors,
    tooltip: baseTooltip,
    animationDuration: 1000,
    textStyle: { fontFamily: 'Inter, sans-serif' },
    grid: { top: 40, right: 30, bottom: 40, left: 50, containLabel: true }
  };

  if (widget?.showLegend !== false && !['heatmap', 'gauge', 'treemap'].includes(widget?.type || 'bar')) {
     option.legend = {
       show: true,
       bottom: 5,
       textStyle: { color: '#64748b', fontSize: 11 }
     };
  }

  const defaultLabel = {
     show: widget?.showLabels || false,
     position: 'top',
     color: '#475569',
     fontSize: 11,
     fontWeight: 'bold'
  };

  // ============================================================================
  // COMPARISONS (bar, bar_stacked, bar_horizontal, waterfall)
  // ============================================================================
  if (['bar', 'bar_stacked', 'bar_horizontal', 'waterfall'].includes(widget.type)) {
    const isHorizontal = widget.type === 'bar_horizontal';
    
    option.xAxis = {
      type: isHorizontal ? 'value' : 'category',
      data: isHorizontal ? undefined : xData,
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b', fontSize: 11 },
      splitLine: isHorizontal ? { lineStyle: { color: '#e2e8f0', type: 'dashed' } } : { show: false }
    };
    option.yAxis = {
      type: isHorizontal ? 'category' : 'value',
      data: isHorizontal ? xData : undefined,
      splitLine: isHorizontal ? { show: false } : { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
      axisLabel: { color: '#64748b', fontSize: 11 },
    };

    if (widget.type === 'waterfall') {
      // Mock waterfall calculation (base + delta)
      const baseData = [0];
      let current = 0;
      for (let i = 0; i < yData.length - 1; i++) {
        current += yData[i];
        baseData.push(current);
      }
      option.series = [
        {
          name: 'Placeholder',
          type: 'bar',
          stack: 'Total',
          itemStyle: { borderColor: 'transparent', color: 'transparent' },
          emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } },
          data: baseData
        },
        {
          name: widget.title,
          type: 'bar',
          stack: 'Total',
          label: { ...defaultLabel, position: 'inside' },
          data: yData,
          itemStyle: { borderRadius: 4, color: (params: any) => params.dataIndex === 0 || params.dataIndex === yData.length - 1 ? colors[2] : colors[0] }
        }
      ];
    } else {
      // Standard or Stacked Bar
      // If stacked, we would ideally have multiple series based on keys. For simplicity, we mock a second series if stacking is enabled to demonstrate.
      const seriesTpl: any = {
        name: widget.title,
        type: 'bar',
        stack: widget.isStacked ? 'total' : undefined,
        label: { ...defaultLabel, position: isHorizontal ? 'right' : 'top' },
        itemStyle: { borderRadius: isHorizontal ? [0,4,4,0] : [4,4,0,0] },
        data: yData
      };
      
      option.series = [seriesTpl];
      if (widget.isStacked || widget.type === 'bar_stacked') {
         seriesTpl.stack = 'total';
         option.series.push({
           name: 'Secondary',
           type: 'bar',
           stack: 'total',
           itemStyle: { borderRadius: isHorizontal ? [0,4,4,0] : [4,4,0,0] },
           data: yData.map(v => Math.floor(v * 0.4)) // mock second layer
         });
      }
    }
  } 

  // ============================================================================
  // TRENDS (line, area, candlestick)
  // ============================================================================
  else if (['line', 'area'].includes(widget.type)) {
    option.xAxis = {
      type: 'category',
      data: xData,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b', fontSize: 11 },
    };
    option.yAxis = {
      type: 'value',
      splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
      axisLabel: { color: '#64748b', fontSize: 11 },
    };
    
    const seriesObj: any = {
       name: widget.title,
       type: 'line',
       smooth: widget.smoothCurve === true,
       data: yData,
       symbolSize: 8,
       label: defaultLabel,
       itemStyle: { borderWidth: 2, borderColor: '#fff' }
    };

    if (widget.type === 'area') {
      seriesObj.areaStyle = {
        opacity: 0.2,
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: colors[0] }, { offset: 1, color: '#ffffff00' }]
        }
      };
      // If stacked is toggled on area
      if (widget.isStacked) {
         seriesObj.stack = 'Total';
         option.series = [
            seriesObj,
            { ...seriesObj, name: 'Target', data: yData.map(v => v * 0.8), itemStyle: { color: colors[2] } }
         ];
      } else {
         option.series = [seriesObj];
      }
    } else {
      option.series = [seriesObj];
    }
  }

  else if (widget.type === 'candlestick') {
    const kData = data.map(d => {
      if(Array.isArray(d.value)) return d.value;
      const base = d.value;
      return [base - 10, base + 20, base - 15, base + 25];
    });
    option.xAxis = {
      type: 'category', data: xData,
      axisLine: { lineStyle: { color: '#cbd5e1' } }
    };
    option.yAxis = { type: 'value', splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } } };
    option.series = [{
      type: 'candlestick',
      data: kData,
      itemStyle: { color: colors[0], color0: colors[3], borderColor: colors[0], borderColor0: colors[3] }
    }];
  }

  // ============================================================================
  // PROPORTIONS (pie, doughnut, rose, treemap, sunburst)
  // ============================================================================
  else if (['pie', 'doughnut', 'rose'].includes(widget.type)) {
    const isDoughnut = widget.type === 'doughnut';
    const isRose = widget.type === 'rose';

    option.series = [{
      name: widget.title,
      type: 'pie',
      radius: isDoughnut ? ['45%', '70%'] : isRose ? [20, 100] : '70%',
      center: ['50%', '50%'],
      roseType: isRose ? 'radius' : undefined,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: widget.showLabels ? { show: true, formatter: '{b}\n{d}%' } : { show: false },
      data: data.map(d => ({ name: d.name || d.label, value: d.value }))
    }];
    option.grid = undefined;
  }

  else if (widget.type === 'treemap') {
    option.series = [{
      type: 'treemap',
      name: widget.title,
      data: data.map(d => ({ name: d.name || d.label, value: d.value })),
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      itemStyle: { borderColor: '#fff', gapWidth: 2, borderRadius: 4 },
      label: { show: true, formatter: '{b}\n{c}' }
    }];
    option.grid = undefined;
  }

  else if (widget.type === 'sunburst') {
    // Generate a quick mock nested hierarchy out of flat data for visual fidelity
    const sunburstData = data.map((d, i) => ({
      name: d.name || d.label,
      value: d.value,
      children: i % 2 === 0 ? [
         { name: 'A', value: d.value * 0.6 },
         { name: 'B', value: d.value * 0.4 }
      ] : undefined
    }));
    option.series = [{
      type: 'sunburst',
      data: sunburstData,
      radius: [0, '90%'],
      itemStyle: { borderRadius: 4, borderWidth: 2, borderColor: '#fff' },
      label: { rotate: 'radial', fontSize: 10 }
    }];
    option.grid = undefined;
  }

  // ============================================================================
  // RELATIONSHIPS (scatter, bubble, radar)
  // ============================================================================
  else if (['scatter', 'bubble'].includes(widget.type)) {
    const isBubble = widget.type === 'bubble';
    
    option.xAxis = {
      type: 'value',
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      splitLine: { show: false }
    };
    option.yAxis = {
      type: 'value',
      splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } }
    };
    
    // Bubble chart needs 3rd dimension data for size. We mock it if absent.
    const scatterData = data.map(d => {
       if (Array.isArray(d.value) && d.value.length >= 2) return d.value;
       // Mock scatter coordinates based on Y value to distribute visually
       return [Math.floor(Math.random() * 100), d.value, Math.floor(Math.random() * 100)];
    });

    option.series = [{
      type: 'scatter',
      data: scatterData,
      symbolSize: isBubble ? (dataItem: any) => Math.sqrt(dataItem[2] || 10) * 4 : 12,
      itemStyle: { opacity: isBubble ? 0.7 : 1, color: colors[0] }
    }];
  }

  else if (widget.type === 'radar') {
    const maxVal = Math.max(...yData, 10) * 1.2;
    option.radar = {
      indicator: data.map(d => ({ name: d.name || d.label, max: maxVal })),
      splitArea: { areaStyle: { color: ['#f8fafc', '#f1f5f9'] } },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      splitLine: { lineStyle: { color: '#cbd5e1' } },
      axisName: { color: '#64748b' }
    };
    option.series = [{
      name: widget.title,
      type: 'radar',
      data: [{ value: yData, name: 'Dataset 1' }],
      areaStyle: { opacity: 0.3, color: colors[0] },
      lineStyle: { width: 3, color: colors[0] },
      itemStyle: { color: colors[0] },
      symbolSize: 6
    }];
    option.grid = undefined;
  }

  // ============================================================================
  // PROCESS & HEALTH (funnel, heatmap, gauge)
  // ============================================================================
  else if (widget.type === 'funnel') {
    option.series = [{
      name: widget.title,
      type: 'funnel',
      left: '10%', top: 20, bottom: 20, width: '80%',
      minSize: '10%', maxSize: '100%',
      sort: 'descending', gap: 2,
      label: { show: true, position: 'inside', formatter: '{b}', color: '#fff', fontWeight: 'bold' },
      data: data.map(d => ({ name: d.name || d.label, value: d.value }))
    }];
  }

  else if (widget.type === 'heatmap') {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const metrics = ['A', 'B', 'C', 'D'];
    let heatmapData: any[] = [];
    for(let i=0; i<days.length; i++){
      for(let j=0; j<metrics.length; j++){
        heatmapData.push([i, j, Math.floor(Math.random() * 100)]);
      }
    }
    option.tooltip.position = 'top';
    option.xAxis = { type: 'category', data: days, splitArea: { show: true } };
    option.yAxis = { type: 'category', data: metrics, splitArea: { show: true } };
    option.visualMap = {
      min: 0, max: 100, calculable: true,
      orient: 'horizontal', left: 'center', bottom: -10,
      inRange: { color: ['#f8fafc', colors[0]] }
    };
    option.series = [{
      type: 'heatmap', data: heatmapData,
      label: { show: widget.showLabels || false, color: '#000', fontSize: 10 },
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 }
    }];
    option.grid = { top: 20, right: 20, bottom: 60, left: 40 }; // Adjust for visualMap
  }

  else if (widget.type === 'gauge') {
    // Single KPI from first data point or sum
    const total = yData[0] || 0;
    const target = widget.kpiTarget || 100;
    
    option.series = [{
      type: 'gauge',
      startAngle: 210,
      endAngle: -30,
      min: 0,
      max: target,
      splitNumber: 4,
      itemStyle: { color: colors[0], shadowColor: 'rgba(0,138,255,0.45)', shadowBlur: 10, shadowOffsetX: 2, shadowOffsetY: 2 },
      progress: { show: true, roundCap: true, width: 18 },
      pointer: { show: false },
      axisLine: { roundCap: true, lineStyle: { width: 18, color: [[1, '#f1f5f9']] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      title: { show: false },
      detail: {
        width: 120, height: 40, fontSize: 36, color: '#0f172a', formatter: '{value}',
        valueAnimation: true, offsetCenter: [0, '20%']
      },
      data: [{ value: total, name: 'Score' }]
    }];
    option.grid = undefined;
  }

  const onEvents = {
    click: (params: any) => {
      if (onChartClick) {
         // Pass the logical category/name string from the chart node clicked
         onChartClick(params.name || params.data?.name || '');
      }
    }
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} onEvents={onEvents} />;
}
