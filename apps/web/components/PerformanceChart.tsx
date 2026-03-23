import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { PerformancePoint } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

export function PerformanceChart({ data }: { data: PerformancePoint[] }) {
  if (!data?.length) return <div className="text-secondary" style={{ padding: 20 }}>No performance data</div>;

  return (
    <div style={{ height: 320, position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} dy={10} />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
            tickFormatter={(value) => formatCurrency(value, 'USD', true)}
            domain={['auto', 'auto']}
          />
          <Tooltip 
            formatter={(value: any, name: any) => [formatCurrency(value, 'USD'), name === 'portfolioValue' ? 'Portfolio Value' : 'Benchmark']}
            labelStyle={{ color: 'var(--text-secondary)', marginBottom: 4 }}
            contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
          <Line type="monotone" dataKey="portfolioValue" name="Portfolio Value" stroke="var(--brand-500)" strokeWidth={2} dot={{ r: 3, fill: 'var(--brand-500)' }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="benchmarkValue" name="Benchmark" stroke="var(--text-tertiary)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
