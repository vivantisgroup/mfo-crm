import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';

const db = getFirestore(firebaseApp);

export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'lookup' | 'external_table' | 'automation_trigger';

export interface CustomFieldDef {
  id: string; // e.g., 'risk_appetite_score'
  label: string; // e.g., 'Risk Appetite Score'
  type: FieldType;
  description?: string;
  required?: boolean;
  lookupTarget?: string; // used when type === 'lookup' or 'automation_trigger' (e.g. 'users', 'families', or 'flow_id')

  // External Grid Layout Mappings
  externalColumns?: { key: string; label: string }[];
  externalParams?: { paramName: string; sourceField: string }[];
}

export interface DataModelDef {
  entityName: string; // e.g., 'families'
  fields: CustomFieldDef[];
  updatedAt: string;
  updatedBy: string;
}

export interface PageLayoutDef {
  pageId: string; // e.g., 'family_overview'
  visibleFields: string[]; // array of custom field IDs that are toggled on
  updatedAt: string;
  updatedBy: string;
}

// Data Model Methods
export async function getDataModel(tenantId: string, entityName: string): Promise<DataModelDef | null> {
  const ref = doc(db, 'tenants', tenantId, 'data_models', entityName);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() as DataModelDef : null;
}

export async function saveDataModel(tenantId: string, entityName: string, fields: CustomFieldDef[], uid: string): Promise<void> {
  const ref = doc(db, 'tenants', tenantId, 'data_models', entityName);
  await setDoc(ref, {
    entityName,
    fields,
    updatedAt: new Date().toISOString(),
    updatedBy: uid
  }, { merge: true });
}

// Page Layout Methods
export async function getPageLayout(tenantId: string, pageId: string): Promise<PageLayoutDef | null> {
  const ref = doc(db, 'tenants', tenantId, 'page_layouts', pageId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() as PageLayoutDef : null;
}

export async function savePageLayout(tenantId: string, pageId: string, visibleFields: string[], uid: string): Promise<void> {
  const ref = doc(db, 'tenants', tenantId, 'page_layouts', pageId);
  await setDoc(ref, {
    pageId,
    visibleFields,
    updatedAt: new Date().toISOString(),
    updatedBy: uid
  }, { merge: true });
}

// Custom Data Value Storage
export async function getCustomData(tenantId: string, entityName: string, recordId: string): Promise<Record<string, any>> {
  const ref = doc(db, 'tenants', tenantId, 'custom_data', `${entityName}_${recordId}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().values || {} : {};
}

export async function saveCustomData(tenantId: string, entityName: string, recordId: string, values: Record<string, any>): Promise<void> {
  const ref = doc(db, 'tenants', tenantId, 'custom_data', `${entityName}_${recordId}`);
  await setDoc(ref, { values }, { merge: true });
}

// System Catalog / Metadata Repository
export interface SystemCatalog {
  dataModels: Record<string, DataModelDef>;
  pageLayouts: Record<string, PageLayoutDef>;
  hubCategories?: string[];
  updatedAt: string;
}

export async function getSystemCatalog(tenantId: string): Promise<SystemCatalog | null> {
  const ref = doc(db, 'tenants', tenantId, 'metadata', 'system_catalog');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() as SystemCatalog : null;
}

export async function updateSystemCatalog(tenantId: string, catalog: Partial<SystemCatalog>): Promise<void> {
  const ref = doc(db, 'tenants', tenantId, 'metadata', 'system_catalog');
  await setDoc(ref, { ...catalog, updatedAt: new Date().toISOString() }, { merge: true });
}

// ─── Data Dictionary ──────────────────────────────────────────────────────────

export interface SystemEntityDef {
  id: string;
  label: string;
  icon: string;
  uiPath: string;
  description: string;
  standardFields: CustomFieldDef[];
}

export const DATA_DICTIONARY: SystemEntityDef[] = [
  {
    id: 'families',
    label: 'Families & Clients',
    icon: 'Users',
    uiPath: 'CRM / Families',
    description: 'Core family office client groups and households.',
    standardFields: [
      { id: 'id', label: 'Primary Key', type: 'text' },
      { id: 'name', label: 'Family Name', type: 'text' },
      { id: 'status', label: 'Client Status', type: 'text' },
      { id: 'tier', label: 'Service Tier', type: 'text' },
      { id: 'aum', label: 'Assets Under Management', type: 'number' },
      { id: 'createdAt', label: 'Created At', type: 'date' }
    ]
  },
  {
    id: 'contacts',
    label: 'Contacts',
    icon: 'UserCircle',
    uiPath: 'CRM / Contacts',
    description: 'Individual people tied to families or external vendors.',
    standardFields: [
      { id: 'id', label: 'Primary Key', type: 'text' },
      { id: 'familyId', label: 'Family Reference', type: 'text' },
      { id: 'firstName', label: 'First Name', type: 'text' },
      { id: 'lastName', label: 'Last Name', type: 'text' },
      { id: 'email', label: 'Email Address', type: 'text' },
      { id: 'phone', label: 'Phone Number', type: 'text' },
      { id: 'role', label: 'Family Role', type: 'text' }
    ]
  },
  {
    id: 'opportunities',
    label: 'Opportunities',
    icon: 'Target',
    uiPath: 'CRM / Opportunities',
    description: 'Pipeline flows, deal tracking, and prospect tracking.',
    standardFields: [
      { id: 'id', label: 'Primary Key', type: 'text' },
      { id: 'title', label: 'Opportunity Title', type: 'text' },
      { id: 'familyId', label: 'Family Reference', type: 'text' },
      { id: 'stage', label: 'Pipeline Stage', type: 'text' },
      { id: 'amount', label: 'Projected Value', type: 'number' },
      { id: 'closeDate', label: 'Expected Close Date', type: 'date' }
    ]
  },
  {
    id: 'activities',
    label: 'Activities',
    icon: 'Activity',
    uiPath: 'CRM / Activities',
    description: 'Interaction logs, meetings, and call transcripts.',
    standardFields: [
      { id: 'id', label: 'Primary Key', type: 'text' },
      { id: 'type', label: 'Activity Type', type: 'text' },
      { id: 'date', label: 'Activity Date', type: 'date' },
      { id: 'subject', label: 'Subject', type: 'text' },
      { id: 'body', label: 'Notes', type: 'text' }
    ]
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: 'CheckSquare',
    uiPath: 'Operations / Tasks',
    description: 'Action items assigned across the organization.',
    standardFields: [
      { id: 'id', label: 'Primary Key', type: 'text' },
      { id: 'title', label: 'Task Title', type: 'text' },
      { id: 'assignee', label: 'Assignee', type: 'text' },
      { id: 'dueDate', label: 'Due Date', type: 'date' },
      { id: 'status', label: 'Completion Status', type: 'text' }
    ]
  },
  {
    id: 'users',
    label: 'Users',
    icon: 'Shield',
    uiPath: 'Platform / Users',
    description: 'Internal employees, advisors, and relationship managers.',
    standardFields: [
      { id: 'uid', label: 'Primary Key', type: 'text' },
      { id: 'email', label: 'Email Address', type: 'text' },
      { id: 'displayName', label: 'Display Name', type: 'text' },
      { id: 'role', label: 'Platform Role', type: 'text' },
      { id: 'status', label: 'Account Status', type: 'text' }
    ]
  },
  {
    id: 'estate_vehicles',
    label: 'Trust & Estate Vehicles',
    icon: 'Landmark',
    uiPath: 'Succession / Entities',
    description: 'Legal vehicles, trusts, and corporate structures.',
    standardFields: [
      { id: 'id', label: 'Primary Key', type: 'text' },
      { id: 'name', label: 'Entity Name', type: 'text' },
      { id: 'type', label: 'Legal Type', type: 'text' },
      { id: 'jurisdiction', label: 'Jurisdiction', type: 'text' },
      { id: 'inceptionDate', label: 'Inception Date', type: 'date' }
    ]
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: 'FileText',
    uiPath: 'Documents / Extraction',
    description: 'Files, compliance artifacts, and extracted metadata.',
    standardFields: [
      { id: 'id', label: 'Primary Key', type: 'text' },
      { id: 'filename', label: 'File Name', type: 'text' },
      { id: 'size', label: 'File Size', type: 'number' },
      { id: 'uploadedAt', label: 'Uploaded At', type: 'date' }
    ]
  }
];
