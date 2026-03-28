'use client';

import React from 'react';
import { ESTATE_PLANS } from '@/lib/mockData';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DataTable } from '@/components/DataTable';
import type { EstatePlan } from '@/lib/types';

export default function EstatePage() {
  return (
    <div className="page-wrapper animate-fade-in mx-auto max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 pb-5 border-b border-tremor-border gap-4">
        <div>
          <h1 className="text-3xl font-bold text-tremor-content-strong tracking-tight">Estate & Succession</h1>
            <p className="mt-2 text-tremor-content">Track estate plans, structures, and next-generation planning</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary">Tax Impact Analysis</button>
          <button className="btn btn-primary">Add Estate Structure</button>
        </div>
      </div>

      <div className="card mt-6">
        <DataTable
          data={ESTATE_PLANS}
          columns={[
            { header: 'Family', accessor: (p: EstatePlan) => <span className="fw-600 text-brand">{p.familyName}</span> },
            { header: 'Structure', accessor: (p: EstatePlan) => (
              <div>
                <div className="fw-600">{p.entityName}</div>
                <div className="text-xs text-secondary mt-1">{p.planType} · {p.jurisdiction}</div>
              </div>
            )},
            { header: 'Estimated Value', className: 'td-right', accessor: (p: EstatePlan) => <span className="fw-600">{formatCurrency(p.estimatedEstateValue, 'USD', true)}</span> },
            { header: 'Est. Tax Liability', className: 'td-right', accessor: (p: EstatePlan) => <span className="text-red">{formatCurrency(p.estimatedTaxLiability, 'USD', true)}</span> },
            { header: 'Primary Beneficiaries', accessor: (p: EstatePlan) => <span className="text-xs text-secondary">{p.primaryBeneficiaries.join(', ')}</span> },
            { header: 'Last Reviewed', className: 'td-right', accessor: (p: EstatePlan) => <span className="text-tertiary">{formatDate(p.lastReviewedDate || '')}</span> },
          ]}
        />
      </div>

    </div>
  );
}
