'use client';

import { useState, useMemo, useCallback } from 'react';

export type SortDir = 'asc' | 'desc' | null;

export interface SortState<T extends string = string> {
  key: T | null;
  dir: SortDir;
}

/** Returns sorted data + helpers for sortable table headers */
export function useSortable<T extends Record<string, any>>(
  data: T[],
  defaultKey?: keyof T,
  defaultDir: 'asc' | 'desc' = 'asc',
) {
  const [sort, setSort] = useState<{ key: keyof T | null; dir: 'asc' | 'desc' }>({
    key: defaultKey ?? null,
    dir: defaultDir,
  });

  const toggle = useCallback((key: keyof T) => {
    setSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );
  }, []);

  const sorted = useMemo(() => {
    if (!sort.key) return data;
    return [...data].sort((a, b) => {
      const av = a[sort.key!];
      const bv = b[sort.key!];
      if (av === bv) return 0;
      const cmp = av === null || av === undefined ? -1
        : bv === null || bv === undefined ? 1
        : typeof av === 'string' && typeof bv === 'string'
          ? av.localeCompare(bv, undefined, { sensitivity: 'base' })
          : av < bv ? -1 : 1;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [data, sort.key, sort.dir]);

  return { sorted, sort, toggle };
}

/** Styled sort indicator arrow for table headers */
export function SortArrow({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span style={{
      display: 'inline-block', marginLeft: 4, opacity: active ? 1 : 0.25,
      transform: active && dir === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: 'transform 0.15s, opacity 0.15s',
      fontSize: 10,
    }}>
      ▲
    </span>
  );
}

/** Wrapper for a <th> that makes it clickable to sort */
export function SortableTh({
  label, sortKey, sort, onSort, style, className,
}: {
  label: string;
  sortKey: string;
  sort: { key: string | null; dir: 'asc' | 'desc' };
  onSort: (k: string) => void;
  style?: React.CSSProperties;
  className?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      className={className}
      onClick={() => onSort(sortKey)}
      style={{
        cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
        color: active ? 'var(--brand-400)' : undefined,
        ...style,
      }}
    >
      {label}
      <SortArrow active={active} dir={sort.dir} />
    </th>
  );
}
