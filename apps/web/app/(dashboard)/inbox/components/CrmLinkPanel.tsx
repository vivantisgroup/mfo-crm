'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Search, X, Link2, Check, Loader2 } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import type { CrmLinkTarget } from '@/app/api/mail/link/route';

// ─── Types ────────────────────────────────────────────────────────────────────

type RecordType = CrmLinkTarget['type'];

interface SearchResult {
  type:     RecordType;
  id:       string;
  name:     string;
  subtitle: string;
  tenantId: string;
}

interface Props {
  emailLogId:  string;
  uid:         string;
  tenantId:    string;
  initialLinks: CrmLinkTarget[];
  onLinksChange: (links: CrmLinkTarget[]) => void;
  onClose:     () => void;
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: { key: RecordType; label: string; emoji: string }[] = [
  { key: 'family',   label: 'Families',     emoji: '👨‍👩‍👧' },
  { key: 'contact',  label: 'Contacts',     emoji: '👤' },
  { key: 'org',      label: 'Orgs',         emoji: '🏢' },
  { key: 'ticket',   label: 'Tickets',      emoji: '🎫' },
  { key: 'activity', label: 'Activities',   emoji: '📋' },
  { key: 'task',     label: 'Tasks',        emoji: '✅' },
];

const TYPE_COLOR: Record<RecordType, string> = {
  family:   '#6366f1',
  contact:  '#22c55e',
  org:      '#f59e0b',
  ticket:   '#ef4444',
  activity: '#0ea5e9',
  task:     '#a855f7',
};

// ─── Firestore REST helpers ───────────────────────────────────────────────────

const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? 'mfo-crm';

async function searchCollection(
  idToken: string,
  collectionPath: string,
  nameField: string,
  subtitleField: string,
  type: RecordType,
  tenantId: string,
  query: string,
): Promise<SearchResult[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}?pageSize=30`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) return [];
  const data = await res.json();
  const docs: any[] = data.documents ?? [];
  const q = query.toLowerCase();

  return docs
    .map(doc => {
      const f = doc.fields ?? {};
      const name     = f[nameField]?.stringValue ?? f.name?.stringValue ?? '';
      const subtitle = f[subtitleField]?.stringValue ?? f.email?.stringValue ?? '';
      return {
        type,
        id:       doc.name.split('/').pop() ?? '',
        name,
        subtitle,
        tenantId,
      };
    })
    .filter(r => r.name.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q) || !q)
    .slice(0, 10);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CrmLinkPanel({ emailLogId, uid, tenantId, initialLinks, onLinksChange, onClose }: Props) {
  const [tab,     setTab]     = useState<RecordType>('family');
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [links,   setLinks]   = useState<CrmLinkTarget[]>(initialLinks);
  const [searching, setSearching] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [flash,     setFlash]     = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Search ─────────────────────────────────────────────────────────────────
  const runSearch = useCallback(async (q: string, type: RecordType) => {
    setSearching(true);
    try {
      const idToken = await getAuth().currentUser?.getIdToken() ?? '';

      let collectionPath = '';
      let nameField      = 'name';
      let subtitleField  = 'email';

      if (type === 'family')   { collectionPath = `tenants/${tenantId}/families`;    nameField = 'name';    subtitleField = 'email'; }
      if (type === 'contact')  { collectionPath = `tenants/${tenantId}/contacts`;    nameField = 'name';    subtitleField = 'email'; }
      if (type === 'org')      { collectionPath = `platform_orgs`;                   nameField = 'name';    subtitleField = 'industry'; }
      if (type === 'ticket')   { collectionPath = `tenants/${tenantId}/tickets`;     nameField = 'subject'; subtitleField = 'status'; }
      if (type === 'activity') { collectionPath = `tenants/${tenantId}/activities`;  nameField = 'subject'; subtitleField = 'activityType'; }
      if (type === 'task')     { collectionPath = `tenants/${tenantId}/activities`;  nameField = 'subject'; subtitleField = 'activityType'; }

      const res = await searchCollection(idToken, collectionPath, nameField, subtitleField, type, tenantId, q);
      setResults(res);
    } catch (e) {
      console.error('[CrmLinkPanel] search error:', e);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [tenantId]);

  function handleQueryChange(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q, tab), 350);
  }

  function handleTabChange(t: RecordType) {
    setTab(t);
    setResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query, t), 50);
  }

  // ── Link / unlink ──────────────────────────────────────────────────────────
  async function toggleLink(record: SearchResult) {
    const already = links.find(l => l.type === record.type && l.id === record.id);
    const newLinks = already
      ? links.filter(l => !(l.type === record.type && l.id === record.id))
      : [...links, { type: record.type, id: record.id, name: record.name, tenantId: record.tenantId }];

    setSaving(true);
    try {
      const idToken = await getAuth().currentUser?.getIdToken() ?? '';
      const res = await fetch('/api/mail/link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid, idToken, emailLogId, links: newLinks, tenantId }),
      });
      if (!res.ok) throw new Error('Save failed');
      setLinks(newLinks);
      onLinksChange(newLinks);
      setFlash(already ? 'Unlinked' : `Linked to ${record.name}`);
      setTimeout(() => setFlash(null), 2000);
    } catch (e) {
      console.error('[CrmLinkPanel] save error:', e);
    } finally {
      setSaving(false);
    }
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: 300, flexShrink: 0, borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-surface)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link2 size={15} color="var(--brand-400)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Link to CRM</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* Flash message */}
      {flash && (
        <div style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, background: '#22c55e18', color: '#22c55e', borderBottom: '1px solid #22c55e22' }}>
          ✅ {flash}
        </div>
      )}

      {/* Already linked */}
      {links.length > 0 && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Linked</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {links.map(l => (
              <button
                key={`${l.type}-${l.id}`}
                onClick={() => toggleLink({ ...l, subtitle: '' })}
                title="Click to unlink"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 8px',
                  borderRadius: 12, border: `1px solid ${TYPE_COLOR[l.type]}44`,
                  background: `${TYPE_COLOR[l.type]}18`, cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, color: TYPE_COLOR[l.type],
                }}
              >
                {l.name}
                <X size={10} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, overflowX: 'auto', padding: '4px 8px 0' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            style={{
              padding: '6px 10px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: tab === t.key ? 700 : 400, whiteSpace: 'nowrap',
              color: tab === t.key ? TYPE_COLOR[t.key] : 'var(--text-tertiary)',
              borderBottom: tab === t.key ? `2px solid ${TYPE_COLOR[t.key]}` : '2px solid transparent',
              transition: 'color 0.1s',
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: '10px 12px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            autoFocus
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder={`Search ${TABS.find(t => t.key === tab)?.label ?? ''}…`}
            style={{
              width: '100%', padding: '8px 10px 8px 30px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-canvas)',
              color: 'inherit', fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
          {searching && (
            <Loader2 size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', animation: 'spin 0.8s linear infinite' }} />
          )}
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {results.length === 0 && !searching && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            {query ? 'No results found' : 'Type to search…'}
          </div>
        )}
        {results.map(record => {
          const isLinked = links.some(l => l.type === record.type && l.id === record.id);
          const color    = TYPE_COLOR[record.type];
          return (
            <button
              key={`${record.type}-${record.id}`}
              onClick={() => toggleLink(record)}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', width: '100%', border: 'none',
                background: isLinked ? `${color}12` : 'transparent',
                cursor: saving ? 'wait' : 'pointer',
                borderBottom: '1px solid var(--border)',
                transition: 'background 0.1s',
                textAlign: 'left',
              }}
            >
              {/* Type dot */}
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: isLinked ? 700 : 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {record.name}
                </div>
                {record.subtitle && (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {record.subtitle}
                  </div>
                )}
              </div>
              {isLinked && <Check size={14} color={color} style={{ flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
