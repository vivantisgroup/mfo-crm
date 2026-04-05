'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { TASKS, SERVICE_REQUESTS } from '@/lib/mockData';
import { useUserSettings } from '@/lib/UserSettingsContext';
import { useTranslation } from '@/lib/i18n/context';
import { Eye, EyeOff, Settings, CheckSquare, Briefcase, TrendingUp, ShieldCheck, Plug, Radio, SlidersHorizontal, Megaphone, Info, AlertTriangle, OctagonAlert, RefreshCw, BellRing } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useAuth } from '@/lib/AuthContext';
import { FeedWizard, type FeedConfig } from '@/components/FeedWizard';
import { useTaskQueue } from '@/lib/TaskQueueContext';

// --- Types -------------------------------------------------------------------

type AlertCategory = 'task' | 'concierge' | 'market' | 'compliance' | 'custom' | 'broadcast';

interface Alert {
  id: string;
  text: string;
  type: 'urgent' | 'alert' | 'info' | 'broadcast';
  category: AlertCategory;
  action?: () => void;
  url?: string;
  source?: string;
}

interface BroadcastAlert {
  id: string;
  text: string;
  severity: 'info' | 'warning' | 'critical';
  publishedAt: number;
}

interface CategoryConfig {
  key: AlertCategory;
  label: string;
  icon: string;
  enabled: boolean;
}

// --- Constants ---------------------------------------------------------------

const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { key: 'task',       label: 'Tasks',        icon: 'task', enabled: true  },
  { key: 'concierge',  label: 'Concierge',    icon: 'concierge', enabled: true  },
  { key: 'market',     label: 'Market',       icon: 'market', enabled: true  },
  { key: 'compliance', label: 'Compliance',   icon: 'compliance', enabled: true  },
  { key: 'custom',     label: 'Custom Feeds', icon: 'custom', enabled: false },
  { key: 'broadcast',  label: 'Broadcast',    icon: 'broadcast', enabled: false },
];

function CategoryIcon({ type, size = 14 }: { type: string, size?: number }) {
  switch (type) {
    case 'task': return <CheckSquare size={size} />;
    case 'concierge': return <Briefcase size={size} />;
    case 'market': return <TrendingUp size={size} />;
    case 'compliance': return <ShieldCheck size={size} />;
    case 'custom': return <Plug size={size} />;
    case 'broadcast': return <Radio size={size} />;
    default: return <Info size={size} />;
  }
}

const STORAGE_CATS   = 'ticker_categories_v2';
const STORAGE_FEEDS  = 'ticker_feeds_v3';
const STORAGE_DIS    = 'ticker_dismissed_v1';
const STORAGE_BROAD  = 'ticker_broadcasts_v1';
const POLL_MS        = 60_000;

// --- Helpers -----------------------------------------------------------------

const DEFAULT_FEED = (): FeedConfig => ({
  id: `feed-${Date.now()}`,
  label: '',
  url: '',
  method: 'GET',
  authType: 'none',
  headers: '{}',
  body: '',
  pathToArray: '',
  textField: '',
  enabled: true,
});

function getTypeColor(type: Alert['type']): string {
  switch (type) {
    case 'urgent':    return '#ef4444';
    case 'alert':     return '#f59e0b';
    case 'broadcast': return '#8b5cf6';
    default:          return '#22d3ee';
  }
}

function getDot(type: Alert['type']): React.CSSProperties {
  const c = getTypeColor(type);
  return { background: c, boxShadow: `0 0 6px ${c}88` };
}

// --- Static alerts -----------------------------------------------------------

function buildStaticAlerts(): Alert[] {
  return [
    { id: 'cc-001', text: 'Capital Call: Sequoia XVI — $1.25M due Apr 1', type: 'urgent', category: 'task' },
    { id: 'cc-002', text: 'Capital Call: Blackstone BREP X — $2M due Mar 28', type: 'urgent', category: 'task' },
    { id: 'cc-003', text: 'OVERDUE: EQT X Capital Call — $500k past due (Rodríguez)', type: 'urgent', category: 'compliance' },
    { id: 'kyc-004', text: 'KYC Renewal: Al-Rashid Family — docs due in 5 days', type: 'alert', category: 'compliance' },
    { id: 'sr-001', text: 'Concierge: Private jet KTEB→KOPF for James Smith — Apr 4 confirmed', type: 'info', category: 'concierge' },
    { id: 'sr-002', text: 'Concierge: Villa maintenance (Cap Ferrat) — awaiting vendor', type: 'info', category: 'concierge' },
    { id: 'mkt-001', text: 'Market: S&P 500 +0.82% | Nasdaq +1.1% | 10Y UST 4.31%', type: 'info', category: 'market' },
    { id: 'mkt-002', text: 'Market: EUR/USD 1.0842 | Gold $2,318/oz | WTI $81.4/bbl', type: 'info', category: 'market' },
    { id: 'tsk-001', text: 'Task Due Mar 25: Q1 2026 performance pack (Smith Family)', type: 'alert', category: 'task' },
    { id: 'tsk-002', text: 'Task Due Mar 26: Liquidity analysis — Miami property (James Smith)', type: 'alert', category: 'task' },
  ];
}

// --- Ticker Item -------------------------------------------------------------

function TickerItem({ alert, onDismiss, onClick }: {
  alert: Alert;
  onDismiss: (id: string) => void;
  onClick?: () => void;
}) {
  const color = getTypeColor(alert.type);
  const dot   = getDot(alert.type);

  return (
    <span
      className="hover-lift"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '0 20px', height: '100%', cursor: onClick ? 'pointer' : 'default',
        borderRight: '1px solid var(--border)', whiteSpace: 'nowrap',
        transition: 'background 0.15s',
      }}
      onClick={onClick}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block', ...dot }} />
      {alert.source && (
        <span style={{ fontSize: 9, color, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', flexShrink: 0 }}>
          [{alert.source}]
        </span>
      )}
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{alert.text}</span>
      {alert.url && (
        <a href={alert.url} target="_blank" rel="noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ fontSize: 10, color, textDecoration: 'underline', flexShrink: 0, fontWeight: 800 }}>
          View
        </a>
      )}
      <button
        onClick={e => { e.stopPropagation(); onDismiss(alert.id); }}
        style={{
          background: 'none', border: 'none', color: 'var(--text-tertiary)',
          cursor: 'pointer', fontSize: 13, padding: '0 4px', lineHeight: 1, flexShrink: 0,
        }}
        title="Dismiss"
        aria-label="Dismiss alert"
      >
        ×
      </button>
    </span>
  );
}

// --- Smart Alerts Manager ---------------------------------------------------

const MANAGER_TABS = ['channels', 'feeds', 'broadcast'] as const;
type ManagerTab = typeof MANAGER_TABS[number];

interface ManagerProps {
  categories: CategoryConfig[];
  onCategoriesChange: (c: CategoryConfig[]) => void;
  feeds: FeedConfig[];
  onFeedsChange: (f: FeedConfig[]) => void;
  broadcastAlerts: BroadcastAlert[];
  onPublishBroadcast: (text: string, severity: BroadcastAlert['severity']) => void;
  dismissedIds: Set<string>;
  onRestoreDismissed: () => void;
  onClose: () => void;
}

function SmartAlertsManager({
  categories, onCategoriesChange,
  feeds, onFeedsChange,
  broadcastAlerts, onPublishBroadcast,
  dismissedIds, onRestoreDismissed,
  onClose,
}: ManagerProps) {
  const { tenant, user } = useAuth();
  const [tab, setTab]           = useState<ManagerTab>('channels');
  const [showWizard, setShowWizard] = useState(false);
  const [editFeed, setEditFeed] = useState<FeedConfig>(DEFAULT_FEED());
  const [bcMsg, setBcMsg]       = useState('');
  const [bcSev, setBcSev]       = useState<BroadcastAlert['severity']>('info');

  const openNew  = () => { setEditFeed(DEFAULT_FEED()); setShowWizard(true); };
  const openEdit = (f: FeedConfig) => { setEditFeed({ ...f }); setShowWizard(true); };

  const handleSave = (f: FeedConfig) => {
    const next = feeds.find(x => x.id === f.id)
      ? feeds.map(x => x.id === f.id ? f : x)
      : [...feeds, f];
    onFeedsChange(next);
    setShowWizard(false);
  };

  const deleteFeed = (id: string) => onFeedsChange(feeds.filter(f => f.id !== id));

  const handlePublish = () => {
    if (!bcMsg.trim()) return;
    onPublishBroadcast(bcMsg.trim(), bcSev);
    setBcMsg('');
  };

  const TAB_LABELS: Record<ManagerTab, React.ReactNode> = {
    channels:  <div className="flex items-center gap-2"><SlidersHorizontal size={14} /> Channels & Filters</div>,
    feeds:     <div className="flex items-center gap-2"><Plug size={14} /> REST API Feeds</div>,
    broadcast: <div className="flex items-center gap-2"><Megaphone size={14} /> Publish Alert</div>,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 440 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px 0' }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BellRing size={16} /> Smart Alerts Manager
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: 12 }}>
            × Close
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '10px 24px 0', borderBottom: '1px solid var(--border)' }}>
        {MANAGER_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', fontSize: 12, fontWeight: tab === t ? 700 : 500,
            background: 'none', border: 'none', cursor: 'pointer',
            color: tab === t ? 'var(--brand-400)' : 'var(--text-secondary)',
            borderBottom: tab === t ? '2px solid var(--brand-400)' : '2px solid transparent',
            marginBottom: -1,
          }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>

        {/* Channels */}
        {tab === 'channels' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              Toggle which categories appear in your live ticker. Saved per-user.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {categories.map(cat => (
                <div key={cat.key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 18px', background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)', borderRadius: 10,
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CategoryIcon type={cat.key} size={14} /> {cat.label}
                    </div>
                    <div style={{ fontSize: 11, color: cat.enabled ? 'var(--color-green)' : 'var(--text-tertiary)', marginTop: 2 }}>
                      {cat.enabled ? '• Active' : '• Hidden'}
                    </div>
                  </div>
                  {/* Toggle */}
                  <button
                    onClick={() => onCategoriesChange(categories.map(c => c.key === cat.key ? { ...c, enabled: !c.enabled } : c))}
                    aria-label={`Toggle ${cat.label}`}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: cat.enabled ? 'var(--brand-500)' : 'var(--bg-overlay)',
                      position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 2, left: cat.enabled ? 22 : 2,
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'white', transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Dismissed Today: {dismissedIds.size}
              </div>
              {dismissedIds.size > 0 && (
                <button className="btn btn-ghost btn-sm flex items-center gap-2 mt-2" onClick={onRestoreDismissed} style={{ fontSize: 12 }}>
                  <RefreshCw size={12} /> Restore alerts
                </button>
              )}
            </div>
          </div>
        )}

        {/* Feeds */}
        {tab === 'feeds' && !showWizard && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                Connect external REST APIs to stream alerts into your ticker.
              </p>
              <button className="btn btn-primary btn-sm" onClick={openNew}>+ Add Feed</button>
            </div>
            {feeds.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}><Plug size={36} className="text-[var(--text-tertiary)] opacity-30" /></div>
                No feeds yet. Click <strong>+ Add Feed</strong> to get started.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {feeds.map(f => (
                  <div key={f.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)', borderRadius: 8,
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{f.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'monospace' }}>
                        {f.method} {f.url.slice(0, 60)}{f.url.length > 60 ? '...' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(f)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => deleteFeed(f.id)}
                        style={{ color: 'var(--color-red)' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'feeds' && showWizard && (
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowWizard(false)} style={{ marginBottom: 16 }}>
              ← Back to feeds
            </button>
            <FeedWizard
              initialFeed={editFeed}
              onSave={handleSave}
              onCancel={() => setShowWizard(false)}
              tenant={tenant}
              user={user}
            />
          </div>
        )}

        {/* Broadcast */}
        {tab === 'broadcast' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              Publish a firm-wide alert that appears in all users&apos; tickers instantly.
            </p>
            <select value={bcSev} onChange={e => setBcSev(e.target.value as any)} className="input" style={{ maxWidth: 200, fontSize: 13 }}>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <textarea
              className="input" rows={3} value={bcMsg}
              onChange={e => setBcMsg(e.target.value)}
              placeholder="Type your broadcast message..."
              style={{ resize: 'vertical', fontSize: 13, fontFamily: 'inherit' }}
            />
            <button className="btn btn-primary flex items-center gap-2" onClick={handlePublish} disabled={!bcMsg.trim()} style={{ alignSelf: 'flex-start' }}>
              <Megaphone size={14} /> Publish Alert
            </button>
            {broadcastAlerts.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 8 }}>RECENT BROADCASTS</div>
                {[...broadcastAlerts].reverse().slice(0, 5).map(b => (
                  <div key={b.id} style={{
                    padding: '10px 14px', background: 'var(--bg-elevated)',
                    borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, marginBottom: 6,
                    color: 'var(--text-secondary)',
                  }}>
                    <span style={{
                      fontWeight: 700,
                      color: b.severity === 'critical' ? '#ef4444' : b.severity === 'warning' ? '#f59e0b' : '#22d3ee',
                      display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 6
                    }}>
                      {b.severity === 'critical' && <OctagonAlert size={12} />}
                      {b.severity === 'warning' && <AlertTriangle size={12} />}
                      {b.severity === 'info' && <Info size={12} />}
                      [{b.severity.toUpperCase()}]
                    </span>{' '}
                    {b.text}
                    <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.5 }}>
                      {new Date(b.publishedAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Ticker Component ---------------------------------------------------

export function Ticker() {
  const { isHydrated }   = useAuth();
  const { notifications } = useTaskQueue();

  // Persisted state
  const [categories, setCategories] = useState<CategoryConfig[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_CATEGORIES;
    try { const s = localStorage.getItem(STORAGE_CATS); return s ? JSON.parse(s) : DEFAULT_CATEGORIES; }
    catch { return DEFAULT_CATEGORIES; }
  });

  const [feeds, setFeeds] = useState<FeedConfig[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const s = localStorage.getItem(STORAGE_FEEDS); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });

  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try { const s = localStorage.getItem(STORAGE_DIS); return new Set(s ? JSON.parse(s) : []); }
    catch { return new Set(); }
  });

  const [broadcastAlerts, setBroadcastAlerts] = useState<BroadcastAlert[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const s = localStorage.getItem(STORAGE_BROAD); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });

  const [feedAlerts, setFeedAlerts]   = useState<Alert[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [paused, setPaused]           = useState(false);
  const [speed, setSpeed]             = useState(1);
  const [visible, setVisible]         = useState(true);

  // Persist
  useEffect(() => { try { localStorage.setItem(STORAGE_CATS,  JSON.stringify(categories));  } catch {} }, [categories]);
  useEffect(() => { try { localStorage.setItem(STORAGE_FEEDS, JSON.stringify(feeds));       } catch {} }, [feeds]);
  useEffect(() => { try { localStorage.setItem(STORAGE_DIS,   JSON.stringify([...dismissed])); } catch {} }, [dismissed]);
  useEffect(() => { try { localStorage.setItem(STORAGE_BROAD, JSON.stringify(broadcastAlerts)); } catch {} }, [broadcastAlerts]);

  // Feed polling
  const feedTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const customEnabled = !!categories.find(c => c.key === 'custom')?.enabled;

  const pollFeed = useCallback(async (feed: FeedConfig) => {
    try {
      const hdrs: Record<string, string> = { Accept: 'application/json' };
      try { Object.assign(hdrs, JSON.parse(feed.headers || '{}')); } catch {}
      if (feed.authType === 'bearer'       && feed.authValue) hdrs['Authorization'] = `Bearer ${feed.authValue}`;
      if (feed.authType === 'apikey_header' && feed.authKeyName && feed.authValue)  hdrs[feed.authKeyName] = feed.authValue;

      const opts: RequestInit = { method: feed.method, headers: hdrs };
      if (feed.method === 'POST' && feed.body) opts.body = feed.body;

      const res = await fetch(feed.url, opts);
      if (!res.ok) return;
      const json = await res.json();

      let arr: any[] = Array.isArray(json) ? json : [];
      if (feed.pathToArray) {
        let cur = json;
        for (const k of feed.pathToArray.split('.')) { if (k) cur = cur?.[k]; }
        arr = Array.isArray(cur) ? cur : [];
      }
      arr = arr.slice(feed.skipRows ?? 0, (feed.skipRows ?? 0) + 6);

      const newAlerts: Alert[] = arr.map((item, i) => {
        let text = feed.textField || '';
        if (text.includes('{')) {
          text = text.replace(/\{([^}]+)\}/g, (_: string, p: string) => {
            const v = p.split('.').reduce((o: any, k: string) => o?.[k], item);
            return v !== undefined && v !== null ? String(v) : `{${p}}`;
          });
        } else {
          text = String(item?.[feed.textField] ?? item?.title ?? JSON.stringify(item).slice(0, 80));
        }
        return {
          id: `feed-${feed.id}-${i}`,
          text: `[${feed.label}] ${text.slice(0, 160)}`,
          type: 'info' as const,
          category: 'custom' as AlertCategory,
          source: feed.label,
        };
      });

      setFeedAlerts(prev => [...prev.filter(a => !a.id.startsWith(`feed-${feed.id}-`)), ...newAlerts]);
    } catch {}
  }, []);

  useEffect(() => {
    Object.values(feedTimers.current).forEach(clearInterval);
    feedTimers.current = {};
    if (customEnabled) {
      feeds.forEach(f => {
        pollFeed(f);
        feedTimers.current[f.id] = setInterval(() => pollFeed(f), POLL_MS);
      });
    }
    return () => { Object.values(feedTimers.current).forEach(clearInterval); };
  }, [feeds, customEnabled, pollFeed]);

  // Build alerts
  const staticAlerts = useMemo(buildStaticAlerts, []);
  const broadcastItems = useMemo((): Alert[] =>
    broadcastAlerts.map(b => ({
      id: b.id, text: b.text,
      type: 'broadcast' as const,
      category: 'broadcast' as AlertCategory,
    })), [broadcastAlerts]);

  // Merge SLA breach notifications into ticker alerts (compliance category)
  const slaAlerts = useMemo((): Alert[] =>
    notifications
      .filter(n => !n.dismissedAt && (n.type === 'sla_assign_breach' || n.type === 'sla_completion_breach'))
      .map(n => ({
        id: `sla-${n.id}`,
        text: n.body,
        type: 'urgent' as const,
        category: 'compliance' as AlertCategory,
      })),
  [notifications]);

  const allAlerts = useMemo(() => {
    const enabled = new Set(categories.filter(c => c.enabled).map(c => c.key));
    return [...staticAlerts, ...slaAlerts, ...feedAlerts, ...broadcastItems]
      .filter(a => enabled.has(a.category) && !dismissed.has(a.id));
  }, [staticAlerts, slaAlerts, feedAlerts, broadcastItems, categories, dismissed]);

  const dismiss       = useCallback((id: string) => setDismissed(s => new Set([...s, id])), []);
  const restoreAll    = useCallback(() => setDismissed(new Set()), []);
  const publishBroad  = useCallback((text: string, severity: BroadcastAlert['severity']) => {
    setBroadcastAlerts(prev => [...prev, { id: `bc-${Date.now()}`, text, severity, publishedAt: Date.now() }]);
  }, []);

  // Scroll animation
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef   = useRef<HTMLDivElement>(null);
  const animRef      = useRef<number | null>(null);
  const posRef       = useRef(0);

  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const container = containerRef.current;
    const content   = contentRef.current;
    if (!container || !content) return;

    const step = () => {
      if (!paused && content.scrollWidth > 0) {
        const half = content.scrollWidth / 2;
        posRef.current -= 0.6 * speed;
        if (posRef.current <= -half) posRef.current = 0;
        content.style.transform = `translateX(${posRef.current}px)`;
      }
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [paused, speed, allAlerts]);

  const TICKER_H = 36;

  if (!isHydrated) return null;

  if (allAlerts.length === 0) {
    return (
      <div className="ticker" style={{
        gridColumn: '2', gridRow: 3,
        height: TICKER_H, background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)', display: 'flex',
        alignItems: 'center', padding: '0 16px',
        justifyContent: 'space-between', zIndex: 40,
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>No active alerts</span>
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setManagerOpen(true)}>
          ⚙️ Manage
        </button>
        {managerOpen && (
          <Modal isOpen={managerOpen} onClose={() => setManagerOpen(false)} title="" width={820}>
            <SmartAlertsManager
              categories={categories} onCategoriesChange={setCategories}
              feeds={feeds} onFeedsChange={setFeeds}
              broadcastAlerts={broadcastAlerts} onPublishBroadcast={publishBroad}
              dismissedIds={dismissed} onRestoreDismissed={restoreAll}
              onClose={() => setManagerOpen(false)}
            />
          </Modal>
        )}
      </div>
    );
  }

  return (
    <>
      <div 
        className="ticker w-full"
        style={{
          height: TICKER_H, background: 'var(--bg-surface)',
          display: 'flex', alignItems: 'stretch',
          overflow: 'hidden', position: 'relative', zIndex: 40,
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* LIVE badge */}
        <div 
          className="bg-[var(--bg-elevated)] border-r border-[var(--border-subtle)]"
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 14px',
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--brand-primary)', boxShadow: '0 0 5px var(--brand-primary)',
            display: 'inline-block', animation: 'pulse 1.4s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', color: 'var(--brand-primary)' }}>LIVE HUB</span>
          
          <button 
             onClick={() => setVisible(!visible)}
             className="ml-2 py-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
             title={visible ? 'Hide alerts' : 'Show alerts'}
          >
             {visible ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
        </div>

        {/* Scrolling strip */}
        {visible && (
          <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
            <div ref={contentRef} style={{ display: 'inline-flex', alignItems: 'center', height: '100%', willChange: 'transform' }}>
              {[...allAlerts, ...allAlerts].map((a, i) => (
                <TickerItem
                  key={`${a.id}-${i}`}
                  alert={a}
                  onDismiss={dismiss}
                  onClick={a.url ? () => window.open(a.url, '_blank') : a.action}
                />
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        {visible && (
          <div 
            className="bg-[var(--bg-elevated)] border-l border-[var(--border-subtle)]"
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
              padding: '0 10px',
            }}
          >
            <button
              onClick={() => setPaused(p => !p)}
              title={paused ? 'Resume' : 'Pause'}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 13, padding: '0 4px' }}
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              {paused ? '▶' : '⏸'}
            </button>
            <select
              value={speed} onChange={e => setSpeed(Number(e.target.value))}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: 10, cursor: 'pointer', outline:'none' }}
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
            </select>
            <button
              onClick={() => setManagerOpen(true)}
              className="ml-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              title="Settings & Channels"
            >
              <Settings size={14} />
            </button>
          </div>
        )}
      </div>

      {managerOpen && (
        <Modal isOpen={managerOpen} onClose={() => setManagerOpen(false)} title="" width={820}>
          <SmartAlertsManager
            categories={categories} onCategoriesChange={setCategories}
            feeds={feeds} onFeedsChange={setFeeds}
            broadcastAlerts={broadcastAlerts} onPublishBroadcast={publishBroad}

            dismissedIds={dismissed} onRestoreDismissed={restoreAll}
            onClose={() => setManagerOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
