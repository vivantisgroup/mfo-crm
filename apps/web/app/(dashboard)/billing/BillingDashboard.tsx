import React, { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { TrendingUp, TrendingDown, DollarSign, Loader2, ArrowUpRight, BarChart3, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function BillingDashboard({ cycles, tenantId }: { cycles: any[], tenantId: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all invoices across all cycles for global aggregation
  useEffect(() => {
    let active = true;
    const fetchAll = async () => {
      if (!tenantId || cycles.length === 0) {
         setLoading(false);
         return;
      }
      
      const aggregateData: any[] = [];
      for (const cycle of cycles) {
         try {
           const snap = await getDocs(collection(db, 'tenants', tenantId, 'billing_cycles', cycle.id, 'invoices'));
           const invoices = snap.docs.map(d => d.data());
           
           let totalRecBrl = 0;
           let totalRecUsd = 0;
           let totalPaidBrl = 0;
           let totalPaidUsd = 0;
           let opTimes = [];

           for (const inv of invoices) {
              totalRecBrl += ((inv.recBrl || 0) + (inv.adjBrl || 0));
              totalRecUsd += ((inv.recUsd || 0) + (inv.adjUsd || 0));
              totalPaidBrl += (inv.receivedBrl || 0);
              totalPaidUsd += (inv.receivedUsd || 0);
              if (inv.opTimeSpentMinutes) opTimes.push(inv.opTimeSpentMinutes);
           }

           const avgTime = opTimes.length ? opTimes.reduce((a,b)=>a+b,0) / opTimes.length : 0;

           aggregateData.push({
             ...cycle,
             totalRecBrl,
             totalRecUsd,
             totalPaidBrl, 
             totalPaidUsd,
             avgOperationTime: Math.round(avgTime),
             invoiceCount: invoices.length,
             emittedRevenueUsdEquivalent: totalRecUsd + (totalRecBrl / (cycle.fxUsdBrl || 5))
           });
         } catch(e) {
           console.error("Error fetching cycle data mapping", e);
         }
      }
      
      // Sort chronological
      aggregateData.sort((a,b) => a.createdAt - b.createdAt);
      if (active) {
         setData(aggregateData);
         setLoading(false);
      }
    };
    fetchAll();
    return () => { active = false; };
  }, [cycles, tenantId]);

  if (loading) {
     return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;
  }

  if (data.length === 0) {
     return <div className="p-10 text-center text-slate-500">Not enough data to calculate aggregates.</div>;
  }

  // Calculate top-most KPIs from the most recent cycle
  const current = data[data.length - 1];
  const previous = data.length > 1 ? data[data.length - 2] : null;

  const pctChange = (curr: number, prev: number) => {
     if (!prev) return 100;
     return Math.round(((curr - prev) / prev) * 100);
  };

  const currentUsdEq = current.emittedRevenueUsdEquivalent;
  const previousUsdEq = previous ? previous.emittedRevenueUsdEquivalent : 0;
  const growth = pctChange(currentUsdEq, previousUsdEq);

  // Recharts payload
  const chartData = data.map(d => ({
     name: d.name,
     PredictedBRL: d.totalRecBrl,
     PredictedUSD: d.totalRecUsd,
     PaidBRL: d.totalPaidBrl,
     PaidUSD: d.totalPaidUsd,
     AvgTimeMinutes: d.avgOperationTime
  }));

  return (
     <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
           <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><BarChart3 size={20}/> Management Dashboards</h2>
           <span className="text-sm font-semibold text-slate-500 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-200">
             Analyzing {data.length} Histórical Cycles
           </span>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           {/* Current Revenue */}
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 relative overflow-hidden">
               <div className="absolute -right-4 -top-4 opacity-5 text-indigo-500"><DollarSign size={100} /></div>
               <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider">Current Cycle Expected (USD Eqv)</h3>
               <div className="text-3xl font-black text-slate-800 mt-2">
                 ${currentUsdEq.toLocaleString('en-US', {maximumFractionDigits:0})}
               </div>
               <div className={`text-xs font-bold mt-2 flex items-center gap-1 ${growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {growth >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                  {growth > 0 ? '+' : ''}{growth}% vs Prior Cycle
               </div>
           </div>

           {/* Collected Revenue */}
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
               <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider">Payments Collected (BRL Target)</h3>
               <div className="text-3xl font-black text-emerald-600 mt-2 flex items-baseline gap-2">
                 <span className="text-lg text-emerald-400">R$</span>
                 {current.totalPaidBrl.toLocaleString('en-US', {maximumFractionDigits:0})}
                 <span className="text-sm text-slate-400 ml-1">/ {current.totalRecBrl.toLocaleString('en-US', {maximumFractionDigits:0})}</span>
               </div>
               <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, (current.totalPaidBrl / (current.totalRecBrl || 1)) * 100)}%` }}></div>
               </div>
           </div>

           {/* Operations Time */}
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
               <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider">Avg Operations Time/Row</h3>
               <div className="text-3xl font-black text-rose-600 mt-2 flex items-baseline gap-1">
                 {current.avgOperationTime} <span className="text-sm text-slate-400">mins</span>
               </div>
               <div className="text-xs text-slate-500 mt-2 font-medium">Tracks end-to-end efficiency</div>
           </div>
           
           {/* Active Invoices */}
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
               <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider">Processed Targets</h3>
               <div className="text-3xl font-black text-blue-600 mt-2">
                 {current.invoiceCount}
               </div>
               <div className="text-xs text-slate-500 mt-2 font-medium">Mapped targets in current cycle</div>
           </div>
        </div>

        {/* Charts block */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
               <h3 className="text-slate-700 font-bold text-md mb-4 flex items-center gap-2"><Activity size={16}/> Emitted vs Paid (BRL) - Growth Trajectory</h3>
               <div className="h-[300px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748B'}} />
                     <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748B'}} />
                     <RechartsTooltip cursor={{fill: '#F1F5F9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                     <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}} />
                     <Bar dataKey="PredictedBRL" name="Predicted Revenue (BRL)" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                     <Bar dataKey="PaidBRL" name="Actual Paid (BRL)" fill="#10B981" radius={[4, 4, 0, 0]} />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
               <h3 className="text-slate-700 font-bold text-md mb-4 flex items-center gap-2"><TrendingUp size={16}/> Dollar Emitted vs Paid (USD)</h3>
               <div className="h-[300px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChartComponent data={chartData} />
                 </ResponsiveContainer>
               </div>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 lg:col-span-2">
               <h3 className="text-slate-700 font-bold text-md mb-4">Internal Efficiency Track (Minutes per Invoice)</h3>
               <div className="h-[250px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748B'}} />
                     <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748B'}} />
                     <RechartsTooltip cursor={{stroke: '#cbd5e1', strokeWidth: 2}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                     <Line type="monotone" dataKey="AvgTimeMinutes" stroke="#f43f5e" strokeWidth={3} dot={{r: 4, strokeWidth: 2, fill: '#fff'}} activeDot={{r: 6}} />
                   </LineChart>
                 </ResponsiveContainer>
               </div>
            </div>
        </div>

     </div>
  );
}

// Internal reusable chart setup wrapper
function AreaChartComponent({ data }: { data: any[] }) {
   if (data.length === 0) return null;
   return (
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
         <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748B'}} />
         <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748B'}} />
         <RechartsTooltip cursor={{fill: '#F1F5F9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
         <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}} />
         <Bar dataKey="PredictedUSD" name="Predicted Revenue (USD)" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
         <Bar dataKey="PaidUSD" name="Actual Paid (USD)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
      </BarChart>
   );
}
