'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getFirestore, collection, getDocs, query, limit } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';

const db = getFirestore(firebaseApp);

// ─── Types ────────────────────────────────────────────────────────────────────

interface BackupRecord {
  id: string; label: string; type: 'tenant' | 'platform_full';
  exportedAt: string; tenantId?: string; status: string;
  collectionsExported?: number; totalDocuments?: number; sizeEstimate?: number;
}

function formatBytes(bytes?: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ProgressLog({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight); }, [lines]);
  if (lines.length === 0) return null;
  return (
    <div ref={ref} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, background: '#0a0a14', borderRadius: 8, padding: 16, maxHeight: 200, overflowY: 'auto', border: '1px solid #1e293b', lineHeight: 1.7, color: '#94a3b8' }}>
      {lines.map((l, i) => <div key={i} style={{ color: l.startsWith('✅') ? '#22c55e' : l.startsWith('❌') ? '#ef4444' : l.startsWith('⚠️') ? '#f59e0b' : '#94a3b8' }}>{l}</div>)}
    </div>
  );
}

// ─── Tab: Platform Backup ──────────────────────────────────────────────────────

function PlatformBackupTab({ history, onBackupDone }: { history: BackupRecord[]; onBackupDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState('');

  async function runFullBackup() {
    setLoading(true); setError(''); setLog(['🔄 Starting full platform backup…']);
    try {
      setLog(p => [...p, '📦 Collecting all collections…']);
      const res = await fetch('/api/admin/backups/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const { meta, backup } = data;
      setLog(p => [...p, `✅ Backup complete — ${meta.totalDocuments} documents across ${meta.collectionsExported} collections`, `📄 Backup ID: ${data.backupDocId ?? 'N/A'}`]);

      // Trigger JSON download
      const blob = new Blob([JSON.stringify({ meta, backup }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mfo-platform-backup-${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setLog(p => [...p, '💾 JSON file downloaded to your computer']);
      onBackupDone();
    } catch (e: any) {
      setError(e.message);
      setLog(p => [...p, `❌ Backup failed: ${e.message}`]);
    } finally { setLoading(false); }
  }

  const platformBackups = history.filter(h => h.type === 'platform_full');

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 28 }}>
        {[
          { label: 'Total Backups', value: platformBackups.length, icon: '💾', color: '#6366f1' },
          { label: 'Last Backup', value: platformBackups[0] ? formatDate(platformBackups[0].exportedAt) : 'Never', icon: '🕒', color: '#22d3ee' },
          { label: 'Last Backup Size', value: formatBytes(platformBackups[0]?.sizeEstimate), icon: '📦', color: '#22c55e' },
        ].map(c => (
          <div key={c.label} style={{ padding: '20px 24px', background: 'var(--bg-elevated)', borderRadius: 12, border: `1px solid ${c.color}22` }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Backup action */}
      <div style={{ padding: '24px', background: 'var(--bg-elevated)', borderRadius: 14, border: '1px solid var(--border)', marginBottom: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Full Platform Backup</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          Exports ALL data across ALL tenants and ALL Firestore collections as a single JSON file. The file is downloaded directly to your computer and a record is saved to the database.
        </div>
        <div style={{ padding: '10px 16px', background: '#22c55e0a', border: '1px solid #22c55e22', borderRadius: 8, fontSize: 12, color: '#86efac', marginBottom: 16 }}>
          🛡 <strong>100% Recoverability:</strong> The exported JSON can be fully restored via the Recovery & Import tab.
        </div>
        {error && <div style={{ marginBottom: 12, padding: '10px 14px', background: '#ef444411', border: '1px solid #ef444433', borderRadius: 8, fontSize: 13, color: '#fca5a5' }}>❌ {error}</div>}
        <ProgressLog lines={log} />
        <button className="btn btn-primary" onClick={runFullBackup} disabled={loading} style={{ marginTop: log.length > 0 ? 12 : 0, padding: '12px 32px', fontSize: 15 }}>
          {loading ? '⏳ Backing up…' : '💾 Backup Entire Platform Now'}
        </button>
      </div>

      {/* Schedule (UI only — no backend scheduler in client) */}
      <div style={{ padding: '20px 24px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>⏰ Automated Backup Schedule</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>Configure automatic backup triggers (requires server-side cron job).</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {[
            { label: 'Frequency', options: ['Daily', 'Weekly', 'Manual only'] },
            { label: 'Retention (keep last N)', options: ['7', '14', '30', '90'] },
            { label: 'Backup Window', options: ['02:00 UTC', '04:00 UTC', '06:00 UTC'] },
          ].map(f => (
            <div key={f.label}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
              <select className="input" style={{ width: '100%', padding: '8px 12px' }}>
                {f.options.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📋 Backup History</div>
      {platformBackups.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px dashed var(--border)' }}>
          No platform backups recorded yet. Run your first backup above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {platformBackups.slice(0, 10).map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 20 }}>💾</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Platform Full Backup</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDate(b.exportedAt)} · {b.totalDocuments ?? 0} docs · {formatBytes(b.sizeEstimate)}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#22c55e18', color: '#22c55e' }}>✓ {b.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Tenant Backups ───────────────────────────────────────────────────────

function TenantBackupsTab({ history, onBackupDone }: { history: BackupRecord[]; onBackupDone: () => void }) {
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getDocs(query(collection(db, 'tenants'), limit(50))).then(snap => {
      setTenants(snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name ?? d.id })));
    }).catch(() => {});
  }, []);

  async function runTenantBackup() {
    if (!selectedTenantId) return;
    setLoading(true); setError(''); setLog([`🔄 Backing up tenant "${selectedTenantId}"…`]);
    try {
      const res = await fetch('/api/admin/backups/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: selectedTenantId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const { meta, backup } = data;
      setLog(p => [...p, `✅ Backup complete — ${meta.totalDocuments} documents`, `📄 Backup ID: ${data.backupDocId ?? 'N/A'}`]);

      const blob = new Blob([JSON.stringify({ meta, backup }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mfo-tenant-${selectedTenantId}-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setLog(p => [...p, '💾 JSON file downloaded']);
      onBackupDone();
    } catch (e: any) {
      setError(e.message);
      setLog(p => [...p, `❌ ${e.message}`]);
    } finally { setLoading(false); }
  }

  const tenantHistory = history.filter(h => h.type === 'tenant');

  return (
    <div>
      {/* Tenant selector */}
      <div style={{ padding: '24px', background: 'var(--bg-elevated)', borderRadius: 14, border: '1px solid var(--border)', marginBottom: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Tenant Backup</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          Export data for a specific tenant only — includes all documents referencing that tenant ID.
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>Select Tenant</label>
            <select className="input" style={{ width: '100%', padding: '10px 12px' }} value={selectedTenantId} onChange={e => setSelectedTenantId(e.target.value)}>
              <option value="">— Select a tenant —</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.id})</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={runTenantBackup} disabled={loading || !selectedTenantId} style={{ padding: '10px 24px', flexShrink: 0 }}>
            {loading ? '⏳ Exporting…' : '💾 Export Tenant'}
          </button>
        </div>
        {error && <div style={{ marginBottom: 12, padding: '10px 14px', background: '#ef444411', border: '1px solid #ef444433', borderRadius: 8, fontSize: 13, color: '#fca5a5' }}>❌ {error}</div>}
        <ProgressLog lines={log} />
      </div>

      {/* Tenant backup history */}
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📋 Tenant Backup History</div>
      {tenantHistory.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px dashed var(--border)' }}>No tenant backups recorded yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tenantHistory.map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 20 }}>🏢</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{b.tenantId ?? 'Unknown tenant'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDate(b.exportedAt)} · {b.totalDocuments ?? 0} docs · {formatBytes(b.sizeEstimate)}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#22c55e18', color: '#22c55e' }}>✓ {b.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Recovery & Import ────────────────────────────────────────────────────

function RecoveryTab() {
  const [file, setFile] = useState<File | null>(null);
  const [payload, setPayload] = useState<any>(null);
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileLoad(f: File) {
    setFile(f); setResult(null); setLog([]); setError('');
    try {
      const text = await f.text();
      const parsed = JSON.parse(text);
      setPayload(parsed);
      const meta = parsed.meta;
      setLog([
        `📂 File loaded: ${f.name}`,
        `📅 Exported: ${meta?.exportedAt ? formatDate(meta.exportedAt) : 'unknown'}`,
        `📦 Type: ${meta?.type ?? 'unknown'}`,
        `📊 ${meta?.totalDocuments ?? '?'} documents across ${meta?.collectionsExported ?? '?'} collections`,
        meta?.errors?.length ? `⚠️ Collections with errors during export: ${meta.errors.join(', ')}` : '',
      ].filter(Boolean));
    } catch {
      setError('Invalid backup file — could not parse JSON');
      setPayload(null);
    }
  }

  async function runImport() {
    if (!payload?.backup) { setError('No backup data loaded'); return; }
    setLoading(true); setError('');
    setLog(prev => [...prev, `\n${dryRun ? '🧪 Running dry-run (no writes)…' : '📥 Importing data into Firestore…'}`]);

    try {
      const res = await fetch('/api/admin/backups/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: payload.backup, dryRun }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setLog(prev => [
        ...prev,
        `✅ ${dryRun ? 'Dry-run complete' : 'Import complete'} — ${data.totalWritten} documents ${dryRun ? 'would be' : ''} written`,
        ...(data.report ?? []).map((r: any) => `  ${r.collection}: ${r.docsWritten} written, ${r.docsSkipped} skipped`),
      ]);
    } catch (e: any) {
      setError(e.message);
      setLog(prev => [...prev, `❌ ${e.message}`]);
    } finally { setLoading(false); }
  }

  return (
    <div>
      <div style={{ padding: '24px', background: 'var(--bg-elevated)', borderRadius: 14, border: '1px solid var(--border)', marginBottom: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Recovery & Import</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          Restore the platform from a previously exported JSON backup file. Always run a <strong>Dry Run</strong> first to verify what will be restored before committing.
        </div>

        {/* File drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileLoad(f); }}
          style={{
            border: `2px dashed ${file ? 'var(--brand-500)' : 'var(--border)'}`,
            borderRadius: 12, padding: '32px', textAlign: 'center', cursor: 'pointer',
            background: file ? 'var(--brand-500)08' : 'var(--bg-canvas)', marginBottom: 20,
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 10 }}>{file ? '📂' : '📁'}</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            {file ? file.name : 'Drop JSON backup file here'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {file ? `${formatBytes(file.size)} — click to replace` : 'or click to browse · accepts .json backup files'}
          </div>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileLoad(f); e.target.value = ''; }} />
        </div>

        {/* Options */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-canvas)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>🧪 Dry Run Mode</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Simulates import without writing to Firestore — always run first</div>
          </div>
          <button onClick={() => setDryRun(v => !v)} style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: dryRun ? 'var(--brand-500)' : 'var(--bg-elevated)', boxShadow: 'inset 0 0 0 1px var(--border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 3, left: dryRun ? 24 : 4, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
          </button>
        </div>

        {error && <div style={{ marginBottom: 12, padding: '10px 14px', background: '#ef444411', border: '1px solid #ef444433', borderRadius: 8, fontSize: 13, color: '#fca5a5' }}>❌ {error}</div>}

        {!dryRun && (
          <div style={{ marginBottom: 12, padding: '10px 14px', background: '#ef444411', border: '1px solid #ef444433', borderRadius: 8, fontSize: 13, color: '#fca5a5' }}>
            ⚠️ <strong>Live import mode.</strong> This will write data directly to your Firestore database and overwrite existing documents. This action cannot be undone.
          </div>
        )}

        <ProgressLog lines={log} />

        {payload && (
          <button
            className={`btn ${dryRun ? 'btn-outline' : 'btn-primary'}`}
            onClick={runImport}
            disabled={loading}
            style={{ marginTop: log.length > 0 ? 12 : 0, padding: '12px 32px', fontSize: 15 }}
          >
            {loading ? '⏳ Processing…' : dryRun ? '🧪 Run Dry-Run Validation' : '📥 Import & Restore Now'}
          </button>
        )}
      </div>

      {/* Result summary */}
      {result && (
        <div style={{ padding: '20px 24px', background: result.dryRun ? '#3b82f611' : '#22c55e11', border: `1px solid ${result.dryRun ? '#3b82f633' : '#22c55e33'}`, borderRadius: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10, color: result.dryRun ? '#3b82f6' : '#22c55e' }}>
            {result.dryRun ? '🧪 Dry-Run Report' : '✅ Import Complete'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {(result.report ?? []).slice(0, 9).map((r: any) => (
              <div key={r.collection} style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: 12 }}>{r.collection}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{r.docsWritten} docs · {r.docsSkipped} skipped</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BackupsPage() {
  const { isSaasMasterAdmin } = useAuth();
  const [tab, setTab] = useState<'platform' | 'tenant' | 'recovery'>('platform');
  const [history, setHistory] = useState<BackupRecord[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/backups/history');
      const data = await res.json();
      setHistory(data.backups ?? []);
    } catch {}
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  if (!isSaasMasterAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16 }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Access Restricted</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Backup Management is only accessible to Super Admins.</div>
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fade-in">
      {/* Compact toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', borderRadius: 10, padding: 4 }}>
          {[
            { id: 'platform',  label: '🌐 Platform Backup' },
            { id: 'tenant',    label: '🏢 Tenant Backups' },
            { id: 'recovery',  label: '📥 Recovery & Import' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              background: tab === t.id ? 'var(--brand-500)' : 'transparent',
              color: tab === t.id ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {tab === 'platform' && <PlatformBackupTab history={history} onBackupDone={loadHistory} />}
      {tab === 'tenant'   && <TenantBackupsTab  history={history} onBackupDone={loadHistory} />}
      {tab === 'recovery' && <RecoveryTab />}
    </div>
  );
}
