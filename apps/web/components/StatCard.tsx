import React from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  trendValue?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
}

export function StatCard({ label, value, trendValue, trendDirection, icon }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      {trendValue && (
        <div className={`stat-card-trend trend-${trendDirection || 'neutral'}`}>
          {trendDirection === 'up' && '↑'}
          {trendDirection === 'down' && '↓'}
          {trendDirection === 'neutral' && '→'}
          <span style={{ marginLeft: 4 }}>{trendValue}</span>
        </div>
      )}
      {icon && <div className="stat-card-icon">{icon}</div>}
    </div>
  );
}
