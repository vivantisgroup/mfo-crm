'use client';

import React, { useState } from 'react';
import { RESEARCH_NOTES, CASH_POSITIONS } from '@/lib/mockData';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Family, ConsolidatedBalanceSheet } from '@/lib/types';

interface InvestmentAdvisoryProps {
  family: Family;
  balanceSheet?: ConsolidatedBalanceSheet;
}

export function InvestmentAdvisory({ family, balanceSheet }: InvestmentAdvisoryProps) {
  const [activeSubTab, setActiveSubTab] = useState<'strategy' | 'treasury' | 'research'>('strategy');

  return (
    <div className="card animate-fade-in" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="card-header" style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="card-title">Investment & Treasury Advisory</h2>
          <p className="text-secondary text-sm">Strategic wealth management and liquidity optimization for {family.name}.</p>
        </div>
        <div style={{ display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 4 }}>
          {['strategy', 'treasury', 'research'].map(t => (
            <button 
              key={t}
              className={`btn btn-sm ${activeSubTab === t ? 'btn-secondary' : 'btn-ghost'}`} 
              onClick={() => setActiveSubTab(t as any)} 
              style={{ border: 'none', textTransform: 'capitalize' }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="card-body" style={{ padding: 32 }}>
        {activeSubTab === 'strategy' && (
          <div className="grid-2" style={{ gap: 32 }}>
            <div>
              <h3 className="fw-600 text-primary mb-4">Current Asset Allocation</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {balanceSheet?.allocation.map(a => (
                  <div key={a.assetClass} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span className="text-secondary" style={{ textTransform: 'capitalize' }}>{a.assetClass.replace('_', ' ')}</span>
                      <span className="fw-600">{a.pct}%</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${a.pct}%`, background: a.color || 'var(--brand-500)' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="alert alert-warning mt-8" style={{ border: '1px dashed var(--color-amber)', background: 'var(--bg-overlay)' }}>
                <div className="fw-600 mb-1">IPS REBALANCING ALERT</div>
                <p className="text-sm">The portfolio's current <b>Equity</b> exposure is 5.4% above the Strategic Asset Allocation (SAA) target of 55%. Consider rebalancing to Fixed Income.</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="card" style={{ padding: 20, border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <div className="fw-600 mb-4 flex justify-between items-center">
                  <span>Investment Policy Statement (IPS)</span>
                  <span className="badge badge-success">ACTIVE</span>
                </div>
                <div className="grid-2 text-xs" style={{ gap: 16 }}>
                  <div>
                    <div className="text-tertiary mb-1">TARGET RETURN</div>
                    <div className="fw-600">7.5% - 9.0%</div>
                  </div>
                  <div>
                    <div className="text-tertiary mb-1">MAX DRAWDOWN</div>
                    <div className="fw-600">-15.0%</div>
                  </div>
                  <div>
                    <div className="text-tertiary mb-1">LAST REVIEW</div>
                    <div className="fw-600">Jan 12, 2026</div>
                  </div>
                  <div>
                    <div className="text-tertiary mb-1">NEXT REVIEW</div>
                    <div className="fw-600">Jul 12, 2026</div>
                  </div>
                </div>
                <button className="btn btn-secondary mt-6 w-full btn-sm">Edit IPS Parameters</button>
              </div>
              <button className="btn btn-primary w-full">Generate Rebalancing Proposal</button>
            </div>
          </div>
        )}

        {activeSubTab === 'treasury' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div className="grid-3">
              <div className="card" style={{ padding: 20, border: '1px solid var(--border)' }}>
                <div className="text-xs text-tertiary mb-1">TOTAL CASH & EQUIVALENTS</div>
                <div className="text-2xl fw-800">$7,500,000</div>
                <div className="text-xs text-success mt-2">Avg Yield: 5.45%</div>
              </div>
              <div className="card" style={{ padding: 20, border: '1px solid var(--border)' }}>
                <div className="text-xs text-tertiary mb-1">CASH DRAG (UNINVESTED)</div>
                <div className="text-2xl fw-800 text-amber">$1,200,000</div>
                <div className="text-xs text-secondary mt-2">Yield Loss: $64k/yr</div>
              </div>
              <div className="card" style={{ padding: 20, border: '1px solid var(--border)' }}>
                <div className="text-xs text-tertiary mb-1">LIQUIDITY RATIO</div>
                <div className="text-2xl fw-800">12.5%</div>
                <div className="text-xs text-secondary mt-2">IPS Target: 10% - 15%</div>
              </div>
            </div>

            <div className="table-wrap">
              <h4 className="fw-600 mb-4">Cash Holdings & Yield Map</h4>
              <table>
                <thead>
                  <tr>
                    <th>Institution</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Yield</th>
                    <th>Maturity</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {CASH_POSITIONS.map(cp => (
                    <tr key={cp.id}>
                      <td className="fw-500">{cp.bankName}</td>
                      <td>{formatCurrency(cp.amount, cp.currency)}</td>
                      <td><span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{cp.liquidityType}</span></td>
                      <td className="text-success fw-600">{(cp.yield * 100).toFixed(2)}%</td>
                      <td className="text-secondary">{cp.maturityDate ? formatDate(cp.maturityDate) : 'On Demand'}</td>
                      <td><button className="btn btn-ghost btn-sm">Move Funds</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>+ Add Cash Account</button>
          </div>
        )}

        {activeSubTab === 'research' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="grid-2" style={{ gap: 24 }}>
              {RESEARCH_NOTES.map(note => (
                <div key={note.id} className="card hover-lift" style={{ padding: 24, border: '1px solid var(--border)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {note.assetClasses.map(ac => (
                        <span key={ac} className="badge badge-secondary" style={{ fontSize: 9 }}>{ac.replace('_', ' ').toUpperCase()}</span>
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDate(note.publishedAt)}</span>
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>{note.title}</h3>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>{note.content}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="text-xs text-tertiary">By RM/Analyst ID: {note.authorId}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="text-xs fw-600" style={{ color: note.conviction === 'high' ? 'var(--color-green)' : 'var(--color-amber)' }}>
                        {note.conviction.toUpperCase()} CONVICTION
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ alignSelf: 'center' }}>Access Full Research Portal</button>
          </div>
        )}
      </div>
    </div>
  );
}
