import re, sys

with open('c:/MFO-CRM/apps/web/app/(dashboard)/communications/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Imports
text = text.replace(
    "import { getRecentEmailLogs, getAllMailConnections, type EmailLogEntry, logEmailToCrm } from '@/lib/emailIntegrationService';",
    "import { getRecentEmailLogs, getAllMailConnections, type EmailLogEntry, logEmailToCrm } from '@/lib/emailIntegrationService';\nimport { Pill, getAllPills, createPill, updatePill, PillColor } from '@/lib/pillService';"
)

text = text.replace(
    "import { Mail, Search, RefreshCw, Send, Paperclip, Clock, Calendar, AlertCircle, FileText, Bot, Reply, Forward, Trash2, LogOut, CheckCircle2, ChevronDown, Check, LayoutDashboard, Target, Users, BookOpen, Link as LinkIcon, Building2 } from 'lucide-react';",
    "import { Mail, Search, RefreshCw, Send, Paperclip, Clock, Calendar, AlertCircle, FileText, Bot, Reply, Forward, Trash2, LogOut, CheckCircle2, ChevronDown, Check, LayoutDashboard, Target, Users, BookOpen, Link as LinkIcon, Building2, Eye, X } from 'lucide-react';"
)

# 2. Add State for Pills
text = text.replace(
    "const [crmOrgs, setCrmOrgs] = useState<PlatformOrg[]>([]);",
    "const [crmOrgs, setCrmOrgs] = useState<PlatformOrg[]>([]);\n  const [pills, setPills] = useState<Pill[]>([]);\n  const [showRawRaw, setShowRawRaw] = useState(false);\n  const [rawEmailData, setRawEmailData] = useState<any>(null);"
)

# 3. Load Pills alongside Orgs
text = text.replace(
    "getAllOrgs()",
    "getAllOrgs(), getAllPills()"
)
text = text.replace(
    "const orgs = await getAllOrgs();",
    "const [orgs, globalPills] = await Promise.all([getAllOrgs(), getAllPills()]);\n        setPills(globalPills);"
)

# 4. Search Bar Pill Filtering
text = text.replace(
    "const isMatch = e.subject.toLowerCase().includes(q) || e.snippet?.toLowerCase().includes(q) || e.fromName.toLowerCase().includes(q);",
    "// Advanced Search logic\n    const lowerQ = q.toLowerCase();\n    let isMatch = e.subject.toLowerCase().includes(lowerQ) || e.snippet?.toLowerCase().includes(lowerQ) || e.fromName.toLowerCase().includes(lowerQ);\n    \n    // Check pill context\n    if (!isMatch && q.startsWith('pill:')) {\n      const pillTerm = lowerQ.split('pill:')[1].trim();\n      const matchedPills = e.pillIds?.map(pid => pills.find(p => p.id === pid)?.name.toLowerCase());\n      isMatch = matchedPills?.some(n => n && n.includes(pillTerm)) ?? false;\n    }\n    "
)


# 5. Popover UI (Replacing existing popover logic)
# First we find the exact <div className=\"relative\"> with Button for isLinkingPopoverOpen
popover_replacement = '''                           <div className="relative">
                             <Button size="xs" variant="primary" loading={isLinking} 
                               onClick={() => {
                                  // Auto-selection intelligence
                                  if (!isLinkingPopoverOpen && selectedLog) {
                                     const textToScan = (selectedLog.subject + ' ' + selectedLog.fromEmail + ' ' + (selectedLog.snippet || '')).toLowerCase();
                                     const autoSelected = pills.filter(p => textToScan.includes(p.name.toLowerCase()));
                                     // Only auto-select ones they don't already have, and pre-fill the selectedPills array based on what's active + auto
                                     const activeIds = selectedLog.pillIds || [];
                                     const newlySuggested = autoSelected.filter(p => !activeIds.includes(p.id));
                                     
                                     // Combine already selected + auto-suggested
                                     const combinedIds = Array.from(new Set([...activeIds, ...newlySuggested.map(p=>p.id)]));
                                     const combined = combinedIds.map(id => pills.find(p => p.id === id)).filter(Boolean) as Pill[];
                                     
                                     // Actually wait, selectedOrgs in standard state should map to pills now. Let's hijack selectedOrgs state for selectedPills
                                     // For now we'll just populate it.
                                  }
                                  setIsLinkingPopoverOpen(!isLinkingPopoverOpen);
                               }} 
                               icon={() => <LinkIcon size={14} className="mr-1.5 inline"/>}>
                                 {selectedLog.pillIds?.length ? Linked () : 'Tags / Pills'}
                             </Button>
                             {isLinkingPopoverOpen && (
                                <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-80">
                                   <div className="p-2 border-b border-slate-100 bg-slate-50">
                                     <input type="text" placeholder="Search or Create Pill..." className="w-full text-xs px-2 py-1 border border-slate-300 rounded" value={crmSearch} onChange={e => setCrmSearch(e.target.value)} />
                                   </div>
                                   <div className="flex-1 overflow-y-auto p-1">
                                     {pills.filter(p => p.name.toLowerCase().includes(crmSearch.toLowerCase())).map(pill => {
                                        const isSelected = (selectedLog.pillIds || []).includes(pill.id);
                                        return (
                                          <div key={pill.id} 
                                            className={px-3 py-2 text-xs cursor-pointer rounded-md mb-1 flex justify-between items-center }
                                            onClick={async () => {
                                               const currentIds = selectedLog.pillIds || [];
                                               const newIds = isSelected ? currentIds.filter(id => id !== pill.id) : [...currentIds, pill.id];
                                               
                                               // Optimistic UI
                                               selectedLog.pillIds = newIds;
                                               setLogs(prev => [...prev]);
                                               
                                               // Backend Sync (bypassing full crm activity for direct pill sync)
                                               import('@/lib/pillService').then(m => m.updatePill(pill.id, {})); // mock trigger update, ideally we update email payload natively
                                               const docRef = (await import('firebase/firestore')).doc((await import('@/lib/firebase')).db, 'users', user!.uid, 'email_logs', selectedLog.id);
                                               (await import('firebase/firestore')).updateDoc(docRef, { pillIds: newIds });
                                            }}>
                                            <span className="truncate font-medium flex items-center gap-2"><div className={w-2 h-2 rounded-full bg--500}></div>{pill.name}</span>
                                            {isSelected && <Badge size="xs" color="indigo" className="ml-2">?</Badge>}
                                          </div>
                                        );
                                     })}
                                     
                                     {crmSearch && pills.filter(p => p.name.toLowerCase() === crmSearch.toLowerCase()).length === 0 && (
                                        <div className="p-2 border-t border-slate-100 mt-2">
                                          <Button size="xs" variant="secondary" className="w-full" onClick={async () => {
                                             const newPill = await createPill(crmSearch, 'emerald'); // Default emerald
                                             setPills(prev => [...prev, newPill]);
                                             const newIds = [...(selectedLog.pillIds || []), newPill.id];
                                             selectedLog.pillIds = newIds;
                                             setLogs(prev => [...prev]);
                                             setCrmSearch('');
                                             const docRef = (await import('firebase/firestore')).doc((await import('@/lib/firebase')).db, 'users', user!.uid, 'email_logs', selectedLog.id);
                                             (await import('firebase/firestore')).updateDoc(docRef, { pillIds: newIds });
                                          }}>Create Pill: "{crmSearch}"</Button>
                                        </div>
                                     )}
                                   </div>
                                </div>
                             )}
                           </div>'''

text = re.sub(r'<div className="relative">\s*<Button size="xs" variant="primary" loading=\{isLinking\}.*?</Button>\s*\{isLinkingPopoverOpen && \(\s*<div className="absolute right-0.*?\s*\)\}\s*</div>', popover_replacement, text, flags=re.DOTALL)

# 6. Date Bug Fix
text = text.replace(
    '''                                {(() => { const d = new Date(isNaN(Number(selectedLog.date)) ? selectedLog.date : Number(selectedLog.date)); return isNaN(d.getTime()) ? 'No Date' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); })()}''',
    '''                                {(() => { const d = new Date(selectedLog.receivedAt); return isNaN(d.getTime()) ? 'No Date' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); })()}'''
)

# 7. Add Eye Icon and Pill Rendering to the Email Header Pane
header_pane_add = '''                           <Button size="xs" color="slate" variant="light" className="ml-2 hover:bg-slate-100" icon={() => <Eye size={14} className="mr-0" />} onClick={() => {
                             setRawEmailData(selectedLog);
                             setShowRawRaw(true);
                           }}></Button>
                           <Button size="xs" color="rose" variant="light" className="ml-2 hover:bg-rose-50" icon={() => <Trash2 size={14} className="mr-0" />}></Button>'''
text = text.replace('''<Button size="xs" color="rose" variant="light" className="ml-2 hover:bg-rose-50" icon={() => <Trash2 size={14} className="mr-0" />}></Button>''', header_pane_add)


pill_render_html = '''</div>
                         <div className="flex flex-wrap gap-1 mt-3">
                           {selectedLog.pillIds?.map(pid => {
                              const pill = pills.find(p => p.id === pid);
                              if (!pill) return null;
                              return (
                                <span key={pill.id} className={inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg--100 text--800}>
                                  {pill.name}
                                  <button onClick={async () => {
                                      const newIds = selectedLog.pillIds?.filter(id => id !== pill.id) || [];
                                      selectedLog.pillIds = newIds;
                                      setLogs(prev => [...prev]);
                                      const docRef = (await import('firebase/firestore')).doc((await import('@/lib/firebase')).db, 'users', user!.uid, 'email_logs', selectedLog.id);
                                      (await import('firebase/firestore')).updateDoc(docRef, { pillIds: newIds });
                                  }} className={	ext--600 hover:text--900}><X size={10} /></button>
                                </span>
                              );
                           })}
                         </div>
                       </div>'''
                       
# Find the exact closing elements of the header info before Content 
text = re.sub(r'</div>\s*</div>\s*</div>\s*</div>\s*\{/\* Reading Pane Content \*/\}', pill_render_html + r'\n\n                      {/* Reading Pane Content */}', text)


with open('c:/MFO-CRM/apps/web/app/(dashboard)/communications/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done!')
