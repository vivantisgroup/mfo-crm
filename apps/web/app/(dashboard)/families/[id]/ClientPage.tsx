'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FAMILIES, BALANCE_SHEETS, NETWORK_NODES, RELATIONSHIP_EDGES } from '@/lib/mockData';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, getInitials, getRiskColor, formatDate } from '@/lib/utils';
import { AssetAllocationChart } from '@/components/AssetAllocationChart';
import { RelationshipsTab } from '@/components/RelationshipsTab';
import { SuitabilityAssessment } from '@/components/SuitabilityAssessment';
import { InvestmentAdvisory } from '@/components/InvestmentAdvisory';

export default function FamilyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const familyId = params.id as string;
  const family = FAMILIES.find(f => f.id === familyId);
  const bs = BALANCE_SHEETS.find(b => b.familyId === familyId);
  const [activeTab, setActiveTab] = useState('overview');

  if (!family) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <div className="empty-state-title">Family Not Found</div>
        <button className="btn btn-secondary mt-4" onClick={() => router.push('/families')}>← Back to Families</button>
      </div>
    );
  }

  // Filter Network Nodes logic: Show nodes relevant to this family or where relation exists
  const relevantNodes = NETWORK_NODES.filter(n => n.familyId === familyId || n.nodeType === 'provider');
  const relevantNodeIds = new Set(relevantNodes.map(n => n.id));
  const relevantEdges = RELATIONSHIP_EDGES.filter(e => relevantNodeIds.has(e.sourceId) || relevantNodeIds.has(e.targetId));

  return (
    <div className="page animate-fade-in">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <button className="icon-btn" onClick={() => router.push('/families')} title="Back to list">
            ←
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 className="page-title" style={{ margin: 0 }}>{family.name}</h1>
              <span className={`badge badge-${family.serviceTier === 'platinum' ? 'platinum' : family.serviceTier === 'gold' ? 'gold' : 'neutral'}`}>
                {family.serviceTier.toUpperCase()}
              </span>
            </div>
            <p className="page-subtitle" style={{ marginTop: 6 }}>
              {family.code} · Domiciled in {family.domicileCountry} · Inception {formatDate(family.inceptionDate || '')}
            </p>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary">Edit Family</button>
          <button className="btn btn-primary">Generate Report</button>
        </div>
      </div>

      <div className="tabs">
        {['overview', 'members', 'entities', 'network', 'suitability', 'advisory', 'settings'].map(t => (
          <button
            key={t}
            className={`tab ${activeTab === t ? 'active' : ''}`}
            onClick={() => setActiveTab(t)}
            style={{ background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        {activeTab === 'overview' && (
          <div className="grid-3-1">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="grid-2">
                <StatCard label="Total AUM" value={formatCurrency(family.totalAum, family.currency, true)} />
                <StatCard label="Risk Profile" value={family.riskProfile.toUpperCase()} 
                  icon={<span style={{ color: getRiskColor(family.riskProfile) }}>●</span>} 
                />
              </div>
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Allocation Overview</h2>
                </div>
                <div className="card-body">
                  {bs ? <AssetAllocationChart data={bs.allocation} /> : <div className="text-secondary">No allocation data</div>}
                </div>
              </div>
            </div>
            
            <div className="card">
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

        {activeTab === 'network' && (
          <RelationshipsTab 
            nodes={relevantNodes} 
            edges={relevantEdges} 
            familyId={familyId} 
          />
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
      </div>
    </div>
  );
}
