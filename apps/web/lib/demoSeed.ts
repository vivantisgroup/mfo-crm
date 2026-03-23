/**
 * lib/demoSeed.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source-of-truth for ALL demo data seeded into a tenant.
 *
 * CONVENTION: Every new feature that introduces mock data MUST add its
 * collections here so the demo provisioner always stays complete and current.
 *
 * Usage from firebase.ts:  buildSeedManifest() → iterate → writeBatch
 */

import {
  FAMILIES,
  ACTIVITIES,
  TASKS,
  TASK_QUEUES,
  TASK_TYPES,
  TIME_ENTRIES,
  HOLDINGS,
  PRIVATE_INVESTMENTS,
  CAPITAL_CALLS,
  SERVICE_REQUESTS,
  DOCUMENTS,
  GOVERNANCE_MEETINGS,
  GOVERNANCE_STRUCTURES,
  VOTES,
  ESTATE_PLANS,
  AUDIT_LOG,
  PLATFORM_USERS,
  TRANSACTIONS,
  PORTFOLIOS,
  ACCOUNTS,
  BALANCE_SHEETS,
  SERVICE_PROVIDERS,
  NETWORK_NODES,
  RELATIONSHIP_EDGES,
  RESEARCH_NOTES,
  CASH_POSITIONS,
  SUITABILITY_QUESTIONS,
  MOCK_SUITABILITY_HISTORY,
  DEFAULT_SUITABILITY_CONFIG,
} from './mockData';

// ─── Collection manifest ──────────────────────────────────────────────────────
// Each entry maps to a Firestore sub-collection under `tenants/{tenantId}/{name}`
// Add a new entry whenever you add a new mock data export.

export interface SeedCollection {
  /** Firestore collection name */
  name: string;
  /** Records to seed */
  data: Record<string, unknown>[];
  /** Field used as Firestore document ID — defaults to 'id' */
  idField?: string;
  /** UI icon for the provisioner table */
  icon: string;
  /** Human-readable label */
  label: string;
}

export function buildSeedManifest(): SeedCollection[] {
  return [
    // ── Core CRM
    { name: 'families',            label: 'Families & Members',       icon: '👨‍👩‍👧', data: FAMILIES           as any[] },
    { name: 'platform_users',      label: 'Platform Users',           icon: '👥', data: PLATFORM_USERS      as any[] },
    { name: 'activities',          label: 'Activities & CRM Log',     icon: '⚡', data: ACTIVITIES          as any[] },
    { name: 'service_requests',    label: 'Concierge Requests',       icon: '🛎', data: SERVICE_REQUESTS    as any[] },

    // ── Task & Queue Management (v2)
    { name: 'task_queues',         label: 'Task Queues',              icon: '🗂', data: TASK_QUEUES         as any[] },
    { name: 'task_types',          label: 'Task Types',               icon: '🏷', data: TASK_TYPES          as any[] },
    { name: 'tasks',               label: 'Tasks',                    icon: '✅', data: TASKS               as any[] },
    { name: 'time_entries',        label: 'Time Entries',             icon: '⏱', data: TIME_ENTRIES        as any[] },

    // ── Portfolio & Investments
    { name: 'portfolios',          label: 'Portfolios',               icon: '📊', data: PORTFOLIOS          as any[] },
    { name: 'accounts',            label: 'Custodian Accounts',       icon: '🏦', data: ACCOUNTS            as any[] },
    { name: 'holdings',            label: 'Holdings & Securities',    icon: '💰', data: HOLDINGS            as any[] },
    { name: 'transactions',        label: 'Transactions',             icon: '💸', data: TRANSACTIONS        as any[] },
    { name: 'private_investments', label: 'Private Investments',      icon: '🔒', data: PRIVATE_INVESTMENTS as any[] },
    { name: 'capital_calls',       label: 'Capital Calls',            icon: '📞', data: CAPITAL_CALLS       as any[] },
    { name: 'balance_sheets',      label: 'Consolidated Bal. Sheets', icon: '📋', idField: 'familyId', data: BALANCE_SHEETS as any[] },
    { name: 'cash_positions',      label: 'Cash Positions',           icon: '💵', data: CASH_POSITIONS      as any[] },
    { name: 'research_notes',      label: 'Research Notes',           icon: '🔬', data: RESEARCH_NOTES      as any[] },

    // ── Governance & Legal
    { name: 'governance',          label: 'Governance Meetings',      icon: '⚖️', data: GOVERNANCE_MEETINGS as any[] },
    { name: 'governance_structures', label: 'Governance Structures',  icon: '🏛', idField: 'id', data: GOVERNANCE_STRUCTURES as any[] },
    { name: 'votes',               label: 'Governance Votes',         icon: '🗳', data: VOTES               as any[] },
    { name: 'estate_plans',        label: 'Estate Plans',             icon: '📜', data: ESTATE_PLANS        as any[] },
    { name: 'documents',           label: 'Documents / DMS',          icon: '📄', data: DOCUMENTS           as any[] },

    // ── Compliance & Suitability
    { name: 'suitability_history', label: 'Suitability History',      icon: '📝', data: MOCK_SUITABILITY_HISTORY as any[] },
    { name: 'suitability_config',  label: 'Suitability Config',       icon: '⚙️', idField: 'tenantId', data: [DEFAULT_SUITABILITY_CONFIG as any] },
    { name: 'audit_log',           label: 'Audit Log',                icon: '🔍', data: AUDIT_LOG           as any[] },

    // ── Network & Relationships
    { name: 'service_providers',   label: 'Service Providers',        icon: '🤝', data: SERVICE_PROVIDERS   as any[] },
    { name: 'network_nodes',       label: 'Relationship Graph Nodes', icon: '🕸', data: NETWORK_NODES        as any[] },
    { name: 'relationship_edges',  label: 'Relationship Graph Edges', icon: '🔗', data: RELATIONSHIP_EDGES   as any[] },
  ];
}

/** Returns the total record count across all collections */
export function totalDemoRecords(): number {
  return buildSeedManifest().reduce((sum, c) => sum + c.data.length, 0);
}

/** Returns the number of collections */
export function totalDemoCollections(): number {
  return buildSeedManifest().length;
}

// ─── Demo Tenant Registry ─────────────────────────────────────────────────────
// Stored entirely in localStorage for the static/no-backend demo.

export type DemoTenantStatus = 'provisioning' | 'active' | 'expired' | 'suspended';

export interface DemoTenant {
  id: string;
  name: string;
  firm: string;
  contactEmail: string;
  contactName: string;
  plan: 'trial_7d' | 'trial_14d' | 'trial_30d' | 'sandbox_permanent';
  status: DemoTenantStatus;
  provisionedAt: string;       // ISO
  expiresAt: string | null;    // ISO — null for permanent sandbox
  seededCollections: number;   // how many collections were seeded
  seededRecords: number;       // total records seeded
  loginUrl: string;
  adminEmail: string;
  adminPassword: string;
  notes: string;
  tags: string[];
  // Metrics (read-only tracking)
  lastLoginAt?: string;
  loginCount?: number;
}

const DEMO_TENANTS_KEY = 'mfo_demo_tenants';

export function loadDemoTenants(): DemoTenant[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DEMO_TENANTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDemoTenants(tenants: DemoTenant[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(DEMO_TENANTS_KEY, JSON.stringify(tenants));
}

export function deleteDemoTenant(id: string): void {
  saveDemoTenants(loadDemoTenants().filter(t => t.id !== id));
}

/** Generate a secure-looking random credential */
export function generateDemoCredentials(firm: string): { tenantId: string; email: string; password: string } {
  const slug = firm
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20);
  const rand  = Math.random().toString(36).slice(2, 8);
  const pass  = Math.random().toString(36).slice(2, 6).toUpperCase()
              + Math.random().toString(36).slice(2, 6)
              + '!9';
  return {
    tenantId: `demo-${slug}-${rand}`,
    email:    `admin@demo-${slug}.mfonexus.dev`,
    password: pass,
  };
}

/** Calculate remaining days for a trial tenant */
export function demoTenantDaysLeft(tenant: DemoTenant): number | null {
  if (!tenant.expiresAt) return null;
  const ms = new Date(tenant.expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

/** Maps plan code to days */
export const PLAN_DAYS: Record<DemoTenant['plan'], number | null> = {
  trial_7d: 7,
  trial_14d: 14,
  trial_30d: 30,
  sandbox_permanent: null,
};

export const PLAN_LABELS: Record<DemoTenant['plan'], string> = {
  trial_7d:          '7-Day Trial',
  trial_14d:         '14-Day Trial',
  trial_30d:         '30-Day Trial',
  sandbox_permanent: 'Permanent Sandbox',
};
