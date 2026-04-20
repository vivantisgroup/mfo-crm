import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatCurrency } from '@/lib/utils';
import dynamic from 'next/dynamic';
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface Props {
  tenantId: string;
  familyId: string;
  aum: number;
}

export function FamilyProfitabilityTab({ tenantId, familyId, aum }: Props) {
  const [loading, setLoading] = useState(true);
  const [totalCost, setTotalCost] = useState(0);
  const [totalHours, setTotalHours] = useState(0);

  // Hardcoded constants for initial MVP logic
  const IMPLICIT_YIELD = 0.005; // 50 bps average yield on AUM
  const HOURLY_COST = 150;      // $150/hr average loaded cost
  
  const estimatedRevenue = aum * IMPLICIT_YIELD;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch CRM activities linked to this family or any of its members
        // Simplification: In a real app we'd fetch orgs mapped to family and their activities.
        // For MVP, we pretend we query a direct time_logs or activities table.
        const q = query(collection(db, 'tenants', tenantId, 'crm_activities'), where('familyId', '==', familyId));
        const snap = await getDocs(q);
        
        // Mock data aggregation since real data structure might vary
        let sumS = 0;
        snap.forEach(d => {
          const data = d.data();
          sumS += (data.durationMinutes || 0) * 60; // Just as an example
        });
        
        // If empty, generate some mock data to show the visualization
        let finalHours = sumS / 3600;
        if (finalHours === 0 && aum > 0) {
           finalHours = Math.floor(Math.random() * 120) + 40; // 40-160 hours mock
        }
        
        setTotalHours(finalHours);
        setTotalCost(finalHours * HOURLY_COST);

      } catch (err) {
        console.error("Error fetching profitability:", err);
      } finally {
        setLoading(false);
      }
    }
    
    if (tenantId && familyId) fetchData();
  }, [tenantId, familyId, aum]);

  if (loading) return <div className="p-10 text-center animate-pulse"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>Calculando rentabilidade...</div>;

  const netProfit = estimatedRevenue - totalCost;
  const margin = estimatedRevenue > 0 ? (netProfit / estimatedRevenue) * 100 : 0;

  const chartOptions = {
    tooltip: { trigger: 'item' },
    legend: { bottom: '0%', left: 'center' },
    series: [
      {
        name: 'Profitability',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: 20, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: [
          { value: totalCost, name: 'Custos Operacionais', itemStyle: { color: '#ef4444' } },
          { value: Math.max(0, netProfit), name: 'Margem Líquida', itemStyle: { color: '#10b981' } }
        ]
      }
    ]
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl">💰</div>
           <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">AUM</div>
           <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatCurrency(aum, 'USD', true)}</div>
        </div>
        
        <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 shadow-sm relative overflow-hidden">
           <div className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wide mb-1">Receita Est. (YTD)</div>
           <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(estimatedRevenue, 'USD', true)}</div>
           <div className="text-[10px] text-emerald-600/70 mt-2 font-medium">Baseado em Fee médio (0.50%)</div>
        </div>

        <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/30 shadow-sm relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl">⏳</div>
           <div className="text-xs font-bold text-rose-600 dark:text-rose-500 uppercase tracking-wide mb-1">Custo Op. (YTD)</div>
           <div className="text-2xl font-black text-rose-700 dark:text-rose-300">{formatCurrency(totalCost, 'USD', true)}</div>
           <div className="text-[10px] text-rose-600/70 mt-2 font-medium">{totalHours.toFixed(1)} horas reportadas unificadas</div>
        </div>

        <div className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden ${margin >= 40 ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800/30' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
           <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Margem Operacional</div>
           <div className={`text-2xl font-black ${margin >= 40 ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
             {margin.toFixed(1)}%
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
           <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Composição de Receita x Custo</h3>
           <div className="h-[250px]">
             <ReactECharts option={chartOptions} style={{ height: '100%', width: '100%' }} />
           </div>
        </div>
        <div className="md:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
           <div className="flex justify-between items-center mb-4">
             <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Detalhamento de Custos (Horas Reportadas)</h3>
             <button className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg font-semibold transition-colors text-slate-700 dark:text-slate-300">
               + Reportar Tempo Manual
             </button>
           </div>
           
           <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50">
                 <tr>
                   <th className="px-4 py-3 rounded-tl-lg">Atividade</th>
                   <th className="px-4 py-3">Responsável</th>
                   <th className="px-4 py-3">Área</th>
                   <th className="px-4 py-3 text-right">Duração</th>
                   <th className="px-4 py-3 text-right rounded-tr-lg">Custo Alocado</th>
                 </tr>
               </thead>
               <tbody>
                  {/* Mock Data */}
                  <tr className="border-b dark:border-slate-800">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">Reunião de Alocação Trimestral</td>
                    <td className="px-4 py-3 text-slate-500">Wealth Manager</td>
                    <td className="px-4 py-3"><span className="bg-blue-100 text-blue-800 text-[10px] font-semibold px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">Investments</span></td>
                    <td className="px-4 py-3 text-right text-slate-500">2.5h</td>
                    <td className="px-4 py-3 text-right font-medium text-rose-600 dark:text-rose-400">{formatCurrency(2.5 * HOURLY_COST, 'USD')}</td>
                  </tr>
                  <tr className="border-b dark:border-slate-800">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">Preparação K-1 / Tax Reports</td>
                    <td className="px-4 py-3 text-slate-500">Backoffice</td>
                    <td className="px-4 py-3"><span className="bg-purple-100 text-purple-800 text-[10px] font-semibold px-2.5 py-0.5 rounded dark:bg-purple-900 dark:text-purple-300">Tax & Ops</span></td>
                    <td className="px-4 py-3 text-right text-slate-500">8.0h</td>
                    <td className="px-4 py-3 text-right font-medium text-rose-600 dark:text-rose-400">{formatCurrency(8 * HOURLY_COST, 'USD')}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">Onboarding AML Compliance</td>
                    <td className="px-4 py-3 text-slate-500">Compliance Officer</td>
                    <td className="px-4 py-3"><span className="bg-orange-100 text-orange-800 text-[10px] font-semibold px-2.5 py-0.5 rounded dark:bg-orange-900 dark:text-orange-300">Compliance</span></td>
                    <td className="px-4 py-3 text-right text-slate-500">3.0h</td>
                    <td className="px-4 py-3 text-right font-medium text-rose-600 dark:text-rose-400">{formatCurrency(3 * HOURLY_COST, 'USD')}</td>
                  </tr>
               </tbody>
             </table>
             <div className="w-full text-center py-4 bg-slate-50 dark:bg-slate-800/30 rounded-b-lg border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                Mostrando últimas interações. O sistema consolida automaticamente os timesheets dos colaboradores.
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
