'use client';

import React, { useState, useMemo } from 'react';
import { SERVICE_REQUESTS, FAMILIES } from '@/lib/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { formatRelativeDate, getServiceIcon } from '@/lib/utils';
import type { ServiceRequest } from '@/lib/types';
import { useSortable, SortableTh } from '@/lib/useSortable';

// Family names from mock data
const FAMILY_NAMES = ['All', ...Array.from(new Set(FAMILIES.map(f => f.name)))];
const SERVICE_TYPES = ['All', 'travel', 'property', 'healthcare', 'event', 'legal', 'other'];
const STATUSES = ['All', 'open', 'in_progress', 'resolved', 'cancelled'];
const PRIORITIES = ['All', 'urgent', 'high', 'medium', 'low'];

export default function ConciergePage() {
  const [search, setSearch]       = useState('');
  const [family, setFamily]       = useState('All');
  const [svcType, setSvcType]     = useState('All');
  const [status, setStatus]       = useState('All');
  const [priority, setPriority]   = useState('All');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return SERVICE_REQUESTS.filter(r => {
      const matchSearch   = !q || r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.familyName?.toLowerCase().includes(q);
      const matchFamily   = family === 'All'   || r.familyName === family;
      const matchType     = svcType === 'All'  || r.serviceType === svcType;
      const matchStatus   = status === 'All'   || r.status === status;
      const matchPriority = priority === 'All' || r.priority === priority;
      return matchSearch && matchFamily && matchType && matchStatus && matchPriority;
    });
  }, [search, family, svcType, status, priority]);

  const { sorted, sort, toggle } = useSortable(filtered, 'createdAt', 'desc');

  const activeFilters = [family, svcType, status, priority].filter(f => f !== 'All').length;

  const clearFilters = () => {
    setSearch(''); setFamily('All'); setSvcType('All'); setStatus('All'); setPriority('All');
  };

  return (
    <div className="page-wrapper animate-fade-in mx-auto max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 pb-5 border-b border-tremor-border gap-4">
        <div>
          <h1 className="text-3xl font-bold text-tremor-content-strong tracking-tight">Concierge &amp; Lifestyle</h1>
            <p className="mt-2 text-tremor-content">White-glove lifestyle management, travel, health, and events</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary">+ New Request</button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
        {/* Search */}
        <div className="search-input-wrap" style={{ flex: 1, minWidth: 240, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>🔍</span>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search requests, families..."
            style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, borderRadius: 'var(--radius-lg)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>

        {/* Filters */}
        {[
          { label: '👨‍👩‍👧 Family', value: family,    set: setFamily,   options: FAMILY_NAMES },
          { label: '🏷 Type',     value: svcType,   set: setSvcType,  options: SERVICE_TYPES },
          { label: '📌 Status',   value: status,    set: setStatus,   options: STATUSES },
          { label: '⚡ Priority', value: priority,  set: setPriority, options: PRIORITIES },
        ].map(f => (
          <select key={f.label} value={f.value} onChange={e => f.set(e.target.value)}
            style={{
              padding: '9px 12px', borderRadius: 'var(--radius-md)',
              background: f.value !== 'All' ? 'var(--brand-900)' : 'var(--bg-elevated)',
              border: `1px solid ${f.value !== 'All' ? 'var(--brand-500)' : 'var(--border)'}`,
              color: f.value !== 'All' ? 'var(--brand-400)' : 'var(--text-primary)',
              fontWeight: f.value !== 'All' ? 700 : 400, fontSize: 13, cursor: 'pointer',
            }}>
            {f.options.map(o => (
              <option key={o} value={o} style={{ textTransform: 'capitalize' }}>
                {f.label.split(' ').slice(1).join(' ')}: {o === 'All' ? 'All' : o}
              </option>
            ))}
          </select>
        ))}

        {activeFilters > 0 && (
          <button onClick={clearFilters} className="btn btn-ghost btn-sm" style={{ color: '#f59e0b', fontSize: 12 }}>
            ✕ Clear ({activeFilters})
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
          {sorted.length} of {SERVICE_REQUESTS.length} results
        </span>
      </div>

      {/* Table */}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>Type</th>
              <SortableTh label="Request"        sortKey="title"       sort={sort as any} onSort={toggle as any} style={{ minWidth: 200 }} />
              <SortableTh label="Family"         sortKey="familyName"  sort={sort as any} onSort={toggle as any} />
              <SortableTh label="Member"         sortKey="memberName"  sort={sort as any} onSort={toggle as any} />
              <SortableTh label="Status"         sortKey="status"      sort={sort as any} onSort={toggle as any} />
              <SortableTh label="Priority"       sortKey="priority"    sort={sort as any} onSort={toggle as any} />
              <SortableTh label="Requested"      sortKey="createdAt"   sort={sort as any} onSort={toggle as any} className="td-right" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>
                No requests match the current filters.{' '}
                {activeFilters > 0 && <button onClick={clearFilters} style={{ color: 'var(--brand-400)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear filters</button>}
              </td></tr>
            ) : sorted.map((r: ServiceRequest) => (
              <tr key={r.id} className="hover-row">
                <td>
                  <span style={{ fontSize: 20 }}>{getServiceIcon(r.serviceType)}</span>
                </td>
                <td>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{r.title}</div>
                  {r.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>}
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: 'var(--brand-400)', fontSize: 13 }}>{r.familyName}</span>
                </td>
                <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {r.memberName || <em style={{ opacity: 0.45 }}>Family-wide</em>}
                </td>
                <td><StatusBadge status={r.status} /></td>
                <td><StatusBadge status={r.priority} /></td>
                <td className="td-right">
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatRelativeDate(r.createdAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
