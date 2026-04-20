const fs = require('fs');

// PART 1: Support Page (Reopen Tickets)
let supportCode = fs.readFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', 'utf8');

const resolveTarget = `  const handleResolve = async () => {
     await updateTicket(ticket.id, { status: 'resolved' });
     await addActivity(ticket.id, { type: 'system', title: 'Ticket resolved' });
  };`;

const resolveReplacement = `  const handleResolve = async () => {
     await updateTicket(ticket.id, { status: 'resolved' });
     await addActivity(ticket.id, { type: 'system', title: 'Ticket resolved' });
  };
  
  const handleReopen = async () => {
     await updateTicket(ticket.id, { status: 'open' });
     await addActivity(ticket.id, { type: 'system', title: 'Ticket reopened' });
  };`;

if (!supportCode.includes('handleReopen')) {
  supportCode = supportCode.replace(resolveTarget, resolveReplacement);
}

const resolveBtnTarget = `{ticket.status !== 'resolved' && <button className="btn btn-emerald btn-sm" style={{ background: '#10b981', color: 'white' }} onClick={handleResolve}>Resolve</button>}`;
const resolveBtnReplacement = `{ticket.status !== 'resolved' ? (
                   <button className="btn btn-emerald btn-sm" style={{ background: '#10b981', color: 'white' }} onClick={handleResolve}>Resolve</button>
                 ) : (
                   <button className="btn btn-outline btn-sm" style={{ color: 'var(--brand-500)', borderColor: 'var(--brand-500)' }} onClick={handleReopen}>Reopen</button>
                 )}`;

supportCode = supportCode.replace(resolveBtnTarget, resolveBtnReplacement);

// Fix double logic if they also check 'closed'
supportCode = supportCode.replace(
  `{ticket.status !== 'resolved' && ticket.status !== 'closed' && <button`,
  `{ticket.status !== 'resolved' && ticket.status !== 'closed' ? <button` // Might not match, but we replaced the exact target above.
)

fs.writeFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', supportCode);


// PART 2: Communication Panel (Edit Notes)
let commCode = fs.readFileSync('apps/web/components/CommunicationPanel.tsx', 'utf8');

// Import updateDoc
commCode = commCode.replace(
  `import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';`,
  `import { collection, query, where, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';`
);

// Add edit state
const stateTarget = `  const [composeContent, setComposeContent] = useState('');
  const [activityFiles, setActivityFiles] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);`;
const stateReplacement = `  const [composeContent, setComposeContent] = useState('');
  const [activityFiles, setActivityFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editActivityId, setEditActivityId] = useState<string | null>(null);`;
if (!commCode.includes('editActivityId')) {
  commCode = commCode.replace(stateTarget, stateReplacement);
}

// Update log activity logic
const saveLogicTarget = `                        // Log manually directly to activities - unified system reads both
                        await addDoc(collection(db, 'tenants', tenant.id, 'activities'), {
                           attachments: uploadedAttachments,
                           type: composeType,
                           subject: composeSubject.trim(),
                           snippet: composeContent.trim(),
                           linkedFamilyId: familyId || null,
                           linkedContactId: contactId || null,
                           linkedOrgId: orgId || null,
                           createdAt: new Date().toISOString(),
                           fromName: user?.email || 'System User',
                           direction: 'outbound'
                        });
                       setIsComposing(false);
                       setComposeSubject('');
                       setComposeContent('');
                       setActivityFiles([]);
                       loadTimeline();`;

const saveLogicReplacement = `                        // Combine newly uploaded files with any pre-existing ones we kept
                        const finalAttachments = [...existingAttachments, ...uploadedAttachments];

                        if (editActivityId) {
                           await updateDoc(doc(db, 'tenants', tenant.id, 'activities', editActivityId), {
                              type: composeType,
                              subject: composeSubject.trim(),
                              snippet: composeContent.trim(),
                              attachments: finalAttachments,
                           });
                        } else {
                           await addDoc(collection(db, 'tenants', tenant.id, 'activities'), {
                              attachments: finalAttachments,
                              type: composeType,
                              subject: composeSubject.trim(),
                              snippet: composeContent.trim(),
                              linkedFamilyId: familyId || null,
                              linkedContactId: contactId || null,
                              linkedOrgId: orgId || null,
                              createdAt: new Date().toISOString(),
                              fromName: user?.email || 'System User',
                              direction: 'outbound'
                           });
                        }
                       setIsComposing(false);
                       setComposeSubject('');
                       setComposeContent('');
                       setActivityFiles([]);
                       setExistingAttachments([]);
                       setEditActivityId(null);
                       loadTimeline();`;
if (!commCode.includes('if (editActivityId)')) {
  commCode = commCode.replace(saveLogicTarget, saveLogicReplacement);
}

// Reset Composer
const resetTarget = `onClick={() => { setIsComposing(false); setSelected(null); }}`;
const resetReplacement = `onClick={() => { setIsComposing(true); setEditActivityId(null); setExistingAttachments([]); setSelected(null); }}`;
if (commCode.includes(resetTarget)) {
  commCode = commCode.replace(resetTarget, resetReplacement);
} else {
  // alternative location
  commCode = commCode.replace(`onClick={() => { setIsComposing(true); setSelected(null); }}`, resetReplacement);
}

const cancelTarget = `setActivityFiles([]); }}`;
const cancelReplacement = `setActivityFiles([]); setEditActivityId(null); setExistingAttachments([]); }}`;
commCode = commCode.replace(cancelTarget, cancelReplacement);

// Render Edit button on Activity Details
const detailHeaderTarget = `<div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 8 }}>
                {getProviderIcon(selected.provider, selected.type)}
                {selected.type} Log
              </div>`;

const detailHeaderReplacement = `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                 <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 8 }}>
                   {getProviderIcon(selected.provider, selected.type)}
                   {selected.type} Log
                 </div>
                 {!selected.provider && (
                    <button onClick={() => {
                       setEditActivityId(selected.id);
                       setComposeSubject(selected.subject || '');
                       setComposeContent(selected.snippet || selected.body || '');
                       setComposeType(selected.type);
                       setExistingAttachments((selected as any).attachments || []);
                       setActivityFiles([]);
                       setIsComposing(true);
                    }} style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-500)', background: 'var(--brand-50)', border: '1px solid var(--brand-200)', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>
                       Edit Note
                    </button>
                 )}
              </div>`;
if (!commCode.includes('Edit Note')) {
  commCode = commCode.replace(detailHeaderTarget, detailHeaderReplacement);
}

const renderAttachmentsComposerTarget = `                   {activityFiles.length > 0 && (
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>`;

const renderAttachmentsComposerReplacement = `                   {(activityFiles.length > 0 || existingAttachments.length > 0) && (
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                       {existingAttachments.map((f, i) => (
                         <div key={'ext-'+i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                           📎 {f.name}
                           <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExistingAttachments(existingAttachments.filter((_, idx) => idx !== i)); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'currentcolor', opacity: 0.6 }}>×</button>
                         </div>
                       ))}`;

if (!commCode.includes('existingAttachments.map')) {
   commCode = commCode.replace(renderAttachmentsComposerTarget, renderAttachmentsComposerReplacement);
}

fs.writeFileSync('apps/web/components/CommunicationPanel.tsx', commCode);
console.log('Applied Edit Notes & Reopen Ticket functionality');
