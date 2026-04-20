import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Save, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';

interface WealthPolicyTabProps {
  tenantId: string;
  familyId: string;
}

export function WealthPolicyTab({ tenantId, familyId }: WealthPolicyTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState<any>({
    status: 'Draft',
    riskReturn: {
       targetYield: 6,
       benchmark: 'IPCA',
       timeHorizon: 10,
    },
    enquadramento: {
      liquidityMin: 5,
      liquidityMax: 10,
      fixedIncomeMin: 40,
      fixedIncomeMax: 60,
      equitiesMin: 10,
      equitiesMax: 20,
      alternativesMin: 0,
      alternativesMax: 10,
    },
    esgFilters: [],
    liquidityEvents: '',
    committeeApprovalDate: null,
  });

  useEffect(() => {
    if (!tenantId || !familyId) return;
    
    const policyRef = doc(db, 'tenants', tenantId, 'organizations', familyId, 'wealth_policy', 'current');
    const unsub = onSnapshot(policyRef, (snap) => {
      if (snap.exists()) {
        setPolicy({ ...policy, ...snap.data() });
      }
      setLoading(false);
    });

    return () => unsub();
  }, [tenantId, familyId]);

  const handleSave = async (status: string = policy.status) => {
    if (!tenantId || !familyId) return;
    setSaving(true);
    
    try {
      const policyRef = doc(db, 'tenants', tenantId, 'organizations', familyId, 'wealth_policy', 'current');
      await setDoc(policyRef, {
        ...policy,
        status,
        updatedAt: serverTimestamp(),
        committeeApprovalDate: status === 'Approved' ? new Date().toISOString() : policy.committeeApprovalDate,
      }, { merge: true });
    } catch (error) {
      console.error('Error saving policy', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading Wealth Policy...</div>;

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-xl font-bold text-slate-800">Investment Policy Statement (IPS)</h2>
           <p className="text-slate-500 text-sm">Define the risk parameters and asset allocation targets (Enquadramento).</p>
        </div>
        <div className="flex items-center gap-3">
           <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${policy.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {policy.status}
           </span>
           {policy.status !== 'Approved' && (
             <button disabled={saving} onClick={() => handleSave('Approved')} className="btn btn-primary flex items-center gap-2">
                <CheckCircle2 size={16} /> Approve Policy
             </button>
           )}
           <button disabled={saving} onClick={() => handleSave()} className="btn btn-secondary flex items-center gap-2">
             <Save size={16} /> Save Draft
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk & Return Objectives */}
        <div className="rounded-tremor-default border border-tremor-border bg-white shadow-tremor-card p-6">
           <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
             <FileText size={18} className="text-indigo-600" /> Objectives & Horizon
           </h3>
           <div className="flex flex-col gap-4">
             <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Target Yield (%)</label>
                <div className="flex items-center gap-2">
                  <select 
                    className="p-2 border border-slate-200 rounded-md bg-slate-50 text-sm w-32"
                    value={policy.riskReturn.benchmark}
                    onChange={e => setPolicy({...policy, riskReturn: {...policy.riskReturn, benchmark: e.target.value}})}
                  >
                    <option value="IPCA">IPCA</option>
                    <option value="CDI">CDI</option>
                    <option value="IGPM">IGP-M</option>
                    <option value="Libor">Secured Overnight (SOFR)</option>
                  </select>
                  <span className="font-bold text-slate-400">+</span>
                  <input 
                    type="number" 
                    className="p-2 border border-slate-200 rounded-md text-sm w-full" 
                    value={policy.riskReturn.targetYield}
                    onChange={e => setPolicy({...policy, riskReturn: {...policy.riskReturn, targetYield: Number(e.target.value)}})}
                  />
                  <span className="text-slate-400 font-medium">%</span>
                </div>
             </div>
             
             <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Investment Horizon (Years)</label>
                <input 
                  type="number" 
                  className="p-2 border border-slate-200 rounded-md text-sm w-full" 
                  value={policy.riskReturn.timeHorizon}
                  onChange={e => setPolicy({...policy, riskReturn: {...policy.riskReturn, timeHorizon: Number(e.target.value)}})}
                />
             </div>
           </div>
        </div>

        {/* Liquidity Map */}
        <div className="rounded-tremor-default border border-tremor-border bg-white shadow-tremor-card p-6">
           <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
             <AlertTriangle size={18} className="text-amber-600" /> Liquidity Events
           </h3>
           <textarea 
             className="w-full border border-slate-200 rounded-md p-3 text-sm h-[140px] resize-none focus:outline-indigo-500"
             placeholder="List any major capital calls, property purchases, or expected tax payments that require high liquidity in the short/medium term..."
             value={policy.liquidityEvents}
             onChange={e => setPolicy({...policy, liquidityEvents: e.target.value})}
           ></textarea>
        </div>
      </div>

      {/* Enquadramento (Asset Allocation) */}
      <div className="rounded-tremor-default border border-tremor-border bg-white shadow-tremor-card p-6">
         <div className="mb-6">
           <h3 className="text-base font-bold text-slate-800">Target Asset Allocation (Enquadramento)</h3>
           <p className="text-sm text-slate-500">Define the min and max exposure allowed per asset class. Breaches will trigger compliance alerts.</p>
         </div>
         
         <div className="grid grid-cols-1 gap-4">
            {[
              { id: 'liquidity', label: 'Liquidity / Cash', state: 'liquidityMin', maxState: 'liquidityMax', color: 'bg-emerald-500' },
              { id: 'fixedIncome', label: 'Fixed Income', state: 'fixedIncomeMin', maxState: 'fixedIncomeMax', color: 'bg-blue-500' },
              { id: 'equities', label: 'Equities', state: 'equitiesMin', maxState: 'equitiesMax', color: 'bg-indigo-500' },
              { id: 'alternatives', label: 'Alternative Inv. / Hedge Funds', state: 'alternativesMin', maxState: 'alternativesMax', color: 'bg-purple-500' },
            ].map(ac => (
              <div key={ac.id} className="flex items-center gap-4 bg-slate-50 p-4 rounded-md border border-slate-100">
                 <div className="w-1/3 flex items-center gap-2 font-semibold text-slate-700 text-sm">
                   <div className={`w-3 h-3 rounded-sm ${ac.color}`}></div>
                   {ac.label}
                 </div>
                 <div className="w-2/3 flex items-center gap-4">
                    <div className="flex flex-col gap-1 w-full relative pt-4">
                       {/* Simple double range simulation */}
                       <div className="flex justify-between text-xs text-slate-500 absolute top-0 w-full left-0">
                         <span>Min: {policy.enquadramento[ac.state]}%</span>
                         <span>Max: {policy.enquadramento[ac.maxState]}%</span>
                       </div>
                       <div className="flex items-center gap-2">
                         <input 
                           type="range" min="0" max="100" 
                           value={policy.enquadramento[ac.state]} 
                           onChange={e => setPolicy({...policy, enquadramento: {...policy.enquadramento, [ac.state]: Number(e.target.value)}})}
                           className="w-full accent-indigo-600"
                         />
                         <input 
                           type="range" min="0" max="100" 
                           value={policy.enquadramento[ac.maxState]} 
                           onChange={e => setPolicy({...policy, enquadramento: {...policy.enquadramento, [ac.maxState]: Number(e.target.value)}})}
                           className="w-full accent-slate-400"
                         />
                       </div>
                    </div>
                 </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
}
