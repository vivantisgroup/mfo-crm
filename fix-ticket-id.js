const fs = require('fs');

let code = fs.readFileSync('apps/web/lib/supportService.ts', 'utf8');

const oldCreateTicket = `export async function createTicket(entry: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'slaDeadline' | 'slaBreached' | 'responses' | 'activities'>): Promise<Ticket> {
  const now = new Date().toISOString();
  
  const fullEntry: Omit<Ticket, 'id'> = {
    ...entry,
    createdAt: now,
    updatedAt: now,
    slaDeadline: calculateSLA(entry.priority),
    slaBreached: false,
    responses: [],
    activities: [{ type: 'system', title: 'Ticket created', timestamp: now }]
  };
  
  const docRef = await addDoc(collection(db, 'platform_tickets'), fullEntry);
  return { id: docRef.id, ...fullEntry };
}`;

const newCreateTicket = `export async function createTicket(entry: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'slaDeadline' | 'slaBreached' | 'responses' | 'activities'>): Promise<Ticket> {
  const now = new Date().toISOString();
  
  // Generate user-friendly Ticket ID: [TENANT_PREFIX]-[RANDOM_4_DIGIT]
  const prefix = entry.tenantName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'SUP';
  const seq = String(Math.floor(Math.random() * 9000) + 1000); // 4-digit number
  const ticketId = \`\${prefix}-\${seq}\`;

  const fullEntry: Omit<Ticket, 'id'> = {
    ...entry,
    createdAt: now,
    updatedAt: now,
    slaDeadline: calculateSLA(entry.priority),
    slaBreached: false,
    responses: [],
    activities: [{ type: 'system', title: \`Ticket \${ticketId} formally provisioned\`, timestamp: now }]
  };
  
  await setDoc(doc(db, 'platform_tickets', ticketId), fullEntry);
  return { id: ticketId, ...fullEntry };
}`;

if (code.includes(`await addDoc(collection(db, 'platform_tickets'), fullEntry);`)) {
  code = code.replace(oldCreateTicket, newCreateTicket);
}

// Make sure setDoc is imported from firebase/firestore
if (!code.includes('setDoc')) {
  code = code.replace(`import { collection, query, orderBy, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';`, `import { collection, query, orderBy, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';`);
}

fs.writeFileSync('apps/web/lib/supportService.ts', code);
console.log('Fixed ticket id generation');
