const fs = require('fs');

let code = fs.readFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', 'utf8');

// 1. Add the import
if (!code.includes('uploadMultipleAttachments')) {
  code = code.replace(
    `import { getAllContacts } from '@/lib/crmService';`,
    `import { getAllContacts } from '@/lib/crmService';\nimport { uploadMultipleAttachments } from '@/lib/attachmentService';\nimport { Paperclip, Loader2 } from 'lucide-react';`
  );
}

// 2. Add state inside SupportPage
const stateTarget = `  const [form, setForm] = useState<Partial<Ticket>>({});`;
const stateReplacement = `  const [form, setForm] = useState<Partial<Ticket>>({});
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);`;
if (!code.includes('ticketFiles')) {
  code = code.replace(stateTarget, stateReplacement);
}

// 3. Update handleSaveForm
const saveTarget = `  const handleSaveForm = async () => {
     if (formMode === 'new') {
        await createTicket({`;
const saveReplacement = `  const handleSaveForm = async () => {
     setIsUploading(true);
     let uploadedAttachments = form.attachments || [];
     if (ticketFiles.length > 0) {
        try {
           const newAttachments = await uploadMultipleAttachments(form.tenantName || 'Internal', ticketFiles);
           uploadedAttachments = [...uploadedAttachments, ...newAttachments];
        } catch (e) {
           console.error("Failed to upload attachments", e);
        }
     }

     if (formMode === 'new') {
        await createTicket({
           attachments: uploadedAttachments,`;

if (!code.includes('const newAttachments = await uploadMultipleAttachments')) {
  code = code.replace(saveTarget, saveReplacement);
}

// Ensure update mode gets attachments too
const updateTarget = `           await updateTicket(form.id, {
             title: form.title,
             description: form.description,
             tenantName: form.tenantName,
             priority: form.priority,
             category: form.category,
             team: form.team,
             assignedTo: form.assignedTo,
           });`;
const updateReplacement = `           await updateTicket(form.id, {
             title: form.title,
             description: form.description,
             tenantName: form.tenantName,
             priority: form.priority,
             category: form.category,
             team: form.team,
             assignedTo: form.assignedTo,
             attachments: uploadedAttachments,
           });`;
if (!code.includes('attachments: uploadedAttachments,')) {
  code = code.replace(updateTarget, updateReplacement);
}

// Turn off uploading
const finishTarget = `     setShowForm(false);
  };`;
const finishReplacement = `     setIsUploading(false);
     setTicketFiles([]);
     setShowForm(false);
  };`;
if (!code.includes('setIsUploading(false);')) {
  code = code.replace(finishTarget, finishReplacement);
}

// 4. Reset form function
const newFormTarget = `onClick={() => { setFormMode('new'); setForm({}); setShowForm(true); }}`;
const newFormReplacement = `onClick={() => { setFormMode('new'); setForm({}); setTicketFiles([]); setShowForm(true); }}`;
code = code.replace(newFormTarget, newFormReplacement);

const editFormTarget = `onClick={onEdit}`;
const editFormReplacement = `onClick={() => { setFormMode('edit'); setForm(ticket); setTicketFiles([]); setShowForm(true); }}`;
code = code.replace(editFormTarget, editFormReplacement);

// 5. Add Input file UI to the Form
const uiTarget = `             <div>
               <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Description</label>
               <textarea className="input" rows={6} style={{ width: '100%', padding: '10px 12px', resize: 'vertical' }} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} placeholder="Details of the inquiry..." />
             </div>

             <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>`;

const uiReplacement = `             <div>
               <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>Description</label>
               <textarea className="input" rows={6} style={{ width: '100%', padding: '10px 12px', resize: 'vertical', marginBottom: 12 }} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} placeholder="Details of the inquiry..." />
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', display: 'block' }}>Attachments</label>
                  <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', width: 'fit-content', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                     <Paperclip size={14} /> Add Files
                     <input type="file" multiple onChange={(e) => {
                        if (e.target.files) {
                           setTicketFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                        }
                     }} style={{ display: 'none' }} />
                  </label>
                  {ticketFiles.length > 0 && (
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                        {ticketFiles.map((f, i) => (
                           <div key={i} style={{ background: 'var(--brand-50)', color: 'var(--brand-600)', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {f.name}
                              <button onClick={() => setTicketFiles(ticketFiles.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'currentcolor', opacity: 0.6 }}>×</button>
                           </div>
                        ))}
                     </div>
                  )}
                  {form.attachments && form.attachments.length > 0 && (
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                        {form.attachments.map((a, i) => (
                           <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                              📎 {a.name}
                           </div>
                        ))}
                     </div>
                  )}
               </div>
             </div>

             <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>`;

if (!code.includes('setTicketFiles(prev =>')) {
  code = code.replace(uiTarget, uiReplacement);
}

// 6. Update TicketDetailView to show attachments!
const detailViewMiddleColTarget = `            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {ticket.description}
            </div>
          </div>`;

const detailViewMiddleColReplacement = `            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {ticket.description}
              
              {ticket.attachments && ticket.attachments.length > 0 && (
                 <div style={{ marginTop: 16, borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Attached Files</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                       {ticket.attachments.map((a, i) => (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--brand-500)', background: 'var(--brand-50)', padding: '6px 10px', borderRadius: 6, textDecoration: 'none' }}>
                             <Paperclip size={12} />
                             {a.name}
                          </a>
                       ))}
                    </div>
                 </div>
              )}
            </div>
          </div>`;

if (!code.includes('ticket.attachments && ticket.attachments.length > 0')) {
  code = code.replace(detailViewMiddleColTarget, detailViewMiddleColReplacement);
}

// 7. Fix the "Save Changes" button disabled state
const buttonTarget = `<button className="btn btn-primary" onClick={handleSaveForm} disabled={!form.title || !form.tenantName}>
                   {formMode === 'new' ? 'Create Ticket' : 'Save Changes'}
                 </button>`;
const buttonReplacement = `<button className="btn btn-primary" onClick={handleSaveForm} disabled={!form.title || !form.tenantName || isUploading}>
                   {isUploading ? <Loader2 size={16} className="animate-spin" /> : (formMode === 'new' ? 'Create Ticket' : 'Save Changes')}
                 </button>`;
if (!code.includes('isUploading ? <Loader2')) {
  code = code.replace(buttonTarget, buttonReplacement);
}


fs.writeFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', code);
console.log("Updated SupportPage to support file uploads");
