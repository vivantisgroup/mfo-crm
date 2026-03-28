'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { User, Plus, Search, X, Trash2, CheckCircle2 } from 'lucide-react';
import { Card, Grid, Title, Text, TextInput, Select, SelectItem, Button, Badge } from '@tremor/react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Contact {
  id:              string;
  firstName:       string;
  lastName:        string;
  email?:          string;
  phone?:          string;
  dateOfBirth?:    string;
  role:            string;
  relationshipType?: string;
  identifications?: Array<{ type: string; number: string; isPrimary: boolean }>;
  linkedFamilyIds: string[];
  linkedFamilyNames: string[];
  linkedOrgIds:    string[];
  linkedOrgNames:  string[];
  pepFlag?:        boolean;
  nationality?:    string;
  notes?:          string;
  kycStatus?:      string;
  createdAt?:      string;
}

const ROLES = ['beneficiary', 'advisor', 'attorney', 'accountant', 'banker', 'trustee', 'benefactor', 'other'];
const RELATIONSHIP_TYPES = ['Family Member', 'Employee', 'Founder', 'Shareholder', 'Director', 'Advisor', 'Dependent', 'Other'];
const ID_TYPES = ['SSN', 'Passport', 'Drivers License', 'CNPJ', 'CPF', 'RG', 'NIF', 'NIS', 'Other'];

const ROLE_COLORS: Record<string, string> = {
  beneficiary: 'blue',
  advisor:     'cyan',
  attorney:    'amber',
  accountant:  'violet',
  banker:      'emerald',
  trustee:     'indigo',
  benefactor:  'pink',
  other:       'slate',
};

function getInitials(fn: string, ln: string) {
  return `${fn?.[0] ?? ''}${ln?.[0] ?? ''}`.toUpperCase();
}

// ─── Create drawer ────────────────────────────────────────────────────────────

function CreateContactDrawer({ tenantId, onClose, onCreate }: {
  tenantId: string; onClose: () => void; onCreate: () => void;
}) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', role: 'beneficiary', 
    relationshipType: 'Family Member', dateOfBirth: '', nationality: '', notes: '',
  });
  const [identifications, setIdentifications] = useState([{ type: 'SSN', number: '', isPrimary: true }]);
  const [saving, setSaving] = useState(false);

  const valid = form.firstName.trim() && form.lastName.trim();

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const cleanIds = identifications.filter(id => id.number.trim());
      if (cleanIds.length > 0 && !cleanIds.some(id => id.isPrimary)) {
        cleanIds[0].isPrimary = true;
      }

      await addDoc(collection(db, 'tenants', tenantId, 'contacts'), {
        ...form,
        identifications: cleanIds,
        linkedFamilyIds: [], linkedFamilyNames: [],
        linkedOrgIds: [], linkedOrgNames: [],
        pepFlag: false, kycStatus: 'pending',
        createdAt: new Date().toISOString(),
      });
      onCreate();
      onClose();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div onClick={onClose} className="flex-1 bg-black/40 backdrop-blur-sm" />
      <div className="w-[500px] bg-tremor-background border-l border-tremor-border flex flex-col h-screen shadow-2xl relative">
        <div className="p-6 border-b border-tremor-border flex justify-between items-start bg-tremor-background-subtle shrink-0">
          <div>
            <Title className="text-tremor-content-strong text-xl">New Contact</Title>
            <Text className="text-tremor-content mt-1">Register an individual profile into the CRM</Text>
          </div>
          <Button icon={X} variant="light" color="slate" onClick={onClose} className="!p-2 -mr-2" aria-label="Close" />
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-tremor-content-strong text-sm font-medium">First Name</span>
              <TextInput value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} placeholder="Jane" />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-tremor-content-strong text-sm font-medium">Last Name</span>
              <TextInput value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Doe" />
            </div>
          </div>
          
          <div className="p-5 bg-tremor-background-subtle border border-tremor-border rounded-tremor-default flex flex-col gap-5">
            <Title className="text-sm font-bold border-b border-tremor-border pb-2">Identification & Profile</Title>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-tremor-content-strong text-sm font-medium">Date of Birth</span>
              <input type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))} className="w-full rounded-tremor-default border border-tremor-border bg-tremor-background px-3 py-2 text-tremor-content-strong shadow-tremor-input focus:border-tremor-brand-subtle focus:ring-2 focus:ring-tremor-brand-muted outline-none sm:text-sm" />
            </div>
              <div className="flex flex-col gap-2">
                <span className="text-tremor-content-strong text-sm font-medium">Nationality</span>
                <TextInput value={form.nationality} onChange={e => setForm(p => ({ ...p, nationality: e.target.value }))} placeholder="e.g. American" />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-tremor-content-strong text-sm font-medium">Documents</span>
                <button onClick={() => setIdentifications(p => [...p, { type: 'Passport', number: '', isPrimary: p.length === 0 }])}
                  className="text-tremor-brand font-semibold text-xs flex items-center gap-1 hover:underline">
                  <Plus size={14} /> Add ID
                </button>
              </div>
              {identifications.map((id, index) => (
                <div key={index} className={`flex gap-2 items-center bg-tremor-background p-2 rounded-tremor-small border ${id.isPrimary ? 'border-tremor-brand' : 'border-tremor-border'}`}>
                  <div className="w-28">
                    <Select value={id.type} onValueChange={val => {
                      const next = [...identifications];
                      next[index].type = val;
                      setIdentifications(next);
                    }} enableClear={false}>
                      {ID_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </Select>
                  </div>
                  <div className="flex-1">
                    <TextInput value={id.number} placeholder="Document string..." onChange={e => {
                      const next = [...identifications];
                      next[index].number = e.target.value;
                      setIdentifications(next);
                    }} />
                  </div>
                  
                  <button onClick={() => {
                    const next = [...identifications];
                    next.forEach(n => n.isPrimary = false);
                    next[index].isPrimary = true;
                    setIdentifications(next);
                  }} title="Set Primary" className={`p-1.5 rounded-tremor-small ${id.isPrimary ? 'text-tremor-brand bg-tremor-brand-faint' : 'text-tremor-content hover:bg-tremor-background-subtle'}`}>
                    <CheckCircle2 size={16} strokeWidth={id.isPrimary ? 2.5 : 1.5} />
                  </button>

                  <button onClick={() => {
                    if (identifications.length === 1) return;
                    const next = identifications.filter((_, i) => i !== index);
                    if (id.isPrimary && next.length > 0) next[0].isPrimary = true;
                    setIdentifications(next);
                  }} disabled={identifications.length === 1} className="p-1.5 text-tremor-content hover:text-rose-500 hover:bg-rose-50 rounded-tremor-small disabled:opacity-30 disabled:hover:bg-transparent">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-tremor-content-strong text-sm font-medium">CRM Role</span>
              <Select value={form.role} onValueChange={val => setForm(p => ({ ...p, role: val }))} enableClear={false}>
                {ROLES.map(r => <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>)}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-tremor-content-strong text-sm font-medium">Relationship Type</span>
              <Select value={form.relationshipType} onValueChange={val => setForm(p => ({ ...p, relationshipType: val }))} enableClear={false}>
                {RELATIONSHIP_TYPES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-tremor-content-strong text-sm font-medium">Email</span>
              <TextInput type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="jane@example.com" />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-tremor-content-strong text-sm font-medium">Phone</span>
              <TextInput type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-tremor-content-strong text-sm font-medium">Internal Notes</span>
            <textarea 
              value={form.notes} 
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} 
              rows={3}
              className="px-3 py-2 rounded-tremor-default border border-tremor-border bg-tremor-background text-tremor-content-strong shadow-tremor-input focus:ring-2 focus:ring-tremor-brand-muted outline-none transition-all text-sm resize-y"
              placeholder="Context or KYC remarks..."
            />
          </div>
        </div>

        <div className="p-5 border-t border-tremor-border flex gap-3 bg-tremor-background-subtle shrink-0">
          <Button variant="secondary" className="flex-1 font-medium" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1 font-semibold" onClick={handleSave} disabled={!valid || saving} loading={saving}>
            Create Contact
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const router  = useRouter();
  const [contacts,    setContacts]    = useState<Contact[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [roleFilter,  setRoleFilter]  = useState('All');
  const [showCreate,  setShowCreate]  = useState(false);
  const [tenantId,    setTenantId]    = useState('');

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
      if (t?.id) setTenantId(t.id);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    const q = query(collection(db, 'tenants', tenantId, 'contacts'), orderBy('lastName', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Contact)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [tenantId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter(c => {
      const matchSearch = !q || `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
        || c.email?.toLowerCase().includes(q)
        || c.role?.toLowerCase().includes(q)
        || c.linkedOrgNames?.some(o => o.toLowerCase().includes(q))
        || c.linkedFamilyNames?.some(f => f.toLowerCase().includes(q));
      const matchRole = roleFilter === 'All' || c.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [contacts, search, roleFilter]);

  return (
    <div className="page-wrapper animate-fade-in mx-auto max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 pb-5 border-b border-tremor-border gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-tremor-brand-faint rounded-tremor-default border border-tremor-brand-muted">
              <User size={24} className="text-tremor-brand" />
            </div>
            <h1 className="text-3xl font-bold text-tremor-content-strong tracking-tight">Contacts</h1>
          </div>
          <Text className="mt-2 text-tremor-content pl-14">
            Unified directory of individuals across all families and organizations
            {!loading && <Badge color="blue" className="ml-3 font-bold">{contacts.length}</Badge>}
          </Text>
        </div>
        <Button size="md" icon={Plus} onClick={() => setShowCreate(true)} className="font-semibold shadow-tremor-card">
          New Contact
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div className="w-full md:flex-1 md:min-w-[300px]">
          <TextInput 
            icon={Search} 
            placeholder="Search by name, email, organization, or family affiliation..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
        <div className="w-full md:w-64">
          <Select value={roleFilter} onValueChange={setRoleFilter} enableClear={false}>
            <SelectItem value="All">All Roles</SelectItem>
            {ROLES.map(r => (
               <SelectItem key={r} value={r}>
                 {r.charAt(0).toUpperCase() + r.slice(1)}
               </SelectItem>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <Grid numItemsSm={1} numItemsMd={2} numItemsLg={3} className="gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="h-32 animate-pulse bg-tremor-background-subtle border-transparent" />
          ))}
        </Grid>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-20 bg-tremor-background-subtle border-dashed">
          <div className="text-6xl mb-4 opacity-50">👤</div>
          <Title className="text-tremor-content-strong mb-2">
             {contacts.length === 0 ? 'No contacts registered yet.' : 'No people match your filters.'}
          </Title>
          <Text className="mb-6 mx-auto max-w-sm">Contacts act as the atomic relationship layer, bridging organizations and families seamlessly.</Text>
          {contacts.length === 0 && <Button onClick={() => setShowCreate(true)}>Create First Profile</Button>}
        </Card>
      ) : (
        <Grid numItemsSm={1} numItemsMd={2} numItemsLg={3} className="gap-5">
          {filtered.map(c => {
            const color = ROLE_COLORS[c.role] ?? 'slate';
            return (
              <Card 
                key={c.id} 
                onClick={() => router.push(`/relationships/contacts/${c.id}`)}
                className="cursor-pointer hover:shadow-tremor-card hover:border-tremor-border transition-all flex flex-col gap-4 !p-5 group"
                decoration="top"
                decorationColor={color as any}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-tremor-full shrink-0 flex items-center justify-center text-sm font-bold border border-${color}-200 bg-${color}-50 text-${color}-700 group-hover:scale-105 transition-transform`}>
                    {getInitials(c.firstName, c.lastName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Title className="truncate font-bold text-tremor-content-strong text-lg">{c.firstName} {c.lastName}</Title>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge color={color as any} size="sm" className="font-semibold capitalize tracking-wide px-2 py-0.5">
                        {c.role.replace(/_/g, ' ')}
                      </Badge>
                      {c.email && <span className="text-xs font-medium text-tremor-content truncate max-w-[120px]">· {c.email}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-tremor-border mt-auto">
                   {c.linkedOrgNames?.slice(0, 2).map(o => (
                    <span key={o} className="text-[11px] px-2 py-0.5 rounded-full bg-tremor-background-subtle text-tremor-content-strong font-medium border border-tremor-border truncate max-w-[140px]">
                      🏢 {o}
                    </span>
                  ))}
                  {(c.linkedOrgNames?.length ?? 0) > 2 && (
                    <span className="text-[10px] font-bold text-tremor-content px-1">+{c.linkedOrgNames!.length - 2}</span>
                  )}
                  {c.linkedFamilyNames?.map(f => (
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

      {showCreate && tenantId && <CreateContactDrawer tenantId={tenantId} onClose={() => setShowCreate(false)} onCreate={() => {}} />}
    </div>
  );
}
