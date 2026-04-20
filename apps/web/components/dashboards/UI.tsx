import React from 'react';

export const Grid = ({ numItemsSm, numItemsLg, className, children }: any) => {
  const smCols = numItemsSm === 1 ? 'sm:grid-cols-1' : numItemsSm === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';
  const lgCols = numItemsLg === 2 ? 'lg:grid-cols-2' : numItemsLg === 3 ? 'lg:grid-cols-3' : numItemsLg === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-1';
  return <div className={`grid grid-cols-1 ${smCols} ${lgCols} ${className || ''}`}>{children}</div>;
};

export const Flex = ({ alignItems, className, children, justifyContent }: any) => {
  const align = alignItems === 'start' ? 'items-start' : 'items-center';
  const justify = justifyContent === 'center' ? 'justify-center' : 'justify-between';
  return <div className={`flex ${justify} ${align} w-full ${className || ''}`}>{children}</div>;
};

export const Subtitle = ({ className, children }: any) => (
  <div className={`text-sm text-[var(--text-secondary)] ${className || ''}`}>{children}</div>
);

export const ProgressBar = ({ value, color, className }: any) => {
  let bg = 'bg-primary';
  if (color === 'emerald') bg = 'bg-emerald-500';
  if (color === 'blue') bg = 'bg-blue-500';
  if (color === 'amber') bg = 'bg-amber-500';
  if (color === 'rose') bg = 'bg-rose-500';
  
  return (
    <div className={`w-full bg-secondary/30 rounded-full h-2 ${className || ''}`}>
       <div className={`${bg} h-2 rounded-full transition-all`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }}></div>
    </div>
  );
};

export const DonutChart = (props: any) => <div className="flex h-full w-full items-center justify-center border border-dashed rounded-xl bg-card/50 text-sm text-muted-foreground p-4">Analytic Chart Unavailable</div>;
export const AreaChart = (props: any) => <div className="flex h-full w-full items-center justify-center border border-dashed rounded-xl bg-card/50 text-sm text-muted-foreground p-4">Analytic Chart Unavailable</div>;
export const BarList = (props: any) => <div className="flex h-full w-full items-center justify-center border border-dashed rounded-xl bg-card/50 text-sm text-muted-foreground p-4">Data List Unavailable</div>;

export function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}
