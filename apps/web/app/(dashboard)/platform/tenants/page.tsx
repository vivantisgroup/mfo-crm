'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useSearchParams } from 'next/navigation';
import {
  SUBSCRIPTION_PLANS, getAllSubscriptions, upsertSubscription, extendTrial,
  changePlan, updateSeats, generateInvoice, getInvoices, markInvoicePaid,
  getSubscriptionEvents, getAllInvoices,
  formatUsd, formatAum, planMonthlyTotal, trialDaysLeft,
  type TenantSubscription, type Invoice, type SubscriptionEvent,
  type PlanId, type BillingCycle, type InvoiceStatus, type SubscriptionStatus,
} from '@/lib/subscriptionService';
import {
  buildSeedManifest, loadDemoTenants, saveDemoTenants,
  generateDemoCredentials, demoTenantDaysLeft, totalDemoRecords, totalDemoCollections,
  PLAN_LABELS, PLAN_DAYS, type DemoTenant, type DemoTenantStatus,
} from '@/lib/demoSeed';
import {
  getAllOrgs, getContactsForOrg, linkTenantToOrg,
  type PlatformOrg, type PlatformContact,
} from '@/lib/crmService';
import { OrgCombobox, ContactCombobox } from '../crm/page';
import {
  getTenantMembers, addMemberToTenant,
  addPlaceholderMember,
  removeMemberFromTenant,
  updateMemberRole, setMemberStatus,
  createInvitation, getInvitationsForTenant, revokeInvitation,
  ROLE_LABELS, ROLE_DESCRIPTIONS, TENANT_ROLES,
  type TenantMember, type TenantInvitation,
} from '@/lib/tenantMemberService';
import { getAllUsers, deleteTenant, type UserProfile } from '@/lib/platformService';
import { CommunicationPanel } from '@/components/CommunicationPanel';


// ─── Shared helpers ───────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, { fg: string; bg: string }> = {
  trial:       { fg: '#f59e0b', bg: '#f59e0b15' },
  active:      { fg: '#22c55e', bg: '#22c55e15' },
  past_due:    { fg: '#ef4444', bg: '#ef444415' },
  suspended:   { fg: '#94a3b8', bg: '#94a3b815' },
  cancelled:   { fg: '#64748b', bg: '#64748b15' },
  provisioning:{ fg: '#818cf8', bg: '#818cf815' },
  expired:     { fg: '#94a3b8', bg: '#94a3b815' },
  draft:       { fg: '#94a3b8', bg: '#94a3b815' },
  sent:        { fg: '#60a5fa', bg: '#60a5fa15' },
  paid:        { fg: '#22c55e', bg: '#22c55e15' },
  overdue:     { fg: '#ef4444', bg: '#ef444415' },
  void:        { fg: '#64748b', bg: '#64748b15' },
};

function Chip({ label, status }: { label: string; status: string }) {
  const c = STATUS_COLOR[status] ?? { fg: '#94a3b8', bg: '#94a3b815' };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: c.bg, color: c.fg, textTransform: 'capitalize' }}>
      {label}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{children}</div>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

function Modal({ onClose, children, width = 760 }: { onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-elevated)', borderRadius: 20, border: '1px solid var(--border)', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
        {children}
      </div>
    </div>
  );
}

// ─── Seed Progress Modal ──────────────────────────────────────────────────────

interface SeedStep { collection: string; label: string; records: number; status: 'pending'|'seeding'|'done'|'error'; }

function SeedProgressModal({ progress, total, done, tenant, onClose }: { progress: SeedStep[]; total: number; done: boolean; tenant: DemoTenant | null; onClose: () => void }) {
  const doneCount = progress.filter(p => p.status === 'done').length;
  const pct = total > 0 ? Math.round(doneCount / total * 100) : 0;
  return (
    <Modal onClose={onClose} width={540}>
      <div style={{ padding: '32px 36px' }}>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>{done ? '✅ Provisioning Complete' : '⚙️ Seeding Demo Tenant…'}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{tenant?.firm} — {doneCount}/{total} collections</div>
        <div style={{ height: 8, background: 'var(--bg-overlay)', borderRadius: 4, marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: done ? '#22c55e' : 'var(--brand-500)', transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {progress.map(p => (
            <div key={p.collection} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: p.status === 'done' ? '#22c55e08' : p.status === 'seeding' ? 'var(--bg-overlay)' : 'transparent' }}>
              <span>{p.status === 'done' ? '✓' : p.status === 'seeding' ? '⟳' : '○'}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{p.label}</span>
              <span style={{ fontSize: 11, color: p.status === 'done' ? '#22c55e' : 'var(--text-tertiary)' }}>{p.status === 'done' ? `${p.records} records` : p.status === 'seeding' ? 'Writing…' : `${p.records} records`}</span>
            </div>
          ))}
        </div>
        {done && tenant && (
          <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg-overlay)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>Credentials</div>
            {[['Email', tenant.adminEmail], ['Password', tenant.adminPassword], ['Tenant ID', tenant.id]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>
        )}
        {done && <div style={{ marginTop: 20, textAlign: 'right' }}><button className="btn btn-primary" onClick={onClose}>Done →</button></div>}
      </div>
    </Modal>
  );
}

// ─── Tenant Detail Modal ──────────────────────────────────────────────────────

type DetailTab = 'overview' | 'communications' | 'billing' | 'invoices' | 'members' | 'demo' | 'events' | 'delete';

function TenantDetailModal({ sub, demoTenant, onClose, onRefresh, performer, onDeleted }: {
  sub: TenantSubscription;
  demoTenant?: DemoTenant;
  onClose: () => void;
  onRefresh: () => void;
  performer: { uid: string; name: string };
  onDeleted?: (tenantId: string) => void;
}) {
  const [tab, setTab] = useState<DetailTab>('overview');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [events,   setEvents]   = useState<SubscriptionEvent[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState<string | null>(null);

  // Members tab state
  const [members,     setMembers]     = useState<TenantMember[]>([]);
  const [invitations, setInvitations] = useState<TenantInvitation[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [allUsers,    setAllUsers]    = useState<UserProfile[]>([]);
  const [memberInput, setMemberInput] = useState('');
  const [memberRole,  setMemberRole]  = useState<import('@/lib/platformService').PlatformRole>('report_viewer');
  const [sendInvite,  setSendInvite]  = useState(true);
  const [addingMember, setAddingMember] = useState(false);

  // Extension UI
  const [extDays, setExtDays]   = useState(14);
  // Plan change UI
  const [newPlan, setNewPlan]   = useState<PlanId>(sub.planId);
  const [newCycle, setNewCycle] = useState<BillingCycle>(sub.billingCycle);
  // Seats
  const [seats, setSeats]       = useState(sub.licensedSeats);
  // AUM
  const [aum, setAum]           = useState(sub.currentAumUsd);

  // Demo seed
  const [seedProgress, setSeedProgress] = useState<SeedStep[]>([]);
  const [seedDone,     setSeedDone]     = useState(false);
  const [seeding,      setSeeding]      = useState(false);
  const [seedTenant,   setSeedTenant]   = useState<DemoTenant | null>(null);

  useEffect(() => {
    if (tab === 'invoices') getInvoices(sub.tenantId).then(setInvoices);
    if (tab === 'events')   getSubscriptionEvents(sub.tenantId).then(setEvents);
    if (tab === 'members' && !membersLoaded) {
      Promise.all([
        getTenantMembers(sub.tenantId),
        getInvitationsForTenant(sub.tenantId),
        getAllUsers(),
      ]).then(([m, inv, u]) => {
        setMembers(m); setInvitations(inv); setAllUsers(u);
        setMembersLoaded(true);
      }).catch(() => {});
    }
  }, [tab, sub.tenantId, membersLoaded]);

  const plan = SUBSCRIPTION_PLANS[sub.planId];
  const daysLeft = trialDaysLeft(sub);
  const monthly = planMonthlyTotal(sub);

  async function doExtend() {
    setLoading(true); setMsg(null);
    try {
      await extendTrial(sub.tenantId, extDays, performer);
      setMsg(`✅ Trial extended by ${extDays} days.`);
      onRefresh();
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    finally { setLoading(false); }
  }

  async function doChangePlan() {
    setLoading(true); setMsg(null);
    try {
      await changePlan(sub.tenantId, newPlan, newCycle, performer);
      setMsg('✅ Plan updated.');
      onRefresh();
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    finally { setLoading(false); }
  }

  async function doUpdateSeats() {
    setLoading(true); setMsg(null);
    try {
      await updateSeats(sub.tenantId, seats, performer);
      setMsg('✅ Seats updated.');
      onRefresh();
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    finally { setLoading(false); }
  }

  async function doGenerateInvoice() {
    setLoading(true); setMsg(null);
    try {
      const inv = await generateInvoice(sub, performer);
      setMsg(`✅ Invoice ${inv.invoiceNumber} generated — ${formatUsd(inv.totalAmount)}`);
      if (tab === 'invoices') getInvoices(sub.tenantId).then(setInvoices);
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    finally { setLoading(false); }
  }

  async function doMarkPaid(invoiceId: string, num: string) {
    setLoading(true); setMsg(null);
    try {
      await markInvoicePaid(invoiceId, 'bank_transfer', performer);
      setMsg(`✅ Invoice ${num} marked as paid.`);
      getInvoices(sub.tenantId).then(setInvoices);
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    finally { setLoading(false); }
  }

  async function doSeedDemo() {
    const manifest = buildSeedManifest();
    const creds    = generateDemoCredentials(sub.tenantName);
    const demo: DemoTenant = {
      id: sub.tenantId, name: sub.tenantName, firm: sub.tenantName,
      contactEmail: sub.contactEmail, contactName: sub.contactName,
      plan: 'trial_14d', status: 'provisioning',
      provisionedAt: new Date().toISOString(), expiresAt: sub.trialEndsAt ?? null,
      seededCollections: 0, seededRecords: 0,
      loginUrl: `${window.location.origin}/login`,
      adminEmail: sub.contactEmail, adminPassword: creds.password,
      notes: '', tags: ['production-seed'], loginCount: 0,
    };
    setSeedTenant(demo);
    setSeeding(true);
    const initial: SeedStep[] = manifest.map(c => ({ collection: c.name, label: c.label, records: c.data.length, status: 'pending' }));
    setSeedProgress(initial);
    setSeedDone(false);

    for (let i = 0; i < manifest.length; i++) {
      setSeedProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'seeding' } : p));
      await new Promise(r => setTimeout(r, 80 + Math.random() * 60));
      setSeedProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'done' } : p));
    }
    setSeedDone(true);
  }

  // ── Member actions ────────────────────────────────────────────────────────
  async function doSmartAdd() {
    if (!memberInput) return;
    const input = memberInput.trim().toLowerCase();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input)) {
      setMsg('❌ Please enter a valid email address.');
      return;
    }

    setAddingMember(true); setMsg(null);
    try {
      const existingUser = allUsers.find(u => u.email.toLowerCase() === input);
      if (existingUser) {
        if (members.find(m => m.uid === existingUser.uid)) {
          setMsg('⚠ User is already a member.');
          setAddingMember(false);
          return;
        }
        await addMemberToTenant(sub.tenantId, sub.tenantName, existingUser, memberRole, performer);
        setMsg(`✅ Existing user ${existingUser.displayName} added to tenant.`);
      } else {
        // Dynamically import the Next.js Server Action
        const { adminCreateFirebaseUser, adminGeneratePasswordResetLink } = await import('@/lib/usersAdmin');
        
        const result = await adminCreateFirebaseUser(input, input.split('@')[0]);
        if (!result.success || !result.userRecord) {
          setMsg(`❌ Error creating user: ${result.error}`);
          setAddingMember(false);
          return;
        }
        
        const uid = result.userRecord.uid;
        const newProfile = { uid, email: input, displayName: input.split('@')[0], tenantIds: [] };

        // Ensure base UserProfile exists in Firestore before linking tenant
        const { doc, setDoc, getFirestore } = await import('firebase/firestore');
        const { firebaseApp } = await import('@mfo-crm/config');
        const db = getFirestore(firebaseApp);
        
        await setDoc(doc(db, 'users', uid), {
          uid,
          email: input,
          displayName: input.split('@')[0],
          role: 'report_viewer',
          mfaEnabled: false,
          status: 'active',
          createdAt: new Date().toISOString(),
          tenantIds: []
        }, { merge: true });

        // Add them to the tenant using true UID instead of a fake placeholder UID
        await addMemberToTenant(sub.tenantId, sub.tenantName, newProfile, memberRole, performer);
        
        let successMsg = `✅ User ${input} created and added.`;
        if (sendInvite) {
          const linkRes = await adminGeneratePasswordResetLink(input);
          if (linkRes.success) {
            // In a real app we'd trigger SendGrid. For demonstration we use the reset link as the invite link.
            successMsg += ` (Reset link generated for invite).`;
          }
        } else {
          successMsg += ` Temp Password: ${result.tempPassword}`;
        }
        
        setMsg(successMsg);
      }
      setMemberInput('');
      const [m] = await Promise.all([getTenantMembers(sub.tenantId)]);
      setMembers(m);
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setAddingMember(false);
    }
  }

  async function doChangeRole(member: TenantMember, newRole: any) {
    try {
      await updateMemberRole(sub.tenantId, sub.tenantName, member.uid, member.displayName, newRole, member.role, performer);
      setMembers(prev => prev.map(m => m.uid === member.uid ? { ...m, role: newRole } : m));
      setMsg(`✅ ${member.displayName}'s role updated.`);
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
  }

  async function doToggleSuspend(member: TenantMember) {
    const newStatus = member.status === 'suspended' ? 'active' : 'suspended';
    try {
      await setMemberStatus(sub.tenantId, member.uid, member.displayName, newStatus, performer);
      setMembers(prev => prev.map(m => m.uid === member.uid ? { ...m, status: newStatus } : m));
      setMsg(`✅ ${member.displayName} ${newStatus === 'suspended' ? 'suspended' : 'reactivated'}.`);
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
  }

  async function doRemoveMember(member: TenantMember) {
    if (!confirm(`Remove ${member.displayName} from this tenant? They will lose access immediately.`)) return;
    try {
      await removeMemberFromTenant(sub.tenantId, sub.tenantName, member.uid, member.displayName, performer);
      setMembers(prev => prev.filter(m => m.uid !== member.uid));
      setMsg(`✅ ${member.displayName} removed.`);
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
  }

  async function doRevokeInvitation(inv: TenantInvitation) {
    try {
      await revokeInvitation(inv.id, performer, sub.tenantId);
      setInvitations(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'revoked' } : i));
      setMsg(`✅ Invitation to ${inv.email} revoked.`);
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
  }


  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: '📋 Overview' },
    { id: 'communications', label: '💬 Communications' },
    { id: 'billing',  label: '💳 Subscription' },
    { id: 'invoices', label: '🧾 Invoices' },
    { id: 'members',  label: `👥 Members (${members.length})` },
    { id: 'demo',     label: '🌱 Demo Data' },
    { id: 'events',   label: '📜 Audit Log' },
    { id: 'delete',   label: '🗑 Delete' },
  ];

  return (
    <div className="animate-fade-in">
      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--brand-400)', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Tenants</button>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>{sub.tenantName}</span>
      </div>

      {seeding && (
        <SeedProgressModal progress={seedProgress} total={buildSeedManifest().length} done={seedDone}
          tenant={seedTenant} onClose={() => setSeeding(false)} />
      )}
      {/* Header */}
      <div style={{ padding: '0 0 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>{sub.tenantName}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>{sub.contactName} · {sub.contactEmail}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Chip label={sub.status} status={sub.status} />
              <Chip label={`${plan.icon} ${plan.name}`} status={sub.status} />
              {daysLeft !== null && <Chip label={daysLeft === 0 ? 'Trial expired' : `${daysLeft}d trial left`} status={daysLeft <= 3 ? 'overdue' : 'trial'} />}
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: 'none' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '10px 18px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
              background: 'none', border: 'none',
              borderBottom: `2px solid ${tab === t.id ? (t.id === 'delete' ? '#ef4444' : 'var(--brand-500)') : 'transparent'}`,
              color: tab === t.id ? (t.id === 'delete' ? '#ef4444' : 'var(--brand-500)') : (t.id === 'delete' ? '#ef444488' : 'var(--text-secondary)'),
              cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Message */}
      {msg && <div style={{ margin: '12px 28px 0', padding: '10px 14px', background: msg.startsWith('✅') ? '#22c55e15' : '#ef444415', borderRadius: 8, fontSize: 13, color: msg.startsWith('✅') ? '#22c55e' : '#ef4444' }}>{msg}</div>}

      <div style={{ padding: '20px 28px 28px' }}>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Monthly Estimate</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--brand-500)' }}>{formatUsd(monthly)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{sub.billingCycle} billing</div>
              </div>
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Usage</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{sub.licensedSeats} / {SUBSCRIPTION_PLANS[sub.planId].maxSeats === -1 ? '∞' : SUBSCRIPTION_PLANS[sub.planId].maxSeats} seats</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{formatAum(sub.currentAumUsd)} AUM</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Max {SUBSCRIPTION_PLANS[sub.planId].maxAumUsd === -1 ? '∞' : formatAum(SUBSCRIPTION_PLANS[sub.planId].maxAumUsd)}</div>
              </div>
            </div>
            <Field label="Tenant ID"        value={<span style={{ fontFamily: 'monospace', fontSize: 11 }}>{sub.tenantId}</span>} />
            <Field label="Plan"             value={`${plan.icon} ${plan.name}`} />
            <Field label="Status"           value={<Chip label={sub.status} status={sub.status} />} />
            <Field label="Billing Cycle"    value={sub.billingCycle} />
            <Field label="Trial Ends"       value={sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString() : '—'} />
            <Field label="Current Period"   value={`${sub.currentPeriodStart?.slice(0,10)} → ${sub.currentPeriodEnd?.slice(0,10)}`} />
            <Field label="Next Invoice"     value={sub.nextInvoiceDate?.slice(0,10) ?? '—'} />
            <Field label="Currency"         value={sub.currency} />
            <Field label="Subscribed"       value={new Date(sub.subscriptionStart).toLocaleDateString()} />
          </div>
        )}

        {/* ── COMMUNICATIONS ── */}
        {tab === 'communications' && (
          <div style={{ height: 600 }}>
            <CommunicationPanel
              familyId={sub.tenantId} // tenant acts as the logical entity
              familyName={sub.tenantName}
              linkedRecordType="crm" // The "crm" equivalent at platform level is handling tenant records
              linkedRecordId={sub.tenantId}
            />
          </div>
        )}

        {/* ── SUBSCRIPTION MANAGEMENT ── */}
        {tab === 'billing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Trial Extension */}
            {(sub.status === 'trial') && (
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>⏱️ Extend Trial</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <Label>Days to add</Label>
                    <input type="number" min={1} max={365} value={extDays} onChange={e => setExtDays(+e.target.value)}
                      className="input" style={{ width: 100 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
                    {[7, 14, 30].map(d => (
                      <button key={d} className={`btn btn-sm ${extDays === d ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setExtDays(d)}>+{d}d</button>
                    ))}
                  </div>
                  <button className="btn btn-primary" style={{ marginTop: 22 }} onClick={doExtend} disabled={loading}>
                    {loading ? '…' : 'Extend Trial'}
                  </button>
                </div>
              </div>
            )}

            {/* Plan Change */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>📦 Change Plan</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <Label>Subscription Plan</Label>
                  <select className="input" style={{ width: '100%' }} value={newPlan} onChange={e => setNewPlan(e.target.value as PlanId)}>
                    {Object.values(SUBSCRIPTION_PLANS).map(p => (
                      <option key={p.id} value={p.id}>{p.icon} {p.name} — {p.baseMonthly > 0 ? formatUsd(p.baseMonthly)+'/mo base' : 'Custom'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Billing Cycle</Label>
                  <select className="input" style={{ width: '100%' }} value={newCycle} onChange={e => setNewCycle(e.target.value as BillingCycle)}>
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual (save ~17%)</option>
                  </select>
                </div>
              </div>
              {newPlan !== sub.planId || newCycle !== sub.billingCycle ? (
                <div style={{ padding: '10px 14px', background: 'var(--bg-overlay)', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                  <strong>Change:</strong> {plan.name} ({sub.billingCycle}) → {SUBSCRIPTION_PLANS[newPlan].name} ({newCycle})
                </div>
              ) : null}
              <button className="btn btn-primary" onClick={doChangePlan} disabled={loading || (newPlan === sub.planId && newCycle === sub.billingCycle)}>
                {loading ? '…' : 'Apply Plan Change'}
              </button>
            </div>

            {/* Seats & AUM */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>👥 Licensed Seats & AUM</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <Label>Licensed Seats</Label>
                  <input type="number" min={1} max={SUBSCRIPTION_PLANS[sub.planId].maxSeats === -1 ? 9999 : SUBSCRIPTION_PLANS[sub.planId].maxSeats}
                    value={seats} onChange={e => setSeats(+e.target.value)} className="input" style={{ width: '100%' }} />
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    Max: {SUBSCRIPTION_PLANS[sub.planId].maxSeats === -1 ? 'Unlimited' : SUBSCRIPTION_PLANS[sub.planId].maxSeats}
                  </div>
                </div>
                <div>
                  <Label>Current AUM (USD)</Label>
                  <input type="number" min={0} value={aum} onChange={e => setAum(+e.target.value)} className="input" style={{ width: '100%' }} />
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{formatAum(aum)}</div>
                </div>
              </div>
              <button className="btn btn-primary" onClick={doUpdateSeats} disabled={loading || (seats === sub.licensedSeats && aum === sub.currentAumUsd)}>
                {loading ? '…' : 'Update Usage'}
              </button>
            </div>

            {/* Pricing Preview */}
            <div className="card" style={{ padding: 20, background: 'var(--bg-canvas)' }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>💰 Monthly Price Estimate</div>
              {(() => {
                const p = SUBSCRIPTION_PLANS[sub.planId];
                const m = sub.billingCycle === 'monthly';
                const base  = m ? p.baseMonthly : p.baseAnnual / 12;
                const seat  = seats * (m ? p.pricePerSeat : p.pricePerSeatAnnual / 12);
                const aumF  = aum * (p.aumFeeBps / 10000) / 12;
                const total = base + seat + aumF;
                return [
                  ['Platform base fee', base],
                  [`Seats (${seats} × ${formatUsd(m ? p.pricePerSeat : p.pricePerSeatAnnual/12)})`, seat],
                  [`AUM (${p.aumFeeBps} bps/yr ÷ 12)`, aumF],
                ].map(([label, val]) => (
                  <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ fontWeight: 600 }}>{formatUsd(Number(val))}</span>
                  </div>
                )).concat([
                  <div key="total" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 15, fontWeight: 900 }}>
                    <span>Total / month</span>
                    <span style={{ color: 'var(--brand-500)' }}>{formatUsd(total)}</span>
                  </div>
                ] as any);
              })()}
            </div>
          </div>
        )}

        {/* ── INVOICES ── */}
        {tab === 'invoices' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>🧾 Invoices</div>
              <button className="btn btn-primary btn-sm" onClick={doGenerateInvoice} disabled={loading}>
                {loading ? '…' : '+ Generate Invoice'}
              </button>
            </div>
            {invoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>No invoices yet</div>
            ) : invoices.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)).map(inv => (
              <div key={inv.id} style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{inv.invoiceNumber}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {inv.periodStart?.slice(0,10)} → {inv.periodEnd?.slice(0,10)} · Due {inv.dueAt?.slice(0,10)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontWeight: 900, fontSize: 16 }}>{formatUsd(inv.totalAmount)}</span>
                    <Chip label={inv.status} status={inv.status} />
                    {(inv.status === 'sent' || inv.status === 'draft' || inv.status === 'overdue') && (
                      <button className="btn btn-sm btn-secondary" onClick={() => doMarkPaid(inv.id, inv.invoiceNumber)} disabled={loading}>Mark Paid</button>
                    )}
                  </div>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px', background: 'var(--bg-canvas)' }}>
                  {inv.lineItems.map((li, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>
                      <span>{li.description}</span>
                      <span style={{ fontWeight: 600 }}>{formatUsd(li.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── DEMO DATA ── */}
        {tab === 'demo' && (() => {
          const [confirmed1, setConfirmed1] = React.useState(false);
          const [confirmText, setConfirmText] = React.useState('');
          const nameMatch = confirmText.trim().toLowerCase() === sub.tenantName.trim().toLowerCase();

          return (
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>🌱 Demo Data Provisioner</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                Seeds {totalDemoRecords().toLocaleString()} realistic records across {totalDemoCollections()} collections in <strong>{sub.tenantName}</strong>.
              </div>

              {/* Big danger banner — always visible */}
              <div style={{
                padding: '16px 20px', borderRadius: 12, marginBottom: 20,
                background: '#ef444410', border: '2px solid #ef444440',
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>🚨</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#ef4444', marginBottom: 4 }}>
                      DESTRUCTIVE OPERATION — ALL DATA WILL BE RESET
                    </div>
                    <div style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.6 }}>
                      Provisioning demo data will <strong>permanently delete and replace all existing data</strong> in this tenant, including:
                    </div>
                  </div>
                </div>
                <ul style={{ margin: '0 0 0 36px', padding: 0, fontSize: 13, color: '#fca5a5', lineHeight: 1.8 }}>
                  <li>All family records, contacts, and CRM notes</li>
                  <li>All tasks, queues, and time entries</li>
                  <li>All portfolio data, holdings, and account balances</li>
                  <li>All documents, compliance records, and suitability assessments</li>
                  <li>All activities and calendar events</li>
                </ul>
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#ef444420', borderRadius: 8, fontSize: 12, color: '#fca5a5', fontWeight: 700 }}>
                  ⚠️ This action cannot be undone. Real client data entered into this tenant will be permanently lost.
                </div>
              </div>

              {/* Step 1 — acknowledge */}
              {!confirmed1 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 4 }}>
                    {[
                      { label: 'Collections', value: totalDemoCollections() },
                      { label: 'Records to seed', value: totalDemoRecords().toLocaleString() },
                      { label: 'Est. duration', value: `~${Math.ceil(totalDemoCollections() * 0.12)}s` },
                    ].map(s => (
                      <div key={s.label} style={{ padding: '12px 14px', background: 'var(--bg-canvas)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--brand-500)' }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginTop: 3 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ borderColor: '#ef4444', color: '#ef4444' }}
                    onClick={() => setConfirmed1(true)}
                  >
                    I understand — this will reset all tenant data. Continue →
                  </button>
                </div>
              ) : (
                /* Step 2 — type tenant name to confirm */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ padding: '14px 16px', background: 'var(--bg-canvas)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Final confirmation required</div>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
                      Type the tenant name exactly as shown to enable the seed button:
                    </div>
                    <code style={{ display: 'block', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6, marginBottom: 12, fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' }}>
                      {sub.tenantName}
                    </code>
                    <input
                      className="input"
                      style={{ width: '100%', borderColor: nameMatch ? '#22c55e' : confirmText ? '#ef4444' : undefined }}
                      placeholder={`Type "${sub.tenantName}" to confirm…`}
                      value={confirmText}
                      onChange={e => setConfirmText(e.target.value)}
                      autoFocus
                    />
                    {confirmText && !nameMatch && (
                      <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>Name does not match. Check capitalisation and spacing.</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setConfirmed1(false); setConfirmText(''); }}>
                      ← Back
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{
                        background: nameMatch ? '#ef4444' : 'var(--bg-elevated)',
                        color: nameMatch ? 'white' : 'var(--text-tertiary)',
                        border: `1px solid ${nameMatch ? '#ef4444' : 'var(--border)'}`,
                        cursor: nameMatch ? 'pointer' : 'not-allowed',
                        flex: 1,
                        fontWeight: 700,
                      }}
                      disabled={!nameMatch || loading}
                      onClick={doSeedDemo}
                    >
                      {loading ? '⚙️ Seeding…' : '🚀 Reset & Seed Demo Data'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}


        {/* ── MEMBERS ── */}
        {tab === 'members' && (() => {
          const pendingInvites = invitations.filter(i => i.status === 'pending');
          return (
            <div>
              {/* Add Member panel */}
              <div style={{ marginBottom: 20, padding: '16px 18px', background: 'var(--bg-canvas)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>➕ Add Member</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 2fr) 1fr auto', gap: 10, alignItems: 'flex-end' }}>
                  <div>
                    <Label>User Email (or select existing)</Label>
                    <input className="input" type="email" style={{ width: '100%' }} placeholder="user@firm.com"
                      value={memberInput} onChange={e => setMemberInput(e.target.value)} list="user-suggestions" />
                    <datalist id="user-suggestions">
                      {allUsers.filter(u => !members.find(m => m.uid === u.uid))
                        .map(u => <option key={u.uid} value={u.email}>{u.displayName || u.email}</option>)}
                    </datalist>
                  </div>
                  <div>
                    <Label>Role</Label>
                    <select className="input" style={{ width: '100%' }} value={memberRole}
                      onChange={e => setMemberRole(e.target.value as any)}>
                      {TENANT_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={doSmartAdd}
                    disabled={!memberInput || addingMember} style={{ height: 40, padding: '0 20px', whiteSpace: 'nowrap' }}>
                    {addingMember ? '…' : 'Add to Tenant'}
                  </button>
                </div>
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" id="sendInv2" checked={sendInvite} onChange={e => setSendInvite(e.target.checked)} style={{ cursor: 'pointer', accentColor: 'var(--brand-500)', width: 14, height: 14 }} />
                  <label htmlFor="sendInv2" style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                    Generate an invitation link (if user is completely new to platform)
                  </label>
                </div>
              </div>

              {/* Members list */}
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                Active Members ({members.filter(m => m.status !== 'invited').length})
              </div>
              {!membersLoaded ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-tertiary)' }}>Loading members…</div>
              ) : members.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-tertiary)', border: '1px dashed var(--border)', borderRadius: 10 }}>
                  No members yet. Add the first one above.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {members.map(m => (
                    <div key={m.uid} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto auto auto',
                      alignItems: 'center', gap: 12, padding: '10px 14px',
                      background: m.status === 'suspended' ? 'var(--bg-canvas)' : 'var(--bg-elevated)',
                      borderRadius: 8, opacity: m.status === 'suspended' ? 0.6 : 1, border: '1px solid var(--border)' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%',
                        background: `hsl(${(m.displayName.charCodeAt(0) * 7) % 360},60%,50%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {m.displayName[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{m.displayName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {m.email} · Joined {new Date(m.joinedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <select className="input" style={{ fontSize: 12, padding: '4px 8px', height: 30, minWidth: 160 }}
                        value={m.role} onChange={e => doChangeRole(m, e.target.value)}>
                        {TENANT_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                      <button onClick={() => doToggleSuspend(m)}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                          background: 'none', cursor: 'pointer', color: m.status === 'suspended' ? '#22c55e' : '#f59e0b' }}>
                        {m.status === 'suspended' ? '↩ Reactivate' : '⏸ Suspend'}
                      </button>
                      <button onClick={() => doRemoveMember(m)}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #ef444444',
                          background: 'none', cursor: 'pointer', color: '#ef4444' }}>
                        🗑 Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending Invitations */}
              {pendingInvites.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📧 Pending Invitations ({pendingInvites.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {pendingInvites.map(inv => (
                      <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', background: 'var(--bg-canvas)', borderRadius: 8, border: '1px solid #f59e0b33' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.email}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            {ROLE_LABELS[inv.role]} · Expires {new Date(inv.expiresAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button onClick={() => doRevokeInvitation(inv)}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                            background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── AUDIT LOG ── */}
        {tab === 'events' && (
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>📜 Subscription Audit Log</div>
            {events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>No events recorded</div>
            ) : events.map(ev => (
              <div key={ev.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flexShrink: 0, fontSize: 10, fontFamily: 'monospace', color: 'var(--text-tertiary)', paddingTop: 3, width: 145 }}>
                  {new Date(ev.occurredAt).toLocaleString()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>by {ev.userName} · {ev.type}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── DELETE TENANT ── */}
        {tab === 'delete' && (() => {
          const [step, setStep]             = React.useState<1|2|3>(1);
          const [exported, setExported]     = React.useState(false);
          const [ackChecked, setAckChecked] = React.useState(false);
          const [confirmName, setConfirmName] = React.useState('');
          const [deleting, setDeleting]     = React.useState(false);
          const [delError, setDelError]     = React.useState('');
          const nameOk = confirmName.trim() === sub.tenantName.trim();

          function handleExport() {
            const payload = {
              exportedAt: new Date().toISOString(),
              exportedBy: performer.name,
              tenant: {
                tenantId:    sub.tenantId,
                tenantName:  sub.tenantName,
                contactName: sub.contactName,
                contactEmail:sub.contactEmail,
                plan:        sub.planId,
                status:      sub.status,
                billingCycle:sub.billingCycle,
                licensedSeats:sub.licensedSeats,
                currentAumUsd:sub.currentAumUsd,
                currency:    sub.currency,
                subscriptionStart: sub.subscriptionStart,
                currentPeriodStart:sub.currentPeriodStart,
                currentPeriodEnd:  sub.currentPeriodEnd,
                notes:       sub.notes,
              },
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `tenant-export-${sub.tenantId}-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            setExported(true);
          }

          async function handleDelete() {
            if (!nameOk) return;
            setDeleting(true); setDelError('');
            try {
              await deleteTenant(sub.tenantId, sub.tenantName, performer);
              onDeleted?.(sub.tenantId);
              onClose();
            } catch (e: any) {
              setDelError(e.message ?? 'Deletion failed. Please try again.');
              setDeleting(false);
            }
          }

          return (
            <div>
              {/* Top warning banner — always visible */}
              <div style={{ padding: '16px 20px', borderRadius: 12, marginBottom: 24, background: '#ef444410', border: '2px solid #ef444440' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 28, flexShrink: 0 }}>🗑</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#ef4444', marginBottom: 4 }}>
                      Permanently Delete Tenant
                    </div>
                    <div style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.7 }}>
                      This will <strong>permanently and irreversibly</strong> delete the tenant <strong style={{ color: '#fff' }}>{sub.tenantName}</strong> and all its data from the platform:
                    </div>
                    <ul style={{ margin: '8px 0 0 18px', padding: 0, fontSize: 13, color: '#fca5a5', lineHeight: 1.8 }}>
                      <li>All member access records for this tenant</li>
                      <li>All user-to-tenant associations (users will lose access)</li>
                      <li>The tenant profile itself</li>
                    </ul>
                    <div style={{ marginTop: 10, fontSize: 12, color: '#f87171', fontWeight: 600 }}>
                      ⚠ Subscription records and invoices are retained for accounting purposes.
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 1 — Export */}
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ padding: '16px 20px', background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                      Step 1 of 3 — Export tenant data (optional)
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
                      Download a JSON snapshot of this tenant's subscription and billing information before deleting. This step is optional but recommended.
                    </div>
                    <button
                      onClick={handleExport}
                      className="btn btn-secondary"
                      style={{ gap: 8, display: 'inline-flex', alignItems: 'center' }}
                    >
                      ⬇ {exported ? 'Exported ✓' : 'Download Tenant Data (.json)'}
                    </button>
                    {exported && (
                      <div style={{ marginTop: 10, fontSize: 12, color: '#22c55e' }}>
                        ✓ Export saved. You can proceed to the next step.
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn-sm"
                    style={{ alignSelf: 'flex-end', borderColor: '#ef4444', color: '#ef4444', background: 'none', border: '1px solid #ef444466' }}
                    onClick={() => setStep(2)}
                  >
                    {exported ? 'Continue to Confirmation →' : 'Skip export and continue →'}
                  </button>
                </div>
              )}

              {/* Step 2 — Acknowledge */}
              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ padding: '16px 20px', background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid #ef444433' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                      Step 2 of 3 — Acknowledge the consequences
                    </div>
                    <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={ackChecked}
                        onChange={e => setAckChecked(e.target.checked)}
                        style={{ width: 18, height: 18, marginTop: 2, accentColor: '#ef4444', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                        I understand this action is <strong style={{ color: '#ef4444' }}>permanent and cannot be undone</strong>.
                        All users who belong exclusively to <strong>{sub.tenantName}</strong> will lose access to the platform.
                        No data recovery will be possible after deletion.
                      </span>
                    </label>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>← Back</button>
                    <button
                      className="btn btn-sm"
                      style={{ borderColor: '#ef4444', color: ackChecked ? '#fff' : '#ef444488', background: ackChecked ? '#ef4444' : 'none', border: `1px solid ${ackChecked ? '#ef4444' : '#ef444433'}`, cursor: ackChecked ? 'pointer' : 'not-allowed' }}
                      disabled={!ackChecked}
                      onClick={() => setStep(3)}
                    >
                      I Understand — Continue →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 — Type name + final delete */}
              {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ padding: '16px 20px', background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid #ef444433' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                      Step 3 of 3 — Final confirmation
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
                      Type the exact tenant name below to unlock the delete button:
                    </div>
                    <code style={{ display: 'block', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 13, fontWeight: 700, marginBottom: 12, letterSpacing: '0.02em' }}>
                      {sub.tenantName}
                    </code>
                    <input
                      className="input"
                      autoFocus
                      placeholder={`Type "${sub.tenantName}" to confirm…`}
                      value={confirmName}
                      onChange={e => setConfirmName(e.target.value)}
                      style={{ width: '100%', borderColor: nameOk ? '#ef4444' : confirmName ? '#ef444466' : undefined }}
                    />
                    {confirmName && !nameOk && (
                      <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>Name does not match — check capitalisation and spacing.</div>
                    )}
                    {delError && (
                      <div style={{ marginTop: 10, padding: '10px 14px', background: '#ef444415', border: '1px solid #ef444433', borderRadius: 8, fontSize: 13, color: '#fca5a5' }}>
                        ❌ {delError}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setStep(2)} disabled={deleting}>← Back</button>
                    <button
                      onClick={handleDelete}
                      disabled={!nameOk || deleting}
                      style={{
                        padding: '10px 24px', borderRadius: 10, fontWeight: 800, fontSize: 14, border: 'none',
                        background: nameOk ? '#ef4444' : 'var(--bg-elevated)',
                        color: nameOk ? '#fff' : 'var(--text-tertiary)',
                        cursor: nameOk && !deleting ? 'pointer' : 'not-allowed',
                        boxShadow: nameOk ? '0 4px 16px rgba(239,68,68,0.4)' : 'none',
                        transition: 'all 0.2s',
                        opacity: deleting ? 0.7 : 1,
                      }}
                    >
                      {deleting ? '⏳ Deleting…' : '🗑 Permanently Delete Tenant'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── New Subscription Modal ────────────────────────────────────────────────────

function NewSubscriptionModal({ onClose, onCreated, performer }: {
  onClose: () => void;
  onCreated: (sub: TenantSubscription) => void;
  performer: { uid: string; name: string };
}) {
  const [form, setForm] = useState({
    tenantId: '', tenantName: '', contactName: '', contactEmail: '',
    planId: 'trial' as PlanId, billingCycle: 'monthly' as BillingCycle,
    licensedSeats: 5, currentAumUsd: 0, currency: 'USD',
    isDemoTenant: false, notes: '',
    // CRM linkage
    crmOrgId: '', crmOrgName: '', crmContactId: '', crmContactName: '',
  });
  const [loading, setLoading] = useState(false);

  // CRM data
  const [orgs,     setOrgs]     = useState<PlatformOrg[]>([]);
  const [contacts, setContacts] = useState<PlatformContact[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  useEffect(() => {
    getAllOrgs()
      .then(o => { setOrgs(o); setLoadingOrgs(false); })
      .catch(() => setLoadingOrgs(false));
  }, []);

  // When org changes, load its contacts + pre-fill tenant name from org
  async function handleOrgChange(orgId: string, orgName: string) {
    setForm(p => ({ ...p, crmOrgId: orgId, crmOrgName: orgName, crmContactId: '', contactName: '', contactEmail: '', tenantName: p.tenantName || orgName }));
    setContacts([]);
    if (orgId) {
      const c = await getContactsForOrg(orgId);
      setContacts(c);
      // Auto-select primary contact
      const primary = c.find(x => x.isPrimary) ?? c[0];
      if (primary) {
        setForm(p => ({ ...p, crmContactId: primary.id, crmContactName: primary.name, contactName: primary.name, contactEmail: primary.email }));
      }
    }
  }

  function handleContactChange(contactId: string, contactName: string, contactEmail: string) {
    setForm(p => ({ ...p, crmContactId: contactId, crmContactName: contactName, contactName, contactEmail }));
  }

  const f = (k: string) => (e: any) => setForm(prev => ({ ...prev, [k]: e.target.value }));
  const plan = SUBSCRIPTION_PLANS[form.planId];
  const now  = new Date();
  const trialEnd = new Date(now.getTime() + plan.trialDays * 864e5);
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + (form.billingCycle === 'annual' ? 12 : 1));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tenantId || !form.tenantName) return;
    setLoading(true);
    const sub: TenantSubscription = {
      tenantId:           form.tenantId,
      tenantName:         form.tenantName,
      contactName:        form.contactName,
      contactEmail:       form.contactEmail,
      // @ts-ignore — extend with CRM fields
      crmOrgId:           form.crmOrgId || null,
      crmOrgName:         form.crmOrgName || null,
      crmContactId:       form.crmContactId || null,
      planId:             form.planId,
      billingCycle:       form.billingCycle as BillingCycle,
      status:             form.planId === 'trial' ? 'trial' : 'active',
      subscriptionStart:  now.toISOString(),
      trialEndsAt:        form.planId === 'trial' ? trialEnd.toISOString() : undefined,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd:   periodEnd.toISOString(),
      nextInvoiceDate:    periodEnd.toISOString(),
      licensedSeats:      form.licensedSeats,
      activeUsers:        0,
      currentAumUsd:      form.currentAumUsd,
      currency:           form.currency as 'USD',
      isDemoTenant:       form.isDemoTenant,
      autoRenew:          true,
      notes:              form.notes,
      createdAt:          now.toISOString(),
      createdBy:          performer.uid,
    };
    try {
      await upsertSubscription(sub);
      // Bidirectional CRM link
      if (form.crmOrgId) {
        await linkTenantToOrg(form.crmOrgId, form.tenantId);
      }
      onCreated(sub);
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal onClose={onClose} width={660}>
      <form onSubmit={handleCreate}>
        <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>➕ New Tenant Subscription</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Create a subscription and link it to a CRM customer.</div>
        </div>
        <div style={{ padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ─── CRM Linkage ─── */}
          <div style={{ padding: '14px 16px', background: 'var(--bg-canvas)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              🏢 Link to CRM Customer
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>— optional, but recommended</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <Label>Organization</Label>
                {loadingOrgs
                  ? <div className="input" style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading organizations…</div>
                  : <OrgCombobox orgs={orgs} value={form.crmOrgId} onChange={handleOrgChange} />
                }
              </div>
              <div>
                <Label>Contact</Label>
                <ContactCombobox
                  contacts={contacts}
                  value={form.crmContactId}
                  onChange={handleContactChange}
                  disabled={!form.crmOrgId}
                />
              </div>
            </div>
            {form.crmOrgId && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#22c55e' }}>
                ✓ This tenant will appear in the <strong>{form.crmOrgName}</strong> CRM record.
              </div>
            )}
          </div>

          {/* ─── Tenant Identity ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><Label>Tenant ID *</Label><input required className="input" style={{ width: '100%' }} value={form.tenantId} onChange={f('tenantId')} placeholder="tenant-acme-001" /></div>
            <div><Label>Tenant Name *</Label><input required className="input" style={{ width: '100%' }} value={form.tenantName} onChange={f('tenantName')} placeholder="Acme Family Office" /></div>
          </div>

          {/* Contact override — pre-filled from CRM but editable */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><Label>Contact Name</Label><input className="input" style={{ width: '100%' }} value={form.contactName} onChange={f('contactName')} placeholder="John Smith" /></div>
            <div><Label>Contact Email</Label><input type="email" className="input" style={{ width: '100%' }} value={form.contactEmail} onChange={f('contactEmail')} placeholder="john@acme.com" /></div>
          </div>

          {/* Plan */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <Label>Plan</Label>
              <select className="input" style={{ width: '100%' }} value={form.planId} onChange={e => setForm(p => ({ ...p, planId: e.target.value as PlanId }))}>
                {Object.values(SUBSCRIPTION_PLANS).map(p => (
                  <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Billing</Label>
              <select className="input" style={{ width: '100%' }} value={form.billingCycle} onChange={f('billingCycle')}>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><Label>Licensed Seats</Label><input type="number" min={1} className="input" style={{ width: '100%' }} value={form.licensedSeats} onChange={e => setForm(p => ({ ...p, licensedSeats: +e.target.value }))} /></div>
            <div><Label>AUM (USD)</Label><input type="number" min={0} className="input" style={{ width: '100%' }} value={form.currentAumUsd} onChange={e => setForm(p => ({ ...p, currentAumUsd: +e.target.value }))} /></div>
            <div><Label>Currency</Label>
              <select className="input" style={{ width: '100%' }} value={form.currency} onChange={f('currency')}>
                <option>USD</option><option>BRL</option><option>EUR</option>
              </select>
            </div>
          </div>
          {/* Price preview */}
          <div style={{ padding: '12px 14px', background: 'var(--bg-canvas)', borderRadius: 8, fontSize: 13 }}>
            Est. {formatUsd(planMonthlyTotal({ ...form as any, planId: form.planId, billingCycle: form.billingCycle, licensedSeats: form.licensedSeats, currentAumUsd: form.currentAumUsd, customBasePrice: undefined }))}/month
            {form.planId === 'trial' && ` · Trial ends ${trialEnd.toLocaleDateString()}`}
          </div>
          <textarea className="input" rows={2} placeholder="Notes (optional)…" value={form.notes} onChange={f('notes')} style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }} />
        </div>
        <div style={{ padding: '0 32px 28px', display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading || !form.tenantId || !form.tenantName} style={{ flex: 2 }}>
            {loading ? '…' : '✅ Create Subscription'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type MainTab = 'tenants' | 'invoices' | 'plans' | 'events';

export default function TenantManagementPage() {
  const { user } = useAuth();
  const performer = { uid: user?.uid ?? 'unknown', name: user?.name ?? 'Admin' };
  const searchParams = useSearchParams();

  const [mainTab,    setMainTab]    = useState<MainTab>('tenants');
  const [subs,       setSubs]       = useState<TenantSubscription[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [allEvents,  setAllEvents]  = useState<SubscriptionEvent[]>([]);
  const [search,     setSearch]     = useState('');
  const [statusF,    setStatusF]    = useState<SubscriptionStatus | 'all'>('all');
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<TenantSubscription | null>(null);
  const [showNew,    setShowNew]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, inv] = await Promise.all([getAllSubscriptions(), getAllInvoices()]);
      setSubs(s);
      setAllInvoices(inv);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (mainTab === 'invoices') getAllInvoices().then(setAllInvoices);
  }, [mainTab]);

  // Auto-open tenant modal when navigated from /platform/users with ?open=tenantId
  useEffect(() => {
    const openId = searchParams?.get('open');
    if (openId && subs.length > 0) {
      const match = subs.find(s => s.tenantId === openId);
      if (match) setSelected(match);
    }
  }, [searchParams, subs]);

  const filtered = useMemo(() => subs.filter(s => {
    const q = search.toLowerCase();
    if (q && !`${s.tenantName} ${s.contactEmail} ${s.contactName} ${s.tenantId}`.toLowerCase().includes(q)) return false;
    if (statusF !== 'all' && s.status !== statusF) return false;
    return true;
  }), [subs, search, statusF]);

  const stats = useMemo(() => ({
    total:    subs.length,
    trial:    subs.filter(s => s.status === 'trial').length,
    active:   subs.filter(s => s.status === 'active').length,
    pastDue:  subs.filter(s => s.status === 'past_due').length,
    mrr:      subs.filter(s => s.status === 'active').reduce((sum, s) => sum + planMonthlyTotal(s), 0),
  }), [subs]);

  const MAIN_TABS: { id: MainTab; label: string }[] = [
    { id: 'tenants',  label: '🏢 Tenants' },
    { id: 'invoices', label: '🧾 All Invoices' },
    { id: 'plans',    label: '📋 Subscription Plans' },
    { id: 'events',   label: '📜 Global Audit' },
  ];

  if (selected) {
    return (
      <div className="page animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
        <TenantDetailModal
          sub={selected} performer={performer}
          onClose={() => setSelected(null)}
          onRefresh={() => { load(); setSelected(null); }}
          onDeleted={id => { setSubs(prev => prev.filter(s => s.tenantId !== id)); setSelected(null); }}
        />
      </div>
    );
  }

  return (
    <div className="page animate-fade-in">
      {showNew && (
        <NewSubscriptionModal
          performer={performer}
          onClose={() => setShowNew(false)}
          onCreated={sub => { setSubs(prev => [sub, ...prev.filter(s => s.tenantId !== sub.tenantId)]); setShowNew(false); }}
        />
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Tenant Management</h1>
          <p className="page-subtitle">Manage subscriptions, billing, demo environments, and trial periods.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={load}>↻ Refresh</button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Tenant</button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Tenants', value: stats.total,   color: 'var(--brand-500)' },
          { label: 'Trial',         value: stats.trial,   color: '#f59e0b' },
          { label: 'Active',        value: stats.active,  color: '#22c55e' },
          { label: 'Past Due',      value: stats.pastDue, color: '#ef4444' },
          { label: 'Monthly ARR',   value: formatUsd(stats.mrr), color: '#a78bfa' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {MAIN_TABS.map(t => (
          <button key={t.id} onClick={() => setMainTab(t.id)} style={{
            padding: '10px 20px', fontSize: 13, fontWeight: mainTab === t.id ? 700 : 500,
            background: 'none', border: 'none', borderBottom: `2px solid ${mainTab === t.id ? 'var(--brand-500)' : 'transparent'}`,
            color: mainTab === t.id ? 'var(--brand-500)' : 'var(--text-secondary)', cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── TENANTS TAB ── */}
      {mainTab === 'tenants' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input type="text" className="input" placeholder="🔍 Search tenants…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: '1 1 260px' }} />
            <select className="input" value={statusF} onChange={e => setStatusF(e.target.value as any)}>
              <option value="all">All Statuses</option>
              {(['trial','active','past_due','suspended','cancelled'] as SubscriptionStatus[]).map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', alignSelf: 'center' }}>{filtered.length} tenant{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
              <h2 style={{ fontWeight: 800, marginBottom: 8 }}>No tenants found</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Create your first tenant subscription to get started.</p>
              <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Tenant</button>
            </div>
          ) : (
            <div className="card table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Seats</th>
                    <th>AUM</th>
                    <th>Est. MRR</th>
                    <th>Trial / Period End</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const p = SUBSCRIPTION_PLANS[s.planId];
                    const dl = trialDaysLeft(s);
                    return (
                      <tr key={s.tenantId} onClick={() => setSelected(s)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{s.tenantName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.contactEmail}</div>
                        </td>
                        <td><span style={{ fontWeight: 600 }}>{p.icon} {p.name}</span></td>
                        <td><Chip label={s.status} status={s.status} /></td>
                        <td style={{ fontWeight: 600 }}>{s.licensedSeats}</td>
                        <td>{formatAum(s.currentAumUsd)}</td>
                        <td style={{ fontWeight: 700, color: 'var(--brand-500)' }}>{formatUsd(planMonthlyTotal(s))}</td>
                        <td>
                          {dl !== null
                            ? <span style={{ color: dl <= 3 ? '#ef4444' : '#f59e0b', fontWeight: 700, fontSize: 12 }}>{dl === 0 ? 'Expired' : `${dl}d left`}</span>
                            : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{s.currentPeriodEnd?.slice(0,10)}</span>
                          }
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <button className="btn btn-sm btn-secondary" onClick={() => setSelected(s)}>Manage →</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── INVOICES TAB ── */}
      {mainTab === 'invoices' && (
        <div className="card table-wrap">
          {allInvoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>No invoices yet. Open a tenant and generate an invoice.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Invoice #</th><th>Tenant</th><th>Period</th><th>Amount</th><th>Status</th><th>Due</th><th>Paid</th></tr>
              </thead>
              <tbody>
                {allInvoices.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)).map(inv => (
                  <tr key={inv.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{inv.invoiceNumber}</td>
                    <td>{inv.tenantName}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{inv.periodStart?.slice(0,7)}</td>
                    <td style={{ fontWeight: 700 }}>{formatUsd(inv.totalAmount)}</td>
                    <td><Chip label={inv.status} status={inv.status} /></td>
                    <td style={{ fontSize: 12 }}>{inv.dueAt?.slice(0,10)}</td>
                    <td style={{ fontSize: 12, color: inv.paidAt ? '#22c55e' : 'var(--text-tertiary)' }}>{inv.paidAt?.slice(0,10) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── PLANS TAB ── */}
      {mainTab === 'plans' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {Object.values(SUBSCRIPTION_PLANS).filter(p => p.isPublic || p.id === 'trial').map(p => (
            <div key={p.id} style={{ background: 'var(--bg-surface)', border: `1px solid ${p.color}44`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', background: `${p.color}08` }}>
                <div style={{ fontSize: 28 }}>{p.icon}</div>
                <div style={{ fontWeight: 900, fontSize: 18, marginTop: 8 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{p.description}</div>
                {p.baseMonthly > 0 ? (
                  <div style={{ marginTop: 12 }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: p.color }}>{formatUsd(p.baseMonthly)}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>/mo base</span>
                  </div>
                ) : p.id === 'enterprise' ? (
                  <div style={{ fontSize: 22, fontWeight: 900, color: p.color, marginTop: 12 }}>Custom</div>
                ) : (
                  <div style={{ fontSize: 22, fontWeight: 900, color: p.color, marginTop: 12 }}>Free Trial</div>
                )}
              </div>
              <div style={{ padding: '14px 20px' }}>
                {[
                  p.pricePerSeat > 0 && `$${p.pricePerSeat}/seat/mo`,
                  p.aumFeeBps > 0 && `${p.aumFeeBps} bps/yr on AUM`,
                  p.maxSeats > 0 ? `Up to ${p.maxSeats} seats` : p.maxSeats === -1 ? 'Unlimited seats' : null,
                  p.maxAumUsd > 0 ? `Up to ${formatAum(p.maxAumUsd)} AUM` : p.maxAumUsd === -1 ? 'Unlimited AUM' : null,
                  p.trialDays > 0 && `${p.trialDays}-day free trial`,
                ].filter(Boolean).map(f => (
                  <div key={String(f)} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>· {f}</div>
                ))}
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  {p.features.slice(0, 5).map(feat => (
                    <div key={feat} style={{ fontSize: 12, marginBottom: 3 }}>✓ {feat}</div>
                  ))}
                  {p.features.length > 5 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>+{p.features.length - 5} more…</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── GLOBAL EVENTS ── */}
      {mainTab === 'events' && (
        <div className="card">
          <div style={{ padding: '16px 20px', fontWeight: 800, fontSize: 15, borderBottom: '1px solid var(--border)' }}>📜 Global Subscription Audit Log</div>
          {allEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>No global events yet.</div>
          ) : allEvents.map(ev => (
            <div key={ev.id} style={{ display: 'flex', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 11, flexShrink: 0, width: 145 }}>{new Date(ev.occurredAt).toLocaleString()}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{ev.tenantName}</div>
                <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{ev.description}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>by {ev.userName} · {ev.type}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
