'use client';

import React from 'react';

export default function ReportsPage() {
  return (
    <div className="page-wrapper animate-fade-in mx-auto max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 pb-5 border-b border-tremor-border gap-4">
        <div>
          <h1 className="text-3xl font-bold text-tremor-content-strong tracking-tight">Reporting & Analytics</h1>
            <p className="mt-2 text-tremor-content">Custom performance, tax, and governance reporting</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary">Generate Report</button>
        </div>
      </div>

      <div className="grid-3 mt-6">
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6">
          <div className="card-header"><h2 className="card-title">Performance Packs</h2></div>
          <div className="card-body text-center text-secondary">
            <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
            <div>Quarterly Performance Packs</div>
            <button className="btn btn-secondary btn-sm mt-4">View Templates</button>
          </div>
        </div>
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6">
          <div className="card-header"><h2 className="card-title">Tax & Accounting</h2></div>
          <div className="card-body text-center text-secondary">
            <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
            <div>Realized gains, K-1 generation</div>
            <button className="btn btn-secondary btn-sm mt-4">View Templates</button>
          </div>
        </div>
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6">
          <div className="card-header"><h2 className="card-title">Custom Builder</h2></div>
          <div className="card-body text-center text-secondary">
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div>Drag-and-drop report builder</div>
            <button className="btn btn-secondary btn-sm mt-4">Open Builder</button>
          </div>
        </div>
      </div>
    </div>
  );
}
