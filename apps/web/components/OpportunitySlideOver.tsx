import React, { useState, useEffect } from 'react';
import { OpportunityRecord, PipelineStage } from '@/lib/salesService';
import { X, Clock, Plus, Target, DollarSign, Activity } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { formatUsd } from '@/lib/subscriptionService';
import { useAuth } from '@/lib/AuthContext';
import { getTenantMembers, TenantMember } from '@/lib/tenantMemberService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Props {
  tenantId: string;
  opportunity: OpportunityRecord | null;
  onClose: () => void;
  onUpdate: () => void;
}

export function OpportunitySlideOver({ tenantId, opportunity, onClose, onUpdate }: Props) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<any[]>([]);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [form, setForm] = useState({ 
    type: 'meeting', 
    subject: '', 
    durationMinutes: 30,
    isBillable: true,
    hourlyRate: 150,
  });

  useEffect(() => {
    getTenantMembers(tenantId).then(setMembers).catch(console.error);
  }, [tenantId]);

  useEffect(() => {
    if (!opportunity?.id) return;
    const q = query(
      collection(db, 'tenants', tenantId, 'activities'), 
      where('opportunityId', '==', opportunity.id),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [tenantId, opportunity?.id]);

  if (!opportunity) return null;

  async function handleAddActivity() {
    if (!opportunity) return;
    if (!form.subject.trim()) return;
    try {
      const assignedName = members.find(m => m.uid === user?.uid)?.displayName || user?.email || 'Unknown';
      const totalCost = form.isBillable ? (form.durationMinutes / 60) * form.hourlyRate : 0;
      
      await addDoc(collection(db, 'tenants', tenantId, 'activities'), {
        ...form,
        opportunityId: opportunity.id,
        linkedFamilyName: opportunity.title,
        totalCost,
        assignedEmployeeId: user?.uid,
        assignedEmployeeName: assignedName,
        createdAt: new Date().toISOString(),
        source: 'opportunity',
      });
      setForm({ ...form, subject: '', durationMinutes: 30 });
    } catch (err) {
      console.error(err);
    }
  }

  const formatAum = (u: number) => {
    if (u >= 1e9) return `$${(u/1e9).toFixed(1)}B`;
    if (u >= 1e6) return `$${(u/1e6).toFixed(1)}M`;
    return `$${u.toLocaleString()}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex font-sans">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[500px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
        
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-start bg-zinc-50 dark:bg-zinc-900/50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] uppercase font-bold text-indigo-600 border-indigo-200 bg-indigo-50 dark:text-indigo-400 dark:border-indigo-900/50 dark:bg-indigo-900/20">{opportunity.stageName}</Badge>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{opportunity.title}</h2>
            <p className="text-sm text-zinc-500 mt-1">{opportunity.primaryContactName || 'No External Contact Linked'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition text-zinc-500"><X size={18} /></button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4 border-b border-zinc-200 dark:border-zinc-800">
           <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <div className="text-xs font-bold text-zinc-500 flex items-center justify-between mb-2">EXPECTED AUM <Target size={14}/></div>
              <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">{formatAum(opportunity.expectedAum)}</div>
           </div>
           <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
              <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center justify-between mb-2">EXP. REVENUE / YR <DollarSign size={14}/></div>
              <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300 tracking-tighter">{formatUsd(opportunity.expectedRevenue)}</div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-zinc-50/30 dark:bg-zinc-900/20 p-6 flex flex-col gap-6">
           
           <div className="flex flex-col gap-4">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                 <Activity size={16} /> Deal Activities & Time Tracking
              </h3>

              <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                 <Input 
                   placeholder="Log a touchpoint or meeting..." 
                   value={form.subject} 
                   onChange={e => setForm({...form, subject: e.target.value})}
                   className="border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
                 />
                 <div className="flex gap-2 items-center text-xs">
                    <select className="border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-900 px-2 py-1.5 focus:outline-none" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                      <option value="meeting">Meeting</option>
                      <option value="call">Call</option>
                      <option value="email">Email</option>
                      <option value="internal">Internal Analysis</option>
                      <option value="note">Note</option>
                    </select>
                    <div className="flex items-center gap-1 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 bg-zinc-50 dark:bg-zinc-900">
                       <Clock size={12} className="text-zinc-500" />
                       <input type="number" className="w-12 bg-transparent focus:outline-none" value={form.durationMinutes} onChange={e => setForm({...form, durationMinutes: parseInt(e.target.value) || 0})} />
                       <span className="text-zinc-400">min</span>
                    </div>
                    <label className="flex items-center gap-1 text-zinc-500 ml-auto cursor-pointer">
                      <input type="checkbox" checked={form.isBillable} onChange={e => setForm({...form, isBillable: e.target.checked})} /> Billable?
                    </label>
                    <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={handleAddActivity}>Log</Button>
                 </div>
              </div>

              <div className="space-y-3">
                 {activities.length === 0 && (
                   <p className="text-xs text-center text-zinc-400 py-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">No activities logged for this opportunity.</p>
                 )}
                 {activities.map(act => (
                   <div key={act.id} className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center shrink-0">
                         {act.type === 'meeting' ? '🤝' : act.type === 'call' ? '📞' : act.type === 'email' ? '✉️' : '📝'}
                      </div>
                      <div className="flex-1 min-w-0">
                         <div className="flex justify-between items-start">
                           <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">{act.subject}</div>
                           <div className="text-[10px] text-zinc-400 whitespace-nowrap">{new Date(act.createdAt).toLocaleDateString()}</div>
                         </div>
                         <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                           <span className="font-medium">{act.assignedEmployeeName}</span>
                           <span>•</span>
                           <span className="flex items-center gap-1"><Clock size={10}/> {act.durationMinutes}m</span>
                           {act.totalCost > 0 && (
                             <>
                               <span>•</span>
                               <span className="text-emerald-600 dark:text-emerald-400 font-medium">${act.totalCost.toFixed(2)}</span>
                             </>
                           )}
                         </div>
                      </div>
                   </div>
                 ))}
              </div>
           </div>

        </div>
      </div>
    </div>
  );
}
