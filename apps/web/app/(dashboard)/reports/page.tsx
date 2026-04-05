'use client';

import React from 'react';
import RevenueChart from './components/RevenueChart';
import PipelineFunnel from './components/PipelineFunnel';
import AccountDistribution from './components/AccountDistribution';
import Link from 'next/link';
import { PenTool } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-[var(--bg-background)]">
      {/* Header Dock */}
      <div className="px-6 py-4 lg:py-5 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-[var(--text-primary)] tracking-tight leading-none mb-1">Business Intelligence</h1>
          <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Platform Analytics & Metrics</p>
        </div>
        <div>
           <Link href="/reports/builder" className="flex items-center gap-2 px-3 py-1.5 bg-[var(--brand-primary)] hover:brightness-90 text-white text-[11px] font-bold rounded shadow-sm border border-transparent uppercase tracking-wider transition-colors">
              <PenTool size={14} />
              Build Chart
           </Link>
        </div>
      </div>
      
      {/* Fixed Dashboard Body */}
      <div className="flex-1 p-3 lg:p-4 flex flex-col min-h-0 gap-3 lg:gap-4 max-w-[1600px] w-full mx-auto">
        {/* Top Row: 55% */}
        <div className="shrink-0 w-full" style={{ height: '55%' }}>
          <RevenueChart />
        </div>
        
        {/* Bottom Row: 45% (flex-1) */}
        <div className="flex-1 flex flex-col lg:flex-row gap-3 lg:gap-4 min-h-0">
          <div className="flex-1 w-full min-w-0 min-h-0 h-full">
            <PipelineFunnel />
          </div>
          <div className="flex-1 w-full min-w-0 min-h-0 h-full">
            <AccountDistribution />
          </div>
        </div>
      </div>
    </div>
  );
}
