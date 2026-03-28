'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FAMILIES, BALANCE_SHEETS } from '@/lib/mockData';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, getInitials, getRiskColor, formatDate } from '@/lib/utils';
import { AssetAllocationChart } from '@/components/AssetAllocationChart';
import { ContactRelationshipGraph } from '@/components/ContactRelationshipGraph';
import { SuitabilityAssessment } from '@/components/SuitabilityAssessment';
import { InvestmentAdvisory } from '@/components/InvestmentAdvisory';
import { CommunicationPanel } from '@/components/CommunicationPanel';

export default function FamilyDetailPage() {
  const params   = useParams();
  const router   = useRouter();
  const familyId = params.id as string;
  const family   = FAMILIES.find(f => f.id === familyId);
  const bs       = BALANCE_SHEETS.find(b => b.familyId === familyId);
  const [activeTab, setActiveTab] = useState('overview');
  const [tenantId, setTenantId]   = useState('');

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
      if (t?.id) setTenantId(t.id);
    } catch { /* ignore */ }
  }, []);

  if (!family) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <div className="empty-state-title">Client Not Found</div>
        <button className="btn btn-secondary mt-4" onClick={() => router.push('/clients')}>← Back to Clients</button>
      </div>
    );
  }

  return (
    <div className="page animate-fade-in" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600 }}>
        <button onClick={() => router.push('/clients')} style={{ background: 'none', border: 'none', color: 'var(--brand-400)', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Clients</button>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>{family.name}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <button className="btn btn-secondary btn-sm">Edit Client</button>
        <button className="btn btn-primary btn-sm">Generate Report</button>
      </div>

      <div className="tabs" style={{ marginBottom: 24, borderBottom: '1px solid var(--border)', display: 'flex', gap: 0, overflowX: 'auto' }}>
        {['overview', 'communications', 'members', 'entities', 'network', 'suitability', 'advisory', 'tickets', 'settings'].map(t => (
          <button
            key={t}
            className={`tab ${activeTab === t ? 'active' : ''}`}
            onClick={() => setActiveTab(t)}
            style={{ padding:'10px 18px', fontSize:13, background:'none', border:'none', borderBottom:`2px solid ${activeTab===t?'var(--brand-500)':'transparent'}`, cursor:'pointer', whiteSpace:'nowrap', color:activeTab===t?'var(--brand-500)':'var(--text-secondary)', textTransform: 'capitalize' }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 24, flex: 1, minHeight: 0 }}>
        {activeTab === 'overview' && (
          <div className="grid-3-1">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="grid-2">
                <StatCard label="Total AUM" value={formatCurrency(family.totalAum, family.currency, true)} />
                <StatCard label="Risk Profile" value={family.riskProfile.toUpperCase()} 
                  icon={<span style={{ color: getRiskColor(family.riskProfile) }}>●</span>} 
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
                  <div className="text-sm fw-500">{family.assignedRmName}</div>
                </div>
                <div>
                  <div className="text-xs text-tertiary fw-600 mb-1">COMPLIANCE STATUS</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <StatusBadge status={family.kycStatus} label={`KYC: ${family.kycStatus}`} />
                    <StatusBadge status={family.amlStatus} label={`AML: ${family.amlStatus}`} />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-tertiary fw-600 mb-1">LAST ACTIVITY</div>
                  <div className="text-sm">{formatDate(family.lastActivityAt)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="grid-3">
            {family.members.map(m => (
              <div key={m.id} className="card">
                <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div className="avatar" style={{ width: 48, height: 48, fontSize: 16 }}>
                    {getInitials(`${m.firstName} ${m.lastName}`)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className="text-sm fw-600">{m.firstName} {m.lastName}</div>
                      {m.pepFlag && <span className="badge badge-warning">PEP</span>}
                    </div>
                    <div className="text-xs text-secondary mt-1">{m.roleInFamily} · Gen {m.generation}</div>
                    <div className="mt-4" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {m.email && <div className="text-xs text-secondary flex items-center gap-2"><span>✉</span> {m.email}</div>}
                      <div className="text-xs text-secondary flex items-center gap-2"><span>🛂</span> {m.nationality?.join(', ')}</div>
                      <div className="text-xs mt-2"><StatusBadge status={m.kycStatus} label={`KYC: ${m.kycStatus}`} /></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'entities' && (
          <div className="table-wrap card">
            <table>
              <thead>
                <tr>
                  <th>Entity Name</th>
                  <th>Type</th>
                  <th>Jurisdiction</th>
                  <th>Status</th>
                  <th className="td-right">Total Value</th>
                </tr>
              </thead>
            <tbody>
              {family.entities.map(e => (
                <tr key={e.id}>
                  <td className="fw-500">{e.name}</td>
                  <td><span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{e.entityType.replace('_', ' ')}</span></td>
                  <td className="text-secondary">{e.jurisdiction}</td>
                  <td><StatusBadge status={e.status} /></td>
                  <td className="td-right fw-500">{e.totalValue ? formatCurrency(e.totalValue, e.currency) : '-'}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}

        {activeTab === 'network' && tenantId && (
          <ContactRelationshipGraph tenantId={tenantId} familyId={familyId} />
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
            family={family} 
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
