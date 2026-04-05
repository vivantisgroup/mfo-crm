/**
 * rbacService.ts
 *
 * Enterprise Role-Based Access Control (RBAC) with Object-Level Authorization.
 *
 * Model:
 *   User  ─► Direct Role  ─► Default Permissions
 *         ─► Groups[]     ─► Role + Additional Permissions
 *         ─► Direct Permission Overrides (grant/deny)
 *
 * Authorization checks evaluate:
 *   1. DENY overrides at user level (highest priority)
 *   2. GRANT at user level
 *   3. Group permissions (union of all groups)
 *   4. Role default permissions
 *
 * Object-Level Authorization:
 *   object_acls/{id} – grants a user or group explicit access
 *   to a specific resource instance (e.g. family, portfolio, document).
 *
 * Firestore schema supplement:
 *   platform_permissions/{id}   ← canonical permission registry (optional cache)
 *   tenant_groups/{id}          ← see groupService.ts
 *   object_acls/{id}            ← resource-level ACL entries
 *   user_permissions/{uid}_{tenantId} ← per-user overrides
 */

import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, where, addDoc, writeBatch,
} from 'firebase/firestore';
import type { PlatformRole } from './platformService';

const db = getFirestore(firebaseApp);

// ─── Permission Atoms ─────────────────────────────────────────────────────────
//
// Format: <module>:<action>  (action may be: read | write | delete | export | approve | admin)

export type Permission =
  // ─ Families / Clients ─
  | 'families:read'      | 'families:write'      | 'families:delete'
  | 'families:export'    | 'families:import'
  // ─ Contacts ─
  | 'contacts:read'      | 'contacts:write'       | 'contacts:delete'
  // ─ Activities / Notes ─
  | 'activities:read'    | 'activities:write'     | 'activities:delete'
  // ─ Tasks ─
  | 'tasks:read'         | 'tasks:write'          | 'tasks:delete' | 'tasks:assign'
  // ─ Calendar ─
  | 'calendar:read'      | 'calendar:write'       | 'calendar:delete'
  // ─ Portfolio ─
  | 'portfolio:read'     | 'portfolio:write'      | 'portfolio:trade' | 'portfolio:export'
  // ─ Documents ─
  | 'documents:read'     | 'documents:write'      | 'documents:delete' | 'documents:sign'
  // ─ Reports ─
  | 'reports:read'       | 'reports:generate'     | 'reports:export' | 'reports:distribute'
  // ─ Estate ─
  | 'estate:read'        | 'estate:write'
  // ─ Governance ─
  | 'governance:read'    | 'governance:write'     | 'governance:approve'
  // ─ Compliance / KYC / AML ─
  | 'compliance:read'    | 'compliance:write'     | 'compliance:approve' | 'compliance:export'
  | 'suitability:read'   | 'suitability:write'    | 'suitability:approve'
  // ─ Audit Logs ─
  | 'audit:read'         | 'audit:export'
  // ─ Concierge / Services ─
  | 'concierge:read'     | 'concierge:write'
  // ─ Tenant Admin ─
  | 'admin:users'        | 'admin:groups'         | 'admin:roles'
  | 'admin:settings'     | 'admin:integrations'   | 'admin:branding'
  | 'admin:billing'      | 'admin:audit'
  // ─ Platform (SaaS Master) ─
  | 'platform:tenants'   | 'platform:billing'     | 'platform:config'
  | 'platform:users'     | 'platform:audit'       | 'platform:crm'
  | 'platform:support'
  // ─ Email Templates ─
  | 'email_templates:manage';

// ─── Role Permission Maps ──────────────────────────────────────────────────────

const ALL_PERMISSIONS: Permission[] = [
  'families:read','families:write','families:delete','families:export','families:import',
  'contacts:read','contacts:write','contacts:delete',
  'activities:read','activities:write','activities:delete',
  'tasks:read','tasks:write','tasks:delete','tasks:assign',
  'calendar:read','calendar:write','calendar:delete',
  'portfolio:read','portfolio:write','portfolio:trade','portfolio:export',
  'documents:read','documents:write','documents:delete','documents:sign',
  'reports:read','reports:generate','reports:export','reports:distribute',
  'estate:read','estate:write',
  'governance:read','governance:write','governance:approve',
  'compliance:read','compliance:write','compliance:approve','compliance:export',
  'suitability:read','suitability:write','suitability:approve',
  'audit:read','audit:export',
  'concierge:read','concierge:write',
  'admin:users','admin:groups','admin:roles','admin:settings','admin:integrations',
  'admin:branding','admin:billing','admin:audit',
  'platform:tenants','platform:billing','platform:config','platform:users',
  'platform:audit','platform:crm','platform:support',
  'email_templates:manage',
];

export const ROLE_PERMISSIONS: Record<PlatformRole, Permission[]> = {

  saas_master_admin: ALL_PERMISSIONS,

  tenant_admin: [
    'families:read','families:write','families:delete','families:export','families:import',
    'contacts:read','contacts:write','contacts:delete',
    'activities:read','activities:write','activities:delete',
    'tasks:read','tasks:write','tasks:delete','tasks:assign',
    'calendar:read','calendar:write','calendar:delete',
    'portfolio:read','portfolio:write','portfolio:trade','portfolio:export',
    'documents:read','documents:write','documents:delete','documents:sign',
    'reports:read','reports:generate','reports:export','reports:distribute',
    'estate:read','estate:write',
    'governance:read','governance:write','governance:approve',
    'compliance:read','compliance:write','compliance:approve','compliance:export',
    'suitability:read','suitability:write','suitability:approve',
    'audit:read','audit:export',
    'concierge:read','concierge:write',
    'admin:users','admin:groups','admin:roles','admin:settings',
    'admin:integrations','admin:branding','admin:billing','admin:audit',
    'email_templates:manage',
  ],

  relationship_manager: [
    'families:read','families:write','families:export',
    'contacts:read','contacts:write',
    'activities:read','activities:write',
    'tasks:read','tasks:write','tasks:assign',
    'calendar:read','calendar:write',
    'portfolio:read','portfolio:export',
    'documents:read','documents:write',
    'reports:read','reports:generate','reports:export',
    'estate:read',
    'governance:read',
    'compliance:read','suitability:read','suitability:write',
    'concierge:read','concierge:write',
    'audit:read',
  ],

  cio: [
    'families:read',
    'portfolio:read','portfolio:write','portfolio:trade','portfolio:export',
    'documents:read','documents:write',
    'reports:read','reports:generate','reports:export','reports:distribute',
    'governance:read','governance:write',
    'compliance:read',
    'audit:read',
    'concierge:read',
  ],

  controller: [
    'families:read',
    'portfolio:read','portfolio:export',
    'documents:read','documents:write',
    'reports:read','reports:generate','reports:export',
    'estate:read','estate:write',
    'governance:read','governance:write',
    'compliance:read','compliance:write',
    'audit:read',
    'admin:billing',
  ],

  compliance_officer: [
    'families:read',
    'documents:read',
    'reports:read','reports:generate','reports:export',
    'governance:read','governance:write','governance:approve',
    'compliance:read','compliance:write','compliance:approve','compliance:export',
    'suitability:read','suitability:write','suitability:approve',
    'audit:read','audit:export',
  ],

  report_viewer: [
    'families:read',
    'portfolio:read',
    'documents:read',
    'reports:read',
    'governance:read',
    'compliance:read',
    'suitability:read',
    'audit:read',
  ],

  external_advisor: [
    'families:read',
    'portfolio:read',
    'documents:read',
    'reports:read',
  ],

  sales_operations: [
    // Client & contact management
    'families:read','families:write','families:export',
    'contacts:read','contacts:write','contacts:delete',
    // CRM activities (pipeline, calls, meetings, notes)
    'activities:read','activities:write','activities:delete',
    // Task management
    'tasks:read','tasks:write','tasks:assign',
    // Calendar
    'calendar:read','calendar:write',
    // Documents
    'documents:read','documents:write',
    // Reporting (revenue, pipeline analytics)
    'reports:read','reports:generate','reports:export',
    // Concierge / service delivery
    'concierge:read','concierge:write',
    // Read-only compliance (suitability checks before pitches)
    'suitability:read',
  ],

  business_manager: [
    'families:read','families:write','families:export','families:import',
    'contacts:read','contacts:write',
    'activities:read','activities:write',
    'tasks:read','tasks:write','tasks:delete','tasks:assign',
    'calendar:read','calendar:write','calendar:delete',
    'portfolio:read','portfolio:export',
    'documents:read','documents:write',
    'reports:read','reports:generate','reports:export','reports:distribute',
    'estate:read',
    'governance:read','governance:write',
    'compliance:read','suitability:read',
    'audit:read',
    'concierge:read','concierge:write',
    'admin:users','admin:groups','admin:settings','admin:integrations',
  ],

  // ─── Sales Structure Roles ────────────────────────────────────────────────────

  sales_manager: [
    // Full CRM visibility (own team)
    'families:read','families:write','families:export','families:import',
    'contacts:read','contacts:write','contacts:delete',
    'activities:read','activities:write','activities:delete',
    // Full task management + assignment
    'tasks:read','tasks:write','tasks:delete','tasks:assign',
    'calendar:read','calendar:write','calendar:delete',
    'documents:read','documents:write','documents:sign',
    // Full reporting suite
    'reports:read','reports:generate','reports:export','reports:distribute',
    // Service delivery
    'concierge:read','concierge:write',
    // Compliance + suitability review
    'compliance:read','suitability:read','suitability:write',
    'audit:read',
    // Team admin (own team)
    'admin:users','admin:groups','admin:settings',
  ],

  revenue_manager: [
    // Full data access for analytics
    'families:read','families:export',
    'contacts:read',
    'activities:read',
    'tasks:read',
    'calendar:read',
    'portfolio:read','portfolio:export',
    'documents:read',
    // Full reporting — this is the core function
    'reports:read','reports:generate','reports:export','reports:distribute',
    // Governance + compliance read for revenue assurance
    'governance:read',
    'compliance:read','suitability:read',
    'audit:read','audit:export',
    // Admin: can manage quotas/settings but not users
    'admin:settings',
  ],

  data_analyst: [
    // Full data access for analytics
    'families:read','families:export',
    'contacts:read',
    'activities:read',
    'tasks:read',
    'calendar:read',
    'portfolio:read','portfolio:export',
    'documents:read',
    // Full reporting — this is the core function
    'reports:read','reports:generate','reports:export','reports:distribute',
    // Governance + compliance read
    'governance:read',
    'compliance:read','suitability:read',
    'audit:read','audit:export',
  ],

  account_executive: [
    // Own CRM records
    'families:read','families:write','families:export',
    'contacts:read','contacts:write',
    'activities:read','activities:write',
    // Tasks + calendar for deal management
    'tasks:read','tasks:write','tasks:assign',
    'calendar:read','calendar:write',
    // Docs + signing for proposals / contracts
    'documents:read','documents:write','documents:sign',
    // Core reporting for own pipeline
    'reports:read','reports:generate','reports:export',
    // Concierge for client delivery
    'concierge:read','concierge:write',
    // Pre-sale suitability
    'suitability:read','suitability:write',
  ],

  sdr: [
    // Prospecting — read + write leads/contacts
    'families:read','families:write',
    'contacts:read','contacts:write',
    // Activity logging (calls, emails, LinkedIn)
    'activities:read','activities:write',
    // Task management (own tasks)
    'tasks:read','tasks:write',
    'calendar:read','calendar:write',
    // Basic reporting (own activity metrics)
    'reports:read',
    // Concierge read for context
    'concierge:read',
  ],

  customer_success_manager: [
    // Full client data for account health
    'families:read','families:write','families:export',
    'contacts:read','contacts:write',
    // Activity logging (QBRs, onboarding sessions)
    'activities:read','activities:write',
    // Task management
    'tasks:read','tasks:write','tasks:assign',
    'calendar:read','calendar:write',
    // Portfolio + documents (health dashboards, renewal docs)
    'portfolio:read',
    'documents:read','documents:write','documents:sign',
    // Customer health reporting + renewal reporting
    'reports:read','reports:generate','reports:export','reports:distribute',
    // Estate + governance read (for complex clients)
    'estate:read',
    'governance:read',
    // Compliance
    'compliance:read','suitability:read',
    'audit:read',
    // Concierge (full — CS is the service team)
    'concierge:read','concierge:write',
  ],
};

// ─── Permission metadata (human-readable) ─────────────────────────────────────

export interface PermissionMeta {
  id:          Permission;
  module:      string;
  action:      string;
  label:       string;
  description: string;
  sensitive?:  boolean; // requires extra confirmation before granting
}

export const PERMISSION_META: Record<Permission, PermissionMeta> = {
  // Families
  'families:read':    { id: 'families:read',    module: 'Families', action: 'read',   label: 'View Families',     description: 'View client family profiles and details' },
  'families:write':   { id: 'families:write',   module: 'Families', action: 'write',  label: 'Edit Families',     description: 'Create and edit client family records' },
  'families:delete':  { id: 'families:delete',  module: 'Families', action: 'delete', label: 'Delete Families',   description: 'Permanently delete family records', sensitive: true },
  'families:export':  { id: 'families:export',  module: 'Families', action: 'export', label: 'Export Families',   description: 'Export family data as CSV/PDF' },
  'families:import':  { id: 'families:import',  module: 'Families', action: 'import', label: 'Import Families',   description: 'Bulk import family data' },
  // Contacts
  'contacts:read':    { id: 'contacts:read',    module: 'Contacts', action: 'read',   label: 'View Contacts',     description: 'View contact information' },
  'contacts:write':   { id: 'contacts:write',   module: 'Contacts', action: 'write',  label: 'Edit Contacts',     description: 'Create and edit contacts' },
  'contacts:delete':  { id: 'contacts:delete',  module: 'Contacts', action: 'delete', label: 'Delete Contacts',   description: 'Delete contacts', sensitive: true },
  // Activities
  'activities:read':  { id: 'activities:read',  module: 'Activities', action: 'read',   label: 'View Activities', description: 'View notes and activity history' },
  'activities:write': { id: 'activities:write', module: 'Activities', action: 'write',  label: 'Log Activities',  description: 'Create and edit activity notes' },
  'activities:delete':{ id: 'activities:delete',module: 'Activities', action: 'delete', label: 'Delete Activities',description: 'Delete activity records', sensitive: true },
  // Tasks
  'tasks:read':       { id: 'tasks:read',       module: 'Tasks', action: 'read',   label: 'View Tasks',    description: 'View assigned and team tasks' },
  'tasks:write':      { id: 'tasks:write',      module: 'Tasks', action: 'write',  label: 'Manage Tasks',  description: 'Create, edit, and complete tasks' },
  'tasks:delete':     { id: 'tasks:delete',     module: 'Tasks', action: 'delete', label: 'Delete Tasks',  description: 'Delete tasks', sensitive: true },
  'tasks:assign':     { id: 'tasks:assign',     module: 'Tasks', action: 'assign', label: 'Assign Tasks',  description: 'Assign tasks to other users' },
  // Calendar
  'calendar:read':    { id: 'calendar:read',    module: 'Calendar', action: 'read',   label: 'View Calendar',  description: 'View calendar events' },
  'calendar:write':   { id: 'calendar:write',   module: 'Calendar', action: 'write',  label: 'Edit Calendar',  description: 'Create and edit calendar events' },
  'calendar:delete':  { id: 'calendar:delete',  module: 'Calendar', action: 'delete', label: 'Delete Events',  description: 'Delete calendar events' },
  // Portfolio
  'portfolio:read':   { id: 'portfolio:read',   module: 'Portfolio', action: 'read',   label: 'View Portfolio',  description: 'View portfolio holdings and performance' },
  'portfolio:write':  { id: 'portfolio:write',  module: 'Portfolio', action: 'write',  label: 'Edit Portfolio',  description: 'Edit portfolio data and allocations' },
  'portfolio:trade':  { id: 'portfolio:trade',  module: 'Portfolio', action: 'trade',  label: 'Execute Trades',  description: 'Place and approve trade orders', sensitive: true },
  'portfolio:export': { id: 'portfolio:export', module: 'Portfolio', action: 'export', label: 'Export Portfolio', description: 'Export portfolio reports' },
  // Documents
  'documents:read':   { id: 'documents:read',   module: 'Documents', action: 'read',   label: 'View Documents',   description: 'Access document vault' },
  'documents:write':  { id: 'documents:write',  module: 'Documents', action: 'write',  label: 'Upload Documents', description: 'Upload and edit documents' },
  'documents:delete': { id: 'documents:delete', module: 'Documents', action: 'delete', label: 'Delete Documents', description: 'Permanently delete documents', sensitive: true },
  'documents:sign':   { id: 'documents:sign',   module: 'Documents', action: 'sign',   label: 'Sign Documents',   description: 'Digitally sign documents', sensitive: true },
  // Reports
  'reports:read':         { id: 'reports:read',         module: 'Reports', action: 'read',       label: 'View Reports',        description: 'Access generated reports' },
  'reports:generate':     { id: 'reports:generate',     module: 'Reports', action: 'generate',   label: 'Generate Reports',    description: 'Create new reports' },
  'reports:export':       { id: 'reports:export',       module: 'Reports', action: 'export',     label: 'Export Reports',      description: 'Export reports to PDF/Excel' },
  'reports:distribute':   { id: 'reports:distribute',   module: 'Reports', action: 'distribute', label: 'Distribute Reports',  description: 'Send reports to clients', sensitive: true },
  // Estate
  'estate:read':      { id: 'estate:read',      module: 'Estate', action: 'read',  label: 'View Estate Plans',  description: 'View estate planning records' },
  'estate:write':     { id: 'estate:write',     module: 'Estate', action: 'write', label: 'Edit Estate Plans',  description: 'Create and edit estate plans' },
  // Governance
  'governance:read':    { id: 'governance:read',    module: 'Governance', action: 'read',    label: 'View Governance',    description: 'View governance records and policies' },
  'governance:write':   { id: 'governance:write',   module: 'Governance', action: 'write',   label: 'Edit Governance',    description: 'Create and edit governance records' },
  'governance:approve': { id: 'governance:approve', module: 'Governance', action: 'approve', label: 'Approve Governance',  description: 'Approve governance requests and policies', sensitive: true },
  // Compliance
  'compliance:read':    { id: 'compliance:read',    module: 'Compliance', action: 'read',    label: 'View Compliance',    description: 'View KYC/AML compliance records' },
  'compliance:write':   { id: 'compliance:write',   module: 'Compliance', action: 'write',   label: 'Edit Compliance',    description: 'Create and update compliance records' },
  'compliance:approve': { id: 'compliance:approve', module: 'Compliance', action: 'approve', label: 'Approve Compliance', description: 'Approve compliance reviews', sensitive: true },
  'compliance:export':  { id: 'compliance:export',  module: 'Compliance', action: 'export',  label: 'Export Compliance',  description: 'Export compliance reports' },
  'suitability:read':   { id: 'suitability:read',   module: 'Suitability', action: 'read',   label: 'View Suitability',  description: 'View suitability assessments' },
  'suitability:write':  { id: 'suitability:write',  module: 'Suitability', action: 'write',  label: 'Edit Suitability',  description: 'Create suitability assessments' },
  'suitability:approve':{ id: 'suitability:approve',module: 'Suitability', action: 'approve',label: 'Approve Suitability',description: 'Approve suitability results', sensitive: true },
  // Audit
  'audit:read':   { id: 'audit:read',   module: 'Audit', action: 'read',   label: 'View Audit Log',   description: 'Read platform audit trail' },
  'audit:export': { id: 'audit:export', module: 'Audit', action: 'export', label: 'Export Audit Log', description: 'Export audit trail to CSV/PDF' },
  // Concierge
  'concierge:read':  { id: 'concierge:read',  module: 'Concierge', action: 'read',  label: 'View Services',   description: 'View concierge service requests' },
  'concierge:write': { id: 'concierge:write', module: 'Concierge', action: 'write', label: 'Manage Services',  description: 'Create and manage service requests' },
  // Admin
  'admin:users':        { id: 'admin:users',        module: 'Admin', action: 'admin', label: 'Manage Users',        description: 'Invite, edit, and suspend users', sensitive: true },
  'admin:groups':       { id: 'admin:groups',       module: 'Admin', action: 'admin', label: 'Manage Groups',       description: 'Create and manage user groups', sensitive: true },
  'admin:roles':        { id: 'admin:roles',        module: 'Admin', action: 'admin', label: 'Manage Roles',        description: 'Assign and modify user roles', sensitive: true },
  'admin:settings':     { id: 'admin:settings',     module: 'Admin', action: 'admin', label: 'Tenant Settings',     description: 'Manage tenant configuration' },
  'admin:integrations': { id: 'admin:integrations', module: 'Admin', action: 'admin', label: 'Integrations',        description: 'Configure third-party integrations' },
  'admin:branding':     { id: 'admin:branding',     module: 'Admin', action: 'admin', label: 'Branding',            description: 'Configure logos, colors, and identity' },
  'admin:billing':      { id: 'admin:billing',      module: 'Admin', action: 'admin', label: 'Billing Access',      description: 'View and manage billing information', sensitive: true },
  'admin:audit':        { id: 'admin:audit',        module: 'Admin', action: 'admin', label: 'Admin Audit Log',     description: 'Access admin-level audit records' },
  // Platform
  'platform:tenants': { id: 'platform:tenants', module: 'Platform', action: 'admin', label: 'Manage Tenants',    description: 'Full tenant lifecycle management', sensitive: true },
  'platform:billing': { id: 'platform:billing', module: 'Platform', action: 'admin', label: 'Platform Billing',  description: 'Manage SaaS subscriptions and invoices', sensitive: true },
  'platform:config':  { id: 'platform:config',  module: 'Platform', action: 'admin', label: 'Platform Config',   description: 'Configure platform-wide settings', sensitive: true },
  'platform:users':   { id: 'platform:users',   module: 'Platform', action: 'admin', label: 'Platform Users',    description: 'Manage all platform users', sensitive: true },
  'platform:audit':   { id: 'platform:audit',   module: 'Platform', action: 'admin', label: 'Platform Audit',    description: 'Access full platform audit trail' },
  'platform:crm':     { id: 'platform:crm',     module: 'Platform', action: 'admin', label: 'Platform CRM',      description: 'Access the SaaS sales CRM' },
  'platform:support': { id: 'platform:support', module: 'Platform', action: 'admin', label: 'Platform Support',  description: 'Manage support tickets platform-wide' },
  // Email Templates
  'email_templates:manage': { id: 'email_templates:manage', module: 'Email Templates', action: 'admin', label: 'Manage Email Templates', description: 'Edit and customize tenant email notification templates' },
};

// ─── Grouped permission modules (for UI rendering) ───────────────────────────

export const PERMISSION_MODULES = [
  'Families','Contacts','Activities','Tasks','Calendar','Portfolio',
  'Documents','Reports','Estate','Governance','Compliance','Suitability',
  'Audit','Concierge','Admin','Platform','Email Templates',
] as const;

export type PermissionModule = typeof PERMISSION_MODULES[number];

export function permissionsByModule(module: PermissionModule): PermissionMeta[] {
  return Object.values(PERMISSION_META).filter(p => p.module === module);
}

// ─── Firestore types ──────────────────────────────────────────────────────────

/** A direct permission override on a user (within a tenant). */
export interface UserPermissionOverride {
  id:         string;   // {uid}_{tenantId}
  uid:        string;
  tenantId:   string;
  grants:     Permission[];   // explicit allow (additive)
  denies:     Permission[];   // explicit deny (takes precedence over everything)
  updatedAt:  string;
  updatedBy:  string;
}

/** Object-level ACL — grants a user or group access to a specific resource instance. */
export interface ObjectACL {
  id:           string;
  tenantId:     string;
  resourceType: 'family' | 'portfolio' | 'document' | 'client' | 'task';
  resourceId:   string;
  resourceName: string;
  /** If set: this ACL grants a specific user access */
  userId?:      string;
  /** If set: this ACL grants all members of a group access */
  groupId?:     string;
  permissions:  Array<'read' | 'write' | 'delete'>;
  grantedAt:    string;
  grantedBy:    string;
}

// ─── Permission Override CRUD ─────────────────────────────────────────────────

export async function getUserPermissionOverride(
  uid: string, tenantId: string,
): Promise<UserPermissionOverride | null> {
  const ref = doc(db, 'user_permissions', `${uid}_${tenantId}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() as UserPermissionOverride : null;
}

export async function setUserPermissionOverride(
  uid:      string,
  tenantId: string,
  grants:   Permission[],
  denies:   Permission[],
  updatedBy: string,
): Promise<void> {
  const id  = `${uid}_${tenantId}`;
  const ref = doc(db, 'user_permissions', id);
  const override: UserPermissionOverride = {
    id, uid, tenantId, grants, denies,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  await setDoc(ref, override);
  await _audit(tenantId, updatedBy, 'PERMISSION_OVERRIDE_SET', uid, 'user',
    `Permission overrides updated for user ${uid} in tenant ${tenantId}`);
}

export async function clearUserPermissionOverride(
  uid: string, tenantId: string, clearedBy: string,
): Promise<void> {
  await deleteDoc(doc(db, 'user_permissions', `${uid}_${tenantId}`));
  await _audit(tenantId, clearedBy, 'PERMISSION_OVERRIDE_CLEARED', uid, 'user',
    `All permission overrides cleared for user ${uid}`);
}

// ─── Object ACL CRUD ──────────────────────────────────────────────────────────

export async function getObjectACLs(
  tenantId: string,
  filters?: { resourceType?: string; resourceId?: string; userId?: string; groupId?: string },
): Promise<ObjectACL[]> {
  let q = query(collection(db, 'object_acls'), where('tenantId', '==', tenantId));
  const snap = await getDocs(q);
  let results = snap.docs.map(d => ({ id: d.id, ...d.data() } as ObjectACL));
  if (filters?.resourceType) results = results.filter(a => a.resourceType === filters.resourceType);
  if (filters?.resourceId)   results = results.filter(a => a.resourceId   === filters.resourceId);
  if (filters?.userId)       results = results.filter(a => a.userId       === filters.userId);
  if (filters?.groupId)      results = results.filter(a => a.groupId      === filters.groupId);
  return results;
}

export async function grantObjectACL(
  acl:        Omit<ObjectACL, 'id' | 'grantedAt'>,
  grantedBy:  string,
): Promise<ObjectACL> {
  const ref = await addDoc(collection(db, 'object_acls'), {
    ...acl, grantedAt: new Date().toISOString(),
  });
  await _audit(acl.tenantId, grantedBy, 'OBJECT_ACL_GRANTED', acl.resourceId, acl.resourceType,
    `ACL [${acl.permissions.join(',')}] on ${acl.resourceType}:${acl.resourceName} → ${acl.userId ?? acl.groupId}`);
  return { ...acl, id: ref.id, grantedAt: new Date().toISOString() };
}

export async function revokeObjectACL(
  aclId:     string,
  tenantId:  string,
  revokedBy: string,
): Promise<void> {
  await deleteDoc(doc(db, 'object_acls', aclId));
  await _audit(tenantId, revokedBy, 'OBJECT_ACL_REVOKED', aclId, 'acl', `Object ACL ${aclId} revoked`);
}

// ─── Authorization Engine ─────────────────────────────────────────────────────

export interface AuthzContext {
  role:         PlatformRole;
  groupPerms:   Permission[];   // merged from all groups the user belongs to
  grants:       Permission[];   // direct user-level grants
  denies:       Permission[];   // direct user-level denies (highest priority)
}

/**
 * Build the authorization context for a user in a tenant.
 * Callers should cache this to avoid repeated Firestore reads.
 */
export async function buildAuthzContext(
  uid:      string,
  tenantId: string,
  role:     PlatformRole,
  groupIds: string[],
): Promise<AuthzContext> {
  // Fetch group permissions
  const groupPerms = new Set<Permission>();
  if (groupIds.length > 0) {
    const snaps = await Promise.all(
      groupIds.map(gid => getDoc(doc(db, 'tenant_groups', gid)))
    );
    for (const snap of snaps) {
      if (snap.exists()) {
        const data = snap.data();
        const rolePerms = data.roleId ? (ROLE_PERMISSIONS[data.roleId as PlatformRole] ?? []) : [];
        rolePerms.forEach(p => groupPerms.add(p));
        (data.additionalPermissions ?? []).forEach((p: Permission) => groupPerms.add(p));
      }
    }
  }

  // Fetch user-level override
  const override = await getUserPermissionOverride(uid, tenantId);

  return {
    role,
    groupPerms:  Array.from(groupPerms),
    grants:  override?.grants  ?? [],
    denies:  override?.denies  ?? [],
  };
}

/**
 * Main authorization check.
 * Returns true if the permission is granted, false otherwise.
 */
export function can(ctx: AuthzContext, permission: Permission): boolean {
  // 1. Explicit deny at user level — always wins
  if (ctx.denies.includes(permission)) return false;

  // 2. Explicit grant at user level
  if (ctx.grants.includes(permission)) return true;

  // 3. Group permissions (union)
  if (ctx.groupPerms.includes(permission)) return true;

  // 4. Role default permissions
  const rolePerms = ROLE_PERMISSIONS[ctx.role] ?? [];
  return rolePerms.includes(permission);
}

/** Check multiple permissions simultaneously (all must pass = AND). */
export function canAll(ctx: AuthzContext, permissions: Permission[]): boolean {
  return permissions.every(p => can(ctx, p));
}

/** Check multiple permissions simultaneously (any must pass = OR). */
export function canAny(ctx: AuthzContext, permissions: Permission[]): boolean {
  return permissions.some(p => can(ctx, p));
}

/**
 * Compute the full effective permission list for a user  
 * (role defaults + group additions - denies + grants).
 */
export function effectivePermissions(ctx: AuthzContext): Permission[] {
  const base = new Set<Permission>([
    ...(ROLE_PERMISSIONS[ctx.role] ?? []),
    ...ctx.groupPerms,
    ...ctx.grants,
  ]);
  ctx.denies.forEach(d => base.delete(d));
  return Array.from(base);
}

// ─── Audit helper ─────────────────────────────────────────────────────────────

async function _audit(
  tenantId: string, performerId: string, action: string,
  resourceId: string, resourceType: string, description: string,
): Promise<void> {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      tenantId, userId: performerId, userName: performerId,
      action, resourceId, resourceType, resourceName: description,
      status: 'success', ipAddress: 'client',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      occurredAt: new Date().toISOString(),
    });
  } catch { /* non-critical */ }
}
