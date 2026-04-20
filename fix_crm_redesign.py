import re

with open('apps/web/app/(dashboard)/platform/crm/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace TABS definition
code = code.replace(
    "const TABS = [\n  {id:'dashboard', icon:'??', label:'Dashboard'},\n  {id:'pipeline', icon:'??', label:'Pipeline', count: opps.filter(o=>OPEN_STAGES.includes(o.stage)).length},\n  {id:'organizations', icon:'??', label:'Organizations', count: orgs.length},\n  {id:'contacts', icon:'??', label:'Contacts', count: contacts.length},\n  {id:'activities', icon:'??', label:'Activities', count: activities.length},\n  {id:'teams', icon:'??', label:'Teams', count: teams.length},\n  {id:'reports', icon:'??', label:'Reports'},\n  ];",
    "const TABS = [\n  {id:'dashboard', icon:'??', label:'Dashboard'},\n  {id:'entities', icon:'??', label:'Entities', count: orgs.length},\n  {id:'pipeline', icon:'??', label:'Pipeline', count: opps.filter(o=>OPEN_STAGES.includes(o.stage)).length},\n  {id:'activities', icon:'??', label:'Activities', count: activities.length},\n  {id:'teams', icon:'??', label:'Teams', count: teams.length},\n  {id:'reports', icon:'??', label:'Reports'},\n];\n  const [subTab, setSubTab] = useState('organizations');\n  const ENTITY_TABS = [{id:'organizations', label:'Organizations', badge: orgs.length}, {id:'contacts', label:'Global Contacts', badge: contacts.length}];"
)

# Replace SubTab render
code = code.replace(
    "<SecondaryDock \n  tabs={TABS.map(t => ({ id: t.id, label: t.label, icon: t.icon, badge: t.count !== undefined ? <span style={{ background: 'var(--brand-500)22', color: 'var(--brand-500)', fontSize: 10, padding: '2px 6px', borderRadius: 10, marginLeft: 6 }}>{t.count}</span> : null }))} \n  activeTab={mainTab} \n  onTabChange={(id) => setMainTab(id as MainTab)} \n  />",
    "<SecondaryDock \n  tabs={TABS.map(t => ({ id: t.id, label: t.label, icon: t.icon, badge: t.count !== undefined ? <span style={{ background: 'var(--brand-500)22', color: 'var(--brand-500)', fontSize: 10, padding: '2px 6px', borderRadius: 10, marginLeft: 6 }}>{t.count}</span> : null }))} \n  activeTab={mainTab} \n  onTabChange={(id) => setMainTab(id as MainTab)} \n  />\n  {mainTab === 'entities' && (\n  <div className=\"bg-slate-50 border-b border-slate-200 px-6\">\n    <div className=\"flex items-center gap-6\">\n      {ENTITY_TABS.map(t => (\n        <button key={t.id} onClick={() => setSubTab(t.id)} className={py-2 px-1 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors }>{t.label} <span className=\"ml-1 bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full text-[9px]\">{t.badge}</span></button>\n      ))}\n    </div>\n  </div>\n  )}"
)

# Route entities sub-tabs
code = code.replace(
    "{mainTab==='organizations' && <OrgListTab orgs={orgs} onOpen={openOrg} />}",
    "{mainTab==='entities' && subTab==='organizations' && <OrgListTab orgs={orgs} onOpen={openOrg} />}"
)
code = code.replace(
    "{mainTab==='contacts' && <ContactsTab contacts={contacts} orgs={orgs} onDeleted={load} />}",
    "{mainTab==='entities' && subTab==='contacts' && <ContactsTab contacts={contacts} orgs={orgs} onDeleted={load} />}"
)

# Edit Contact State in OrgDetail
if "const [editContact, setEditContact]" not in code:
    code = code.replace("const [addingC, setAddingC] = useState(false);", "const [addingC, setAddingC] = useState(false);\n  const [editContact, setEditContact] = useState<PlatformContact | null>(null);\n  const [ecForm, setEcForm] = useState({ name:'', email:'', role:'', phone:'', isPrimary:false, notes:'' });")

# OrgDetail UI Rewrite for unified dashboard
old_master_start = code.find("<SecondaryDock \n    tabs={[")
old_master_end = code.find("</div>\n  </div>\n  </div>\n  );\n}")

if old_master_start != -1 and old_master_end != -1:
    old_body = code[old_master_start:old_master_end]
    new_body = """
  {/* Edit Contact Modal */}
  {editContact && (
  <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
    <Card className="max-w-md w-full shadow-2xl bg-white border-0 outline-none ring-0">
      <Title>?? Edit Contact</Title>
      <form onSubmit={async (e) => {
        e.preventDefault();
        try {
          const patch = { name: ecForm.name, email: ecForm.email, role: ecForm.role, phone: ecForm.phone };
          await updateDoc(doc(db, 'platform_contacts', editContact.id), patch);
          setContacts(p => p.map(c => c.id === editContact.id ? { ...c, ...patch } : c));
          setEditContact(null);
          setContactMsg('? Contact updated.');
        } catch(err) { alert(err); }
      }} className="mt-4 flex flex-col gap-4">
        <div><Text className="text-xs font-bold text-slate-500 uppercase">Name</Text><TextInput required value={ecForm.name} onValueChange={v => setEcForm(p=>({...p,name:v}))} /></div>
        <div><Text className="text-xs font-bold text-slate-500 uppercase">Email</Text><TextInput required type="email" value={ecForm.email} onValueChange={v => setEcForm(p=>({...p,email:v}))} /></div>
        <div><Text className="text-xs font-bold text-slate-500 uppercase">Role</Text><TextInput value={ecForm.role} onValueChange={v => setEcForm(p=>({...p,role:v}))} /></div>
        <div><Text className="text-xs font-bold text-slate-500 uppercase">Phone</Text><TextInput value={ecForm.phone} onValueChange={v => setEcForm(p=>({...p,phone:v}))} /></div>
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="light" onClick={() => setEditContact(null)}>Cancel</Button>
          <Button type="submit" variant="primary">Save Changes</Button>
        </div>
      </form>
    </Card>
  </div>
  )}

  <div className="flex-1 w-full relative overflow-y-auto hidden-scrollbar px-6 lg:px-8 py-6 pb-24 h-full">
    {editMode && (
      <form onSubmit={saveOrgEdit} className="max-w-2xl bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 mx-auto">
      <div style={{ fontWeight:800, fontSize:14, marginBottom:16 }}>?? Edit Organization</div>
      {editMsg && <div style={{ marginBottom:14, padding:'9px 14px', borderRadius:8, fontSize:13, background:editMsg.startsWith('?')?'#22c55e15':'#ef444415', color:editMsg.startsWith('?')?'#22c55e':'#ef4444' }}>{editMsg}</div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
      <div style={{ gridColumn:'1/-1' }}><FieldLabel>Name *</FieldLabel><input required className="input w-full" value={editForm.name} onChange={ef('name')} /></div>
      <div style={{ gridColumn:'1/-1' }}><FieldLabel>Type / Category</FieldLabel><select className="input w-full" value={(editForm as any).orgType || 'client'} onChange={(e) => setEditForm(p => ({...p, orgType: e.target.value}))}>
        <option value="client">Client</option>
        <option value="prospect">Prospect</option>
        <option value="supplier">Supplier / Vendor</option>
        <option value="partner">Partner / Affiliate</option>
      </select></div>
      <div><FieldLabel>Country</FieldLabel><input className="input w-full" value={editForm.country} onChange={ef('country')} /></div>
      <div><FieldLabel>Size</FieldLabel><select className="input w-full" value={editForm.size} onChange={ef('size')}>{(Object.keys(ORG_SIZE_LABELS) as OrgSize[]).map(s=><option key={s} value={s}>{ORG_SIZE_LABELS[s]}</option>)}</select></div>
      <div><FieldLabel>Est. AUM (USD)</FieldLabel><input type="number" className="input w-full" value={editForm.estAumUsd} onChange={ef('estAumUsd')} /></div>
      <div><FieldLabel>Stage</FieldLabel><select className="input w-full" value={editForm.stage} onChange={ef('stage')}>{STAGES.map(s=><option key={s} value={s}>{STAGE_LABELS[s].replace(/^.+ /,'')}</option>)}</select></div>
      <div><FieldLabel>Assigned To</FieldLabel><input className="input w-full" value={editForm.assignedTo} onChange={ef('assignedTo')} /></div>
      <div><FieldLabel>Website</FieldLabel><input className="input w-full" value={editForm.website} onChange={ef('website')} /></div>
      <div style={{ gridColumn:'1/-1' }}><FieldLabel>Tags</FieldLabel><input className="input w-full" value={editForm.tags} onChange={ef('tags')} /></div>
      <div style={{ gridColumn:'1/-1' }}><FieldLabel>Notes</FieldLabel><textarea className="input w-full font-sans text-sm" rows={2} value={editForm.notes} onChange={ef('notes')} /></div>
      </div>
      <div style={{ display:'flex', gap:10, marginTop:16 }}>
      <Button type="button" variant="light" size="xs" onClick={()=>{setEditMode(false);setEditMsg('');}}>Cancel</Button>
      <Button type="submit" variant="primary" size="xs" disabled={savingEdit||!editForm.name}>{savingEdit?'…':'? Save Changes'}</Button>
      </div>
      </form>
    )}

    {!editMode && (
      <Grid numItemsLg={3} className="gap-6 h-[85vh] h-full items-stretch">
        {/* Left Column: Organization Details + Contacts + Tenants */}
        <Col numColSpanLg={1} className="flex flex-col gap-6 overflow-y-auto hidden-scrollbar pb-10 pr-2">
          
          <Card className="shadow-sm border-slate-200 p-0 overflow-hidden shrink-0">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <Title className="text-slate-800 text-sm flex items-center gap-2 uppercase tracking-widest font-bold">
                <Building size={16} className="text-slate-400"/> CRM Profile
              </Title>
              <Button size="xs" variant="light" color="indigo" onClick={()=>{setEditMode(true);setEditMsg('');}}>EDIT</Button>
            </div>
            <List className="px-5 py-2">
              <ListItem className="py-3 border-b border-slate-50"><span className="font-bold text-slate-500 text-[10px] tracking-widest uppercase">Type</span><Badge size="xs" color="blue" className="uppercase font-bold tracking-widest bg-blue-50">{(org as any).orgType || 'Client'}</Badge></ListItem>
              <ListItem className="py-3 border-b border-slate-50"><span className="font-bold text-slate-500 text-[10px] tracking-widest uppercase">Website</span><span className="font-semibold text-slate-800 text-xs truncate max-w-[150px]">{org.website ? <a href={org.website} target="_blank" className="text-indigo-600 hover:underline">{org.website}</a> : '—'}</span></ListItem>
              <ListItem className="py-3 border-b border-slate-50"><span className="font-bold text-slate-500 text-[10px] tracking-widest uppercase">Assigned Rep</span><span className="font-semibold text-slate-800 text-xs">{org.assignedTo || '—'}</span></ListItem>
              <ListItem className="py-3 border-b border-slate-50"><span className="font-bold text-slate-500 text-[10px] tracking-widest uppercase">Est AUM</span><span className="font-bold text-indigo-600 text-xs">{fmtAum(org.estAumUsd)}</span></ListItem>
            </List>
            {org.notes && <div className="p-4 bg-amber-50/50 border-t border-amber-100"><p className="text-xs text-slate-700 font-medium leading-relaxed">{org.notes}</p></div>}
          </Card>

          <Card className="shadow-sm border-slate-200 p-0 flex flex-col min-h-[250px] shrink-0">
             <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between sticky top-0 z-10">
               <Title className="text-slate-800 text-sm flex items-center gap-2 uppercase tracking-widest font-bold">?? Contacts ({contacts.length})</Title>
               <Button size="xs" variant="light" color="indigo" onClick={()=>{setShowAddC(v=>!v);setContactMsg('');}}>{showAddC ? 'CLOSE' : 'ADD'}</Button>
             </div>
             <div className="p-4 flex-1 overflow-y-auto">
               {showAddC && (
                 <div className="mb-4 bg-slate-50 p-3 rounded border border-slate-200">
                   <form onSubmit={handleAddContact} className="flex flex-col gap-2">
                     <TextInput size="xs" required placeholder="Name" value={nc.name} onValueChange={v=>setNc(p=>({...p,name:v}))} />
                     <TextInput size="xs" required type="email" placeholder="Email" value={nc.email} onValueChange={v=>setNc(p=>({...p,email:v}))} />
                     <TextInput size="xs" placeholder="Role (e.g. CEO)" value={nc.role} onValueChange={v=>setNc(p=>({...p,role:v}))} />
                     <TextInput size="xs" placeholder="Phone" value={nc.phone} onValueChange={v=>setNc(p=>({...p,phone:v}))} />
                     <Button type="submit" size="xs" variant="primary" className="mt-1" disabled={addingC}>Save Contact</Button>
                   </form>
                 </div>
               )}
               {contacts.length === 0 && <Text className="text-xs text-center text-slate-400 my-4">No contacts added.</Text>}
               <div className="flex flex-col gap-2">
                 {contacts.map(c => (
                   <div key={c.id} onClick={() => { setEcForm({ name: c.name, email: c.email, role: c.role, phone: c.phone || '', isPrimary: c.isPrimary, notes: c.notes }); setEditContact(c); }} className="p-3 bg-white border border-slate-100 rounded-lg hover:border-indigo-300 hover:shadow-sm cursor-pointer transition-all group relative">
                     <div className="font-bold text-sm text-slate-900 group-hover:text-indigo-700">{c.name} {c.isPrimary && <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded ml-1 uppercase border border-indigo-100">Primary</span>}</div>
                     <div className="text-xs text-slate-500 font-semibold uppercase tracking-widest mt-0.5">{c.role || 'No Role'}</div>
                     <div className="text-xs text-slate-400 mt-1 truncate">{c.email}</div>
                     <button className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 bg-white shadow rounded p-1 text-rose-500 hover:bg-rose-50 border border-slate-200" onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete contact?')) { deleteContact(c.id).then(()=>setContacts(p=>p.filter(x=>x.id!==c.id))); } }}><Trash2 size={12}/></button>
                   </div>
                 ))}
               </div>
             </div>
          </Card>

          <Card className="shadow-sm border-slate-200 p-0 overflow-hidden shrink-0">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
               <Title className="text-slate-800 text-sm flex items-center gap-2 uppercase tracking-widest font-bold">?? Tenants ({linkedSubs.length})</Title>
            </div>
            <div className="p-4">
               {linkedSubs.length===0 && <Text className="text-xs text-center text-slate-400 my-2">No linked tenants.</Text>}
               <div className="flex flex-col gap-2">
                 {linkedSubs.map(sub => (
                   <div key={sub.tenantId} className="p-3 border border-slate-100 bg-slate-50/50 rounded-lg">
                     <div className="flex justify-between items-start">
                       <span className="font-bold text-sm text-slate-800">{sub.tenantName}</span>
                       <Badge size="xs" color={sub.status==='active'?'emerald':'slate'} className="uppercase text-[9px]">{sub.status}</Badge>
                     </div>
                     <div className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">{sub.planId} · {sub.licensedSeats} Seats</div>
                   </div>
                 ))}
               </div>
            </div>
          </Card>

        </Col>

        {/* Right Column: Communications Hub */}
        <Col numColSpanLg={2} className="h-full flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
           <CommunicationPanel orgId={org.id} familyName={org.name} linkedRecordType="org" linkedRecordId={org.id} />
        </Col>
      </Grid>
    )}
"""
    code = code[:old_master_start] + new_body + code[old_master_end:]

# Add doc to imports if needed
if 'doc,' not in code and 'updateDoc' in new_body:
    code = code.replace("getFirestore,\n  collection,", "getFirestore,\n  collection, doc, updateDoc,")
    
with open('apps/web/app/(dashboard)/platform/crm/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Redesign applied.")
