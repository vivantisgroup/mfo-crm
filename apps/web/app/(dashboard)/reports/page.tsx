'use client';

import React from 'react';

export default function ReportsPage() {
  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reporting & Analytics</h1>
          <p className="page-subtitle">Custom performance, tax, and governance reporting</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary">Generate Report</button>
        </div>
      </div>

      <div className="grid-3 mt-6">
        <div className="card">
          <div className="card-header"><h2 className="card-title">Performance Packs</h2></div>
          <div className="card-body text-center text-secondary">
            <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
            <div>Quarterly Performance Packs</div>
            <button className="btn btn-secondary btn-sm mt-4">View Templates</button>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h2 className="card-title">Tax & Accounting</h2></div>
          <div className="card-body text-center text-secondary">
            <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
            <div>Realized gains, K-1 generation</div>
            <button className="btn btn-secondary btn-sm mt-4">View Templates</button>
          </div>
        </div>
        <div className="card">
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
