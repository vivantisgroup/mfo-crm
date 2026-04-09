'use client';

import { Search, LayoutDashboard, MessageSquare, CreditCard, Receipt, Users, Leaf, FileText, Trash2, FlaskConical, Sprout, Star, Gem, Building2 } from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { usePageTitle } from '@/lib/PageTitleContext';
import { useSearchParams } from 'next/navigation';
import { CommunicationPanel } from '@/components/CommunicationPanel';
import { SecondaryDock, type SecondaryDockTab } from '@/components/SecondaryDock';
import { 
  SUBSCRIPTION_PLANS, trialDaysLeft, planMonthlyTotal, 
  TenantSubscription, Invoice, SubscriptionEvent, PlanId, BillingCycle,
  extendTrial, changePlan, updateSeats, generateInvoice, markInvoicePaid,
  getInvoices, getSubscriptionEvents, formatUsd, formatAum,
  getAllSubscriptions, getAllInvoices, getAllSubscriptionEvents
} from '@/lib/subscriptionService';
import { buildSeedManifest, generateDemoCredentials } from '@/lib/demoSeed';
import { 
  getTenantMembers, getInvitationsForTenant, addMemberToTenant, 
  updateMemberRole, setMemberStatus, removeMemberFromTenant, revokeInvitation,
  ROLE_LABELS, TENANT_ROLES
} from '@/lib/tenantMemberService';
import { getAllUsers } from '@/lib/platformService';
import { UserProfile, TenantMember, TenantInvitation, PlatformOrg, PlatformContact } from '@/lib/types';
import { SUPPORTED_LANGUAGES } from '@/lib/emailTemplateService';
const PLAN_ICONS: Record<string, React.ElementType> = {
  FlaskConical, Sprout, Star, Gem, Building2
};

function PlanIcon({ name, ...props }: { name: string; [key: string]: any }) {
  const Icon = PLAN_ICONS[name] || Star;
  return <Icon {...props} />;
}


// ─── Shared helpers ───────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, { fg: string; bg: string }> = {
 trial: { fg: '#f59e0b', bg: '#f59e0b15' },
 active: { fg: '#22c55e', bg: '#22c55e15' },
 past_due: { fg: '#ef4444', bg: '#ef444415' },
 suspended: { fg: '#94a3b8', bg: '#94a3b815' },
 cancelled: { fg: '#64748b', bg: '#64748b15' },
 provisioning:{ fg: '#818cf8', bg: '#818cf815' },
 expired: { fg: '#94a3b8', bg: '#94a3b815' },
 draft: { fg: '#94a3b8', bg: '#94a3b815' },
 sent: { fg: '#60a5fa', bg: '#60a5fa15' },
 paid: { fg: '#22c55e', bg: '#22c55e15' },
 overdue: { fg: '#ef4444', bg: '#ef444415' },
 void: { fg: '#64748b', bg: '#64748b15' },
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
 // Push breadcrumb to header bar


 const [tab, setTab] = useState<DetailTab>('overview');
 const [invoices, setInvoices] = useState<Invoice[]>([]);
 const [events, setEvents] = useState<SubscriptionEvent[]>([]);
 const [loading, setLoading] = useState(false);
 const [msg, setMsg] = useState<React.ReactNode | null>(null);

 // Members tab state
 const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
 const [members, setMembers] = useState<TenantMember[]>([]);
 const [invitations, setInvitations] = useState<TenantInvitation[]>([]);
 const [membersLoaded, setMembersLoaded] = useState(false);
 const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [globalMemberships, setGlobalMemberships] = useState<TenantMember[]>([]);;
 const [memberInput, setMemberInput] = useState('');
 const [memberRole, setMemberRole] = useState<import('@/lib/platformService').PlatformRole>('report_viewer');
 const [memberLang, setMemberLang] = useState((sub as any).defaultLanguage ?? 'en');
 const [sendInvite, setSendInvite] = useState(true);
 const [addingMember, setAddingMember] = useState(false);

 // CRM association state
 const [crmOrgs, setCrmOrgs] = useState<PlatformOrg[]>([]);
 const [crmContacts, setCrmContacts] = useState<PlatformContact[]>([]);
 const [selCrmOrgId, setSelCrmOrgId] = useState((sub as any).crmOrgId ?? '');
 const [selCrmOrgName, setSelCrmOrgName] = useState((sub as any).crmOrgName ?? '');
 const [selCrmContactId, setSelCrmContactId] = useState((sub as any).crmContactId ?? '');
 const [crmSaving, setCrmSaving] = useState(false);

 // Load CRM orgs on mount
 useEffect(() => {
 import('@/lib/crmService').then(({ getAllOrgs }) => getAllOrgs().then(setCrmOrgs)).catch(() => {});
 }, []);

 // Load contacts when org changes
 useEffect(() => {
 if (!selCrmOrgId) { setCrmContacts([]); return; }
 import('@/lib/crmService').then(({ getContactsForOrg }) =>
 getContactsForOrg(selCrmOrgId).then(setCrmContacts)
 ).catch(() => {});
 }, [selCrmOrgId]);

 async function saveCrmLink() {
 setCrmSaving(true);
 try {
 const contact = crmContacts.find(c => c.id === selCrmContactId);
 await updateTenant(sub.tenantId, {
 crmOrgId: selCrmOrgId || undefined,
 crmOrgName: selCrmOrgName || undefined,
 crmContactId: selCrmContactId || undefined,
 crmContactName: contact?.name || undefined,
 });
 if (selCrmOrgId) {
 const { updateOrg } = await import('@/lib/crmService');
 await updateOrg(selCrmOrgId, { tenantIds: [sub.tenantId] });
 }
 setMsg('✅ CRM association saved.');
 } catch (e: any) { setMsg(`❌ ${e.message}`); }
 finally { setCrmSaving(false); }
 }

 // Extension UI
 const [extDays, setExtDays] = useState(14);
 // Plan change UI
 const [newPlan, setNewPlan] = useState<PlanId>(sub.planId);
 const [newCycle, setNewCycle] = useState<BillingCycle>(sub.billingCycle);
 // Seats
 const [seats, setSeats] = useState(sub.licensedSeats);
 // AUM
 const [aum, setAum] = useState(sub.currentAumUsd);

 // Demo seed
 const [seedProgress, setSeedProgress] = useState<SeedStep[]>([]);
 const [seedDone, setSeedDone] = useState(false);
 const [seeding, setSeeding] = useState(false);
 const [seedTenant, setSeedTenant] = useState<DemoTenant | null>(null);
 // Demo tab confirmation wizard state (hoisted to avoid hooks-in-IIFE violation)
 const [demoConfirmed1, setDemoConfirmed1] = useState(false);
 const [demoConfirmText, setDemoConfirmText] = useState('');
 const demoNameMatch = demoConfirmText.trim().toLowerCase() === sub.tenantName.trim().toLowerCase();

 // Delete tab state (hoisted — hooks cannot live inside IIFEs)
 const [delStep, setDelStep] = useState<1|2|3>(1);
 const [delExported, setDelExported] = useState(false);
 const [delAckChecked, setDelAckChecked] = useState(false);
 const [delConfirmName,setDelConfirmName]= useState('');
 const [deleting, setDeleting] = useState(false);
 const [delError, setDelError] = useState('');
 const delNameOk = delConfirmName.trim() === sub.tenantName.trim();

 // Audit log state
 const [auditLogs, setAuditLogs] = useState<any[]>([]);
 const [auditLoaded, setAuditLoaded] = useState(false);

 // Remove member inline confirm
 const [removeConfirmMember, setRemoveConfirmMember] = useState<TenantMember | null>(null);
 const [removingMember, setRemovingMember] = useState(false);

 useEffect(() => {
 if (tab === 'invoices') getInvoices(sub.tenantId).then(setInvoices);
 if (tab === 'events') getSubscriptionEvents(sub.tenantId).then(setEvents);
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

 // Load members count & audit log eagerly on mount
 useEffect(() => {
 // Pre-load member count so the tab badge is live immediately
 getTenantMembers(sub.tenantId)
 .then(m => setMembers(m))
 .catch(() => {});

 // Pre-load audit log — use simple query without orderBy to avoid composite index requirement
 (async () => {
 try {
 const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
 const { firebaseApp } = await import('@mfo-crm/config');
 const _db = getFirestore(firebaseApp);
 const q = query(
 collection(_db, 'audit_logs'),
 where('tenantId', '==', sub.tenantId),
 );
 const snap = await getDocs(q);
 const logs = snap.docs
 .map(d => ({ id: d.id, ...d.data() }))
 .sort((a: any, b: any) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? ''));
 setAuditLogs(logs);
 setAuditLoaded(true);
 } catch (e) {
 console.error('[audit_logs eager]', e);
 setAuditLoaded(true); // mark loaded even on error so UI shows empty state
 }
 })();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [sub.tenantId]);

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
 // Guard: demo data seeding is NOT allowed on the master (platform) tenant
 if (sub.tenantId === 'master') {
 setMsg('❌ Demo data seeding is not available on the master tenant. Select a non-master client tenant to seed demo data.');
 return;
 }

 const manifest = buildSeedManifest();
 const creds = generateDemoCredentials(sub.tenantName);
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
 // ── Case 1: user already exists in our CRM ────────────────────────────
 const existingUser = allUsers.find(u => u.email.toLowerCase() === input);
 if (existingUser) {
 if (members.find(m => m.uid === existingUser.uid)) {
 setMsg('⚠ User is already a member.');
 setAddingMember(false);
 return;
 }
 await addMemberToTenant(sub.tenantId, sub.tenantName, existingUser, memberRole, performer);
 setMsg(`✅ ${existingUser.displayName} (existing user) added to ${sub.tenantName}.`);
 } else {
 // ── Case 2: new user — get idToken client-side, call API route directly ──
 // (Server Actions cannot call auth.currentUser — it's always null server-side)
 const { getAuth } = await import('firebase/auth');
 const { firebaseApp } = await import('@mfo-crm/config');
 const auth = getAuth(firebaseApp);

 // Wait for auth state to be fully ready, then get a fresh token
 const idToken = await new Promise<string | null>((resolve) => {
 if (auth.currentUser) {
 auth.currentUser.getIdToken(true).then(resolve).catch(() => resolve(null));
 } else {
 const unsub = auth.onAuthStateChanged(u => {
 unsub();
 if (u) u.getIdToken(true).then(resolve).catch(() => resolve(null));
 else resolve(null);
 });
 }
 });

 if (!idToken) {
 setMsg('❌ Session expired — please refresh the page and sign in again.');
 setAddingMember(false);
 return;
 }

 const displayName = input.split('@')[0];

 // Create Firebase Auth user via API route
 const createRes = await fetch('/api/admin/users', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ idToken, email: input, displayName, tenantName: sub.tenantName }),
 });
 const createData = await createRes.json();
 if (!createRes.ok) {
 setMsg(`❌ Error creating user: ${createData.error ?? 'Unknown error'}`);
 setAddingMember(false);
 return;
 }

 const uid = createData.uid as string;
 const isNew = createData.isNew as boolean;
 const tempPassword = createData.tempPassword as string | undefined;
 const newProfile = { uid, email: input, displayName, tenantIds: [] as string[] };

 // Write user profile to Firestore via client SDK
 // IMPORTANT: use arrayUnion for tenantIds so we don't clobber any existing tenantIds
 const { doc, setDoc, arrayUnion: au, getFirestore } = await import('firebase/firestore');
 const _db = getFirestore(firebaseApp);

 await setDoc(doc(_db, 'users', uid), {
 uid: uid,
 email: input,
 displayName,
 role: 'report_viewer',
 mfaEnabled: false,
 mfaEnrollRequired: isNew, // new users must enroll TOTP on first login
 status: 'active',
 preferredLanguage: memberLang,
 createdAt: new Date().toISOString(),
 // Use arrayUnion so we merge with any existing tenantIds — do NOT write []
 tenantIds: au(sub.tenantId),
 ...(uid.startsWith('pending_') ? { pendingActivation: true } : {}),
 }, { merge: true });

 // Link user to tenant (also updates tenantIds via arrayUnion in batch)
 await addMemberToTenant(
 sub.tenantId,
 sub.tenantName,
 { ...newProfile, uid },
 memberRole,
 performer,
 );

 // Send invite email if requested
 let successMsg: React.ReactNode = `✅ User ${input} ${isNew ? 'created' : 'found'} and added to ${sub.tenantName}.`;
 
 if (createData.inviteLink) {
   successMsg = (
     <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
       <div>✅ <strong>User {input} created successfully.</strong></div>
       <div style={{ color: 'var(--text-primary)', marginTop: 4 }}>
         <strong>Action required:</strong> Share this secure enrollment link with the user so they can set their password.
       </div>
       <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
         <input type="text" readOnly value={createData.inviteLink} style={{ flex: 1, padding: '8px 12px', fontSize: 13, background: 'var(--bg-elevated)', border: '1px solid var(--brand-500)', borderRadius: 6, color: 'var(--brand-500)', fontFamily: 'monospace' }} onClick={e => (e.target as HTMLInputElement).select()} />
         <button className="btn btn-primary btn-sm" onClick={() => navigator.clipboard.writeText(createData.inviteLink as string)}>Copy Link</button>
       </div>
     </div>
   );
 } else if (sendInvite && !createData.emailSent) {
   const invRes = await fetch('/api/admin/users', {
     method: 'PUT',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ idToken, email: input }),
   });
   const invData = await invRes.json();
   if (invRes.ok) {
     successMsg = `✅ User ${input} created. 📧 Password-reset invitation email sent via Firebase.`;
   } else {
     successMsg = `✅ User ${input} created. (Invite email failed: ${invData.error ?? 'unknown'})`;
   }
 } else if (isNew && tempPassword) {
   successMsg = `✅ User ${input} created. Temp password: ${tempPassword}`;
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
 // Show inline confirmation modal instead of browser confirm()
 setRemoveConfirmMember(member);
 }

 async function confirmRemoveMember() {
 if (!removeConfirmMember) return;
 setRemovingMember(true);
 try {
 await removeMemberFromTenant(sub.tenantId, sub.tenantName, removeConfirmMember.uid, removeConfirmMember.displayName, performer);
 setMembers(prev => prev.filter(m => m.uid !== removeConfirmMember.uid));
 setMsg(`✅ ${removeConfirmMember.displayName} removed from ${sub.tenantName}.`);
 } catch (e: any) { setMsg(`❌ ${e.message}`); }
 finally { setRemovingMember(false); setRemoveConfirmMember(null); }
 }

 async function doRevokeInvitation(inv: TenantInvitation) {
 try {
 await revokeInvitation(inv.id, performer, sub.tenantId);
 setInvitations(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'revoked' } : i));
 setMsg(`✅ Invitation to ${inv.email} revoked.`);
 } catch (e: any) { setMsg(`❌ ${e.message}`); }
 }

 async function doGenerateInviteLink(email: string) {
   setLoading(true); setMsg(null);
   try {
     const { getAuth } = await import('firebase/auth');
     const { firebaseApp } = await import('@mfo-crm/config');
     const auth = getAuth(firebaseApp);
     const idToken = await new Promise<string | null>((resolve) => {
       if (auth.currentUser) auth.currentUser.getIdToken(true).then(resolve).catch(() => resolve(null));
       else {
         const unsub = auth.onAuthStateChanged(u => {
           unsub();
           if (u) u.getIdToken(true).then(resolve).catch(() => resolve(null));
           else resolve(null);
         });
       }
     });

     if (!idToken) throw new Error('Session expired');

     const { adminGeneratePasswordResetLink } = await import('@/lib/usersAdmin');
     const res = await adminGeneratePasswordResetLink(email, idToken);

     if (!res.success) throw new Error(res.error);

     setMsg(
       <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
         <div>✅ <strong>Invitation Generated for {email}</strong></div>
         {res.emailSent && <div style={{ color: '#22c55e', marginTop: 4 }}>📧 Magic link sent via email.</div>}
         {res.inviteLink && (
           <>
             <div style={{ color: 'var(--text-primary)', marginTop: 4 }}>
               <strong>Action required:</strong> Share this secure enrollment link with the user so they can set their password.
             </div>
             <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
               <input type="text" readOnly value={res.inviteLink} style={{ flex: 1, padding: '8px 12px', fontSize: 13, background: 'var(--bg-elevated)', border: '1px solid var(--brand-500)', borderRadius: 6, color: 'var(--brand-500)', fontFamily: 'monospace' }} onClick={e => (e.target as HTMLInputElement).select()} />
               <button className="btn btn-primary btn-sm" onClick={() => navigator.clipboard.writeText(res.inviteLink as string)}>Copy Link</button>
             </div>
           </>
         )}
       </div>
     );
   } catch (e: any) {
     setMsg(`❌ Failed to generate invite link: ${e.message}`);
   } finally {
     setLoading(false);
   }
 }


 const TABS: SecondaryDockTab[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'communications', label: 'Communications', icon: MessageSquare },
    { id: 'billing', label: 'Subscription', icon: CreditCard },
    { id: 'invoices', label: 'Invoices', icon: Receipt },
    { id: 'members', label: `Members (${members.length})`, icon: Users },
    { id: 'demo', label: 'Demo Data', icon: Leaf },
    { id: 'events', label: 'Audit Log', icon: FileText },
    { id: 'delete', label: 'Delete', icon: Trash2 },
  ];

 return (
 <div className="animate-fade-in">

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
 <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: 'var(--bg-overlay)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
   <PlanIcon name={plan.icon} size={12} /> {plan.name}
 </div>
 {daysLeft !== null && <Chip label={daysLeft === 0 ? 'Trial expired' : `${daysLeft}d trial left`} status={daysLeft <= 3 ? 'overdue' : 'trial'} />}
 {selCrmOrgName && (
 <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, background: '#6366f115', color: '#6366f1', border: '1px solid #6366f130' }}>
 🔗 {selCrmOrgName}
 </span>
 )}
 </div>
 </div>
 </div>
 {/* Tabs */}
 <div style={{ display: 'flex', gap: 0, borderBottom: 'none' }}>
 {TABS.map(t => (
 <button key={t.id} onClick={() => setTab(t.id as any)} style={{
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
 {msg && (
  <div style={{ margin: '12px 28px 0', padding: '10px 14px', background: typeof msg === 'string' && (msg as string).startsWith('✅') ? '#22c55e15' : (typeof msg !== 'string' ? '#22c55e15' : '#ef444415'), borderRadius: 8, fontSize: 13, color: typeof msg === 'string' && (msg as string).startsWith('✅') ? '#22c55e' : (typeof msg !== 'string' ? '#22c55e' : '#ef4444') }}>
    {msg}
  </div>
 )}

 <div style={{ padding: '20px 28px 28px' }}>

 {/* ── OVERVIEW ── */}
 {tab === 'overview' && (
 <div>
 {/* ── CRM Association card — shown first as per requirement ── */}
 <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ marginTop: 20, padding: '20px 22px' }}>
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
 <div style={{ width: 32, height: 32, borderRadius: 8, background: '#6366f115', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔗</div>
 <div>
 <div style={{ fontWeight: 700, fontSize: 14 }}>CRM Association</div>
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Link this tenant to its CRM organization and primary contact</div>
 </div>
 </div>
 {selCrmOrgId && (
 <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: '#22c55e15', color: '#22c55e', border: '1px solid #22c55e30' }}>
 ● Linked
 </span>
 )}
 </div>

 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
 <div>
 <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Organization</div>
 <select
 className="input"
 style={{ width: '100%' }}
 value={selCrmOrgId}
 onChange={e => {
 const org = crmOrgs.find(o => o.id === e.target.value);
 setSelCrmOrgId(e.target.value);
 setSelCrmOrgName(org?.name ?? '');
 setSelCrmContactId('');
 }}
 >
 <option value="">— Not linked —</option>
 {crmOrgs.map(o => (
 <option key={o.id} value={o.id}>{o.name}{o.country ? ` · ${o.country}` : ''}</option>
 ))}
 </select>
 </div>
 <div>
 <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Primary Contact</div>
 <select
 className="input"
 style={{ width: '100%', opacity: selCrmOrgId ? 1 : 0.5 }}
 value={selCrmContactId}
 onChange={e => setSelCrmContactId(e.target.value)}
 disabled={!selCrmOrgId}
 >
 <option value="">— None —</option>
 {crmContacts.map(c => (
 <option key={c.id} value={c.id}>{c.name}{c.role ? ` · ${c.role}` : ''}</option>
 ))}
 </select>
 </div>
 </div>

 {selCrmOrgId && (
 <div style={{ marginTop: 12, padding: '10px 14px', background: '#22c55e0d', borderRadius: 8, border: '1px solid #22c55e20', fontSize: 12, color: '#22c55e' }}>
 ✓ Linked to <strong>{selCrmOrgName}</strong>
 {selCrmContactId && crmContacts.find(c => c.id === selCrmContactId) && (
 <> · Contact: <strong>{crmContacts.find(c => c.id === selCrmContactId)!.name}</strong></>
 )}
 </div>
 )}

 <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
 {selCrmOrgId && (
 <button
 className="btn btn-secondary btn-sm"
 style={{ color: '#ef4444', borderColor: '#ef444440' }}
 onClick={() => { setSelCrmOrgId(''); setSelCrmOrgName(''); setSelCrmContactId(''); }}
 disabled={crmSaving}
 >
 ✕ Remove Link
 </button>
 )}
 <button className="btn btn-primary btn-sm" onClick={saveCrmLink} disabled={crmSaving}>
 {crmSaving ? '…' : '💾 Save Link'}
 </button>
 </div>
 </div>
 {/* ── KPI cards ── */}
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, marginTop: 20 }}>
 <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: '16px 20px' }}>
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Monthly Estimate</div>
 <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--brand-500)' }}>{formatUsd(monthly)}</div>
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{sub.billingCycle} billing</div>
 </div>
 <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: '16px 20px' }}>
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Usage</div>
 <div style={{ fontSize: 14, fontWeight: 700 }}>{sub.licensedSeats} / {SUBSCRIPTION_PLANS[sub.planId].maxSeats === -1 ? '∞' : SUBSCRIPTION_PLANS[sub.planId].maxSeats} seats</div>
 <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{formatAum(sub.currentAumUsd)} AUM</div>
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Max {SUBSCRIPTION_PLANS[sub.planId].maxAumUsd === -1 ? '∞' : formatAum(SUBSCRIPTION_PLANS[sub.planId].maxAumUsd)}</div>
 </div>
 </div>
 <Field label="Tenant ID" value={<span style={{ fontFamily: 'monospace', fontSize: 11 }}>{sub.tenantId}</span>} />
 <Field label="Plan" value={`${plan.icon} ${plan.name}`} />
 <Field label="Status" value={<Chip label={sub.status} status={sub.status} />} />
 <Field label="Billing Cycle" value={sub.billingCycle} />
 <Field label="Trial Ends" value={sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString() : '—'} />
 <Field label="Current Period" value={`${sub.currentPeriodStart?.slice(0,10)} → ${sub.currentPeriodEnd?.slice(0,10)}`} />
 <Field label="Next Invoice" value={sub.nextInvoiceDate?.slice(0,10) ?? '—'} />
 <Field label="Currency" value={sub.currency} />
 <Field label="Subscribed" value={new Date(sub.subscriptionStart).toLocaleDateString()} />
 </div>
 )}

 {/* ── COMMUNICATIONS ── */}
 {tab === 'communications' && (
 <div style={{ height: 600 }}>
 <CommunicationPanel
 familyId={sub.tenantId} // tenant acts as the logical entity
 familyName={sub.tenantName}
 />
 </div>
 )}

 {/* ── SUBSCRIPTION MANAGEMENT ── */}
 {tab === 'billing' && (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

 {/* Trial Extension */}
 {(sub.status === 'trial') && (
 <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 20 }}>
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
 <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 20 }}>
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
 <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 20 }}>
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
 <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 20, background: 'var(--bg-canvas)' }}>
 <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>💰 Monthly Price Estimate</div>
 {(() => {
 const p = SUBSCRIPTION_PLANS[sub.planId];
 const m = sub.billingCycle === 'monthly';
 const base = m ? p.baseMonthly : p.baseAnnual / 12;
 const seat = seats * (m ? p.pricePerSeat : p.pricePerSeatAnnual / 12);
 const aumF = aum * (p.aumFeeBps / 10000) / 12;
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
 {tab === 'demo' && (
 <div>
 <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>🌱 Demo Data Provisioner</div>
 <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
 Seeds {totalDemoRecords().toLocaleString()} realistic records across {totalDemoCollections()} collections in <strong>{sub.tenantName}</strong>.
 </div>

 {/* ── Master-tenant guard ── */}
 {sub.tenantId === 'master' ? (
 <div style={{ padding: '20px 24px', borderRadius: 12, background: '#6366f110', border: '2px solid #6366f140', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
 <span style={{ fontSize: 32 }}>🏛️</span>
 <div>
 <div style={{ fontWeight: 800, fontSize: 15, color: '#818cf8', marginBottom: 6 }}>Demo seeding not available on Master Tenant</div>
 <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
 The <strong>Master Tenant</strong> is the platform&apos;s own internal organization and cannot be seeded with demo data.
 Demo provisioning is only available on <strong>client tenants</strong> — select any non-master tenant from the tenant list to use this feature.
 </div>
 </div>
 </div>
 ) : (
 <>
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
 {!demoConfirmed1 ? (
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
 onClick={() => setDemoConfirmed1(true)}
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
 style={{ width: '100%', borderColor: demoNameMatch ? '#22c55e' : demoConfirmText ? '#ef4444' : undefined }}
 placeholder={`Type "${sub.tenantName}" to confirm…`}
 value={demoConfirmText}
 onChange={e => setDemoConfirmText(e.target.value)}
 autoFocus
 />
 {demoConfirmText && !demoNameMatch && (
 <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>Name does not match. Check capitalisation and spacing.</div>
 )}
 </div>
 <div style={{ display: 'flex', gap: 10 }}>
 <button className="btn btn-ghost btn-sm" onClick={() => { setDemoConfirmed1(false); setDemoConfirmText(''); }}>
 ← Back
 </button>
 <button
 className="btn btn-sm"
 style={{
 background: demoNameMatch ? '#ef4444' : 'var(--bg-elevated)',
 color: demoNameMatch ? 'white' : 'var(--text-tertiary)',
 border: `1px solid ${demoNameMatch ? '#ef4444' : 'var(--border)'}`,
 cursor: demoNameMatch ? 'pointer' : 'not-allowed',
 flex: 1,
 fontWeight: 700,
 }}
 disabled={!demoNameMatch || loading}
 onClick={doSeedDemo}
 >
 {loading ? '⚙️ Seeding…' : '🚀 Reset & Seed Demo Data'}
 </button>
 </div>
 </div>
 )}
 </>
 )}
 </div>
 )}

{/* ── MEMBERS ── */}
 {tab === 'members' && (() => {
 const pendingInvites = invitations.filter(i => i.status === 'pending');
 return (
 <div>
 {/* Add Member panel */}
 <div style={{ marginBottom: 20, padding: '16px 18px', background: 'var(--bg-canvas)', borderRadius: 10, border: '1px solid var(--border)' }}>
 <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>➕ Add Member</div>
 <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 2fr) 1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
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
 <div>
 <Label>Language</Label>
 <select className="input" style={{ width: '100%' }} value={memberLang}
 onChange={e => setMemberLang(e.target.value)}>
 {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
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
  {selectedMemberId ? (() => {
     const m = members.find(x => x.uid === selectedMemberId);
     if (!m) return null;
     const userObj = allUsers.find(x => x.uid === selectedMemberId);
     const matchedContact = crmContacts.find(c => c.linkedUserUid === m.uid);
 
     return (
       <div className={"animate-fade-in pl-1"}>
          <div className={"mb-6 flex items-center justify-between"}>
            <button className={"btn btn-light btn-sm"} onClick={() => setSelectedMemberId(null)}>← Back to List</button>
            {(!userObj?.lastLoginAt || m.status === 'invited') && (
              <button className={"btn btn-primary btn-sm"} onClick={() => doGenerateInviteLink(m.email)} disabled={loading}>
                {loading ? '…' : 'Generate Invitation Link'}
              </button>
            )}
          </div>
          
          {/* Detailed Card */}
          <div className={"bg-white p-6 rounded-3xl border border-slate-200 flex flex-col md:flex-row gap-6 mt-2 relative"}>
             <div className={"absolute top-6 right-6"}>
                 {m.status === 'active' ? <span className={"bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"}>Active</span> : <span className={"bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"}>{m.status}</span>}
             </div>
             <div className={"w-24 h-24 rounded-full flex-shrink-0 flex items-center justify-center text-4xl font-black text-white shadow-inner"} style={{ background: `hsl(${((m.displayName || m.email || '?').charCodeAt(0) * 7) % 360},60%,50%)` }}>
                {(m.displayName || m.email || '?')[0].toUpperCase()}
             </div>
             <div className={"flex-1"}>
                <h2 className={"text-2xl font-black text-slate-800 mb-1"}>{m.displayName || m.email}</h2>
                <div className={"text-sm text-slate-500 font-medium"}>{m.email}</div>
                <div className={"mt-4 flex flex-wrap gap-4"}>
                  <div className={"bg-slate-50/80 px-4 py-2 border border-slate-100 rounded-xl min-w-[120px]"}>
                    <div className={"text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1"}>Role</div>
                    <div className={"font-bold text-slate-700 text-sm whitespace-nowrap"}>{ROLE_LABELS[m.role]}</div>
                  </div>
                  <div className={"bg-slate-50/80 px-4 py-2 border border-slate-100 rounded-xl min-w-[120px]"}>
                    <div className={"text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1"}>Joined Date</div>
                    <div className={"font-bold text-slate-700 text-sm whitespace-nowrap"}>{new Date(m.joinedAt).toLocaleDateString()}</div>
                  </div>
                  <div className={"bg-slate-50/80 px-4 py-2 border border-slate-100 rounded-xl min-w-[120px]"}>
                    <div className={"text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1"}>Security / MFA</div>
                    <div className={"font-bold text-slate-700 text-sm whitespace-nowrap"}>{userObj?.mfaEnabled ? '🟢 Enrolled' : '🔴 Exposed'}</div>
                  </div>
                </div>
             </div>
          </div>
 
          <div className={"mt-8 border border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm"}>
             <div className={"bg-slate-50 px-6 py-4 border-b border-slate-100"}>
                 <div className={"flex gap-2 items-center text-slate-500 h-5"}>
                    <Users size={16}/>
                    <h3 className={"text-sm font-extrabold tracking-wider uppercase mt-0.5"}>CRM Integration</h3>
                 </div>
             </div>
             
             <div className={"p-6"}>
                <div className={"flex gap-5 items-start"}>
                   <div className={"flex-1"}>
                      <div className={"font-extrabold text-slate-800"}>Contact Sync Link</div>
                      <div className={"text-xs text-slate-500 mt-1 mb-5 max-w-lg leading-relaxed"}>Directly associate this user record with a CRM Contact node. Doing this auto-populates timelines, deals, and notes directly into the User's profile view anywhere on the platform.</div>
                      
                      <div className={"bg-slate-50 p-4 rounded-xl border border-slate-200 max-w-md"}>
                         <div className={"text-[10px] uppercase font-black text-slate-400 mb-1.5"}>Associated CRM Contact</div>
                         <select className={"input focus:border-brand-500 focus:ring-brand-500/20"} style={{ width: '100%', fontSize: 13, background: 'white', fontWeight: 600, color: matchedContact ? 'var(--brand-600)' : 'var(--text-secondary)' }} value={matchedContact ? matchedContact.id : ''} onChange={async (e) => {
                             const selId = e.target.value;
                             const { updateContact } = await import('@/lib/crmService');
                             
                             if (matchedContact) await updateContact(matchedContact.id, { linkedUserUid: null } as any);
                             
                             if (selId) {
                                await updateContact(selId, { linkedUserUid: m.uid } as any);
                             }
                             
                             import('@/lib/crmService').then(({ getContactsForOrg }) =>
                               getContactsForOrg(selCrmOrgId).then(setCrmContacts)
                             );
                         }}>
                            <option value="">— Not Applicable —</option>
                            {crmContacts.map(c => <option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ''}</option>)}
                         </select>
                      </div>
                   </div>
                </div>
             </div>
          </div>
 
          <div className={"mt-8 border border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm mb-12"}>
             <div className={"bg-slate-50 px-6 py-4 border-b border-slate-100"}>
                <h3 className={"text-sm font-extrabold text-slate-500 tracking-wider uppercase mt-1"}>Audit Data</h3>
             </div>
             <div className={"p-6 text-sm text-slate-600"}>
                <div className={"mb-4"}>
                    <strong className={"block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1"}>Last Platform Login</strong>
                    <div className={"font-medium text-slate-800 text-lg"}>{userObj?.lastLoginAt ? new Date(userObj.lastLoginAt).toLocaleString() : 'N/A'}</div>
                </div>
             </div>
          </div>
       </div>
     );
  })() : (
  <div className={"animate-fade-in"}>
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
  <div key={m.uid} 
    onClick={(e) => {
       if ((e.target as HTMLElement).tagName === 'SELECT' || (e.target as HTMLElement).tagName === 'BUTTON') return;
       setSelectedMemberId(m.uid);
    }}
    style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto auto auto auto',
  alignItems: 'center', gap: 12, padding: '10px 14px',
  background: m.status === 'suspended' ? 'var(--bg-canvas)' : 'var(--bg-elevated)',
  borderRadius: 8, opacity: m.status === 'suspended' ? 0.6 : 1, border: '1px solid var(--border)', cursor: 'pointer' }} className={"hover:border-slate-300 transition-colors"}>
  <div style={{ width: 32, height: 32, borderRadius: '50%',
  background: `hsl(${((m.displayName || m.email || '?').charCodeAt(0) * 7) % 360},60%,50%)`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
  {(m.displayName || m.email || '?')[0].toUpperCase()}
  </div>
  <div>
  <div style={{ fontWeight: 600, fontSize: 13 }}>{m.displayName || m.email}</div>
  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
  {m.email} · Joined {new Date(m.joinedAt).toLocaleDateString()}
  </div>
  </div>
  <select className={"input"} style={{ fontSize: 12, padding: '4px 8px', height: 30, minWidth: 160 }}
  value={m.role} onChange={e => doChangeRole(m, e.target.value)}>
  {TENANT_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
  </select>

  {m.status === 'invited' ? (
    <button onClick={(e) => { e.stopPropagation(); doGenerateInviteLink(m.email); }} disabled={loading}
    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--brand-500)44',
    background: 'none', cursor: 'pointer', color: 'var(--brand-400)' }}>
    {loading ? '…' : '📧 Send Invitation'}
    </button>
  ) : (
    <button onClick={(e) => { e.stopPropagation(); doGenerateInviteLink(m.email); }} disabled={loading}
    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
    {loading ? '…' : '🔑 Reset Password'}
    </button>
  )}

  <button onClick={(e) => { e.stopPropagation(); doToggleSuspend(m); }}
  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
  background: 'none', cursor: 'pointer', color: m.status === 'suspended' ? '#22c55e' : '#f59e0b' }}>
  {m.status === 'suspended' ? '↩ Reactivate' : '⏸ Suspend'}
  </button>
  <button onClick={(e) => { e.stopPropagation(); doRemoveMember(m); }}
  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #ef444444',
  background: 'none', cursor: 'pointer', color: '#ef4444' }}>
  🗑 Remove
  </button>
  </div>
  ))}
  </div>
  )}
  </div>
  )}
 {/* ── Inline remove confirmation modal ── */}
 {removeConfirmMember && (
 <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
 <div style={{ background: 'var(--bg-elevated)', border: '1px solid #ef444440', borderRadius: 16, padding: '28px 32px', maxWidth: 440, width: '90%', boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
 <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
 <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Remove Member</div>
 <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
 Remove <strong>{removeConfirmMember.displayName}</strong> ({removeConfirmMember.email}) from <strong>{sub.tenantName}</strong>?<br />
 They will immediately lose access to all resources in this tenant.
 </p>
 <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
 <button className="btn btn-ghost" onClick={() => setRemoveConfirmMember(null)} disabled={removingMember}>
 Cancel
 </button>
 <button
 onClick={confirmRemoveMember}
 disabled={removingMember}
 style={{ padding: '8px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
 >
 {removingMember ? '⏳ Removing…' : '🗑 Remove Member'}
 </button>
 </div>
 </div>
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
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
 <div style={{ fontWeight: 800, fontSize: 15 }}>📜 Tenant Audit Log</div>
 <button className="btn btn-ghost btn-sm" onClick={() => {
 setAuditLoaded(false);
 setAuditLogs([]);
 // Re-trigger the eager effect by temporarily changing a dep — just refetch directly
 (async () => {
 try {
 const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
 const { firebaseApp } = await import('@mfo-crm/config');
 const _db = getFirestore(firebaseApp);
 const q = query(collection(_db, 'audit_logs'), where('tenantId', '==', sub.tenantId));
 const snap = await getDocs(q);
 const logs = snap.docs
 .map(d => ({ id: d.id, ...d.data() }))
 .sort((a: any, b: any) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? ''));
 setAuditLogs(logs);
 } catch (e) { console.error(e); }
 finally { setAuditLoaded(true); }
 })();
 }}>↻ Refresh</button>
 </div>
 {!auditLoaded ? (
 <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>⏳ Loading audit log…</div>
 ) : auditLogs.length === 0 ? (
 <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)', border: '1px dashed var(--border)', borderRadius: 10 }}>
 No audit events recorded for this tenant yet.
 <div style={{ fontSize: 12, marginTop: 8, color: 'var(--text-tertiary)' }}>Events are logged when members are added, plans changed, and invoices generated.</div>
 </div>
 ) : auditLogs.map((ev: any) => (
 <div key={ev.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
 <div style={{ flexShrink: 0, fontSize: 10, fontFamily: 'monospace', color: 'var(--text-tertiary)', paddingTop: 3, width: 145 }}>
 {new Date(ev.occurredAt).toLocaleString()}
 </div>
 <div style={{ flex: 1 }}>
 <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.resourceName ?? ev.action}</div>
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>by {ev.userName} · {ev.action}</div>
 </div>
 <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6,
 background: ev.status === 'success' ? '#22c55e15' : '#ef444415',
 color: ev.status === 'success' ? '#22c55e' : '#ef4444' }}>
 {ev.status}
 </span>
 </div>
 ))}
 </div>
 )}

 {/* ── DELETE TENANT ── */}
 {tab === 'delete' && (() => {
 // State hoisted to parent — only scoped fns live here
 const step = delStep;
 const exported = delExported;
 const ackChecked = delAckChecked;
 const confirmName = delConfirmName;
 const nameOk = delNameOk;

 function handleExport() {
 const payload = {
 exportedAt: new Date().toISOString(),
 exportedBy: performer.name,
 tenant: {
 tenantId: sub.tenantId,
 tenantName: sub.tenantName,
 contactName: sub.contactName,
 contactEmail:sub.contactEmail,
 plan: sub.planId,
 status: sub.status,
 billingCycle:sub.billingCycle,
 licensedSeats:sub.licensedSeats,
 currentAumUsd:sub.currentAumUsd,
 currency: sub.currency,
 subscriptionStart: sub.subscriptionStart,
 currentPeriodStart:sub.currentPeriodStart,
 currentPeriodEnd: sub.currentPeriodEnd,
 notes: sub.notes,
 },
 };
 const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `tenant-export-${sub.tenantId}-${new Date().toISOString().slice(0,10)}.json`;
 a.click();
 URL.revokeObjectURL(url);
 setDelExported(true);
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
 setDeleting(false); // don't set to false on success (already closed)
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
 onClick={() => setDelStep(2)}
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
 onChange={e => setDelAckChecked(e.target.checked)}
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
 <button className="btn btn-ghost btn-sm" onClick={() => setDelStep(1)}>← Back</button>
 <button
 className="btn btn-sm"
 style={{ borderColor: '#ef4444', color: ackChecked ? '#fff' : '#ef444488', background: ackChecked ? '#ef4444' : 'none', border: `1px solid ${ackChecked ? '#ef4444' : '#ef444433'}`, cursor: ackChecked ? 'pointer' : 'not-allowed' }}
 disabled={!ackChecked}
 onClick={() => setDelStep(3)}
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
 onChange={e => setDelConfirmName(e.target.value)}
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
 <button className="btn btn-ghost btn-sm" onClick={() => setDelStep(2)} disabled={deleting}>← Back</button>
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
 const [verticalId, setVerticalId] = useState<IndustryVerticalId>('multi_family_office');
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
 const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
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
 const now = new Date();
 const trialEnd = new Date(now.getTime() + plan.trialDays * 864e5);
 const periodEnd = new Date(now);
 periodEnd.setMonth(periodEnd.getMonth() + (form.billingCycle === 'annual' ? 12 : 1));

 const isValid = form.tenantId.trim() !== '' && form.tenantName.trim() !== '';

 async function handleCreate(e: React.FormEvent) {
 e.preventDefault();
 if (!isValid) return;
 setLoading(true);
 const sub: TenantSubscription = {
 tenantId: form.tenantId,
 tenantName: form.tenantName,
 contactName: form.contactName,
 contactEmail: form.contactEmail,
 // @ts-ignore — extend with CRM fields
 crmOrgId: form.crmOrgId || null,
 crmOrgName: form.crmOrgName || null,
 crmContactId: form.crmContactId || null,
 planId: form.planId,
 billingCycle: form.billingCycle as BillingCycle,
 status: form.planId === 'trial' ? 'trial' : 'active',
 subscriptionStart: now.toISOString(),
 trialEndsAt: form.planId === 'trial' ? trialEnd.toISOString() : undefined,
 currentPeriodStart: now.toISOString(),
 currentPeriodEnd: periodEnd.toISOString(),
 nextInvoiceDate: periodEnd.toISOString(),
 licensedSeats: form.licensedSeats,
 activeUsers: 0,
 currentAumUsd: form.currentAumUsd,
 currency: form.currency as 'USD',
 isDemoTenant: form.isDemoTenant,
 autoRenew: true,
 notes: form.notes,
 createdAt: now.toISOString(),
 createdBy: performer.uid,
 };
 try {
 await upsertSubscription(sub);
 // Write a tenants/{id} record so getTenant() resolves this tenant in the switcher
 const vertical = VERTICAL_REGISTRY.find(v => v.id === verticalId);
 await createTenant({
 id: form.tenantId,
 name: form.tenantName,
 plan: (['trial', 'standard', 'enterprise'].includes(form.planId)
 ? form.planId
 : 'standard') as 'trial' | 'standard' | 'enterprise',
 status: form.planId === 'trial' ? 'trial' : 'active',
 isInternal: false,
 brandColor: vertical?.color ?? '#6366f1',
 createdBy: performer.uid,
 industryVertical: verticalId,
 modulesEnabled: vertical?.defaultModules ?? [],
 currencyCode: form.currency,
 });
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

 {/* ─── Industry Vertical ─── */}
 <div>
 <Label>Industry Vertical *</Label>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
 {VERTICAL_REGISTRY.filter(v => v.status === 'ga').map(v => (
 <button
 key={v.id}
 type="button"
 onClick={() => setVerticalId(v.id)}
 style={{
 padding: '10px 12px', borderRadius: 10, border: `2px solid ${verticalId === v.id ? v.color : 'var(--border)'}`,
 background: verticalId === v.id ? `${v.color}14` : 'var(--bg-canvas)',
 cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
 }}
 >
 <div style={{ fontSize: 18, marginBottom: 4 }}>{v.icon}</div>
 <div style={{ fontSize: 12, fontWeight: 700, color: verticalId === v.id ? v.color : 'var(--text-primary)' }}>{v.label}</div>
 <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.3 }}>{v.tagline.slice(0, 44)}…</div>
 </button>
 ))}
 </div>
 {VERTICAL_REGISTRY.filter(v => v.status !== 'ga').length > 0 && (
 <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
 Beta / Coming Soon: {VERTICAL_REGISTRY.filter(v => v.status !== 'ga').map(v => `${v.icon} ${v.label}`).join(', ')}
 </div>
 )}
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
 <button 
 type="submit" 
 className={`btn ${isValid ? 'btn-primary' : 'btn-secondary'}`} 
 disabled={loading} 
 style={{ 
 flex: 2, 
 opacity: loading ? 0.7 : 1,
 transition: 'all 0.2s',
 border: isValid ? undefined : '1px solid var(--border)'
 }}
 >
 {loading ? '…' : '✅ Create Subscription'}
 </button>
 </div>
 </form>
 </Modal>
 );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type MainTab = 'tenants' | 'invoices' | 'plans' | 'events' | 'members';

export default function TenantManagementPage() {
 const { user, isSaasMasterAdmin } = useAuth();
 usePageTitle('Tenant Management');
 const performer = { uid: user?.uid ?? 'unknown', name: user?.name ?? 'Admin' };
 const searchParams = useSearchParams();

 const [mainTab, setMainTab] = useState<MainTab>('tenants');
 const [subs, setSubs] = useState<TenantSubscription[]>([]);
 const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
 const [allEvents, setAllEvents] = useState<SubscriptionEvent[]>([]);
 const [allPlatformUsers, setAllPlatformUsers] = useState<UserProfile[]>([]);
  const [globalMemberships, setGlobalMemberships] = useState<import('@/lib/tenantMemberService').TenantMember[]>([]);
 const [search, setSearch] = useState('');
 const [statusF, setStatusF] = useState<SubscriptionStatus | 'all'>('all');
 const [planF, setPlanF] = useState<PlanId | 'all'>('all');
 const [sortKey, setSortKey] = useState<'name' | 'plan' | 'status' | 'mrr' | 'seats' | 'period'>('name');
 const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
 const [selPlan, setSelPlan] = useState<PlanId | null>(null);
 const [loading, setLoading] = useState(true);
 const [selected, setSelected] = useState<TenantSubscription | null>(null);
 const [showNew, setShowNew] = useState(false);

 function toggleSort(key: typeof sortKey) {
 if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
 else { setSortKey(key); setSortDir('asc'); }
 }
 function SortIcon({ k }: { k: typeof sortKey }) {
 if (sortKey !== k) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
 return <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
 }

 const handleRemoveGlobalMember = async (targetUid: string, targetName: string, tenantId: string, tenantName: string) => {
   if (!confirm(`Are you sure you want to remove ${targetName} from ${tenantName}? If this is their last tenant, they will be deleted entirely from the system.`)) return;
   setLoading(true);
   try {
     await removeMemberFromTenant(tenantId, tenantName, targetUid, targetName, performer);
     const [u, m] = await Promise.all([
       getAllUsers(),
       import('@/lib/tenantMemberService').then(mod => mod.getAllGlobalMemberships())
     ]);
     setAllPlatformUsers(u);
     setGlobalMemberships(m);
   } catch (err: any) {
     alert('Failed to remove member: ' + err.message);
   } finally {
     setLoading(false);
   }
 };

 const load = useCallback(async () => {
 setLoading(true);
 try {
 let [s, inv] = await Promise.all([getAllSubscriptions(), getAllInvoices()]);

 // Inject the master/internal tenant for SaaS Master Admins
 // It lives in tenants/master but has no subscription record.
 if (isSaasMasterAdmin && !s.find(x => x.tenantId === 'master')) {
 const { getTenant } = await import('@/lib/platformService');
 const masterTenant = await getTenant('master');
 if (masterTenant) {
 const masterSub: TenantSubscription = {
 tenantId: 'master',
 tenantName: masterTenant.name + ' [Platform HQ]',
 contactName: 'SaaS Master Admin',
 contactEmail: user?.email ?? '',
 planId: 'enterprise',
 billingCycle: 'annual',
 status: 'active',
 licensedSeats: 999,
 activeUsers: 0,
 currentAumUsd: 0,
 currency: 'USD',
 subscriptionStart: masterTenant.createdAt,
 currentPeriodStart: masterTenant.createdAt,
 currentPeriodEnd: '2099-12-31',
 nextInvoiceDate: 'N/A',
 trialEndsAt: undefined,
 customBasePrice: undefined,
 isDemoTenant: false,
 autoRenew: false,
 notes: 'Internal platform tenant — not billed',
 createdAt: masterTenant.createdAt,
 createdBy: masterTenant.createdBy,
 updatedAt: masterTenant.createdAt,
 };
 s = [masterSub, ...s];
 }
 }

 setSubs(s);
 setAllInvoices(inv);
 } catch {}
 finally { setLoading(false); }
 }, [isSaasMasterAdmin, user?.email]);

 useEffect(() => { load(); }, [load]);
 useEffect(() => {
 if (mainTab === 'invoices') getAllInvoices().then(setAllInvoices);
 if (mainTab === 'members') { getAllUsers().then(setAllPlatformUsers); import('@/lib/tenantMemberService').then(m => m.getAllGlobalMemberships().then(setGlobalMemberships)); }
 }, [mainTab]);

 // Auto-open tenant modal when navigated from /platform/users with ?open=tenantId
 useEffect(() => {
 const openId = searchParams?.get('open');
 if (openId && subs.length > 0) {
 const match = subs.find(s => s.tenantId === openId);
 if (match) setSelected(match);
 }
 }, [searchParams, subs]);

 const MAIN_TABS = [
    { id: 'tenants', label: 'Tenants', icon: '🏢' },
    { id: 'invoices', label: 'All Invoices', icon: '🧾' },
    { id: 'plans', label: 'Subscription Plans', icon: '📋' },
    { id: 'members', label: 'All Members', icon: '👥' },
    { id: 'events', label: 'Global Audit', icon: '📜' },
  ];

 const filtered = useMemo(() => {
 let list = subs.filter(s => {
 const q = search.toLowerCase();
 if (q && !`${s.tenantName} ${s.contactEmail} ${s.contactName} ${s.tenantId}`.toLowerCase().includes(q)) return false;
 if (statusF !== 'all' && s.status !== statusF) return false;
 if (planF !== 'all' && s.planId !== planF) return false;
 return true;
 });
 list = [...list].sort((a, b) => {
 let cmp = 0;
 switch (sortKey) {
 case 'name': cmp = a.tenantName.localeCompare(b.tenantName); break;
 case 'plan': cmp = a.planId.localeCompare(b.planId); break;
 case 'status': cmp = a.status.localeCompare(b.status); break;
 case 'mrr': cmp = planMonthlyTotal(a) - planMonthlyTotal(b); break;
 case 'seats': cmp = a.licensedSeats - b.licensedSeats; break;
 case 'period': cmp = (a.currentPeriodEnd ?? '').localeCompare(b.currentPeriodEnd ?? ''); break;
 }
 return sortDir === 'asc' ? cmp : -cmp;
 });
 return list;
 }, [subs, search, statusF, planF, sortKey, sortDir]);

 const stats = useMemo(() => ({
 total: subs.length,
 trial: subs.filter(s => s.status === 'trial').length,
 active: subs.filter(s => s.status === 'active').length,
 pastDue: subs.filter(s => s.status === 'past_due').length,
 mrr: subs.filter(s => s.status === 'active').reduce((sum, s) => sum + planMonthlyTotal(s), 0),
 }), [subs]);

 if (selected) {
 return (
 <div className="flex flex-col absolute inset-0 overflow-y-auto bg-canvas z-0">
 <div className="page animate-fade-in" style={{ width: '100%', padding: '0 24px', paddingBottom: 60 }}>
 <TenantDetailModal
 sub={selected} performer={performer}
 onClose={() => setSelected(null)}
 onRefresh={() => { load(); setSelected(null); }}
 onDeleted={id => { setSubs(prev => prev.filter(s => s.tenantId !== id)); setSelected(null); }}
 />
 </div>
 </div>
 );
 }

 return (
    <div className="flex flex-col absolute inset-0 overflow-hidden bg-canvas z-0">
      <SecondaryDock tabs={MAIN_TABS as any} activeTab={mainTab} onTabChange={setMainTab as any} />
      
      <main className="flex-1 flex flex-col min-h-0 relative animate-fade-in px-4 lg:px-8 pt-6 pb-12 overflow-y-auto w-full">
        {showNew && (
 <NewSubscriptionModal
 performer={performer}
 onClose={() => setShowNew(false)}
 onCreated={sub => { setSubs(prev => [sub, ...prev.filter(s => s.tenantId !== sub.tenantId)]); setShowNew(false); }}
 />
 )}

 {/* Page Header */}
 

 {/* KPI Row */}
 <div className="stat-grid" style={{ marginBottom: 24 }}>
 {[
 { label: 'Total Tenants', value: stats.total, color: 'var(--brand-500)' },
 { label: 'Trial', value: stats.trial, color: '#f59e0b' },
 { label: 'Active', value: stats.active, color: '#22c55e' },
 { label: 'Past Due', value: stats.pastDue, color: '#ef4444' },
 { label: 'Monthly ARR', value: formatUsd(stats.mrr), color: '#a78bfa' },
 ].map(k => (
 <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{k.label}</div>
 <div style={{ fontSize: 26, fontWeight: 900, color: k.color }}>{k.value}</div>
 </div>
 ))}
 </div>
 {/* ── TENANTS TAB ── */}
 {mainTab === 'tenants' && (
 <>
 <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
 <div className="header-search cursor-text max-w-md w-full" style={{ flex: '1 1 220px' }}>
   <Search size={16} className="text-tertiary shrink-0" />
   <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, ID…" className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] text-primary placeholder-tertiary" />
 </div>
 <select className="input" style={{ flex: '0 0 140px' }} value={statusF} onChange={e => setStatusF(e.target.value as any)}>
 <option value="all">All Statuses</option>
 {(['trial','active','past_due','suspended','cancelled'] as SubscriptionStatus[]).map(s => (
 <option key={s} value={s}>{s.replace('_', ' ')}</option>
 ))}
 </select>
 <select className="input" style={{ flex: '0 0 140px' }} value={planF} onChange={e => setPlanF(e.target.value as any)}>
 <option value="all">All Plans</option>
 {Object.values(SUBSCRIPTION_PLANS).map(p => (
 <option key={p.id} value={p.id}>{p.name}</option>
 ))}
 </select>
 <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{filtered.length} tenant{filtered.length !== 1 ? 's' : ''}</span>
 <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
   <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
     + Add Tenant
   </button>
 </div>
 </div>
 {loading ? (
 <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>Loading…</div>
 ) : filtered.length === 0 ? (
 <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ textAlign: 'center', padding: '60px 40px' }}>
 <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}><Building2 size={48} className="text-tertiary" /></div>
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
 <td><span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}><PlanIcon name={p.icon} size={14} /> {p.name}</span></td>
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

 {/* ── PLANS TAB — Master-Detail ── */}
 {mainTab === 'plans' && (() => {
 const displayedPlan = selPlan ?? (Object.keys(SUBSCRIPTION_PLANS)[0] as PlanId);
 const p = SUBSCRIPTION_PLANS[displayedPlan];
 const planTenants = subs.filter(s => s.planId === displayedPlan && s.tenantId !== 'master');
 const planMrr = planTenants.filter(s => s.status === 'active').reduce((sum, s) => sum + planMonthlyTotal(s), 0);
 return (
 <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
 {/* ── Left: Plan list ── */}
 <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 0, overflow: 'hidden' }}>
 <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)' }}>Subscription Plans</div>
 {Object.values(SUBSCRIPTION_PLANS).map(pl => {
 const tenantCount = subs.filter(s => s.planId === pl.id && s.tenantId !== 'master').length;
 const active = (selPlan ?? Object.keys(SUBSCRIPTION_PLANS)[0]) === pl.id;
 return (
 <button key={pl.id} onClick={() => setSelPlan(pl.id)} style={{
 width: '100%', display: 'flex', alignItems: 'center', gap: 10,
 padding: '12px 16px', border: 'none', borderBottom: '1px solid var(--border)',
 background: active ? `${pl.color}12` : 'transparent',
 borderLeft: active ? `3px solid ${pl.color}` : '3px solid transparent',
 cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
 }}>
 <span style={{ fontSize: 20 }}>{pl.icon}</span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <div style={{ fontWeight: 700, fontSize: 13, color: active ? pl.color : 'var(--text-primary)' }}>{pl.name}</div>
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{tenantCount} tenant{tenantCount !== 1 ? 's' : ''}</div>
 </div>
 {pl.baseMonthly > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{formatUsd(pl.baseMonthly)}</div>}
 </button>
 );
 })}
 </div>

 {/* ── Right: Plan detail ── */}
 <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
 {/* Header card */}
 <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: '24px 28px', background: `linear-gradient(135deg, ${p.color}10, transparent)`, border: `1px solid ${p.color}30` }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
 <div>
 <div style={{ fontSize: 36 }}>{p.icon}</div>
 <div style={{ fontWeight: 900, fontSize: 24, marginTop: 8 }}>{p.name}</div>
 <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{p.description}</div>
 </div>
 <div style={{ textAlign: 'right' }}>
 <div style={{ fontSize: 36, fontWeight: 900, color: p.color }}>
 {p.baseMonthly > 0 ? formatUsd(p.baseMonthly) : p.id === 'enterprise' ? 'Custom' : 'Free'}
 </div>
 {p.baseMonthly > 0 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>/month base</div>}
 </div>
 </div>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 20 }}>
 {[
 { label: 'Active Tenants', value: planTenants.filter(s => s.status === 'active').length },
 { label: 'Trial Tenants', value: planTenants.filter(s => s.status === 'trial').length },
 { label: 'Total Tenants', value: planTenants.length },
 { label: 'Plan MRR', value: formatUsd(planMrr) },
 ].map(kpi => (
 <div key={kpi.label} style={{ background: 'var(--bg-canvas)', borderRadius: 8, padding: '10px 14px' }}>
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>{kpi.label}</div>
 <div style={{ fontSize: 20, fontWeight: 900, color: p.color, marginTop: 4 }}>{kpi.value}</div>
 </div>
 ))}
 </div>
 </div>

 {/* Pricing & Limits */}
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
 <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: '18px 20px' }}>
 <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>💰 Pricing</div>
 {[
 ['Base (monthly)', p.baseMonthly > 0 ? formatUsd(p.baseMonthly) + '/mo' : p.id === 'enterprise' ? 'Custom' : 'Free'],
 ['Base (annual)', p.baseAnnual > 0 ? formatUsd(p.baseAnnual) + '/yr' : '—'],
 ['Per Seat/mo', p.pricePerSeat > 0 ? formatUsd(p.pricePerSeat) : '—'],
 ['Per Seat/yr', p.pricePerSeatAnnual > 0 ? formatUsd(p.pricePerSeatAnnual) : '—'],
 ['AUM Fee', p.aumFeeBps > 0 ? `${p.aumFeeBps} bps/yr` : 'None'],
 ].map(([lbl, val]) => (
 <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
 <span style={{ color: 'var(--text-secondary)' }}>{lbl}</span>
 <span style={{ fontWeight: 600 }}>{val}</span>
 </div>
 ))}
 </div>
 <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: '18px 20px' }}>
 <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>📊 Limits</div>
 {[
 ['Max Seats', p.maxSeats === -1 ? 'Unlimited' : String(p.maxSeats)],
 ['Max AUM', p.maxAumUsd === -1 ? 'Unlimited' : formatAum(p.maxAumUsd)],
 ['Trial', p.trialDays > 0 ? `${p.trialDays} days` : 'None'],
 ].map(([lbl, val]) => (
 <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
 <span style={{ color: 'var(--text-secondary)' }}>{lbl}</span>
 <span style={{ fontWeight: 600 }}>{val}</span>
 </div>
 ))}
 </div>
 </div>

 {/* Features */}
 <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: '18px 20px' }}>
 <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>✅ Included Features</div>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6 }}>
 {p.features.map(feat => (
 <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
 <span style={{ color: p.color, fontWeight: 700 }}>✓</span> {feat}
 </div>
 ))}
 </div>
 {p.addOns.length > 0 && (
 <>
 <div style={{ fontWeight: 700, fontSize: 13, marginTop: 16, marginBottom: 10 }}>🔌 Available Add-ons</div>
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
 {p.addOns.map(ao => (
 <span key={ao} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 12, background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}30`, fontWeight: 600 }}>{ao}</span>
 ))}
 </div>
 </>
 )}
 </div>

 {/* Tenants on this plan */}
 {planTenants.length > 0 && (
 <div className="card table-wrap">
 <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--border)' }}>🏢 Tenants on this plan ({planTenants.length})</div>
 <table>
 <thead><tr><th>Tenant</th><th>Status</th><th>Seats</th><th>Est. MRR</th><th>Period End</th></tr></thead>
 <tbody>
 {planTenants.map(t => (
 <tr key={t.tenantId} style={{ cursor: 'pointer' }} onClick={() => { setSelected(t); setMainTab('tenants'); }}>
 <td><div style={{ fontWeight: 700 }}>{t.tenantName}</div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.contactEmail}</div></td>
 <td><Chip label={t.status} status={t.status} /></td>
 <td>{t.licensedSeats}</td>
 <td style={{ fontWeight: 700, color: 'var(--brand-500)' }}>{formatUsd(planMonthlyTotal(t))}</td>
 <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.currentPeriodEnd?.slice(0,10) ?? '—'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </div>
 );
 })()}

 {/* ── GLOBAL EVENTS ── */}
 {mainTab === 'events' && (
 <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6">
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

 {/* ── ALL MEMBERS ── */}
 {mainTab === 'members' && (
   <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-0 overflow-hidden">
     <div style={{ padding: '16px 20px', fontWeight: 800, fontSize: 15, borderBottom: '1px solid var(--border)', background: 'var(--bg-canvas)' }}>
       👥 All Platform Users ({allPlatformUsers.length})
     </div>
     <div className="overflow-x-auto w-full">
       <table className="w-full text-left border-collapse min-w-[800px]">
         <thead>
           <tr style={{ borderBottom: '1px solid var(--border)', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)', background: 'var(--bg-surface)' }}>
             <th style={{ padding: '14px 20px', fontWeight: 800 }}>User</th>
             <th style={{ padding: '14px 20px', fontWeight: 800 }}>Status</th>
             <th style={{ padding: '14px 20px', fontWeight: 800 }}>Role</th>
             <th style={{ padding: '14px 20px', fontWeight: 800 }}>Created</th>
             <th style={{ padding: '14px 20px', fontWeight: 800 }}>Last Login</th>
             <th style={{ padding: '14px 20px', fontWeight: 800 }}>Tenants</th>
           </tr>
         </thead>
         <tbody className="divide-y divide-[var(--border)]">
           {allPlatformUsers.length === 0 ? (
             <tr>
               <td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)' }}>No users found.</td>
             </tr>
           ) : allPlatformUsers.map(user => (
             <tr key={user.uid} className="hover:bg-[var(--bg-canvas)] transition-colors">
               <td style={{ padding: '12px 20px' }}>
                 <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{user.displayName || user.email}</div>
                 <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{user.email}</div>
               </td>
               <td style={{ padding: '12px 20px' }}>
                 <Chip label={user.status} status={user.status} />
               </td>
               <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-secondary)' }}>
                 {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
               </td>
               <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>
                 {new Date(user.createdAt).toLocaleDateString()}
               </td>
               <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-secondary)' }}>
                 {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never logged in'}
               </td>
                               <td style={{ padding: '12px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(() => {
                      const userMemberships = globalMemberships.filter(m => m.uid === user.uid);
                      const isMasterAdmin = user.role === 'saas_master_admin';
                      const hasExplicitMaster = userMemberships.some(m => m.tenantId === 'master');
                      
                      if (userMemberships.length === 0 && !isMasterAdmin) return <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No tenants</span>;
                      
                      return (
                        <>
                          {(isMasterAdmin && !hasExplicitMaster) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#6366f115', padding: '4px 10px', borderRadius: 8, width: 'fit-content', border: '1px solid #6366f130' }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: '#6366f1' }}>Platform HQ (Master Tenant)</span>
                              <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 700 }}>SaaS Master Admin</span>
                            </div>
                          )}
                          {userMemberships.filter(m => !isMasterAdmin || m.tenantId !== 'master').map((m, idx) => {
                            const t = subs.find(s => s.tenantId === m.tenantId);
                            const isMasterTenant = m.tenantId === 'master';
                            return (
                              <div key={`${m.tenantId || 'unknown'}-${idx}`} style={{ 
                                display: 'flex', alignItems: 'center', gap: 8, 
                                background: isMasterTenant ? '#6366f115' : 'var(--bg-overlay)', 
                                padding: '4px 10px', borderRadius: 8, width: 'fit-content',
                                border: isMasterTenant ? '1px solid #6366f130' : 'none'
                              }}>
                                <span style={{ fontSize: 12, fontWeight: 800, color: isMasterTenant ? '#6366f1' : 'inherit' }}>
                                  {isMasterTenant ? 'Platform HQ (Master Tenant)' : (t?.tenantName ?? m.tenantId)}
                                </span>
                                <span style={{ fontSize: 11, color: isMasterTenant ? '#818cf8' : 'var(--text-secondary)', fontWeight: isMasterTenant ? 700 : 400 }}>
                                  {ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] || m.role}
                                </span>
                                {!isMasterTenant && (
                                  <button
                                    onClick={() => handleRemoveGlobalMember(user.uid, user.displayName || user.email, m.tenantId, t?.tenantName ?? m.tenantId)}
                                    style={{ padding: 4, marginLeft: 4, borderRadius: 4, color: 'var(--text-tertiary)', background: 'transparent' }}
                                    className="hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center transition-colors"
                                    title={`Remove from ${t?.tenantName ?? m.tenantId}`}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                </td>
             </tr>
           ))}
         </tbody>
       </table>
     </div>
   </div>
 )}
 </main>
 </div>
 );
}
