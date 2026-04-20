import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building2 } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function NewFamilyGroupModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { tenant } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    currency: 'USD',
    riskProfile: 'moderate',
    serviceTier: 'standard',
    jurisdiction: ''
  });

  const handleSave = async () => {
    if (!tenant?.id || !form.name) return;
    setSaving(true);
    try {
      const docRef = await addDoc(collection(db, 'tenants', tenant.id, 'organizations'), {
        ...form,
        type: 'family_group',
        aum: 0,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      onOpenChange(false);
      router.push(`/families/${docRef.id}`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to create family group');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
             <Building2 className="text-indigo-500" size={24} />
             Create Family Group
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Family Name</label>
            <input 
               value={form.name}
               onChange={e => setForm({...form, name: e.target.value})}
               className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
               placeholder="e.g. The Smith Legacy"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Currency</label>
              <select 
                 value={form.currency}
                 onChange={e => setForm({...form, currency: e.target.value})}
                 className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="BRL">BRL</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Risk Profile</label>
              <select 
                 value={form.riskProfile}
                 onChange={e => setForm({...form, riskProfile: e.target.value})}
                 className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="conservative">Conservative</option>
                <option value="moderate">Moderate</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="grid gap-2">
               <label className="text-sm font-medium">Service Tier</label>
               <select 
                  value={form.serviceTier}
                  onChange={e => setForm({...form, serviceTier: e.target.value})}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
               >
                 <option value="standard">Standard</option>
                 <option value="premium">Premium</option>
                 <option value="select">Select</option>
               </select>
             </div>
             <div className="grid gap-2">
               <label className="text-sm font-medium">Jurisdiction</label>
               <input 
                  value={form.jurisdiction}
                  onChange={e => setForm({...form, jurisdiction: e.target.value})}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="e.g. US, UK, CH"
               />
             </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name || saving}>
             {saving ? 'Creating...' : 'Create Family'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
