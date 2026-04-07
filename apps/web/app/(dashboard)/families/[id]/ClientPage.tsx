'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BALANCE_SHEETS } from '@/lib/mockData';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, getInitials, getRiskColor, formatDate } from '@/lib/utils';
import { AssetAllocationChart } from '@/components/AssetAllocationChart';
import { ContactRelationshipGraph } from '@/components/ContactRelationshipGraph';
import { SuitabilityAssessment } from '@/components/SuitabilityAssessment';
import { InvestmentAdvisory } from '@/components/InvestmentAdvisory';
import { CommunicationPanel } from '@/components/CommunicationPanel';
import { SecondaryDock } from '@/components/SecondaryDock';
import { usePageTitle } from '@/lib/PageTitleContext';

export default function FamilyDetailPage() {
  const params   = useParams();
  const router   = useRouter();
  const familyId = params.id as string;
  const bs       = BALANCE_SHEETS.find(b => b.familyId === familyId);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [tenantId, setTenantId]   = useState('');
  const [family, setFamily] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
      if (t?.id) setTenantId(t.id);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!tenantId || !familyId) return;
    const unsub = onSnapshot(doc(db, 'tenants', tenantId, 'organizations', familyId), snap => {
      if(snap.exists()) setFamily({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
    return unsub;
  }, [tenantId, familyId]);

  const { setTitle } = usePageTitle();
  useEffect(() => {
    if (family) {
      setTitle('Family Profile', '', [
        { label: 'Families', onClick: () => router.push('/families') },
        { label: family.name }
      ]);
    }
  }, [family, router, setTitle]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading Family Group...</div>;
  }

  if (!family) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <div className="empty-state-title">Family Group Not Found</div>
        <button className="btn btn-secondary mt-4" onClick={() => router.push('/families')}>← Back to Families</button>
      </div>
    );
  }

  return (
    <div className="page animate-fade-in" style={{ width: '100%', padding: '0 24px', paddingBottom: 60 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/relationships/organizations/${family.id}`)}>View Base Entity</button>
        <button className="btn btn-primary btn-sm">Generate Report</button>
      </div>

      <div style={{ marginBottom: 24, paddingBottom: 16 }}>
        <SecondaryDock 
          tabs={[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'communications', label: 'Comms', icon: '💬' },
            { id: 'members', label: 'Members', icon: '👥' },
            { id: 'entities', label: 'Entities', icon: '🏢' },
            { id: 'network', label: 'Network', icon: '🔗' },
            { id: 'suitability', label: 'Suitability', icon: '🛡️' },
            { id: 'advisory', label: 'Advisory', icon: '💡' },
            { id: 'tickets', label: 'Tickets', icon: '🎫' },
            { id: 'settings', label: 'Settings', icon: '⚙️' }
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      <div style={{ marginTop: 24, flex: 1, minHeight: 0 }}>
        {activeTab === 'overview' && (
          <div className="grid-3-1">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="grid-2">
                <StatCard label="Total AUM" value={formatCurrency(family.aum || 0, family.currency || 'USD', true)} />
                <StatCard label="Risk Profile" value={(family.riskProfile || 'moderate').toUpperCase()} 
                  icon={<span style={{ color: getRiskColor(family.riskProfile || 'moderate') }}>●</span>} 
                />
              </div>
              <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6">
                <div className="card-header">
                  <h2 className="card-title">Allocation Overview</h2>
                </div>
                <div className="card-body">
                  {bs ? <AssetAllocationChart data={bs.allocation} /> : <div className="text-secondary">No allocation data</div>}
                </div>
              </div>
            </div>
            
            <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6">
              <div className="card-header">
                <h2 className="card-title">Key Details</h2>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div className="text-xs text-tertiary fw-600 mb-1">RELATIONSHIP MANAGER</div>
                  <div className="text-sm fw-500">{family.assignedRmName || 'Unassigned'}</div>
                </div>
                <div>
                  <div className="text-xs text-tertiary fw-600 mb-1">COMPLIANCE STATUS</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <StatusBadge status={family.kycStatus || 'pending'} label={`KYC: ${family.kycStatus || 'pending'}`} />
                    <StatusBadge status={family.amlStatus || 'pending'} label={`AML: ${family.amlStatus || 'pending'}`} />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-tertiary fw-600 mb-1">LAST ACTIVITY</div>
                  <div className="text-sm">{family.lastActivityAt ? formatDate(family.lastActivityAt) : 'No recent activity'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
              Contacts in this Family Group
            </div>
            {!family.linkedContactNames?.length ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                <span style={{ fontSize: 32 }}>👥</span>
                <div style={{ marginTop: 8 }}>No members linked to this family yet.</div>
              </div>
            ) : family.linkedContactNames.map((n: string, i: number) => (
              <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                  {n[0]?.toUpperCase()}
                </div>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{n}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'entities' && (
          <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
              Connected Entities
            </div>
            {!family.linkedOrgNames?.length ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                <span style={{ fontSize: 32 }}>🏢</span>
                <div style={{ marginTop: 8 }}>No corporate entities linked yet.</div>
              </div>
            ) : family.linkedOrgNames.map((n: string, i: number) => (
              <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                  {n[0]?.toUpperCase()}
                </div>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{n}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'network' && tenantId && (
          <ContactRelationshipGraph tenantId={tenantId} focusOrgId={familyId} />
        )}
        {activeTab === 'network' && !tenantId && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading graph…</div>
        )}

        {activeTab === 'suitability' && (
          <SuitabilityAssessment 
            familyId={familyId} 
          />
        )}

        {activeTab === 'advisory' && (
          <InvestmentAdvisory 
            family={{...family, totalAum: family.aum}} 
            balanceSheet={bs}
          />
        )}

        {activeTab === 'communications' && (
          <div style={{ height: 600 }}>
            <CommunicationPanel
              familyId={family.id}
              familyName={family.name}
            />
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6">
            <div className="card-header">
              <h2 className="card-title">Support Tickets</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => router.push('/tasks')}>New Ticket</button>
            </div>
            <div className="card-body" style={{ padding: '0 20px' }}>
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🎫</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Please use the main tasks queue to view specific tickets.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
