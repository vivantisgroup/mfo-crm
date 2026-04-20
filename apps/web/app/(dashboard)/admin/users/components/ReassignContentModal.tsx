import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { type TenantMember } from '@/lib/tenantMemberService';
import { useAuth } from '@/lib/AuthContext';

export function ReassignContentModal({ 
  tenantId, 
  fromMember, 
  allMembers,
  onClose,
  onSuccess
}: { 
  tenantId: string; 
  fromMember: TenantMember; 
  allMembers: TenantMember[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState<{
    families: number;
    contacts: number;
    organizations: number;
    tasks: number;
  } | null>(null);

  const [toUid, setToUid] = useState<string>('');
  
  const [transferParams, setTransferParams] = useState({
    families: true,
    contacts: true,
    organizations: true,
    tasks: true,
  });

  const [msg, setMsg] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const db = getFirestore();
        
        const [famSnap, conSnap, orgSnap, tskSnap] = await Promise.all([
          getDocs(query(collection(db, 'tenants', tenantId, 'families'), where('assignedRmId', '==', fromMember.uid))),
          getDocs(query(collection(db, 'tenants', tenantId, 'contacts'), where('assignedTo', '==', fromMember.uid))),
          getDocs(query(collection(db, 'tenants', tenantId, 'organizations'), where('assignedRmId', '==', fromMember.uid))),
          getDocs(query(collection(db, 'bpm_tasks'), where('tenantId', '==', tenantId), where('assignedTo', '==', fromMember.uid), where('status', 'in', ['open', 'in_progress'])))
        ]);

        setCounts({
          families: famSnap.size,
          contacts: conSnap.size,
          organizations: orgSnap.size,
          tasks: tskSnap.size
        });
      } catch (err: any) {
        setMsg('❌ Failed to fetch asset counts: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantId, fromMember.uid]);

  const handleTransfer = async () => {
    if (!toUid) {
      setMsg('❌ Please select a recipient.');
      return;
    }
    if (toUid === fromMember.uid) {
      setMsg('❌ Recipient cannot be the same as the departing user.');
      return;
    }

    setSaving(true);
    setMsg('');
    const db = getFirestore();
    const batch = writeBatch(db);

    try {
      let transferredCount = 0;
      const targetUser = allMembers.find(m => m.uid === toUid);
      const targetName = targetUser?.displayName || 'Unknown';

      if (transferParams.families) {
        const snap = await getDocs(query(collection(db, 'tenants', tenantId, 'families'), where('assignedRmId', '==', fromMember.uid)));
        snap.forEach(d => {
          batch.update(d.ref, { assignedRmId: toUid, assignedRmName: targetName });
          transferredCount++;
        });
      }
      if (transferParams.contacts) {
        const snap = await getDocs(query(collection(db, 'tenants', tenantId, 'contacts'), where('assignedTo', '==', fromMember.uid)));
        snap.forEach(d => {
          batch.update(d.ref, { assignedTo: toUid, assignedToName: targetName });
          transferredCount++;
        });
      }
      if (transferParams.organizations) {
        const snap = await getDocs(query(collection(db, 'tenants', tenantId, 'organizations'), where('assignedRmId', '==', fromMember.uid)));
        snap.forEach(d => {
          batch.update(d.ref, { assignedRmId: toUid, assignedRmName: targetName });
          transferredCount++;
        });
      }
      if (transferParams.tasks) {
        const snap = await getDocs(query(collection(db, 'bpm_tasks'), where('tenantId', '==', tenantId), where('assignedTo', '==', fromMember.uid), where('status', 'in', ['open', 'in_progress'])));
        snap.forEach(d => {
          batch.update(d.ref, { assignedTo: toUid });
          transferredCount++;
        });
      }

      // Log the transfer
      const auditRef = doc(collection(db, 'audit_logs'));
      batch.set(auditRef, {
        action: 'content_reassignment',
        performerId: user?.uid,
        fromUid: fromMember.uid,
        toUid: toUid,
        tenantId,
        transferredItemsCount: transferredCount,
        timestamp: new Date().toISOString()
      });

      await batch.commit();
      onSuccess();
    } catch (err: any) {
      setMsg('❌ Reassignment failed: ' + err.message);
      setSaving(false);
    }
  };

  const eligibleRecipients = allMembers.filter(m => m.uid !== fromMember.uid && m.status === 'active');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 600, maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-elevated)', borderRadius: 20, border: '1px solid var(--border)', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '22px 26px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>🔄 Reassign Content</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Transfer ownership of assets from <strong>{fromMember.displayName}</strong> to another member.
          </div>
        </div>

        <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: msg.startsWith('❌') ? '#ef444415' : '#22c55e15', color: msg.startsWith('❌') ? '#ef4444' : '#22c55e' }}>{msg}</div>}

          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)' }}>Calculating assets...</div>
          ) : (
            <>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>Assets to Transfer</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: transferParams.families ? '#6366f108' : 'var(--bg-canvas)' }}>
                    <input type="checkbox" checked={transferParams.families} onChange={e => setTransferParams(p => ({ ...p, families: e.target.checked }))} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Families</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{counts?.families} records</div>
                    </div>
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: transferParams.organizations ? '#6366f108' : 'var(--bg-canvas)' }}>
                    <input type="checkbox" checked={transferParams.organizations} onChange={e => setTransferParams(p => ({ ...p, organizations: e.target.checked }))} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Organizations</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{counts?.organizations} records</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: transferParams.tasks ? '#6366f108' : 'var(--bg-canvas)' }}>
                    <input type="checkbox" checked={transferParams.tasks} onChange={e => setTransferParams(p => ({ ...p, tasks: e.target.checked }))} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Active Tasks</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{counts?.tasks} open tasks</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: transferParams.contacts ? '#6366f108' : 'var(--bg-canvas)' }}>
                    <input type="checkbox" checked={transferParams.contacts} onChange={e => setTransferParams(p => ({ ...p, contacts: e.target.checked }))} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Contacts</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{counts?.contacts} records</div>
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Recipient Member</div>
                <select className="input" style={{ width: '100%' }} value={toUid} onChange={e => setToUid(e.target.value)}>
                  <option value="">-- Select Recipient --</option>
                  {eligibleRecipients.map(r => (
                    <option key={r.uid} value={r.uid}>{r.displayName} ({r.role})</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '0 26px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleTransfer} disabled={saving || loading || !toUid || (counts ? Object.values(counts).every(c => c === 0) : false)}>
            {saving ? 'Transferring...' : 'Transfer Selected Assets'}
          </button>
        </div>
      </div>
    </div>
  );
}
