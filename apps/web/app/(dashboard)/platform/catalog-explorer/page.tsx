'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConsistencyIssue {
  id: string; collection: string; docId: string; field: string;
  severity: 'critical' | 'warning' | 'info';
  issueType: string; title: string; description: string;
  howToFix: string; canAutoFix: boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6',
};

const KNOWN_COLLECTIONS = [
  'users', 'tenants', 'tenant_members', 'user_mfa_secrets',
  'audit_logs', 'notifications',
  'crm_opportunities', 'crm_contacts', 'crm_activities', 'crm_pipelines',
  'platform_backups', 'platform_config',
  'email_templates', 'roles', 'subscription_plans', 'invoices', 'renewals',
  'support_tickets', 'expenses',
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function JsonViewer({ data, onSave, saving }: { data: any; onSave?: (json: any) => void; saving?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(JSON.stringify(data, null, 2));
  const [jsonError, setJsonError] = useState('');

  const handleSave = () => {
    try {
      const parsed = JSON.parse(draft);
      setJsonError('');
      onSave?.(parsed);
      setEditing(false);
    } catch {
      setJsonError('Invalid JSON — please check your syntax');
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            style={{
              width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: 12,
              background: '#0a0a14', color: '#e2e8f0', border: `1px solid ${jsonError ? '#ef4444' : '#334155'}`,
              borderRadius: 8, padding: 16, minHeight: 300, resize: 'vertical', outline: 'none', lineHeight: 1.6,
            }}
          />
          {jsonError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{jsonError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? '⏳ Saving…' : '💾 Save Changes'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setDraft(JSON.stringify(data, null, 2)); setJsonError(''); }}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <pre style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 12,
            background: 'var(--bg-canvas)', color: '#94a3b8',
            borderRadius: 8, padding: 16, overflow: 'auto', maxHeight: 400,
            border: '1px solid var(--border)', margin: 0, lineHeight: 1.6,
          }}>
            {JSON.stringify(data, null, 2)}
          </pre>
          {onSave && (
            <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)} style={{ marginTop: 8 }}>✏️ Edit Document</button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab: Database Explorer ────────────────────────────────────────────────────

function DatabaseExplorer() {
  const [selectedCollection, setSelectedCollection] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [collectionSearch, setCollectionSearch] = useState('');

  const [dbCollections, setDbCollections] = useState<{name: string, exists: boolean, hasData: boolean, isKnown: boolean}[]>([]);

  useEffect(() => {
    fetch('/api/admin/catalog/collections')
      .then(r => r.json())
      .then(d => {
        if (d.collections) setDbCollections(d.collections);
      });
  }, []);

  const loadCollection = useCallback(async (col: string) => {
    setLoading(true); setError(''); setDocuments([]); setSelectedDoc(null);
    try {
      const res = await fetch(`/api/admin/catalog/collections?collection=${encodeURIComponent(col)}&limit=200`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDocuments(data.documents ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (selectedCollection) loadCollection(selectedCollection); }, [selectedCollection, loadCollection]);

  const handleSaveDoc = async (updatedData: any) => {
    if (!selectedDoc || !selectedCollection) return;
    setSaving(true);
    const { id, ...fields } = updatedData;
    try {
      const res = await fetch(`/api/admin/catalog/document?collection=${selectedCollection}&id=${selectedDoc.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSuccessMsg('Document saved successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
      loadCollection(selectedCollection);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      const res = await fetch(`/api/admin/catalog/document?collection=${selectedCollection}&id=${docId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      setSelectedDoc(null);
      setDeleteConfirm(null);
      setSuccessMsg('Document deleted');
      setTimeout(() => setSuccessMsg(''), 3000);
      loadCollection(selectedCollection);
    } catch (e: any) { setError(e.message); }
  };

  const filteredDocs = documents.filter(d =>
    !search || JSON.stringify(d).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, minHeight: 600 }}>
      {/* Collection sidebar */}
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'flex', gap: 10, alignItems: 'center' }}>
          Collections
        </div>
        <div style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
            <input
              type="text"
              placeholder="🔍 Filter collections..."
              value={collectionSearch}
              onChange={e => setCollectionSearch(e.target.value)}
              className="input"
              style={{ width: '100%', padding: '6px 10px', fontSize: 12 }}
            />
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 560 }}>
          {dbCollections.filter(c => c.name.toLowerCase().includes(collectionSearch.toLowerCase())).map(col => (
            <button
              key={col.name}
              onClick={() => setSelectedCollection(col.name)}
              style={{
                width: '100%', padding: '10px 16px', textAlign: 'left', border: 'none', cursor: 'pointer',
                background: selectedCollection === col.name ? 'var(--brand-500)18' : 'transparent',
                color: selectedCollection === col.name ? 'var(--brand-400)' : 'var(--text-secondary)',
                borderLeft: selectedCollection === col.name ? '3px solid var(--brand-500)' : '3px solid transparent',
                fontSize: 13, fontWeight: selectedCollection === col.name ? 700 : 400,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span>{col.name}</span>
              {!col.isKnown && <span style={{ fontSize: 10, background: '#ef444422', color: '#ef4444', padding: '2px 6px', borderRadius: 4 }}>Orphaned</span>}
              {col.isKnown && col.exists && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{col.hasData ? 'Active' : 'Empty'}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!selectedCollection && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 48 }}>🗄</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Select a collection to explore</div>
          </div>
        )}

        {selectedCollection && (
          <>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                type="text" placeholder="Search documents…" value={search} onChange={e => setSearch(e.target.value)}
                className="input" style={{ flex: 1, padding: '8px 12px' }}
              />
              <button className="btn btn-ghost btn-sm" onClick={() => loadCollection(selectedCollection)}>↺ Refresh</button>
            </div>

            {/* Success / Error */}
            {successMsg && <div style={{ padding: '10px 14px', background: '#22c55e11', border: '1px solid #22c55e33', borderRadius: 8, fontSize: 13, color: '#22c55e' }}>✅ {successMsg}</div>}
            {error && <div style={{ padding: '10px 14px', background: '#ef444411', border: '1px solid #ef444433', borderRadius: 8, fontSize: 13, color: '#fca5a5' }}>❌ {error}</div>}

            {/* Stats */}
            {!loading && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Showing {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''} from <strong style={{ color: 'var(--text-primary)' }}>{selectedCollection}</strong>
              </div>
            )}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 20, color: 'var(--text-tertiary)' }}>
                <div style={{ width: 20, height: 20, border: '2px solid var(--border)', borderTopColor: 'var(--brand-500)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Loading…
              </div>
            )}

            {!loading && (
              <div style={{ display: 'grid', gridTemplateColumns: selectedDoc ? '1fr 1fr' : '1fr', gap: 16 }}>
                {/* Document list */}
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  {filteredDocs.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>No documents found</div>
                  ) : (
                    filteredDocs.map(d => (
                      <div
                        key={d.id}
                        onClick={() => setSelectedDoc(d)}
                        style={{
                          padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                          background: selectedDoc?.id === d.id ? 'var(--brand-500)12' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace', color: selectedDoc?.id === d.id ? 'var(--brand-400)' : 'var(--text-primary)' }}>{d.id}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {Object.keys(d).filter(k => k !== 'id').slice(0, 4).join(' · ')}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Document viewer */}
                {selectedDoc && (
                  <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)', padding: 20, overflow: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, fontFamily: 'monospace' }}>{selectedDoc.id}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{selectedCollection}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {deleteConfirm === selectedDoc.id ? (
                          <>
                            <button className="btn btn-sm" onClick={() => handleDeleteDoc(selectedDoc.id)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>Confirm Delete</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                          </>
                        ) : (
                          <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(selectedDoc.id)} style={{ color: '#ef4444' }}>🗑 Delete</button>
                        )}
                      </div>
                    </div>

                    <div style={{ marginBottom: 8, padding: '8px 12px', background: '#f59e0b0a', border: '1px solid #f59e0b22', borderRadius: 8, fontSize: 11, color: '#f59e0b' }}>
                      ⚠️ Direct edits bypass business logic. Use with caution.
                    </div>

                    <JsonViewer data={selectedDoc} onSave={handleSaveDoc} saving={saving} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Consistency Inspector ────────────────────────────────────────────────

function ConsistencyInspector() {
  const [issues, setIssues] = useState<ConsistencyIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<string[]>([]);
  const [error, setError] = useState('');

  const runChecks = async () => {
    setLoading(true); setError(''); setIssues([]); setReport([]); setFixedIds(new Set());
    try {
      const res = await fetch('/api/admin/catalog/consistency', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIssues(data.issues ?? []);
      setCheckedAt(data.checkedAt);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const applyFix = async (issue: ConsistencyIssue) => {
    setFixingId(issue.id); setError('');
    try {
      const res = await fetch('/api/admin/catalog/consistency', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFixedIds(prev => new Set(prev).add(issue.id));
      setReport(prev => [...prev, `✅ Fixed: ${issue.title} (${issue.collection}/${issue.docId})`]);
    } catch (e: any) { setError(e.message); }
    finally { setFixingId(null); }
  };

  const counts = {
    critical: issues.filter(i => i.severity === 'critical' && !fixedIds.has(i.id)).length,
    warning:  issues.filter(i => i.severity === 'warning'  && !fixedIds.has(i.id)).length,
    info:     issues.filter(i => i.severity === 'info'      && !fixedIds.has(i.id)).length,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Database Consistency Inspector</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Scans all Firestore collections for referential integrity issues, orphaned records, invalid role assignments, and data corruption.
          </div>
          {checkedAt && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Last checked: {new Date(checkedAt).toLocaleString()}</div>}
        </div>
        <button className="btn btn-primary" onClick={runChecks} disabled={loading} style={{ flexShrink: 0, gap: 8 }}>
          {loading ? (
            <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid white33', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Running…</>
          ) : '🔍 Run Consistency Check'}
        </button>
      </div>

      {error && <div style={{ marginBottom: 16, padding: '12px 14px', background: '#ef444411', border: '1px solid #ef444433', borderRadius: 8, fontSize: 13, color: '#fca5a5' }}>❌ {error}</div>}

      {/* Summary cards */}
      {checkedAt && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Issues', value: issues.length - fixedIds.size, color: 'var(--text-primary)', bg: 'var(--bg-elevated)' },
            { label: 'Critical', value: counts.critical, color: '#ef4444', bg: '#ef444411' },
            { label: 'Warnings', value: counts.warning, color: '#f59e0b', bg: '#f59e0b11' },
            { label: 'Info', value: counts.info, color: '#3b82f6', bg: '#3b82f611' },
          ].map(c => (
            <div key={c.label} style={{ padding: '16px 20px', background: c.bg, borderRadius: 12, border: `1px solid ${c.color}33` }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: c.color, lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* No issues found */}
      {checkedAt && issues.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 24px', background: '#22c55e0a', border: '1px solid #22c55e33', borderRadius: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#22c55e', marginBottom: 6 }}>All Clear!</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No integrity issues found across all checked collections.</div>
        </div>
      )}

      {/* Issues list */}
      {issues.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {issues.map(issue => {
            const isFixed   = fixedIds.has(issue.id);
            const isExpanded = expandedIssue === issue.id;
            const isFixing  = fixingId === issue.id;

            return (
              <div key={issue.id} style={{
                background: 'var(--bg-elevated)', borderRadius: 12,
                border: `1px solid ${isFixed ? '#22c55e33' : `${SEVERITY_COLOR[issue.severity]}33`}`,
                overflow: 'hidden', opacity: isFixed ? 0.6 : 1,
              }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
                  onClick={() => setExpandedIssue(isExpanded ? null : issue.id)}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: isFixed ? '#22c55e' : SEVERITY_COLOR[issue.severity] }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: isFixed ? '#22c55e' : 'var(--text-primary)' }}>
                      {isFixed ? '✓ Fixed: ' : ''}{issue.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      <code style={{ fontFamily: 'monospace' }}>{issue.collection}/{issue.docId}</code>
                      {issue.field && <> · field: <code style={{ fontFamily: 'monospace' }}>{issue.field}</code></>}
                    </div>
                  </div>

                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6, background: `${SEVERITY_COLOR[issue.severity]}22`, color: SEVERITY_COLOR[issue.severity] }}>
                    {issue.severity}
                  </span>

                  {!isFixed && issue.canAutoFix && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={e => { e.stopPropagation(); applyFix(issue); }}
                      disabled={!!fixingId}
                    >
                      {isFixing ? '⏳ Fixing…' : '🔧 Fix'}
                    </button>
                  )}

                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
                      <div style={{ padding: '12px 16px', background: 'var(--bg-canvas)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Issue</div>
                        <div style={{ fontSize: 13, lineHeight: 1.6 }}>{issue.description}</div>
                      </div>
                      <div style={{ padding: '12px 16px', background: '#22c55e08', borderRadius: 8, border: '1px solid #22c55e22' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', marginBottom: 6 }}>How it will be fixed</div>
                        <div style={{ fontSize: 13, lineHeight: 1.6 }}>{issue.howToFix}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fix report */}
      {report.length > 0 && (
        <div style={{ marginTop: 24, padding: '16px 20px', background: '#22c55e0a', border: '1px solid #22c55e33', borderRadius: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>📋 Fix Report</div>
          {report.map((r, i) => <div key={i} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{r}</div>)}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CatalogExplorerPage() {
  const { isSaasMasterAdmin } = useAuth();
  const [tab, setTab] = useState<'explorer' | 'consistency'>('explorer');

  if (!isSaasMasterAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16 }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Access Restricted</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>The Catalog Explorer is only accessible to Super Admins (saas_master_admin).</div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
          This tool allows direct Firestore access and data modifications — it bypasses all business logic. Access is strictly controlled.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #7c3aed44, #a855f744)', border: '1px solid #7c3aed33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🔬</div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Catalog Explorer</h1>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Direct Firestore browser · Consistency Inspector · Super Admin only</div>
          </div>
        </div>
        <div style={{ padding: '10px 16px', background: '#ef444411', border: '1px solid #ef444433', borderRadius: 10, fontSize: 13, color: '#fca5a5', display: 'flex', gap: 10, alignItems: 'center' }}>
          🚨 <strong>Critical Tool:</strong> Direct database access. Edits bypass all application business logic, validation, and audit protection. Use only for emergency fixes.
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'var(--bg-elevated)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[
          { id: 'explorer', label: '📂 Database Explorer' },
          { id: 'consistency', label: '🔍 Consistency Inspector' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              background: tab === t.id ? 'var(--brand-500)' : 'transparent',
              color: tab === t.id ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'explorer'    && <DatabaseExplorer />}
      {tab === 'consistency' && <ConsistencyInspector />}
    </div>
  );
}
