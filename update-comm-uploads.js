const fs = require('fs');

let code = fs.readFileSync('apps/web/components/CommunicationPanel.tsx', 'utf8');

// 1. Add Paperclip & Loader2 imports
if (!code.includes('Paperclip')) {
  code = code.replace(
    `import { ExternalLink, RefreshCw, Plus, Search, MessageSquare, Mail, PhoneCall } from 'lucide-react';`,
    `import { ExternalLink, RefreshCw, Plus, Search, MessageSquare, Mail, PhoneCall, Paperclip, Loader2 } from 'lucide-react';\nimport { uploadMultipleAttachments } from '@/lib/attachmentService';`
  );
}

// 2. Add state
const stateTarget = `  const [composeContent, setComposeContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);`;
const stateReplacement = `  const [composeContent, setComposeContent] = useState('');
  const [activityFiles, setActivityFiles] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);`;
if (!code.includes('activityFiles')) {
  code = code.replace(stateTarget, stateReplacement);
}

// 3. Update Log Activity function
const saveTarget = `                     try {
                        // Log manually directly to activities - unified system reads both
                        await addDoc(collection(db, 'tenants', tenant.id, 'activities'), {`;
const saveReplacement = `                     try {
                        let uploadedAttachments: any[] = [];
                        if (activityFiles.length > 0) {
                           uploadedAttachments = await uploadMultipleAttachments(tenant.id, activityFiles);
                        }

                        // Log manually directly to activities - unified system reads both
                        await addDoc(collection(db, 'tenants', tenant.id, 'activities'), {
                           attachments: uploadedAttachments,`;

if (!code.includes('attachments: uploadedAttachments,')) {
  code = code.replace(saveTarget, saveReplacement);
}

// 4. Reset file state inside Log Activity routine
const resetTarget = `                       setIsComposing(false);
                       setComposeSubject('');
                       setComposeContent('');
                       loadTimeline();`;
const resetReplacement = `                       setIsComposing(false);
                       setComposeSubject('');
                       setComposeContent('');
                       setActivityFiles([]);
                       loadTimeline();`;
if (!code.includes('setActivityFiles([]);')) {
  code = code.replace(resetTarget, resetReplacement);
}

// 5. Cancel reset
const cancelTarget = `                 onClick={() => { setIsComposing(false); setComposeSubject(''); setComposeContent(''); }}`;
const cancelReplacement = `                 onClick={() => { setIsComposing(false); setComposeSubject(''); setComposeContent(''); setActivityFiles([]); }}`;
code = code.replace(cancelTarget, cancelReplacement);

// 6. Add UI input for paperclip near "Log Activity"
const uiTarget = `              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                 <RichTextEditor 
                 content={composeContent}
                 onChange={(html) => setComposeContent(html)}
                 placeholder="Detailed notes or minutes from the interaction (supports rich text)..."
                 />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>`;

const uiReplacement = `              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                 <RichTextEditor 
                 content={composeContent}
                 onChange={(html) => setComposeContent(html)}
                 placeholder="Detailed notes or minutes from the interaction (supports rich text)..."
                 />
                 
                 <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                   <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', width: 'fit-content', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                     <Paperclip size={14} /> Add Attachments
                     <input type="file" multiple onChange={(e) => {
                        if (e.target.files) {
                           setActivityFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                        }
                     }} style={{ display: 'none' }} />
                   </label>
                   {activityFiles.length > 0 && (
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                       {activityFiles.map((f, i) => (
                         <div key={i} style={{ background: 'var(--brand-50)', color: 'var(--brand-600)', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                           {f.name}
                           <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActivityFiles(activityFiles.filter((_, idx) => idx !== i)); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'currentcolor', opacity: 0.6 }}>×</button>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>`;

if (!code.includes('setActivityFiles(prev =>')) {
  code = code.replace(uiTarget, uiReplacement);
}

// 7. Map attachments on detailed pane view
const detailViewTarget = `              {selected.body || selected.snippet ? (
                <div 
                  className="prose prose-sm prose-slate max-w-none" 
                  dangerouslySetInnerHTML={{ __html: selected.body || selected.snippet || '' }} 
                />
              ) : (
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No content logged for this activity.</span>
                </div>
              )}`;

const detailViewReplacement = `              {selected.body || selected.snippet ? (
                <div 
                  className="prose prose-sm prose-slate max-w-none" 
                  dangerouslySetInnerHTML={{ __html: selected.body || selected.snippet || '' }} 
                />
              ) : (
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No content logged for this activity.</span>
                </div>
              )}
              
              {(selected as any).attachments && (selected as any).attachments.length > 0 && (
                 <div style={{ marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>Attachments</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                       {(selected as any).attachments.map((a: any, i: number) => (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--brand-500)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '8px 14px', borderRadius: 8, textDecoration: 'none', transition: 'background 0.15s' }}>
                             <Paperclip size={14} />
                             {a.name}
                          </a>
                       ))}
                    </div>
                 </div>
              )}`;

if (!code.includes('(selected as any).attachments &&')) {
  code = code.replace(detailViewTarget, detailViewReplacement);
}

fs.writeFileSync('apps/web/components/CommunicationPanel.tsx', code);
console.log('Updated CommunicationPanel to support multi-file uploads');
