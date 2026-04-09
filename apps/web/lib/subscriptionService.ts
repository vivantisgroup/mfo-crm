/**
 * subscriptionService.ts
 *
 * Defines subscription plans, billing calculations, and invoice generation
 * for the MFO Nexus SaaS platform.
 *
 * Firestore schema:
 *   tenants/{id}                — extended with subscription fields
 *   invoices/{id}              — invoice records
 *   subscription_events/{id}   — audit trail for every subscription change
 */

import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';

const db = getFirestore(firebaseApp);

// ─── Plan Definitions ──────────────────────────────────────────────────────────

export type PlanId = 'trial' | 'starter' | 'standard' | 'professional' | 'enterprise';
export type BillingCycle = 'monthly' | 'annual';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'void';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled';
export type EventType =
  | 'SUBSCRIPTION_CREATED'
  | 'PLAN_CHANGED'
  | 'TRIAL_EXTENDED'
  | 'TRIAL_EXPIRED'
  | 'SUBSCRIPTION_SUSPENDED'
  | 'SUBSCRIPTION_REACTIVATED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'INVOICE_GENERATED'
  | 'INVOICE_PAID'
  | 'INVOICE_OVERDUE'
  | 'SEATS_UPDATED'
  | 'AUM_UPDATED'
  | 'DEMO_PROVISIONED'
  | 'DEMO_EXTENDED'
  | 'DEMO_SUSPENDED'
  | 'DEMO_DELETED';

export interface SubscriptionPlan {
  id:              PlanId;
  name:            string;
  description:     string;
  icon:            string;
  color:           string;
  // Pricing
  baseMonthly:     number;   // USD/month base platform fee
  baseAnnual:      number;   // USD/year (annual discount)
  pricePerSeat:    number;   // USD/seat/month
  pricePerSeatAnnual: number;
  aumFeeBps:       number;   // basis points on AUM per year (billed monthly)
  // Limits
  maxSeats:        number;   // -1 = unlimited
  maxAumUsd:       number;   // -1 = unlimited
  trialDays:       number;   // 0 = no trial
  // Features
  features:        string[];
  addOns:          string[];
  isPublic:        boolean;  // shown on pricing page
}

export const SUBSCRIPTION_PLANS: Record<PlanId, SubscriptionPlan> = {
  trial: {
    id: 'trial', name: 'Trial', description: '14-day full-feature evaluation', icon: 'FlaskConical',
    color: '#f59e0b',
    baseMonthly: 0, baseAnnual: 0, pricePerSeat: 0, pricePerSeatAnnual: 0, aumFeeBps: 0,
    maxSeats: 5, maxAumUsd: 50_000_000, trialDays: 14,
    features: ['All features included', 'Up to 5 users', 'Up to $50M AUM', 'Email support'],
    addOns: [],
    isPublic: false,
  },
  starter: {
    id: 'starter', name: 'Starter', description: 'For boutique family offices under $100M',
    icon: 'Sprout', color: '#22d3ee',
    baseMonthly: 299, baseAnnual: 2_990,
    pricePerSeat: 49, pricePerSeatAnnual: 490,
    aumFeeBps: 2,  // 2 bps/yr on AUM
    maxSeats: 10, maxAumUsd: 100_000_000, trialDays: 14,
    features: [
      'Up to 10 licensed users',
      'Up to $100M AUM',
      'Family CRM & KYC',
      'Portfolio consolidation',
      'Task management',
      'Document vault (10GB)',
      'Email support',
    ],
    addOns: ['API Access', 'Custom branding'],
    isPublic: true,
  },
  standard: {
    id: 'standard', name: 'Standard', description: 'For growing MFOs up to $500M AUM',
    icon: 'Star', color: '#818cf8',
    baseMonthly: 799, baseAnnual: 7_990,
    pricePerSeat: 79, pricePerSeatAnnual: 790,
    aumFeeBps: 3,
    maxSeats: 25, maxAumUsd: 500_000_000, trialDays: 30,
    features: [
      'Up to 25 licensed users',
      'Up to $500M AUM',
      'Everything in Starter',
      'Private investments tracking',
      'Suitability assessments',
      'Advanced reporting',
      'Calendar integrations',
      'Document vault (100GB)',
      'Priority email & chat support',
    ],
    addOns: ['API Access', 'Custom branding', 'Dedicated onboarding'],
    isPublic: true,
  },
  professional: {
    id: 'professional', name: 'Professional', description: 'For established MFOs up to $2B AUM',
    icon: 'Gem', color: '#a78bfa',
    baseMonthly: 1_999, baseAnnual: 19_990,
    pricePerSeat: 99, pricePerSeatAnnual: 990,
    aumFeeBps: 2,   // discounted at this tier
    maxSeats: 50, maxAumUsd: 2_000_000_000, trialDays: 30,
    features: [
      'Up to 50 licensed users',
      'Up to $2B AUM',
      'Everything in Standard',
      'Investment advisory modules',
      'Estate & succession planning',
      'Governance workflows',
      'Concierge & lifestyle services',
      'AI-powered task extraction',
      'White-label available',
      'Document vault (1TB)',
      'Dedicated success manager',
      'SLA-backed support',
    ],
    addOns: ['API Access', 'Custom branding', 'Data export', 'Custom integrations'],
    isPublic: true,
  },
  enterprise: {
    id: 'enterprise', name: 'Enterprise', description: 'Unlimited scale, custom pricing',
    icon: 'Building2', color: '#6366f1',
    baseMonthly: 0, baseAnnual: 0,   // custom
    pricePerSeat: 0, pricePerSeatAnnual: 0,
    aumFeeBps: 1,
    maxSeats: -1, maxAumUsd: -1, trialDays: 30,
    features: [
      'Unlimited users',
      'Unlimited AUM',
      'Everything in Professional',
      'Multi-tenant management',
      'Custom integrations & API',
      'On-premise or private cloud',
      'Custom data retention policies',
      'Dedicated infrastructure',
      'White-glove onboarding',
      '24/7 dedicated support',
      'Custom SLAs',
    ],
    addOns: [],
    isPublic: true,
  },
};

// ─── Subscription & Tenant extended types ────────────────────────────────────

export interface TenantSubscription {
  tenantId:           string;
  tenantName:         string;
  contactName:        string;
  contactEmail:       string;
  defaultLanguage?:   string;   // BCP-47, e.g. 'en' | 'pt' | 'es' — used for email templates
  // Subscription
  planId:             PlanId;
  billingCycle:       BillingCycle;
  status:             SubscriptionStatus;
  subscriptionStart:  string;  // ISO
  trialEndsAt?:       string;  // ISO — only if status=trial
  currentPeriodStart: string;
  currentPeriodEnd:   string;
  nextInvoiceDate:    string;
  // Usage
  licensedSeats:      number;
  activeUsers:        number;
  currentAumUsd:      number;
  // Billing
  currency:           'USD' | 'BRL' | 'EUR';
  customBasePrice?:   number;  // for enterprise
  notes?:             string;
  // Flags
  isDemoTenant:       boolean;
  autoRenew:          boolean;
  // Audit
  createdAt:          string;
  createdBy:          string;
  updatedAt?:         string;
  updatedBy?:         string;
}

export interface InvoiceLineItem {
  description:  string;
  quantity:     number;
  unit:         string;
  unitPrice:    number;
  amount:       number;
  category:     'platform' | 'seats' | 'aum' | 'addon' | 'adjustment';
}

export interface Invoice {
  id:             string;
  invoiceNumber:  string;
  tenantId:       string;
  tenantName:     string;
  planId:         PlanId;
  billingCycle:   BillingCycle;
  // Period
  periodStart:    string;
  periodEnd:      string;
  issuedAt:       string;
  dueAt:          string;
  // Line items
  lineItems:      InvoiceLineItem[];
  subtotal:       number;
  taxRate:        number;
  taxAmount:      number;
  totalAmount:    number;
  currency:       string;
  // Status
  status:         InvoiceStatus;
  paidAt?:        string;
  paymentMethod?: string;
  notes?:         string;
  // Audit
  createdAt:      string;
  createdBy:      string;
}

export interface SubscriptionEvent {
  id:          string;
  tenantId:    string;
  tenantName:  string;
  type:        EventType;
  description: string;
  before?:     Record<string, any>;
  after?:      Record<string, any>;
  userId:      string;
  userName:    string;
  occurredAt:  string;
}

// ─── Billing calculation helpers ──────────────────────────────────────────────

export function calculateMonthlyInvoice(
  sub: TenantSubscription,
  performedBy: { uid: string; name: string },
): Omit<Invoice, 'id' | 'invoiceNumber'> {
  const plan    = SUBSCRIPTION_PLANS[sub.planId];
  const monthly = sub.billingCycle === 'monthly';
  const now     = new Date().toISOString();
  const due     = new Date(Date.now() + 15 * 864e5).toISOString(); // net-15

  const items: InvoiceLineItem[] = [];

  // Platform base fee
  const base = sub.customBasePrice ?? (monthly ? plan.baseMonthly : plan.baseAnnual / 12);
  if (base > 0) {
    items.push({
      description: `${plan.name} Platform Access — ${monthly ? 'Monthly' : 'Annual'} subscription`,
      quantity: 1, unit: 'month', unitPrice: base, amount: base,
      category: 'platform',
    });
  }

  // Seat fee
  const seatPrice = monthly ? plan.pricePerSeat : plan.pricePerSeatAnnual / 12;
  if (seatPrice > 0 && sub.licensedSeats > 0) {
    items.push({
      description: `Licensed Seats (${sub.licensedSeats} users × $${seatPrice.toFixed(2)}/seat/month)`,
      quantity: sub.licensedSeats, unit: 'seat', unitPrice: seatPrice,
      amount: sub.licensedSeats * seatPrice,
      category: 'seats',
    });
  }

  // AUM fee (bps per year, divided by 12 for monthly)
  if (plan.aumFeeBps > 0 && sub.currentAumUsd > 0) {
    const aumFee = sub.currentAumUsd * (plan.aumFeeBps / 10000) / 12;
    items.push({
      description: `AUM Fee — ${plan.aumFeeBps} bps/yr on ${formatAum(sub.currentAumUsd)} AUM (÷12 monthly)`,
      quantity: 1, unit: 'month', unitPrice: aumFee, amount: aumFee,
      category: 'aum',
    });
  }

  const subtotal   = items.reduce((s, i) => s + i.amount, 0);
  const taxRate    = 0;  // configure per jurisdiction
  const taxAmount  = subtotal * taxRate;
  const totalAmount = subtotal + taxAmount;

  return {
    tenantId:     sub.tenantId,
    tenantName:   sub.tenantName,
    planId:       sub.planId,
    billingCycle: sub.billingCycle,
    periodStart:  sub.currentPeriodStart,
    periodEnd:    sub.currentPeriodEnd,
    issuedAt:     now,
    dueAt:        due,
    lineItems:    items,
    subtotal,
    taxRate,
    taxAmount,
    totalAmount,
    currency:     sub.currency,
    status:       'draft',
    createdAt:    now,
    createdBy:    performedBy.uid,
  };
}

function formatAum(usd: number): string {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(0)}M`;
  return `$${usd.toLocaleString()}`;
}

// ─── Invoice number generator ────────────────────────────────────────────────

function generateInvoiceNumber(tenantId: string): string {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `INV-${y}${m}-${tenantId.slice(-4).toUpperCase()}-${seq}`;
}

// ─── Firestore CRUD ───────────────────────────────────────────────────────────

export async function getSubscription(tenantId: string): Promise<TenantSubscription | null> {
  const snap = await getDoc(doc(db, 'subscriptions', tenantId));
  return snap.exists() ? snap.data() as TenantSubscription : null;
}

export async function getAllSubscriptions(): Promise<TenantSubscription[]> {
  const snap = await getDocs(collection(db, 'subscriptions'));
  return snap.docs.map(d => d.data() as TenantSubscription);
}

/** Strip keys whose value is undefined — Firestore rejects them */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

export async function upsertSubscription(sub: TenantSubscription): Promise<void> {
  const payload = stripUndefined({ ...sub, updatedAt: new Date().toISOString() });
  await setDoc(doc(db, 'subscriptions', sub.tenantId), payload);
}

export async function extendTrial(
  tenantId: string,
  extensionDays: number,
  performer: { uid: string; name: string },
): Promise<void> {
  const sub = await getSubscription(tenantId);
  if (!sub) throw new Error(`Subscription not found for tenant ${tenantId}`);
  const currentExpiry = sub.trialEndsAt ? new Date(sub.trialEndsAt) : new Date();
  if (currentExpiry < new Date()) currentExpiry.setTime(Date.now());
  currentExpiry.setDate(currentExpiry.getDate() + extensionDays);
  const newExpiry = currentExpiry.toISOString();

  await updateDoc(doc(db, 'subscriptions', tenantId), {
    trialEndsAt: newExpiry,
    status:      'trial',
    updatedAt:   new Date().toISOString(),
    updatedBy:   performer.uid,
  });

  await logSubscriptionEvent({
    tenantId, tenantName: sub.tenantName,
    type: 'TRIAL_EXTENDED',
    description: `Trial extended by ${extensionDays} days. New expiry: ${newExpiry.slice(0, 10)}.`,
    before: { trialEndsAt: sub.trialEndsAt },
    after:  { trialEndsAt: newExpiry },
    userId: performer.uid, userName: performer.name,
    occurredAt: new Date().toISOString(),
  });
}

export async function changePlan(
  tenantId: string,
  newPlanId: PlanId,
  newCycle: BillingCycle,
  performer: { uid: string; name: string },
): Promise<void> {
  const sub = await getSubscription(tenantId);
  if (!sub) throw new Error(`Subscription not found for tenant ${tenantId}`);

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + (newCycle === 'annual' ? 12 : 1));

  await updateDoc(doc(db, 'subscriptions', tenantId), {
    planId:             newPlanId,
    billingCycle:       newCycle,
    status:             'active',
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd:   periodEnd.toISOString(),
    nextInvoiceDate:    periodEnd.toISOString(),
    updatedAt:          now.toISOString(),
    updatedBy:          performer.uid,
  });

  await logSubscriptionEvent({
    tenantId, tenantName: sub.tenantName,
    type: 'PLAN_CHANGED',
    description: `Plan changed from ${sub.planId} (${sub.billingCycle}) to ${newPlanId} (${newCycle}).`,
    before: { planId: sub.planId, billingCycle: sub.billingCycle },
    after:  { planId: newPlanId,  billingCycle: newCycle },
    userId: performer.uid, userName: performer.name,
    occurredAt: now.toISOString(),
  });
}

export async function updateSeats(
  tenantId: string,
  licensedSeats: number,
  performer: { uid: string; name: string },
): Promise<void> {
  const sub = await getSubscription(tenantId);
  if (!sub) throw new Error(`Subscription not found for tenant ${tenantId}`);

  await updateDoc(doc(db, 'subscriptions', tenantId), {
    licensedSeats, updatedAt: new Date().toISOString(), updatedBy: performer.uid,
  });

  await logSubscriptionEvent({
    tenantId, tenantName: sub.tenantName,
    type: 'SEATS_UPDATED',
    description: `Licensed seats changed from ${sub.licensedSeats} to ${licensedSeats}.`,
    before: { licensedSeats: sub.licensedSeats },
    after:  { licensedSeats },
    userId: performer.uid, userName: performer.name,
    occurredAt: new Date().toISOString(),
  });
}

export async function generateInvoice(
  sub: TenantSubscription,
  performer: { uid: string; name: string },
): Promise<Invoice> {
  const data = calculateMonthlyInvoice(sub, performer);
  const invoiceNumber = generateInvoiceNumber(sub.tenantId);
  const ref  = await addDoc(collection(db, 'invoices'), { ...data, invoiceNumber });
  const inv  = { ...data, invoiceNumber, id: ref.id } as Invoice;

  await logSubscriptionEvent({
    tenantId: sub.tenantId, tenantName: sub.tenantName,
    type: 'INVOICE_GENERATED',
    description: `Invoice ${invoiceNumber} generated — $${data.totalAmount.toFixed(2)} ${data.currency}`,
    after: { invoiceId: ref.id, invoiceNumber, total: data.totalAmount },
    userId: performer.uid, userName: performer.name,
    occurredAt: new Date().toISOString(),
  });

  return inv;
}

export async function getInvoices(tenantId: string): Promise<Invoice[]> {
  const snap = await getDocs(
    query(collection(db, 'invoices'), where('tenantId', '==', tenantId))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
}

export async function getAllInvoices(): Promise<Invoice[]> {
  const snap = await getDocs(collection(db, 'invoices'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
}

export async function markInvoicePaid(
  invoiceId: string,
  paymentMethod: string,
  performer: { uid: string; name: string },
): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'invoices', invoiceId), {
    status: 'paid', paidAt: now, paymentMethod,
  });
  // log audit
  const snap = await getDoc(doc(db, 'invoices', invoiceId));
  const inv  = snap.data() as Invoice;
  await logSubscriptionEvent({
    tenantId: inv.tenantId, tenantName: inv.tenantName,
    type: 'INVOICE_PAID',
    description: `Invoice ${inv.invoiceNumber} marked as paid via ${paymentMethod}.`,
    after: { invoiceId, paidAt: now },
    userId: performer.uid, userName: performer.name,
    occurredAt: now,
  });
}

export async function getSubscriptionEvents(tenantId: string): Promise<SubscriptionEvent[]> {
  const snap = await getDocs(
    query(collection(db, 'subscription_events'), where('tenantId', '==', tenantId))
  );
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as SubscriptionEvent))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export async function getAllSubscriptionEvents(): Promise<SubscriptionEvent[]> {
  const snap = await getDocs(collection(db, 'subscription_events'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as SubscriptionEvent))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

async function logSubscriptionEvent(event: Omit<SubscriptionEvent, 'id'>): Promise<void> {
  await addDoc(collection(db, 'subscription_events'), event);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function trialDaysLeft(sub: TenantSubscription): number | null {
  if (sub.status !== 'trial' || !sub.trialEndsAt) return null;
  const diff = new Date(sub.trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 864e5));
}

export function planMonthlyTotal(sub: TenantSubscription): number {
  const plan = SUBSCRIPTION_PLANS[sub.planId];
  const monthly = sub.billingCycle === 'monthly';
  const base     = sub.customBasePrice ?? (monthly ? plan.baseMonthly : plan.baseAnnual / 12);
  const seats    = sub.licensedSeats * (monthly ? plan.pricePerSeat : plan.pricePerSeatAnnual / 12);
  const aum      = sub.currentAumUsd * (plan.aumFeeBps / 10000) / 12;
  return base + seats + aum;
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export { formatAum };
