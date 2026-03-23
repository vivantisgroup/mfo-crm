'use client';

import React, { useState } from 'react';
import { StatCard } from '@/components/StatCard';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { PerformanceChart } from '@/components/PerformanceChart';
import { AssetAllocationChart } from '@/components/AssetAllocationChart';
import { formatCurrency, formatPercent, formatMultiple } from '@/lib/utils';
import { ACCOUNTS, PRIVATE_INVESTMENTS, BALANCE_SHEETS, getPerformanceHistory, HOLDINGS } from '@/lib/mockData';
import { LiveModeGate, PortfolioEmptyState } from '@/components/LiveModeGate';

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState('accounts');

  const stats = {
    totalValue: BALANCE_SHEETS[0].totalNetWorth,
    liquid: BALANCE_SHEETS[0].liquidityProfile.dailyLiquid,
    illiquid: BALANCE_SHEETS[0].liquidityProfile.locked,
    ytd: BALANCE_SHEETS[0].twrYtd,
  };

  const allocs = BALANCE_SHEETS[0].allocation;
  const history = getPerformanceHistory('fam-001');

  return (
    <LiveModeGate emptyState={<PortfolioEmptyState />}>
    <div className="page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Portfolio Consolidation</h1>
          <p className="page-subtitle">Smith Family Holdings across 4 custodians & 3 entities</p>
        </div>
        <div className="page-actions">
          <select className="select-filter" defaultValue="fam-001">
            <option value="fam-001">Smith Family</option>
            <option value="fam-002">Rodríguez Family</option>
            <option value="fam-003">Chen Family</option>
            <option value="fam-004">Al-Rashid Family</option>
          </select>
          <button className="btn btn-secondary">Sync Custodians</button>
        </div>
      </div>

      <div className="grid-4 mb-6">
        <StatCard label="Total Portfolio Value" value={formatCurrency(stats.totalValue, 'USD', true)} trendValue="+8.34% YTD" trendDirection="up" icon="📈" />
        <StatCard label="TWR Inception" value={formatPercent(BALANCE_SHEETS[0].twrInception)} trendValue="vs 6.1% bench" trendDirection="up" icon="⚡" />
        <StatCard label="Daily Liquid" value={formatCurrency(stats.liquid, 'USD', true)} trendValue={`${(stats.liquid/stats.totalValue*100).toFixed(1)}% of total`} icon="💧" />
        <StatCard label="Locked / PE" value={formatCurrency(stats.illiquid, 'USD', true)} trendValue={`${(stats.illiquid/stats.totalValue*100).toFixed(1)}% of total`} icon="🔒" />
      </div>

      <div className="grid-2 mb-6">
        <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <h2 className="card-title">Performance vs Benchmark</h2>
          </div>
          <div className="card-body" style={{ flex: 1, padding: '16px 20px 20px' }}>
            <PerformanceChart data={history} />
          </div>
        </div>
        
        <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <h2 className="card-title">Asset Allocation</h2>
          </div>
          <div className="card-body" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '300px' }}>
              <AssetAllocationChart data={allocs} />
            </div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {['accounts', 'holdings', 'private investments'].map(t => (
          <button
            key={t}
            className={`tab ${activeTab === t ? 'active' : ''}`}
            onClick={() => setActiveTab(t)}
            style={{ textTransform: 'capitalize', background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="card mt-6" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
        {activeTab === 'accounts' && (
          <DataTable
            data={ACCOUNTS.filter(a => a.familyId === 'fam-001')}
            columns={[
              { header: 'Account Name', accessor: a => <span className="fw-600">{a.accountName}</span> },
              { header: 'Number', accessor: a => <span className="td-mono">{a.accountNumber}</span> },
              { header: 'Custodian', accessor: a => <span className="text-secondary">{a.custodianName}</span> },
              { header: 'Type', accessor: a => <StatusBadge status={a.accountType} /> },
              { header: 'Balance', className: 'td-right', accessor: a => <span className="fw-600">{formatCurrency(a.currentBalance, a.currency)}</span> },
            ]}
          />
        )}

        {activeTab === 'holdings' && (
          <DataTable
            data={HOLDINGS.filter(h => h.familyId === 'fam-001')}
            columns={[
              { header: 'Security', accessor: h => (
                <div>
                  <div className="fw-600">{h.securityName}</div>
                  <div className="text-xs text-secondary mt-1">{h.ticker || h.isin || 'Private'}</div>
                </div>
              )},
              { header: 'Asset Class', accessor: h => <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{h.assetClass.replace('_', ' ')}</span> },
              { header: 'Qty', className: 'td-right', accessor: h => h.quantity ? h.quantity.toLocaleString() : '-' },
              { header: 'Price', className: 'td-right', accessor: h => h.price ? formatCurrency(h.price, h.currency) : '-' },
              { header: 'Market Value (USD)', className: 'td-right', accessor: h => <span className="fw-600">{formatCurrency(h.marketValueUsd, 'USD')}</span> },
              { header: 'Unrealized P&L', className: 'td-right', accessor: h => {
                if (!h.unrealizedPnl) return '-';
                const isPos = h.unrealizedPnl > 0;
                return <span className={isPos ? 'text-green' : 'text-red'}>{isPos ? '+' : ''}{formatCurrency(h.unrealizedPnl, 'USD')} ({h.unrealizedPnlPct}%)</span>
              }},
            ]}
          />
        )}

        {activeTab === 'private investments' && (
          <DataTable
            data={PRIVATE_INVESTMENTS.filter(p => p.familyId === 'fam-001')}
            columns={[
              { header: 'Fund Name', accessor: p => <span className="fw-600">{p.investmentName}</span> },
              { header: 'Manager', accessor: p => <span className="text-secondary">{p.fundManager}</span> },
              { header: 'Vintage', accessor: p => p.vintageYear },
              { header: 'Commitment', className: 'td-right', accessor: p => formatCurrency(p.commitmentAmount, p.currency) },
              { header: 'Unfunded', className: 'td-right', accessor: p => formatCurrency(p.unfundedCommitment, p.currency) },
              { header: 'NAV', className: 'td-right', accessor: p => <span className="fw-600 text-brand">{formatCurrency(p.currentNav, p.currency)}</span> },
              { header: 'MOIC / IRR', className: 'td-right', accessor: p => (
                <div>
                  <div className="fw-500">{p.moic ? formatMultiple(p.moic) : '-'}</div>
                  <div className="text-xs text-green mt-1">{p.irr ? formatPercent(p.irr) : '-'}</div>
                </div>
              )},
            ]}
          />
        )}
      </div>
    </div>
    </LiveModeGate>
  );
}
