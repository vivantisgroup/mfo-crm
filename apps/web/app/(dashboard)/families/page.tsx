'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, getInitials, getTierBadgeColor, getRiskColor } from '@/lib/utils';
import { FAMILIES } from '@/lib/mockData';
import type { Family } from '@/lib/types';
import { LiveModeGate, FamiliesEmptyState } from '@/components/LiveModeGate';

export default function FamiliesPage() {
  const router = useRouter();

  const columns = [
    {
      header: 'Family',
      className: 'w-full',
      accessor: (f: Family) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="family-avatar" style={{ background: `linear-gradient(135deg, var(--bg-highlight), var(--bg-surface))`, border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            {getInitials(f.name.replace(' Family', ''))}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{f.code} · {f.domicileCountry}</div>
          </div>
        </div>
      ),
    },
    { header: 'AUM',   className: 'td-right', accessor: (f: Family) => <div style={{ fontWeight: 600 }}>{formatCurrency(f.totalAum, f.currency)}</div> },
    { header: 'Tier',  accessor: (f: Family) => <span className="badge" style={{ background: getTierBadgeColor(f.serviceTier).replace('text', 'bg'), color: getTierBadgeColor(f.serviceTier) }}>{f.serviceTier.toUpperCase()}</span> },
    { header: 'Risk',  accessor: (f: Family) => <span style={{ color: getRiskColor(f.riskProfile), fontWeight: 500, fontSize: 12, textTransform: 'capitalize' }}>• {f.riskProfile}</span> },
    { header: 'KYC / AML', accessor: (f: Family) => <div style={{ display: 'flex', gap: 6 }}><StatusBadge status={f.kycStatus} />{f.amlStatus !== 'clear' && <StatusBadge status={f.amlStatus} />}</div> },
    { header: 'Relationship Manager', accessor: (f: Family) => <div style={{ color: 'var(--text-secondary)' }}>{f.assignedRmName}</div> },
  ];

  return (
    <LiveModeGate emptyState={<FamiliesEmptyState />}>
      <div className="page animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Families</h1>
            <p className="page-subtitle">Manage family relationships, KYC, and settings</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-secondary">Export CRM</button>
            <button className="btn btn-primary">Onboard Family</button>
          </div>
        </div>
        <div className="filter-bar">
          <div className="search-input-wrap"><span>🔍</span><input type="text" placeholder="Search by name, code, or RM..." /></div>
          <select className="select-filter"><option>All Tiers</option><option>Platinum</option><option>Gold</option><option>Standard</option></select>
          <select className="select-filter"><option>KYC Status: All</option><option>Approved</option><option>In Review</option><option>Pending</option></select>
        </div>
        <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
          <DataTable data={FAMILIES} columns={columns} onRowClick={(row) => router.push(`/families/${row.id}`)} />
        </div>
      </div>
    </LiveModeGate>
  );
}
