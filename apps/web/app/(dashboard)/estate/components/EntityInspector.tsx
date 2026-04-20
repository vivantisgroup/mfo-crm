import React, { useState, useEffect } from 'react';
import { X, Scale, Building2, UserCircle, HandCoins, PiggyBank, Briefcase, HeartPulse, LockKeyhole, Home, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const ICON_MAP = {
  trust: Scale,
  company: Building2,
  beneficiary: UserCircle,
  charity: HandCoins,
  tax: PiggyBank,
  insurance: HeartPulse,
  escrow: LockKeyhole,
  realestate: Home,
  offshore: MapPin
};

export default function EntityInspector({ 
  node, 
  onClose, 
  onUpdate 
}: { 
  node: any, 
  onClose: () => void, 
  onUpdate: (id: string, data: any) => void 
}) {
  const [formData, setFormData] = useState({ label: '', desc: '', amount: '' });

  useEffect(() => {
    if (node) {
      setFormData({
        label: node.data?.label || '',
        desc: node.data?.desc || '',
        amount: node.data?.amount || ''
      });
    }
  }, [node]);

  if (!node) return null;

  const Icon = (ICON_MAP as any)[node.type] || Briefcase;

  const handleSave = () => {
    onUpdate(node.id, {
      ...node.data,
      ...formData
    });
  };

  return (
    <div className="absolute top-0 right-0 h-full w-[350px] bg-white border-l border-[var(--border-subtle)] shadow-2xl z-50 flex flex-col animate-fade-in font-sans">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
         <div className="flex items-center gap-3 text-[var(--text-primary)]">
            <Icon size={20} className="text-[var(--text-secondary)]"/>
            <h3 className="font-bold text-[14px]">Entity Attributes</h3>
         </div>
         <button onClick={onClose} className="p-1 hover:bg-[var(--bg-elevated)] rounded-md text-[var(--text-secondary)] transition-colors">
            <X size={18} />
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
         <div className="flex flex-col gap-2">
            <label className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">Legal Name / Title</label>
            <Input 
              value={formData.label} 
              onChange={(e: any) => setFormData(prev => ({...prev, label: e.target.value}))}
            />
         </div>
         <div className="flex flex-col gap-2">
            <label className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">Description / Clause</label>
            <Input 
              value={formData.desc} 
              onChange={(e: any) => setFormData(prev => ({...prev, desc: e.target.value}))}
            />
         </div>
         <div className="flex flex-col gap-2">
            <label className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">Capital / Target Amount</label>
            <Input 
              value={formData.amount} 
              onChange={(e: any) => setFormData(prev => ({...prev, amount: e.target.value}))}
            />
            <span className="text-[10px] text-[var(--text-tertiary)] italic">Prefix with $ or % representation.</span>
         </div>

         <div className="w-full h-px bg-[var(--border-subtle)] my-2" />

         <div className="flex flex-col gap-3">
             <h4 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Governance Parameters</h4>
             <div className="flex justify-between items-center text-[13px] text-[var(--text-primary)] font-medium">
                Irrevocable Entity Status
                <div className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded" /> Toggle</div>
             </div>
             <div className="flex justify-between items-center text-[13px] text-[var(--text-primary)] font-medium mt-1">
                GSTT Exempt Alignment
                <div className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded" /> Toggle</div>
             </div>
         </div>
      </div>

      <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-canvas)] flex justify-end gap-2 shrink-0">
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2" onClick={onClose}>Cancel</button>
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-primary)] hover:bg-[#003833] border-none text-white h-9 px-4 py-2 shadow" onClick={handleSave}>Save Blueprint</button>
      </div>
    </div>
  );
}
