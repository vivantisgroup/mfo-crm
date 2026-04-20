import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  query, where, serverTimestamp, Timestamp, orderBy
} from 'firebase/firestore';

const db = getFirestore(firebaseApp);

export type BPMStageStatus = 'pending' | 'in_progress' | 'completed' | 'rejected' | 'blocked';
export type BPMInstanceStatus = 'active' | 'completed' | 'cancelled' | 'on_hold';

export interface BPMTemplateStage {
  id: string;
  name: string;
  description?: string;
  order: number;
  assignedRole?: string; // e.g., 'compliance_officer'
  requiresDocuments?: boolean;
  requiresApproval?: boolean;
  requiredFields?: string[]; // Used for dynamic forms mapping
  slaHours?: number; // Service level agreement in hours
}

export interface BPMTemplate {
  id?: string;
  tenantId: string;
  name: string;
  description: string;
  version: number;
  stages: BPMTemplateStage[];
  createdAt: string;
  createdBy: string;
  isActive: boolean;
}

export interface BPMInstance {
  id?: string;
  tenantId: string;
  templateId: string;
  templateName: string; // denormalized for easy viewing
  status: BPMInstanceStatus;
  currentStageId: string;
  variables: Record<string, any>; // Stores forms or process data
  createdAt: string;
  createdBy: string; // The user who started the process
  updatedAt: string;
  dueDate?: string; // If applicable based on SLAs
}

export interface BPMTask {
  id?: string;
  tenantId: string;
  instanceId: string;
  stageId: string;
  title: string;
  description?: string;
  status: 'pending' | 'completed';
  assignedRole?: string;
  assignedTo?: string; // Specific UID
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
  completedBy?: string;
}

export interface BPMLog {
  id?: string;
  tenantId: string;
  instanceId: string;
  action: 'process_started' | 'stage_advanced' | 'task_created' | 'task_completed' | 'document_uploaded' | 'process_completed' | 'process_rejected';
  stageId?: string;
  userId: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export async function getBPMTemplates(tenantId: string): Promise<BPMTemplate[]> {
  const q = query(
    collection(db, 'bpm_templates'),
    where('tenantId', '==', tenantId),
    where('isActive', '==', true)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BPMTemplate));
}

export async function getBPMTemplate(templateId: string): Promise<BPMTemplate | null> {
  const d = await getDoc(doc(db, 'bpm_templates', templateId));
  return d.exists() ? ({ id: d.id, ...d.data() } as BPMTemplate) : null;
}

export async function startProcess(
  tenantId: string, 
  templateId: string, 
  userId: string, 
  initialPayload: Record<string, any> = {}
): Promise<string> {
  const template = await getBPMTemplate(templateId);
  if (!template || template.tenantId !== tenantId) throw new Error('Template not found or access denied.');

  // Find the first stage
  const sortedStages = [...template.stages].sort((a, b) => a.order - b.order);
  const firstStage = sortedStages[0];

  if (!firstStage) throw new Error('Template has no stages defined.');

  const now = new Date().toISOString();

  // Create Instance
  const instanceRef = await addDoc(collection(db, 'bpm_instances'), {
    tenantId,
    templateId,
    templateName: template.name,
    status: 'active',
    currentStageId: firstStage.id,
    variables: initialPayload,
    createdAt: now,
    createdBy: userId,
    updatedAt: now
  });

  // Create Initial Task if needed
  await createTask(tenantId, instanceRef.id, firstStage, userId);

  // Log Event
  await logProcessEvent(tenantId, instanceRef.id, 'process_started', userId, {
    stageId: firstStage.id,
    templateId
  });

  return instanceRef.id;
}

export async function createTask(
  tenantId: string, 
  instanceId: string, 
  stage: BPMTemplateStage,
  userId: string
): Promise<string> {
  const now = new Date();
  let dueDateStr: string | null = null;
  if (stage.slaHours) {
    now.setHours(now.getHours() + stage.slaHours);
    dueDateStr = now.toISOString();
  }

  const taskRef = await addDoc(collection(db, 'bpm_tasks'), {
    tenantId,
    instanceId,
    stageId: stage.id,
    title: `Pending Action: ${stage.name}`,
    description: stage.description || '',
    status: 'pending',
    assignedRole: stage.assignedRole || null,
    dueDate: dueDateStr,
    createdAt: new Date().toISOString()
  });

  await logProcessEvent(tenantId, instanceId, 'task_created', userId, {
    taskId: taskRef.id,
    stageId: stage.id,
    assignedRole: stage.assignedRole
  });

  return taskRef.id;
}

export async function getBPMInstances(tenantId: string, limitStatus?: BPMInstanceStatus): Promise<BPMInstance[]> {
  let q;
  if (limitStatus) {
    q = query(collection(db, 'bpm_instances'), where('tenantId', '==', tenantId), where('status', '==', limitStatus));
  } else {
    q = query(collection(db, 'bpm_instances'), where('tenantId', '==', tenantId));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BPMInstance));
}

export async function getBPMInstance(instanceId: string): Promise<BPMInstance | null> {
  const d = await getDoc(doc(db, 'bpm_instances', instanceId));
  return d.exists() ? ({ id: d.id, ...d.data() } as BPMInstance) : null;
}

export async function getBPMTasks(tenantId: string, statusFilter?: 'pending' | 'completed'): Promise<BPMTask[]> {
  let q;
  if (statusFilter) {
    q = query(collection(db, 'bpm_tasks'), where('tenantId', '==', tenantId), where('status', '==', statusFilter));
  } else {
    q = query(collection(db, 'bpm_tasks'), where('tenantId', '==', tenantId));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BPMTask));
}

export async function advanceStage(
  tenantId: string, 
  instanceId: string, 
  userId: string,
  payloadUpdates: Record<string, any> = {}
): Promise<void> {
  const instance = await getBPMInstance(instanceId);
  if (!instance) throw new Error('Instance not found.');

  const template = await getBPMTemplate(instance.templateId);
  if (!template) throw new Error('Template not found.');

  const sortedStages = [...template.stages].sort((a, b) => a.order - b.order);
  const currentIndex = sortedStages.findIndex(s => s.id === instance.currentStageId);

  // Mark pending tasks for this stage as completed implicitly or throw error if rigid validation is required
  // For safety, we will just proceed, but in a strong enterprise we might throw if tasks are incomplete.
  
  if (currentIndex === -1 || currentIndex === sortedStages.length - 1) {
    // Process is complete
    await updateDoc(doc(db, 'bpm_instances', instanceId), {
      status: 'completed',
      variables: { ...instance.variables, ...payloadUpdates },
      updatedAt: new Date().toISOString()
    });
    await logProcessEvent(tenantId, instanceId, 'process_completed', userId, {});
  } else {
    const nextStage = sortedStages[currentIndex + 1];
    await updateDoc(doc(db, 'bpm_instances', instanceId), {
      currentStageId: nextStage.id,
      variables: { ...instance.variables, ...payloadUpdates },
      updatedAt: new Date().toISOString()
    });
    
    await createTask(tenantId, instanceId, nextStage, userId);
    
    await logProcessEvent(tenantId, instanceId, 'stage_advanced', userId, {
      fromStageId: instance.currentStageId,
      toStageId: nextStage.id
    });
  }
}

export async function completeTask(
  tenantId: string, 
  taskId: string, 
  userId: string
): Promise<void> {
  await updateDoc(doc(db, 'bpm_tasks', taskId), {
    status: 'completed',
    completedAt: new Date().toISOString(),
    completedBy: userId
  });
  
  // also get task to log
  const t = await getDoc(doc(db, 'bpm_tasks', taskId));
  if (t.exists()) {
    const data = t.data() as BPMTask;
    await logProcessEvent(tenantId, data.instanceId, 'task_completed', userId, {
      taskId
    });
  }
}

export async function logProcessEvent(
  tenantId: string, 
  instanceId: string, 
  action: BPMLog['action'], 
  userId: string, 
  metadata: Record<string, any> = {}
): Promise<void> {
  await addDoc(collection(db, 'bpm_logs'), {
    tenantId,
    instanceId,
    action,
    userId,
    timestamp: new Date().toISOString(),
    metadata
  });
}

/** 
 * Seeds out-of-the-box standard MFO templates if they don't exist.
 */
export async function seedBPMTemplates(tenantId: string, userId: string): Promise<void> {
  const existing = await getBPMTemplates(tenantId);
  if (existing.length > 0) return; // Already seeded

  const templates: Omit<BPMTemplate, 'id'>[] = [
    {
      tenantId,
      name: 'Offshore PIC Setup',
      description: 'Standard end-to-end workflow for setting up a Private Investment Company in an offshore jurisdiction.',
      version: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      stages: [
        { id: 'stg_1', name: 'Initiation & Structuring', order: 1, assignedRole: 'relationship_manager', description: 'Define corporate parameters and chosen jurisdiction.' },
        { id: 'stg_2', name: 'KYC & Data Collection', order: 2, assignedRole: 'relationship_manager', requiresDocuments: true, description: 'Collect Passports, PoA, W-8BEN forms.' },
        { id: 'stg_3', name: 'AML Check & Suitability', order: 3, assignedRole: 'compliance_officer', requiresApproval: true, slaHours: 24, description: 'Verify collected documents against compliance standards.' },
        { id: 'stg_4', name: 'Legal Drafting', order: 4, assignedRole: 'compliance_officer', requiresDocuments: true, description: 'Upload generated corporate registry drafts and M&A.' },
        { id: 'stg_5', name: 'Client Signature Hook', order: 5, assignedRole: 'relationship_manager', description: 'Send out to client for digital signature and await completion.' },
        { id: 'stg_6', name: 'Entity Provisioning', order: 6, assignedRole: 'relationship_manager', description: 'Final setup in CRM and accounting ledgers.' },
      ]
    },
    {
      tenantId,
      name: 'Client Onboarding',
      description: 'Standard MFO Private Client Onboarding.',
      version: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      stages: [
        { id: 'stg_1', name: 'Lead Conversion', order: 1, assignedRole: 'sales_operations', description: 'Convert lead to family profile.' },
        { id: 'stg_2', name: 'Due Diligence', order: 2, assignedRole: 'compliance_officer', requiresApproval: true, slaHours: 48, description: 'Source of wealth check and PEP screening.' },
        { id: 'stg_3', name: 'Account Opening', order: 3, assignedRole: 'relationship_manager', description: 'Custodian forms generation.' },
        { id: 'stg_4', name: 'Funding', order: 4, assignedRole: 'controller', description: 'Wait for initial assets transfer.' },
      ]
    }
  ];

  for (const t of templates) {
    await addDoc(collection(db, 'bpm_templates'), t);
  }
}

