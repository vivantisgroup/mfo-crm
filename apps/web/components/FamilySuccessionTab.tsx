import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ESTATE_PLANS } from '@/lib/mockData';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DataTable } from '@/components/DataTable';
import type { EstatePlan } from '@/lib/types';

export function FamilySuccessionTab({ tenantId, familyId }: { tenantId: string; familyId: string }) {
  // For now, filtering mock data or just returning local state if needed.
  // We can fetch remote plans if available, but falling back to ESTATE_PLANS.
  const [plans, setPlans] = useState<EstatePlan[]>(
    ESTATE_PLANS.filter(p => p.familyId === familyId)
  );

  return (
    <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card flex flex-col justify-between mt-6">
      <div className="card-header border-b border-tremor-border p-4 flex items-center justify-between">
        <h2 className="card-title font-bold text-slate-800 m-0">Succession & Estate Planning</h2>
        <button className="btn btn-primary btn-sm">+ Add Plan</button>
      </div>
      <div className="p-0 overflow-hidden">
        {plans.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <span className="text-3xl block mb-2">⚖️</span>
            <div>No succession plans configured for this family.</div>
          </div>
        ) : (
          <DataTable
            data={plans}
            columns={[
              { header: 'Structure', accessor: (p: EstatePlan) => (
                <div>
                  <div className="font-semibold text-slate-900">{p.entityName}</div>
                  <div className="text-xs text-slate-500 mt-1">{p.planType} · {p.jurisdiction}</div>
                </div>
              )},
              { header: 'Estimated Value', className: 'td-right text-right', accessor: (p: EstatePlan) => <span className="font-semibold">{formatCurrency(p.estimatedEstateValue, 'USD', true)}</span> },
              { header: 'Est. Tax Liability', className: 'td-right text-right', accessor: (p: EstatePlan) => <span className="text-rose-600 font-medium">{formatCurrency(p.estimatedTaxLiability, 'USD', true)}</span> },
              { header: 'Primary Beneficiaries', accessor: (p: EstatePlan) => <span className="text-xs text-slate-600">{p.primaryBeneficiaries.join(', ')}</span> },
              { header: 'Last Reviewed', className: 'td-right text-right', accessor: (p: EstatePlan) => <span className="text-slate-400 text-sm whitespace-nowrap">{formatDate(p.lastReviewedDate || '')}</span> },
            ]}
          />
        )}
      </div>
    </div>
  );
}
