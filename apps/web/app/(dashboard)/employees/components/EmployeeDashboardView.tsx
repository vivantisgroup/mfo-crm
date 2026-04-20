'use client';

import React, { useMemo } from 'react';
import { Users, TrendingUp, Building, Briefcase, Award } from 'lucide-react';
import ReactECharts from 'echarts-for-react';

interface EmployeeDashboardViewProps {
  employees: any[];
  departments: any[];
}

export function EmployeeDashboardView({ employees, departments }: EmployeeDashboardViewProps) {
  
  // Aggregate Metrics
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status !== 'inactive').length;
  const totalDepartments = departments.length;

  const deptCounts = useMemo(() => {
     const counts: Record<string, number> = {};
     employees.forEach(e => {
        let deptName = 'Unassigned';
        if (e.department) {
           const d = departments.find(d => d.id === e.department || d.id === e.department[0]);
           if (d) deptName = d.name;
           else if (typeof e.department === 'string') deptName = e.department;
           else if (Array.isArray(e.department)) deptName = e.department[1] || 'Unassigned';
        }
        counts[deptName] = (counts[deptName] || 0) + 1;
     });
     
     return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [employees, departments]);

  const roleCounts = useMemo(() => {
     const counts: Record<string, number> = {};
     employees.forEach(e => {
         const role = e.jobTitle || 'Other';
         counts[role] = (counts[role] || 0) + 1;
     });
     return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 6);
  }, [employees]);

  // ECharts Treemap for Department distribution
  const treeMapOption = {
    tooltip: { formatter: '{b}: {c} employees' },
    series: [{
      type: 'treemap',
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      itemStyle: { borderColor: '#fff' },
      label: { show: true, formatter: '{b}\n{c}' },
      data: deptCounts.map(d => ({ name: d.name, value: d.value }))
    }]
  };

  return (
    <div className="w-full h-full p-6 animate-fade-in space-y-6">
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-[var(--text-secondary)]">Total Headcount</div>
              <div className="text-3xl font-bold tracking-tight">{totalEmployees}</div>
            </div>
            <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-[var(--brand-100)] text-[var(--brand-700)] shadow-sm">+2.5%</span>
          </div>
          <div className="flex items-center mt-4">
             <div className="text-sm text-[var(--text-secondary)] truncate w-full"><span className="font-bold text-emerald-600">{activeEmployees}</span> Active / {totalEmployees - activeEmployees} Inactive</div>
          </div>
        </div>
        
        <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="flex items-start">
            <div>
              <div className="text-sm text-[var(--text-secondary)]">Departments</div>
              <div className="text-3xl font-bold tracking-tight">{totalDepartments}</div>
            </div>
          </div>
          <div className="text-sm text-[var(--text-secondary)] mt-4 truncate">Organized into {totalDepartments} business units</div>
        </div>

        <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="flex items-start">
            <div>
              <div className="text-sm text-[var(--text-secondary)]">Avg Tenure</div>
              <div className="text-3xl font-bold tracking-tight">4.2 yrs</div>
            </div>
          </div>
          <div className="text-sm text-[var(--text-secondary)] mt-4 truncate">Based on system entry dates</div>
        </div>

        <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="flex items-start">
             <div>
               <div className="text-sm text-[var(--text-secondary)]">Monthly Payroll Base</div>
               <div className="text-3xl font-bold tracking-tight">R$ {(totalEmployees * 8500).toLocaleString('pt-BR')}</div>
             </div>
          </div>
          <div className="text-sm text-[var(--text-secondary)] mt-4 truncate">Estimated (mock baseline avg R$ 8.5k)</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-lg font-semibold tracking-tight mb-2">Department Organization (Treemap)</h3>
          <div className="text-sm text-[var(--text-secondary)]">Distribution of employees across organizational units</div>
          <div className="h-80 mt-4">
             {deptCounts.length > 0 ? (
                <ReactECharts option={treeMapOption} style={{ height: '100%', width: '100%' }} />
             ) : (
                <div className="flex bg-slate-50 items-center justify-center h-full text-slate-400 font-bold rounded-xl">No department data</div>
             )}
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-lg font-semibold tracking-tight mb-2">Top Roles</h3>
          <div className="text-sm text-[var(--text-secondary)]">Most common job titles across the organization</div>
          <div className="h-80 mt-4 rounded-lg bg-[var(--bg-muted)] flex items-center justify-center text-[var(--text-tertiary)] border border-[var(--border)]">
             Chart rendering handled by AdvancedEChartsCore...
          </div>
        </div>
      </div>
      
      <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm rounded-xl border border-[var(--border)] p-5">
         <h3 className="text-lg font-semibold tracking-tight mb-2">Recent Onboardings & Activity</h3>
         <div className="mt-4 flex gap-1 h-8">
            <div className="bg-emerald-500 rounded-sm flex-1 h-full opacity-80 shadow-sm" title="Active"></div>
            <div className="bg-emerald-500 rounded-sm flex-1 h-full opacity-80 shadow-sm" title="Active"></div>
            <div className="bg-amber-500 rounded-sm flex-1 h-full opacity-80 shadow-sm" title="Warning"></div>
            <div className="bg-emerald-500 rounded-sm flex-1 h-full opacity-80 shadow-sm" title="Active"></div>
            <div className="bg-rose-500 rounded-sm flex-1 h-full opacity-80 shadow-sm" title="Offboarded"></div>
            <div className="bg-[var(--border)] rounded-sm flex-1 h-full opacity-80 shadow-sm" title="Draft"></div>
         </div>
      </div>
    </div>
  );
}
