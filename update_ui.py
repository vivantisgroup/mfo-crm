import re

def update_file():
    with open(r'c:\MFO-CRM\apps\web\app\(dashboard)\communications\page.tsx', 'r', encoding='utf-8') as f:
        text = f.read()

    # 1. Add crmService imports if not present
    if "getPlatformOrgs" not in text:
        text = text.replace("import { getRecentEmailLogs", "import { getPlatformOrgs, type PlatformOrg } from '@/lib/crmService';\nimport { getRecentEmailLogs")

    # 2. Add React state for orgs
    if "const [crmOrgs" not in text:
        state_injection = """  const [crmOrgs, setCrmOrgs] = useState<PlatformOrg[]>([]);
  const [isLinkingPopoverOpen, setIsLinkingPopoverOpen] = useState(false);
  const [selectedOrgs, setSelectedOrgs] = useState<PlatformOrg[]>([]);
  const [crmSearch, setCrmSearch] = useState('');"""
        text = text.replace("const [isLinking, setIsLinking] = useState(false);", "const [isLinking, setIsLinking] = useState(false);\n" + state_injection)

    # 3. Add useEffect to fetch orgs
    if "getPlatformOrgs(" not in text:
        fetch_injection = """  // Fetch CRM records for the popover
  useEffect(() => {
    if (user?.tenantId) {
      getPlatformOrgs(user.tenantId).then(data => setCrmOrgs(data)).catch(console.error);
    }
  }, [user]);"""
        text = text.replace("const fetchLogs = async () => {", fetch_injection + "\n\n  const fetchLogs = async () => {")

    # 4. Modify Link To Record button logic inside Render right pane
    old_button_logic = """<Button size="xs" variant="primary" loading={isLinking} onClick={async () => {
                           setIsLinking(true);
                           if (user) { await logEmailToCrm(user.uid, selectedLog, 'client_123', 'John Doe'); }
                           setIsLinking(false);
                           showToast('Saved to CRM');
                         }} icon={() => <LinkIcon size={14} className="mr-1.5 inline"/>}>
                             Link to Record
                         </Button>"""

    new_button_logic = """<div className="relative">
                           <Button size="xs" variant="primary" loading={isLinking} 
                             onClick={() => setIsLinkingPopoverOpen(!isLinkingPopoverOpen)} 
                             icon={() => <LinkIcon size={14} className="mr-1.5 inline"/>}>
                               {selectedLog.linkedRecordIds?.length ? `Linked (${selectedLog.linkedRecordIds.length})` : 'Link to Record'}
                           </Button>
                           {isLinkingPopoverOpen && (
                              <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-80">
                                 <div className="p-2 border-b border-slate-100 bg-slate-50">
                                   <input type="text" placeholder="Search Orgs..." className="w-full text-xs px-2 py-1 border border-slate-300 rounded" value={crmSearch} onChange={e => setCrmSearch(e.target.value)} />
                                 </div>
                                 <div className="flex-1 overflow-y-auto p-1">
                                   {crmOrgs.filter(o => o.name.toLowerCase().includes(crmSearch.toLowerCase())).slice(0, 15).map(org => {
                                      const isSelected = selectedOrgs.some(s => s.id === org.id);
                                      return (
                                        <div key={org.id} 
                                          className={`px-3 py-2 text-xs cursor-pointer rounded-md mb-1 flex justify-between items-center ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                          onClick={() => {
                                             if (isSelected) setSelectedOrgs(prev => prev.filter(s => s.id !== org.id));
                                             else setSelectedOrgs(prev => [...prev, org]);
                                          }}>
                                          <span className="truncate font-medium">{org.name}</span>
                                          {isSelected && <Badge size="xs" color="indigo" className="ml-2">✓</Badge>}
                                        </div>
                                      );
                                   })}
                                   {crmOrgs.length === 0 && <div className="p-3 text-xs text-slate-400 text-center">No CRM records found.</div>}
                                 </div>
                                 <div className="p-2 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                                     <Button size="xs" variant="secondary" onClick={() => setIsLinkingPopoverOpen(false)}>Cancel</Button>
                                     <Button size="xs" variant="primary" disabled={selectedOrgs.length === 0} loading={isLinking} onClick={async () => {
                                        setIsLinking(true);
                                        if (user && selectedLog) {
                                          await logEmailToCrm(user.uid, selectedLog, selectedOrgs);
                                          
                                          // Optimistic injection into local state map so UI updates instantly
                                          selectedLog.linkedRecordIds = selectedOrgs.map(o => o.id);
                                          selectedLog.linkedRecordNames = selectedOrgs.map(o => o.name);
                                          
                                          setIsLinkingPopoverOpen(false);
                                          setSelectedOrgs([]);
                                          showToast('Saved to CRM successfully');
                                        }
                                        setIsLinking(false);
                                     }}>Save Links</Button>
                                 </div>
                              </div>
                           )}
                         </div>"""
    
    # We must handle escaping safely. Just simple replace first occurrence
    text = text.replace(old_button_logic, new_button_logic)

    # 5. Render Pill badges beneath subject inside Reading Pane
    old_reading_subject = """<div className="text-[17px] font-bold text-slate-900 leading-snug tracking-tight pr-4">
                           {selectedLog.subject || '(No Subject)'}
                         </div>"""
    new_reading_subject = """<div className="text-[17px] font-bold text-slate-900 leading-snug tracking-tight pr-4 flex flex-col gap-1">
                           <span>{selectedLog.subject || '(No Subject)'}</span>
                           {(selectedLog.linkedRecordNames || []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {selectedLog.linkedRecordNames!.map((name, i) => (
                                  <Badge key={i} size="xs" color="emerald" className="border border-emerald-200 shadow-sm">{name}</Badge>
                                ))}
                              </div>
                           )}
                         </div>"""
    text = text.replace(old_reading_subject, new_reading_subject)

    # 6. Render Pill badges on List items (Middle Pane)
    old_list_subject = """</div>
                              <span className="text-xs font-semibold text-slate-800 truncate pr-2 tracking-tight">
                                {log.subject || '(No Subject)'}
                              </span>
                              <span className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 pr-1 mt-0.5">"""
    new_list_subject = """</div>
                              <span className="text-xs font-semibold text-slate-800 truncate pr-2 tracking-tight flex items-center gap-1.5">
                                {log.subject || '(No Subject)'}
                                {(log.linkedRecordNames?.length ?? 0) > 0 && (
                                   <Badge size="xs" color="emerald" className="scale-75 origin-left">Linked CRM</Badge>
                                )}
                              </span>
                              <span className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 pr-1 mt-0.5">"""
    text = text.replace(old_list_subject, new_list_subject)

    with open(r'c:\MFO-CRM\apps\web\app\(dashboard)\communications\page.tsx', 'w', encoding='utf-8') as f:
        f.write(text)
    print("UI rewrite completed successfully")

update_file()
