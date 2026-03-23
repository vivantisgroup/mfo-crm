'use client';
import React, { useState, useEffect, useMemo } from 'react';
import type { ActiveTenant, UserSession } from '@/lib/AuthContext';

export interface FeedConfig {
  id: string;
  label: string;
  scope?: 'user' | 'tenant' | 'platform';
  tenantId?: string;
  userId?: string;
  url: string;
  method: 'GET' | 'POST';
  authType?: 'none' | 'bearer' | 'apikey_header';
  authKeyName?: string;
  authValue?: string;
  headers: string;
  body: string;
  pathToArray: string;
  textField: string;
  typeField?: string;
  skipRows?: number;
  enabled: boolean;
  lastFetched?: string;
  error?: string;
}

const LS: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em',
};

// ─── JSON Tree Inspector ──────────────────────────────────────────────────────
function JsonNode({ data, path, depth, onPath }: {
  data: any; path: string; depth: number; onPath?: (p: string, v: any) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isArr = Array.isArray(data);
  const type = isArr ? 'array' : typeof data;

  if (type !== 'object' && type !== 'array') {
    const col = type === 'string' ? '#22d3ee' : type === 'number' ? '#a78bfa' : '#f59e0b';
    const txt = type === 'string' ? `"${String(data).slice(0, 60)}${String(data).length > 60 ? '…' : ''}"` : String(data);
    return (
      <span style={{ color: col, cursor: 'pointer' }} onClick={() => onPath?.(path, data)} title={`Use: ${path}`}>
        {txt} {onPath && <span style={{ color: '#6366f1', fontSize: 9 }}>↗</span>}
      </span>
    );
  }

  const entries: [string, any][] = isArr
    ? (data as any[]).map((v, i) => [String(i), v])
    : Object.entries(data as object);

  return (
    <div style={{ marginLeft: depth > 0 ? 14 : 0 }}>
      <span style={{ cursor: 'pointer', fontSize: 11, color: '#64748b', userSelect: 'none' }} onClick={() => setOpen(o => !o)}>
        {open ? '▼' : '▶'}
        <span style={{ color: isArr ? '#f59e0b' : '#818cf8', marginLeft: 4 }}>
          {isArr ? `[${data.length} items]` : `{${entries.length} keys}`}
        </span>
        {isArr && onPath && (
          <span
            onClick={e => { e.stopPropagation(); onPath(path, data); }}
            style={{ marginLeft: 6, fontSize: 9, background: '#6366f122', color: '#a78bfa', padding: '1px 6px', borderRadius: 4, border: '1px solid #6366f140' }}>
            use as array
          </span>
        )}
      </span>
      {open && (
        <div style={{ borderLeft: '1px solid #1e293b', marginLeft: 8, paddingLeft: 8, marginTop: 2 }}>
          {entries.slice(0, 40).map(([k, v]) => (
            <div key={k} style={{ fontSize: 12, lineHeight: '22px' }}>
              <span style={{ color: '#e2e8f0' }}>{k}: </span>
              <JsonNode data={v} path={path ? `${path}.${k}` : k} depth={depth + 1} onPath={onPath} />
            </div>
          ))}
          {entries.length > 40 && <div style={{ color: '#475569', fontSize: 11 }}>…+{entries.length - 40} more</div>}
        </div>
      )}
    </div>
  );
}

// ─── Feed Wizard ──────────────────────────────────────────────────────────────
const STEPS = [
  { n: '1', label: 'Connect', desc: 'Source & auth' },
  { n: '2', label: 'Map & Test', desc: 'Inspect & map fields' },
  { n: '3', label: 'Preview', desc: 'Review & activate' },
];

export function FeedWizard({ initialFeed, onSave, onCancel, tenant, user }: {
  initialFeed: FeedConfig;
  onSave: (f: FeedConfig) => void;
  onCancel: () => void;
  tenant: ActiveTenant | null;
  user: UserSession | null;
}) {
  const [step, setStep] = useState(0);
  const [feed, setFeed] = useState<FeedConfig>(initialFeed);
  const [loading, setLoading] = useState(false);
  const [raw, setRaw] = useState<any>(null);
  const [arr, setArr] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ms, setMs] = useState<number | null>(null);

  const extractArr = (json: any, path: string, skip: number) => {
    let a: any = json;
    if (path) for (const k of path.split('.')) if (k) a = a?.[k];
    return Array.isArray(a) ? a.slice(skip) : null;
  };

  const doFetch = async () => {
    if (!feed.url) return;
    setLoading(true); setErr(null); setRaw(null); setArr(null);
    const t0 = Date.now();
    try {
      const hdrs: Record<string, string> = { Accept: 'application/json' };
      try { Object.assign(hdrs, JSON.parse(feed.headers || '{}')); } catch { /* ignore */ }
      if (feed.authType === 'bearer' && feed.authValue)
        hdrs.Authorization = `Bearer ${feed.authValue}`;
      else if (feed.authType === 'apikey_header' && feed.authKeyName && feed.authValue)
        hdrs[feed.authKeyName] = feed.authValue;

      const opts: RequestInit = { method: feed.method, headers: hdrs };
      if (feed.method === 'POST' && feed.body) opts.body = feed.body;

      const res = await fetch(feed.url, opts);
      const text = await res.text();
      setMs(Date.now() - t0);

      if (!res.ok) { setErr(`HTTP ${res.status} ${res.statusText}\n${text.slice(0, 400)}`); setLoading(false); return; }

      let json: any;
      try { json = JSON.parse(text); } catch { setErr(`Not valid JSON:\n${text.slice(0, 400)}`); setLoading(false); return; }

      setRaw(json);
      setArr(extractArr(json, feed.pathToArray, feed.skipRows || 0));
    } catch (e: any) {
      setMs(Date.now() - t0);
      const msg = String(e?.message ?? e);
      if (msg.includes('fetch') || msg.includes('CORS') || msg.includes('Network'))
        setErr(`CORS blocked. Prefix URL with:\nhttps://corsproxy.io/?\n\n${msg}`);
      else setErr(msg);
    }
    setLoading(false);
  };

  const onPath = (path: string, value: any) => {
    if (Array.isArray(value)) {
      setFeed(f => ({ ...f, pathToArray: path }));
      setArr(value.slice(feed.skipRows || 0));
    } else {
      const key = path.split('.').pop() || path;
      setFeed(f => ({ ...f, textField: f.textField ? `${f.textField}{${key}}` : `{${key}}` }));
    }
  };

  const sampleItem = arr?.[0];
  const sampleKeys: string[] = useMemo(() =>
    (sampleItem && typeof sampleItem === 'object') ? Object.keys(sampleItem) : [],
    [sampleItem]);

  const renderItem = (item: any): string => {
    let t = feed.textField;
    if (t.includes('{')) {
      t = t.replace(/\{([^}]+)\}/g, (_, p) => {
        const v = p.split('.').reduce((o: any, k: string) => o?.[k], item);
        return v !== undefined && v !== null ? String(v) : `{${p}}`;
      });
    } else {
      t = String(item?.[feed.textField] ?? JSON.stringify(item));
    }
    return `[${feed.label}] ${t.slice(0, 160)}`;
  };

  const previews: string[] = arr ? arr.slice(0, 6).map(renderItem) : [];
  const ok0 = !!feed.url && !!feed.label;
  const ok1 = !!feed.textField;

  const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', padding: '9px 12px', ...extra,
  });

  const QUICKSTART = [
    ['IBGE IPCA', 'https://apisidra.ibge.gov.br/values/t/1737/n/all/p/last'],
    ['JSONPlaceholder', 'https://jsonplaceholder.typicode.com/todos?_limit=10'],
    ['CoinGecko', 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=5'],
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 480, flex: 1 }}>

      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid var(--border)', background: '#080d18', flexShrink: 0 }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={i}>
            <button onClick={() => i < step && setStep(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', cursor: i < step ? 'pointer' : 'default', padding: '6px 10px', borderRadius: 8, opacity: i > step ? 0.4 : 1 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: 'white', flexShrink: 0,
                background: i === step ? '#6366f1' : i < step ? '#22c55e' : '#1e293b',
                border: `2px solid ${i === step ? '#818cf8' : i < step ? '#22c55e' : '#334155'}`,
              }}>{i < step ? '✓' : s.n}</div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: i === step ? 700 : 500, color: i === step ? 'white' : '#64748b' }}>{s.label}</div>
                <div style={{ fontSize: 10, color: '#334155' }}>{s.desc}</div>
              </div>
            </button>
            {i < 2 && <div style={{ flex: 1, height: 1, background: i < step ? '#22c55e44' : '#1e293b', margin: '0 4px' }} />}
          </React.Fragment>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* ── Step 0: Connect ── */}
        {step === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={LS}>Feed Name *</label>
              <input className="input" value={feed.label} onChange={e => setFeed(f => ({ ...f, label: e.target.value }))} style={inp()} placeholder="e.g. IPCA Inflation" />
            </div>
            <div>
              <label style={LS}>Scope</label>
              <select className="input" value={feed.scope || 'user'} onChange={e => setFeed(f => ({ ...f, scope: e.target.value as any }))} style={inp()}>
                <option value="user">🧍 Just Me</option>
                {tenant?.role === 'admin' && <option value="tenant">🏢 Tenant</option>}
                {user?.role === 'saas_master_admin' && <option value="platform">🌐 Platform</option>}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={LS}>API URL *</label>
              <input className="input" type="url" value={feed.url} onChange={e => setFeed(f => ({ ...f, url: e.target.value }))} style={inp({ fontFamily: 'monospace', fontSize: 12 })} placeholder="https://api.example.com/data" />
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#475569' }}>Quick start:</span>
                {QUICKSTART.map(([l, u]) => (
                  <button key={l} onClick={() => setFeed(f => ({ ...f, url: u }))}
                    style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#0f172a', color: '#94a3b8', border: '1px solid #1e293b', cursor: 'pointer' }}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={LS}>Method</label>
              <select className="input" value={feed.method} onChange={e => setFeed(f => ({ ...f, method: e.target.value as any }))} style={inp()}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>
            <div>
              <label style={LS}>Authentication</label>
              <select className="input" value={feed.authType || 'none'} onChange={e => setFeed(f => ({ ...f, authType: e.target.value as any }))} style={inp()}>
                <option value="none">No Auth</option>
                <option value="bearer">Bearer Token</option>
                <option value="apikey_header">API Key (Header)</option>
              </select>
            </div>
            {feed.authType === 'apikey_header' && (
              <div>
                <label style={LS}>Header Name</label>
                <input className="input" value={feed.authKeyName || ''} onChange={e => setFeed(f => ({ ...f, authKeyName: e.target.value }))} style={inp({ fontFamily: 'monospace' })} placeholder="x-api-key" />
              </div>
            )}
            {(feed.authType === 'bearer' || feed.authType === 'apikey_header') && (
              <div style={{ gridColumn: feed.authType === 'bearer' ? '1/-1' : 'auto' }}>
                <label style={LS}>Token / Key</label>
                <input type="password" className="input" value={feed.authValue || ''} onChange={e => setFeed(f => ({ ...f, authValue: e.target.value }))} style={inp({ fontFamily: 'monospace' })} placeholder="••••••••" />
              </div>
            )}
            {feed.method === 'POST' && (
              <div style={{ gridColumn: '1/-1' }}>
                <label style={LS}>Request Body (JSON)</label>
                <textarea className="input" value={feed.body} onChange={e => setFeed(f => ({ ...f, body: e.target.value }))} style={inp({ fontFamily: 'monospace', fontSize: 12, height: 64 })} />
              </div>
            )}
            <div style={{ gridColumn: '1/-1' }}>
              <label style={LS}>Extra Headers (JSON)</label>
              <input className="input" value={feed.headers} onChange={e => setFeed(f => ({ ...f, headers: e.target.value }))} style={inp({ fontFamily: 'monospace', fontSize: 12 })} placeholder='{"X-Custom": "value"}' />
            </div>
          </div>
        )}

        {/* ── Step 1: Map & Test ── */}
        {step === 1 && (
          <div>
            {/* Fetch bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <button onClick={doFetch} disabled={loading} className="btn btn-primary btn-sm">
                {loading ? '⏳ Fetching…' : '⚡ Fetch & Inspect'}
              </button>
              {ms !== null && !err && <span style={{ fontSize: 12, color: '#22c55e' }}>✓ {ms}ms</span>}
              {raw !== null && <span style={{ fontSize: 12, color: '#64748b' }}>{Array.isArray(raw) ? `Array[${raw.length}]` : 'Object'}</span>}
            </div>

            {/* CORS tip */}
            <div style={{ marginBottom: 14, padding: '9px 14px', background: '#080d18', borderRadius: 8, border: '1px solid #1e293b', fontSize: 12, color: '#64748b' }}>
              💡 CORS blocked? Prefix URL with <code style={{ color: '#22d3ee' }}>https://corsproxy.io/?</code> or use the API&apos;s SDK.
            </div>

            {/* Error */}
            {err && (
              <div style={{ marginBottom: 14, padding: '12px 14px', background: '#ef444410', borderRadius: 8, border: '1px solid #ef444430' }}>
                <div style={{ fontWeight: 700, color: '#ef4444', fontSize: 13, marginBottom: 4 }}>❌ Error</div>
                <pre style={{ fontSize: 12, color: '#fca5a5', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{err}</pre>
              </div>
            )}

            {/* JSON inspector */}
            {raw !== null && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  📦 Response Inspector
                  <span style={{ fontSize: 11, fontWeight: 400, color: '#64748b' }}>Click arrays → use as source · Click values → insert as field</span>
                </div>
                <div style={{ background: '#080d18', borderRadius: 10, border: '1px solid #1e293b', padding: 12, maxHeight: 220, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
                  <JsonNode data={raw} path="" depth={0} onPath={onPath} />
                </div>
              </div>
            )}

            {/* Mapping */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={LS}>Path to Array <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(blank = root)</span></label>
                <input className="input" value={feed.pathToArray}
                  onChange={e => {
                    setFeed(f => ({ ...f, pathToArray: e.target.value }));
                    if (raw) setArr(extractArr(raw, e.target.value, feed.skipRows || 0));
                  }}
                  style={inp({ fontFamily: 'monospace' })} placeholder="data.results" />
              </div>
              <div>
                <label style={LS}>Skip First N Rows <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(header rows)</span></label>
                <input type="number" min={0} max={20} className="input" value={feed.skipRows || 0}
                  onChange={e => {
                    const n = parseInt(e.target.value) || 0;
                    setFeed(f => ({ ...f, skipRows: n }));
                    if (raw) setArr(extractArr(raw, feed.pathToArray, n));
                  }}
                  style={inp()} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={LS}>Text Template * <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>use {'{fieldName}'} to interpolate values</span></label>
                <input className="input" value={feed.textField}
                  onChange={e => setFeed(f => ({ ...f, textField: e.target.value }))}
                  style={inp({ fontFamily: 'monospace' })} placeholder="{title}  or  IPCA: {V}% em {D2N}" />
                {sampleKeys.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#475569' }}>Available fields:</span>
                    {sampleKeys.slice(0, 12).map(k => (
                      <button key={k}
                        onClick={() => setFeed(f => ({ ...f, textField: f.textField ? `${f.textField}{${k}}` : `{${k}}` }))}
                        style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: '#6366f115', color: '#a78bfa', border: '1px solid #6366f140', cursor: 'pointer', fontFamily: 'monospace' }}>
                        {'{' + k + '}'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Live preview */}
            {previews.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>👁 Live Preview</div>
                {previews.map((t, i) => (
                  <div key={i} style={{ padding: '9px 14px', background: '#080d18', borderRadius: 7, border: '1px solid #1e293b', fontSize: 12, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'monospace' }}>
                    <span style={{ color: '#f59e0b' }}>ℹ️</span>
                    <span style={{ color: '#e2e8f0' }}>{t}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Preview & Activate ── */}
        {step === 2 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {([['Feed Name', feed.label, false], ['URL', feed.url, true], ['Method · Auth', `${feed.method} · ${feed.authType || 'none'}`, false], ['Template', feed.textField, true]] as [string, string, boolean][]).map(([k, v, mono]) => (
                <div key={k} style={{ padding: '14px 16px', background: '#080d18', borderRadius: 8, border: '1px solid #1e293b', wordBreak: 'break-all' }}>
                  <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{k}</div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: mono ? '#22d3ee' : 'white', fontFamily: mono ? 'monospace' : 'inherit' }}>{v || '—'}</div>
                </div>
              ))}
            </div>
            {previews.length > 0 ? (
              <>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#22c55e' }}>✅ {previews.length} items ready for the ticker</div>
                {previews.map((t, i) => (
                  <div key={i} style={{ padding: '10px 14px', background: 'linear-gradient(90deg,#080d18,#0a1020)', borderRadius: 8, border: '1px solid #22c55e30', fontSize: 12, marginBottom: 6, display: 'flex', gap: 8, fontFamily: 'monospace', alignItems: 'center' }}>
                    <span>ℹ️</span><span style={{ color: '#e2e8f0' }}>{t}</span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 20px', border: '2px dashed #1e293b', borderRadius: 10 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
                <p style={{ color: '#475569', fontSize: 13 }}>Go back to Step 2 to fetch and preview data.</p>
                <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={() => setStep(1)}>← Back to Map</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderTop: '1px solid var(--border)', background: '#080d18', flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}>
          {step === 0 ? '✕ Cancel' : '← Back'}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {ok1 && step > 0 && (
            <button className="btn btn-outline btn-sm" onClick={() => onSave({ ...feed, enabled: true })}>Save Now</button>
          )}
          {step < 2
            ? <button className="btn btn-primary btn-sm" disabled={step === 0 ? !ok0 : !ok1} onClick={() => setStep(s => s + 1)}>Next →</button>
            : <button className="btn btn-primary btn-sm" disabled={!ok0 || !ok1} onClick={() => onSave({ ...feed, enabled: true })}>💾 Activate Feed</button>
          }
        </div>
      </div>
    </div>
  );
}
