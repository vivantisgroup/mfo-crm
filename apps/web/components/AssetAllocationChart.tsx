import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { AllocationSlice } from '@/lib/types';

export function AssetAllocationChart({ data }: { data: AllocationSlice[] }) {
  if (!data?.length) return <div className="text-secondary" style={{ padding: 20 }}>No allocation data</div>;

  return (
    <div style={{ height: 260, position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: any, name: any) => [
              new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value), 
              name
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
