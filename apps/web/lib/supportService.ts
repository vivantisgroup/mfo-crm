import { collection, query, orderBy, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export type TicketStatus = 'open' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'critical';
export type TicketCategory = 'billing' | 'technical' | 'integration' | 'compliance' | 'feature_request' | 'onboarding' | 'security';
export type TicketTeam = 'support' | 'engineering' | 'operations' | 'compliance';

export interface Ticket {
  id: string; 
  title: string; 
  description: string;
  tenantName: string; 
  submittedBy: string; 
  email: string;
  status: TicketStatus; 
  priority: TicketPriority;
  category: TicketCategory; 
  team: TicketTeam;
  assignedTo: string | null; 
  createdAt: string; 
  updatedAt: string;
  slaDeadline: string; 
  slaBreached: boolean;
  tags: string[];
  attachments?: { name: string; url: string; size: number; type: string }[];
  responses: { author: string; message: string; timestamp: string; internal: boolean }[];
  activities: { type: string; title: string; timestamp: string }[];
}

export function calculateSLA(priority: TicketPriority): string {
  const now = new Date();
  let hours = 48; // default
  switch (priority) {
    case 'critical': hours = 4; break;
    case 'high': hours = 12; break;
    case 'normal': hours = 48; break;
    case 'low': hours = 96; break;
  }
  now.setHours(now.getHours() + hours);
  return now.toISOString();
}

export async function createTicket(entry: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'slaDeadline' | 'slaBreached' | 'responses' | 'activities'>): Promise<Ticket> {
  const now = new Date().toISOString();
  
  // Generate user-friendly Ticket ID: [TENANT_PREFIX]-[RANDOM_4_DIGIT]
  const prefix = entry.tenantName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'SUP';
  const seq = String(Math.floor(Math.random() * 9000) + 1000); // 4-digit number
  const ticketId = `${prefix}-${seq}`;

  const fullEntry: Omit<Ticket, 'id'> = {
    ...entry,
    attachments: entry.attachments || [],
    createdAt: now,
    updatedAt: now,
    slaDeadline: calculateSLA(entry.priority),
    slaBreached: false,
    responses: [],
    activities: [{ type: 'system', title: `Ticket ${ticketId} formally provisioned`, timestamp: now }]
  };
  
  await setDoc(doc(db, 'platform_tickets', ticketId), fullEntry);
  return { id: ticketId, ...fullEntry };
}

export async function updateTicket(id: string, updates: Partial<Omit<Ticket, 'id'>>): Promise<void> {
  const docRef = doc(db, 'platform_tickets', id);
  const now = new Date().toISOString();
  await updateDoc(docRef, { ...updates, updatedAt: now });
}

export async function addActivity(id: string, activity: { type: string; title: string }) {
  const docRef = doc(db, 'platform_tickets', id);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
     const data = snap.data() as Ticket;
     const newActivities = [{ ...activity, timestamp: new Date().toISOString() }, ...(data.activities || [])];
     await updateDoc(docRef, { activities: newActivities, updatedAt: new Date().toISOString() });
  }
}
