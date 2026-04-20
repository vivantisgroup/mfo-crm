'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { MessageSquare, Mail, Phone, Video, FileText, Plus, Search, X, ExternalLink, Clock, DollarSign, Activity as ActivityIcon, User, Layers, Calendar } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getTenantMembers, type TenantMember } from '@/lib/tenantMemberService';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Activity {
  id:           string;
  type:         string;   // email | call | meeting | note | whatsapp
  subject:      string;
  snippet?:     string;
  fromName?:    string;
  fromEmail?:   string;
  linkedFamilyId?:   string;
  linkedFamilyName?: string;
  linkedContactId?:  string;
  linkedOrgId?:      string;
  
  // Advanced metrics
  durationMinutes?: number;
  isBillable?: boolean;
  hourlyRate?: number;
  totalCost?: number;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  evaluatedEfficiency?: string;

  createdAt?:   string;
  direction?:   string;
}

const TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  email:    { icon: '✉️',  label: 'Email',    color: '#3b82f6' }, // Blue
  call:     { icon: '📞',  label: 'Call',     color: '#10b981' }, // Emerald
  meeting:  { icon: '🤝',  label: 'Meeting',  color: '#f59e0b' }, // Amber
  note:     { icon: '📝',  label: 'Note',     color: '#8b5cf6' }, // Violet
  whatsapp: { icon: '💬',  label: 'WhatsApp', color: '#22c55e' }, // Green
};

// ─── Create/Edit drawer ───────────────────────────────────────────────────────

function CreateActivityDrawer({ tenantId, onClose, members, loggedInUser }: { tenantId: string; onClose: () => void; members: TenantMember[]; loggedInUser: any }) {
  const [form, setForm] = useState({ 
    type: 'call', 
    subject: '', 
    snippet: '', 
    linkedFamilyName: '',
    durationMinutes: 30,
    isBillable: true,
    hourlyRate: 150,
    assignedEmployeeId: loggedInUser?.uid || '',
    evaluatedEfficiency: ''
  });
  const [saving, setSaving] = useState(false);
  const valid = form.subject.trim().length > 0 && form.assignedEmployeeId;

  // Auto-calc cost
  const totalCost = form.isBillable ? (form.durationMinutes / 60) * form.hourlyRate : 0;

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const assignedName = members.find(m => m.uid === form.assignedEmployeeId)?.displayName || 'Unknown';
      await addDoc(collection(db, 'tenants', tenantId, 'activities'), {
        ...form,
        totalCost,
        assignedEmployeeName: assignedName,
        createdAt: new Date().toISOString(),
        source: 'manual',
      });
      onClose();
    } catch (e) { 
      console.error(e); 
      alert('Failed to log activity. Ensure you have permissions.');
    } finally { 
      setSaving(false); 
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex font-sans">
      <div onClick={onClose} className="flex-1 bg-black/60 backdrop-blur-sm animate-fade-in cursor-pointer" />
      <div className="w-[480px] bg-slate-900 border-l border-slate-800 flex flex-col h-screen shadow-2xl animate-slide-in-right shrink-0">
        <div className="py-6 px-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div className="font-extrabold text-xl bg-gradient-to-r from-indigo-400 to-indigo-300 bg-clip-text text-transparent">Log Activity Time</div>
          <button onClick={onClose} className="bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-full p-2 text-slate-400 transition-colors">
             <X size={16} strokeWidth={3} />
          </button>
        </div>
        
        <div className="p-8 flex flex-col gap-6 flex-1 overflow-y-auto w-full min-h-0 bg-slate-950/30">
          {/* ASSIGNMENT & TYPE */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Assigned To</label>
              <select 
                value={form.assignedEmployeeId} 
                onChange={e => setForm(p => ({ ...p, assignedEmployeeId: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="">-- Resource --</option>
                {members.map(m => (
                  <option key={m.uid} value={m.uid}>{m.displayName} ({m.role})</option>
                ))}
              </select>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Activity Type</label>
              <select 
                value={form.type} 
                onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-colors"
              >
                {Object.entries(TYPE_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Subject Goal</label>
            <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
              placeholder="e.g. Q3 Portfolio strategic realignment call..."
              className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-colors" />
          </div>
          
          <div className="flex gap-4">
            <div className="flex flex-col gap-2 flex-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Clock size={12} /> Duration (Mins)</label>
              <input type="number" min={5} step={5} value={form.durationMinutes} onChange={e => setForm(p => ({ ...p, durationMinutes: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-colors" />
            </div>

            <div className="flex flex-col gap-2 flex-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><DollarSign size={12} /> Hourly Rate</label>
              <input type="number" min={0} value={form.hourlyRate} onChange={e => setForm(p => ({ ...p, hourlyRate: parseFloat(e.target.value) || 0 }))} disabled={!form.isBillable}
                className={`w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 text-sm outline-none transition-colors ${form.isBillable ? 'focus:border-indigo-500' : 'opacity-50 cursor-not-allowed'}`} />
            </div>
          </div>

          {/* BILLING TOGGLE */}
          <div className={`flex items-center justify-between px-5 py-4 rounded-xl border transition-all ${form.isBillable ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800 border-slate-700'}`}>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="billCheck" checked={form.isBillable} onChange={e => setForm(p => ({ ...p, isBillable: e.target.checked }))} className="w-4 h-4 accent-emerald-500 cursor-pointer" />
              <label htmlFor="billCheck" className={`text-sm font-bold cursor-pointer ${form.isBillable ? 'text-emerald-400' : 'text-slate-400'}`}>Generate Billable Event</label>
            </div>
            {form.isBillable && (
              <div className="text-sm font-extrabold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">
                Est: ${(totalCost).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Outcome / Execution Notes</label>
            <textarea value={form.snippet} onChange={e => setForm(p => ({ ...p, snippet: e.target.value }))} rows={4}
              placeholder="Summary of effort and deliverables..."
              className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-colors resize-y" />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><UsersIcon size={12} /> Linked Family</label>
            <input value={form.linkedFamilyName} onChange={e => setForm(p => ({ ...p, linkedFamilyName: e.target.value }))}
              placeholder="e.g. Silva Family Holding..."
              className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 text-sm outline-none focus:border-indigo-500 transition-colors" />
          </div>
        </div>
        
        <div className="p-6 border-t border-slate-800 flex gap-4 bg-slate-900 shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.2)]">
          <button className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm transition-colors" onClick={onClose}>Cancel</button>
          <button 
            className={`flex-[2] px-4 py-3 rounded-xl font-bold text-sm text-white transition-all shadow-lg ${valid && !saving ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20 active:scale-95' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`} 
            onClick={handleSave} 
            disabled={!valid || saving}
          >
            {saving ? 'Logging...' : 'Confirm Activity Log'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Icon helper workaround
function UsersIcon(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={props.size||24} height={props.size||24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>;
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TYPES = ['all', 'email', 'call', 'meeting', 'note', 'whatsapp'];

export default function ActivitiesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activities,  setActivities]  = useState<Activity[]>([]);
  const [members,     setMembers]     = useState<TenantMember[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState('all');
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
    
    // Fetch members for assignment
    getTenantMembers(tenantId).then(list => setMembers(list)).catch(console.error);

    // Fetch activities
    const q = query(collection(db, 'tenants', tenantId, 'activities'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [tenantId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return activities.filter(a => {
      const matchSearch = !q || a.subject?.toLowerCase().includes(q)
        || a.snippet?.toLowerCase().includes(q)
        || a.assignedEmployeeName?.toLowerCase().includes(q)
        || a.linkedFamilyName?.toLowerCase().includes(q);
      const matchType = typeFilter === 'all' || a.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [activities, search, typeFilter]);

  // Derived metrics
  const stats = useMemo(() => {
    let hrs = 0;
    let cost = 0;
    const typeCount: Record<string, number> = {};
    const empCount: Record<string, number> = {};

    filtered.forEach(a => {
      hrs += (a.durationMinutes || 0) / 60;
      if (a.isBillable) cost += (a.totalCost || 0);
      
      const tMeta = TYPE_META[a.type]?.label || 'Misc';
      typeCount[tMeta] = (typeCount[tMeta] || 0) + 1;

      const emp = a.assignedEmployeeName || 'System';
      empCount[emp] = (empCount[emp] || 0) + (a.durationMinutes || 0);
    });

    const pieData = Object.keys(typeCount).map(k => ({ name: k, value: typeCount[k] }));
    
    let topEmp = { name: 'N/A', mins: 0 };
    Object.keys(empCount).forEach(e => {
      if(empCount[e] > topEmp.mins) topEmp = { name: e, mins: empCount[e] };
    });

    return { totalHours: hrs, totalCost: cost, pieData, topEmployee: topEmp.name };
  }, [filtered]);

  const handleDelete = async (actId: string) => {
    if(!confirm("Permenantly delete this record?")) return;
    try {
      await deleteDoc(doc(db, 'tenants', tenantId, 'activities', actId));
    } catch(e: any) {
      alert("Failed. Your role may prohibit deletion of activity records.");
    }
  };

  return (
    <div className="page animate-fade-in" style={{ padding: '0 32px 32px' }}>
      
      {/* HEADER SECTION */}
      <div style={{ paddingTop: 32, paddingBottom: 24, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 12, letterSpacing: '-0.02em', background: 'linear-gradient(to right, var(--text-primary), var(--text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            <ActivityIcon size={30} style={{ color: 'var(--brand-500)' }} /> Execution & Activities
          </h1>
          <p style={{ marginTop: 6, fontSize: 14, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
            Comprehensive time attribution, execution flow, and client efficiency metrics.
          </p>
        </div>
        <button 
          onClick={() => setShowCreate(true)}
          style={{ background: 'linear-gradient(135deg, var(--brand-500), var(--brand-600))', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)', transition: 'transform 0.2s', WebkitFontSmoothing: 'antialiased' }}>
          <Plus size={18} strokeWidth={3} /> Log Execution Time
        </button>
      </div>

      {/* DASHBOARD WIDGETS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginTop: 32, marginBottom: 32 }}>
        
        {/* WIDGET 1: ROI */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.02)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -20, width: 100, height: 100, background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%' }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}><DollarSign size={14} color="#10b981" /> Total Generated Value</div>
          <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8, color: 'var(--text-primary)' }}>
            ${stats.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Billable activities across pipeline</div>
        </div>

        {/* WIDGET 2: TIME */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} color="var(--brand-500)" /> Total Time Logged</div>
          <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8, color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: 4 }}>
            {stats.totalHours.toFixed(1)} <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-tertiary)' }}>Hrs</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Representing {filtered.length} interactions this period</div>
        </div>

        {/* WIDGET 3: TOP CONTRIBUTOR */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}><User size={14} color="#f59e0b" /> Highest Contributor</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stats.topEmployee}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, background: '#f59e0b', borderRadius: '50%' }} /> Largest time share
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-elevated)', padding: 12, borderRadius: 16, border: '1px solid var(--border)' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by subject, member, or client..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px 12px 40px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'inherit', fontSize: 13, outline: 'none' }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={14} /></button>}
        </div>
        
        <div style={{ display: 'flex', gap: 4 }}>
          {TYPES.map(t => {
            const meta = TYPE_META[t];
            return (
              <button key={t} onClick={() => setTypeFilter(t)}
                style={{
                  padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid',
                  borderColor: typeFilter === t ? (meta?.color ?? 'var(--brand-500)') : 'transparent',
                  background: typeFilter === t ? (meta?.color ?? 'var(--brand-500)') + '15' : 'transparent',
                  color: typeFilter === t ? (meta?.color ?? 'var(--brand-500)') : 'var(--text-secondary)',
                  textTransform: 'capitalize', transition: 'all 0.2s'
                }}>
                {meta?.icon ? `${meta.icon} ` : ''}{t === 'all' ? `All` : meta?.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* DENSE DATA TABLE */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.03)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading activities...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', width: 64, height: 64, background: 'var(--bg-canvas)', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Layers size={28} color="var(--text-tertiary)" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>No matching records</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>Try relaxing your search terms or log a new event.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-canvas)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>Type / Date</th>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>Subject & Outcome</th>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>Target / Client</th>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>Assigned Rm</th>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5, textAlign: 'right' }}>Time & Billing</th>
                <th style={{ padding: '16px 24px', width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const meta = TYPE_META[a.type] ?? TYPE_META.note;
                const d = a.createdAt ? new Date(a.createdAt) : null;
                const hrs = a.durationMinutes ? (a.durationMinutes / 60).toFixed(1) : '0';

                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-layer">
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${meta.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                          {meta.icon}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: meta.color }}>{meta.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={10} /> {d?.toLocaleDateString(undefined, {month:'short', day:'numeric'})}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', maxWidth: 300 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.subject}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                        {a.snippet ? <div dangerouslySetInnerHTML={{ __html: a.snippet }} /> : <span style={{ fontStyle: 'italic', color: 'var(--text-tertiary)' }}>No execution notes</span>}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      {a.linkedFamilyName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>🏛</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{a.linkedFamilyName}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Internal</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-canvas)', padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--brand-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 8, fontWeight: 800 }}>
                          {a.assignedEmployeeName?.charAt(0) || '?'}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{a.assignedEmployeeName || 'Unknown'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{hrs} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>h</span></div>
                      {a.isBillable ? (
                        <div style={{ color: '#10b981', fontSize: 12, fontWeight: 700, marginTop: 2, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                          <DollarSign size={10} /> {a.totalCost?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 2 }}>Non-billable</div>
                      )}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <button onClick={() => handleDelete(a.id)} style={{ padding: 6, background: '#ef444410', color: '#ef4444', border: 'none', borderRadius: 8, cursor: 'pointer' }} title="Delete Record">
                        <X size={14} strokeWidth={3} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && tenantId && <CreateActivityDrawer tenantId={tenantId} onClose={() => setShowCreate(false)} members={members} loggedInUser={user} />}
    </div>
  );
}
