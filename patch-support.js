const fs = require('fs');

let code = fs.readFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', 'utf8');

// 1. Swap Types for supportService types
const typesRegex = /type TicketStatus = [\s\S]*?activities: \{ type: string; title: string; timestamp: string \}\[\];\n\}/;
code = code.replace(typesRegex, `import { TicketStatus, TicketPriority, TicketCategory, TicketTeam, Ticket, createTicket, updateTicket, addActivity } from '@/lib/supportService';\nimport { getEmployees, Employee } from '@/lib/hrService';\n\ntype TicketQueue = 'unassigned' | 'my_tickets' | 'pending_client' | 'escalated' | 'all';`);

// 2. We need to add state for New Ticket and Edit Ticket
// find `export default function SupportPage() {`
const supportPageHeader = `export default function SupportPage() {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<TicketTeam | 'all'>('all');
  const [queueFilter, setQueueFilter] = useState<TicketQueue>('all');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'new' | 'edit'>('new');
  const [form, setForm] = useState<Partial<Ticket>>({});

  useEffect(() => {
    getEmployees().then(setEmployees);
  }, []);`;

code = code.replace(/export default function SupportPage\(\) \{[\s\S]*?const \[loading, setLoading\] = useState\(true\);/, supportPageHeader);

// 3. Render Support Form Component inside SupportPage
// Put it right before `if (selectedTicket) {`
const formComponent = `
  const handleSaveForm = async () => {
     if (formMode === 'new') {
        await createTicket({
           title: form.title || '',
           description: form.description || '',
           tenantName: form.tenantName || 'Internal',
           submittedBy: form.submittedBy || 'Anonymous',
           email: form.email || '',
           status: 'open',
           priority: form.priority || 'normal',
           category: form.category || 'technical',
           team: form.team || 'support',
           assignedTo: form.assignedTo || null,
           tags: []
        });
     } else {
        if (form.id) {
           await updateTicket(form.id, {
             title: form.title,
             description: form.description,
             tenantName: form.tenantName,
             priority: form.priority,
             category: form.category,
             team: form.team,
             assignedTo: form.assignedTo,
           });
           await addActivity(form.id, { type: 'system', title: 'Ticket particulars updated by Admin' });
        }
     }
     setShowForm(false);
  };

  if (showForm) {
     return (
       <div className="animate-fade-in" style={{ maxWidth: 800, margin: '0 auto', paddingBottom: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
             <button onClick={() => setShowForm(false)} className="btn btn-ghost btn-sm">← Back</button>
             <h2 style={{ fontSize: 24, fontWeight: 800 }}>{formMode === 'new' ? 'Provision New Ticket' : 'Edit Ticket Details'}</h2>
          </div>
          
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
             <div>
               <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Subject</label>
               <input type="text" className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.title || ''} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g., Cannot access billing portal" />
             </div>
             
             <div style={{ display: 'flex', gap: 16 }}>
               <div style={{ flex: 1 }}>
                 <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Tenant</label>
                 <input type="text" className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.tenantName || ''} onChange={e => setForm({...form, tenantName: e.target.value})} placeholder="Acme Corp" />
               </div>
               <div style={{ flex: 1 }}>
                 <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Requester Name</label>
                 <input type="text" className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.submittedBy || ''} onChange={e => setForm({...form, submittedBy: e.target.value})} placeholder="Jane Doe" disabled={formMode === 'edit'} />
               </div>
             </div>

             <div style={{ display: 'flex', gap: 16 }}>
               <div style={{ flex: 1 }}>
                 <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Category</label>
                 <select className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.category || 'technical'} onChange={e => setForm({...form, category: e.target.value as any})}>
                    <option value="technical">Technical</option>
                    <option value="billing">Billing</option>
                    <option value="compliance">Compliance</option>
                    <option value="integration">Integration</option>
                 </select>
               </div>
               <div style={{ flex: 1 }}>
                 <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Priority</label>
                 <select className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.priority || 'normal'} onChange={e => setForm({...form, priority: e.target.value as any})}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                 </select>
               </div>
             </div>

             <div style={{ display: 'flex', gap: 16 }}>
               <div style={{ flex: 1 }}>
                 <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Assign to Team</label>
                 <select className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.team || 'support'} onChange={e => setForm({...form, team: e.target.value as any})}>
                    <option value="support">Support</option>
                    <option value="engineering">Engineering</option>
                    <option value="operations">Operations</option>
                    <option value="compliance">Compliance</option>
                 </select>
               </div>
               <div style={{ flex: 1 }}>
                 <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Assignee</label>
                 <select className="input" style={{ width: '100%', padding: '10px 12px' }} value={form.assignedTo || ''} onChange={e => setForm({...form, assignedTo: e.target.value || null})}>
                    <option value="">Unassigned</option>
                    {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                 </select>
               </div>
             </div>

             <div>
               <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Description</label>
               <textarea className="input" rows={6} style={{ width: '100%', padding: '10px 12px', resize: 'vertical' }} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} placeholder="Details of the inquiry..." disabled={formMode === 'edit'} />
             </div>

             <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="btn btn-primary" onClick={handleSaveForm} disabled={!form.title || !form.tenantName}>
                   {formMode === 'new' ? 'Create Ticket' : 'Save Changes'}
                </button>
             </div>
          </div>
       </div>
     );
  }
`;

code = code.replace(`if (selectedTicket) {`, formComponent + `\n  if (selectedTicket) {`);

// 4. Update the "New Ticket" button on main page
code = code.replace(`<button className="btn btn-primary btn-sm">+ New Ticket</button>`, `<button className="btn btn-primary btn-sm" onClick={() => { setFormMode('new'); setForm({}); setShowForm(true); }}>+ New Ticket</button>`);

// 5. Update TicketDetailView to handle resolving and editing.
// I need TicketDetailView to take `employees`, `onEdit`, `onResolve`
// So I will change the signature of TicketDetailView
const oldTicketDetailSignature = `function TicketDetailView({ ticket, onBack }: { ticket: Ticket; onBack: () => void }) {`;
const newTicketDetailSignature = `function TicketDetailView({ ticket, employees, onBack, onEdit }: { ticket: Ticket; employees: Employee[]; onBack: () => void; onEdit: () => void }) {
  const handleResolve = async () => {
    await updateTicket(ticket.id, { status: 'resolved' });
    await addActivity(ticket.id, { type: 'system', title: 'Ticket marked as resolved' });
  };
  
  const handleUnassign = async () => {
    await updateTicket(ticket.id, { assignedTo: null });
  };`;

code = code.replace(oldTicketDetailSignature, newTicketDetailSignature);

code = code.replace(`<button className="btn btn-outline btn-sm">Edit Ticket</button>`, `<button className="btn btn-outline btn-sm" onClick={onEdit}>Edit Ticket</button>`);
code = code.replace(`<button className="btn btn-primary btn-sm">Resolve</button>`, `{ticket.status !== 'resolved' && <button className="btn btn-emerald btn-sm" style={{ background: '#10b981', color: 'white' }} onClick={handleResolve}>Resolve</button>}`);

// The Change Assignee button logic inside TicketDetailView
const changeAssignee = `<button className="btn btn-ghost btn-sm" style={{ padding: '2px 0', fontSize: 11, color: 'var(--brand-500)', marginTop: 4 }}>Change Assignee</button>`;
const newChangeAssignee = `
  <select value={ticket.assignedTo || ''} onChange={async (e) => {
    const val = e.target.value || null;
    await updateTicket(ticket.id, { assignedTo: val });
    await addActivity(ticket.id, { type: 'system', title: val ? \`Ticket assigned to \${val}\` : 'Ticket unassigned' });
  }} style={{ marginTop: 4, padding: '2px 4px', fontSize: 11, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-secondary)' }}>
    <option value="">Unassigned</option>
    {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
  </select>
`;
code = code.replace(changeAssignee, newChangeAssignee);

// Update caller in main component
code = code.replace(`return <TicketDetailView ticket={selectedTicket} onBack={() => setSelectedTicketId(null)} />;`, `return <TicketDetailView ticket={selectedTicket} employees={employees} onBack={() => setSelectedTicketId(null)} onEdit={() => { setFormMode('edit'); setForm(selectedTicket); setShowForm(true); setSelectedTicketId(null); }} />;`);


fs.writeFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', code);
console.log('Patched support page');
