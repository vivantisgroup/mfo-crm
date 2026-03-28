'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Search, X, Users } from 'lucide-react';
import { Card, Grid, Title, Text, TextInput, Select, SelectItem, Button, Badge } from '@tremor/react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Organization {
  id:                string;
  name:              string;
  type:              string;
  jurisdiction?:     string;
  linkedFamilyIds:   string[];
  linkedFamilyNames: string[];
  linkedContactIds:  string[];
  linkedContactNames:string[];
  status?:           string;
  aum?:              number;
  currency?:         string;
  notes?:            string;
  createdAt?:        string;
}

const ORG_TYPES = ['trust', 'llc', 'corporation', 'foundation', 'holding', 'fund', 'bank', 'law_firm', 'accounting_firm', 'other'];

const TYPE_COLORS: Record<string, string> = {
  trust:           'violet',
  llc:             'cyan',
  corporation:     'indigo',
  foundation:      'emerald',
  holding:         'amber',
  fund:            'pink',
  bank:            'blue',
  law_firm:        'amber',
  accounting_firm: 'emerald',
  other:           'slate',
};

const TYPE_ICONS: Record<string, string> = {
  trust: '🔒', llc: '🏢', corporation: '🌐', foundation: '🌱',
  holding: '🏦', fund: '📊', bank: '🏦', law_firm: '⚖️',
  accounting_firm: '🧾', other: '🏢',
};

// ─── Create org drawer ────────────────────────────────────────────────────────

function CreateOrgDrawer({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', type: 'trust', jurisdiction: '', notes: '', status: 'active' });
  const [saving, setSaving] = useState(false);

  const valid = form.name.trim().length > 0;

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'tenants', tenantId, 'organizations'), {
        ...form,
        linkedFamilyIds: [], linkedFamilyNames: [],
        linkedContactIds: [], linkedContactNames: [],
        createdAt: new Date().toISOString(),
      });
      onClose();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div onClick={onClose} className="flex-1 bg-black/40 backdrop-blur-sm" />
      <div className="w-[480px] bg-tremor-background border-l border-tremor-border flex flex-col h-screen shadow-2xl relative">
        <div className="p-6 border-b border-tremor-border flex justify-between items-start bg-tremor-background-subtle">
          <div>
            <Title className="text-tremor-content-strong text-xl">New Organization</Title>
            <Text className="text-tremor-content mt-1">Register a new trust, fund, or legal entity</Text>
          </div>
          <Button icon={X} variant="light" color="slate" onClick={onClose} className="!p-2 -mr-2" aria-label="Close" />
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-tremor-content-strong text-sm font-medium">Organization Name</span>
            <TextInput value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Acme Holdings LLC" />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-tremor-content-strong text-sm font-medium">Entity Type</span>
            <Select value={form.type} onValueChange={(val) => setForm(p => ({ ...p, type: val }))} enableClear={false}>
              {ORG_TYPES.map(t => (
                <SelectItem key={t} value={t} icon={() => <span className="mr-2 text-sm">{TYPE_ICONS[t]}</span>}>
                  {t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </SelectItem>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-tremor-content-strong text-sm font-medium">Jurisdiction</span>
            <TextInput value={form.jurisdiction} onChange={e => setForm(p => ({ ...p, jurisdiction: e.target.value }))} placeholder="e.g. Delaware, Cayman Islands" />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-tremor-content-strong text-sm font-medium">Internal Notes</span>
            <textarea 
              value={form.notes} 
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} 
              rows={4}
              className="px-3 py-2 rounded-tremor-default border border-tremor-border bg-tremor-background text-tremor-content-strong shadow-tremor-input focus:ring-2 focus:ring-tremor-brand-muted outline-none transition-all text-sm resize-y"
              placeholder="Additional context or formation details..."
            />
          </div>
        </div>

        <div className="p-5 border-t border-tremor-border flex gap-3 bg-tremor-background-subtle shrink-0">
          <Button variant="secondary" className="flex-1 font-medium" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1 font-semibold" onClick={handleSave} disabled={!valid || saving} loading={saving}>
            Create Organization
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OrganizationsPage() {
  const router = useRouter();
  const [orgs,       setOrgs]       = useState<Organization[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [tenantId,   setTenantId]   = useState('');

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
      if (t?.id) setTenantId(t.id);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    const q = query(collection(db, 'tenants', tenantId, 'organizations'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Organization)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [tenantId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orgs.filter(o => {
      const matchSearch = !q || o.name.toLowerCase().includes(q)
        || o.type?.toLowerCase().includes(q)
        || o.jurisdiction?.toLowerCase().includes(q)
        || o.linkedFamilyNames?.some(f => f.toLowerCase().includes(q))
        || o.linkedContactNames?.some(c => c.toLowerCase().includes(q));
      const matchType = typeFilter === 'All' || o.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [orgs, search, typeFilter]);

  return (
    <div className="page-wrapper animate-fade-in mx-auto max-w-7xl">
      

      {loading ? (
        <Grid numItemsSm={1} numItemsMd={2} numItemsLg={3} className="gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-40 animate-pulse bg-tremor-background-subtle border-transparent" />
          ))}
        </Grid>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-20 bg-tremor-background-subtle border-dashed">
          <div className="text-6xl mb-4 opacity-50">🏢</div>
          <Title className="text-tremor-content-strong mb-2">
            {orgs.length === 0 ? 'No organizations registered yet.' : 'No entities match your filters.'}
          </Title>
          <Text className="mb-6 mx-auto max-w-sm">Organizations act as structural nodes mapping companies, trusts, and banks seamlessly into your CRM.</Text>
          {orgs.length === 0 && <Button onClick={() => setShowCreate(true)}>Register First Entity</Button>}
        </Card>
      ) : (
        <Grid numItemsSm={1} numItemsMd={2} numItemsLg={3} className="gap-5">
          {filtered.map(o => {
            const color = TYPE_COLORS[o.type] ?? 'slate';
            const icon  = TYPE_ICONS[o.type] ?? '🏢';
            return (
              <Card 
                key={o.id} 
                onClick={() => router.push(`/relationships/organizations/${o.id}`)}
                className="cursor-pointer hover:shadow-tremor-card hover:border-tremor-border transition-all flex flex-col gap-4 !p-5 group"
                decoration="top"
                decorationColor={color as any}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-tremor-default shrink-0 flex items-center justify-center text-2xl border border-${color}-200 bg-${color}-50 group-hover:scale-105 transition-transform`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Title className="truncate font-bold text-tremor-content-strong text-lg">{o.name}</Title>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge color={color as any} size="sm" className="font-semibold capitalize tracking-wide px-2 py-0.5">
                        {o.type.replace(/_/g, ' ')}
                      </Badge>
                      {o.jurisdiction && <span className="text-xs font-medium text-tremor-content truncate max-w-[120px]">· {o.jurisdiction}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-tremor-border mt-auto">
                  {o.linkedContactNames?.slice(0, 3).map(c => (
                    <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-tremor-background-subtle text-tremor-content-strong font-medium border border-tremor-border truncate max-w-[140px]">
                      👤 {c.split(' ')[0]}
                    </span>
                  ))}
                  {(o.linkedContactNames?.length ?? 0) > 3 && (
                    <span className="text-[10px] font-bold text-tremor-content px-1">+{o.linkedContactNames!.length - 3}</span>
                  )}
                  {o.linkedFamilyNames?.map(f => (
                    <span key={f} className="text-[11px] px-2 py-0.5 rounded-full bg-tremor-brand-faint text-tremor-brand-emphasis font-bold border border-tremor-brand-muted truncate max-w-[120px]">
                      👥 {f}
                    </span>
                  ))}
                </div>
              </Card>
            );
          })}
        </Grid>
      )}

      {showCreate && tenantId && <CreateOrgDrawer tenantId={tenantId} onClose={() => setShowCreate(false)} />}
    </div>
  );
}
