'use client';

import React, { useMemo } from 'react';
import { useTaskQueue } from '@/lib/TaskQueueContext';
import { usePageTitle } from '@/lib/PageTitleContext';
import ReactECharts from 'echarts-for-react';
import { Clock, Users, Activity, BarChart3, Briefcase } from 'lucide-react';

export default function TimeTrackingDashboard() {
  const { timeEntries } = useTaskQueue();
  const { setTitle } = usePageTitle();

  React.useEffect(() => {
    setTitle('Time & Resource Analytics', 'Utilization, fee allocation, and productivity maps');
  }, [setTitle]);

  // Use Memo for Chart computations to keep performance ultra-high
  const { totalMinutes, treemapData, userBarData, activityPieData } = useMemo(() => {
    let tot = 0;
    const clientMap: Record<string, number> = {};
    const userMap: Record<string, number> = {};
    const activityMap: Record<string, number> = {};

    timeEntries.forEach(entry => {
      const dur = entry.durationMinutes || 0;
      tot += dur;

      // Drill by Client
      const entityName = entry.linkedEntityName || entry.taskId || 'Unassigned / Platform';
      clientMap[entityName] = (clientMap[entityName] || 0) + dur;

      // Drill by User
      userMap[entry.userName] = (userMap[entry.userName] || 0) + dur;

      // Drill by Activity Type
      const act = entry.activityType.charAt(0).toUpperCase() + entry.activityType.slice(1);
      activityMap[act] = (activityMap[act] || 0) + dur;
    });

    const tmData = Object.entries(clientMap).map(([name, val]) => ({
      name,
      value: val,
      // Color heuristics based on size
      itemStyle: { color: val > 120 ? '#6366f1' : val > 60 ? '#10b981' : val > 30 ? '#f59e0b' : '#94a3b8' }
    })).sort((a,b) => b.value - a.value);

    return {
      totalMinutes: tot,
      treemapData: tmData,
      userBarData: Object.entries(userMap).map(([user, val]) => ({ user, val })).sort((a,b) => b.val - a.val),
      activityPieData: Object.entries(activityMap).map(([name, val]) => ({ name, value: val }))
    };
  }, [timeEntries]);

  // ECharts Options
  const treemapOptions = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} mins' },
    series: [{
      type: 'treemap',
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      data: treemapData,
      label: { show: true, formatter: '{b}\n{c}m' }
    }]
  };

  const userBarOptions = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', name: 'Minutes' },
    yAxis: { type: 'category', data: userBarData.map(d => d.user) },
    series: [{
      name: 'Logged Time',
      type: 'bar',
      data: userBarData.map(d => d.val),
      itemStyle: { color: '#8b5cf6', borderRadius: [0, 4, 4, 0] }
    }]
  };

  const pieOptions = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} mins ({d}%)' },
    legend: { bottom: '0%', left: 'center' },
    series: [{
      name: 'Activity',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: { show: false, position: 'center' },
      emphasis: {
        label: { show: true, fontSize: 16, fontWeight: 'bold' }
      },
      labelLine: { show: false },
      data: activityPieData
    }]
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto animate-fade-in w-full">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-5 shadow-sm text-indigo-500">
           <div className="flex items-center gap-2 mb-2 text-indigo-700 font-bold uppercase tracking-wider text-[11px]">
             <Clock size={16} /> Total Time Logged
           </div>
           <div className="text-3xl font-black">{Math.floor(totalMinutes / 60)}<span className="text-base font-bold opacity-50 ml-1">hrs</span> {totalMinutes % 60}<span className="text-base font-bold opacity-50 ml-1">m</span></div>
        </div>
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-5 shadow-sm text-emerald-500">
           <div className="flex items-center gap-2 mb-2 text-emerald-700 font-bold uppercase tracking-wider text-[11px]">
             <Briefcase size={16} /> Entities Engaged
           </div>
           <div className="text-3xl font-black">{treemapData.length}</div>
        </div>
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-5 shadow-sm text-amber-500">
           <div className="flex items-center gap-2 mb-2 text-amber-700 font-bold uppercase tracking-wider text-[11px]">
             <Users size={16} /> Team Members Active
           </div>
           <div className="text-3xl font-black">{userBarData.length}</div>
        </div>
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-5 shadow-sm text-rose-500">
           <div className="flex items-center gap-2 mb-2 text-rose-700 font-bold uppercase tracking-wider text-[11px]">
             <Activity size={16} /> Predominant Activity
           </div>
           <div className="text-xl font-black truncate mt-2">{activityPieData.sort((a,b)=>b.value-a.value)[0]?.name || 'N/A'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Treemap Container */}
        <div className="lg:col-span-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
           <h3 className="text-sm font-bold flex items-center gap-2 mb-1">
             <BarChart3 size={16} className="text-indigo-500" /> Time Spent by Client / Entity
           </h3>
           <p className="text-xs text-[var(--text-secondary)] mb-6 tracking-wide">
             Size indicates volume of time. Used to map operational weight against generated fees.
           </p>
           {totalMinutes > 0 ? (
             <ReactECharts option={treemapOptions} style={{ height: '400px' }} />
           ) : (
             <div className="h-[400px] flex items-center justify-center text-sm font-bold text-[var(--text-tertiary)] bg-[var(--bg-canvas)] rounded-lg">
                No time entries logged yet.
             </div>
           )}
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
           <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
             <h3 className="text-sm font-bold mb-4">Activity Breakdown</h3>
             {totalMinutes > 0 ? (
               <ReactECharts option={pieOptions} style={{ height: '220px' }} />
             ) : (
               <div className="h-[220px] flex items-center justify-center text-xs font-bold text-[var(--text-tertiary)] bg-[var(--bg-canvas)] rounded-lg">No data</div>
             )}
           </div>

           <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-5 shadow-sm flex-1">
             <h3 className="text-sm font-bold mb-4">User Productivity</h3>
             {totalMinutes > 0 ? (
               <ReactECharts option={userBarOptions} style={{ height: '220px' }} />
             ) : (
               <div className="h-[220px] flex items-center justify-center text-xs font-bold text-[var(--text-tertiary)] bg-[var(--bg-canvas)] rounded-lg">No data</div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
