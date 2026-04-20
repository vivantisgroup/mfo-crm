'use client';

import React from 'react';
import { ESTATE_PLANS } from '@/lib/mockData';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DataTable } from '@/components/DataTable';
import type { EstatePlan } from '@/lib/types';

export default function EstatePage() {
 return (
 <div className="page-wrapper animate-fade-in w-full px-4 lg:px-8">
 

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
