'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { UserPlus, Trash2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Advisor {
  id: string;
  name: string;
  email: string;
  tenantMemberUid: string;
  employeeId?: string;
  createdAt?: string;
}

interface TenantMember {
  uid: string;
  email: string;
  metadata?: {
    firstName?: string;
    lastName?: string;
  };
}

export function AdvisorListView() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id;
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [tenantMembers, setTenantMembers] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMemberUid, setSelectedMemberUid] = useState('');

  useEffect(() => {
    if (!tenantId) return;

    // Fetch Advisors
    const unsubAdvisors = onSnapshot(collection(db, 'tenants', tenantId, 'advisors'), (snap) => {
      setAdvisors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Advisor)));
      setLoading(false);
    });

    // Fetch Tenant Members (the users who can be advisors)
    const unsubMembers = onSnapshot(collection(db, 'tenants', tenantId, 'members'), (snap) => {
      setTenantMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as TenantMember)));
    });

    return () => {
      unsubAdvisors();
      unsubMembers();
    };
  }, [tenantId]);

  const handleAddAdvisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !selectedMemberUid) return;

    const member = tenantMembers.find(m => m.uid === selectedMemberUid);
    if (!member) return;

    const name = member.metadata?.firstName ? `${member.metadata.firstName} ${member.metadata.lastName || ''}`.trim() : member.email;

    try {
      const advRef = doc(collection(db, 'tenants', tenantId, 'advisors'));
      await setDoc(advRef, {
        name,
        email: member.email,
        tenantMemberUid: member.uid,
        createdAt: new Date().toISOString()
      });
      setShowAddModal(false);
      setSelectedMemberUid('');
    } catch (error) {
      console.error('Failed to add advisor', error);
      toast.error('Failed to add advisor.');
    }
  };

  const handleRemoveAdvisor = async (id: string) => {
    if (!tenantId || !confirm('Are you sure you want to remove this advisor? They will be unassigned from any family groups they manage in future workflows.')) return;
    try {
      await deleteDoc(doc(db, 'tenants', tenantId, 'advisors', id));
    } catch (err) {
      console.error('Failed to remove advisor', err);
    }
  };

  if (loading) return <div className="p-8 text-center text-tremor-content">Loading advisors...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-tremor-content-strong flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" />
            Relationship Managers (Advisors)
          </h2>
          <p className="text-sm text-tremor-content mt-1">
            Manage the list of internal staff or external partners authorized to act as Relationship Managers for Family Groups.
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="gap-2"><UserPlus size={16} /> Add Advisor</Button>
      </div>

      <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card overflow-hidden">
        {advisors.length === 0 ? (
          <div className="p-12 text-center text-tremor-content">
            <UserPlus className="w-12 h-12 mx-auto text-tremor-content-subtle mb-3" />
            <div className="text-lg font-medium text-tremor-content-strong">No advisors recorded</div>
            <p className="mt-1">Add your first advisor to assign them to family groups.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-tremor-background-muted border-b border-tremor-border">
              <tr>
                <th className="px-6 py-3 font-medium text-tremor-content">Name</th>
                <th className="px-6 py-3 font-medium text-tremor-content">Email</th>
                <th className="px-6 py-3 font-medium text-tremor-content">Platform ID</th>
                <th className="px-6 py-3 font-medium text-tremor-content text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tremor-border">
              {advisors.map(adv => (
                <tr key={adv.id} className="hover:bg-tremor-background-muted/50">
                  <td className="px-6 py-4 font-medium text-tremor-content-strong">{adv.name}</td>
                  <td className="px-6 py-4 text-tremor-content">{adv.email}</td>
                  <td className="px-6 py-4 text-tremor-content text-xs font-mono">{adv.tenantMemberUid}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleRemoveAdvisor(adv.id)}
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                      title="Remove Advisor"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-tremor-default shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-tremor-border flex justify-between items-center">
              <h3 className="font-bold text-tremor-content-strong text-lg flex items-center gap-2">
                <UserPlus size={18} />
                Add New Advisor
              </h3>
            </div>
            
            <form onSubmit={handleAddAdvisor} className="p-4 py-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-tremor-content-strong mb-1.5">
                  Select Platform User
                </label>
                <select
                  required
                  value={selectedMemberUid}
                  onChange={e => setSelectedMemberUid(e.target.value)}
                  className="w-full rounded-tremor-default border border-tremor-border px-3 py-2 text-sm focus:ring-2 focus:ring-tremor-brand focus:border-transparent outline-none bg-white"
                >
                  <option value="">-- Choose a tenant member --</option>
                  {tenantMembers.map(m => {
                    const existing = advisors.find(a => a.tenantMemberUid === m.uid);
                    return (
                      <option key={m.uid} value={m.uid} disabled={!!existing}>
                        {m.metadata?.firstName ? `${m.metadata.firstName} ${m.metadata.lastName || ''}` : m.email} {existing && '(Already Advisor)'}
                      </option>
                    )
                  })}
                </select>
                <p className="text-xs text-tremor-content mt-2">
                  Advisors must have a platform user account to communicate with clients through the portal.
                </p>
              </div>

              <div className="pt-4 mt-2 border-t border-tremor-border flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-tremor-content hover:bg-tremor-background-subtle rounded-tremor-default transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedMemberUid}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-tremor-default transition-colors shadow-sm"
                >
                  Confirm & Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
