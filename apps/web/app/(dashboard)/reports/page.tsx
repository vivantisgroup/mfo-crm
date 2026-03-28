'use client';

import React from 'react';

export default function ReportsPage() {
  return (
    <div className="page-wrapper animate-fade-in mx-auto max-w-7xl">
      

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
