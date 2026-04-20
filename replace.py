import sys

with open('apps/web/app/(dashboard)/platform/crm/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = lines[:149] + [
'''  return (
  <div className="animate-fade-in flex flex-col absolute inset-0 bg-slate-50/50 z-0 overflow-hidden">
  
  <div className="px-8 py-6 bg-white border-b border-slate-200 shrink-0 flex items-start gap-4 shadow-sm z-10">
     <button onClick={onBack} className="p-2 mt-1 -ml-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"><ArrowLeft size={20} /></button>
     <div>
       <Title className="text-2xl font-black text-slate-900 flex items-center gap-3">
         {org.name}
         <Badge color="indigo" size="xs" className="font-bold shadow-sm border border-indigo-200">{STAGE_LABELS[org.stage].replace(/^.+ /,'')}</Badge>
         {org.tenantIds.length>0 && <Badge color="emerald" size="xs" className="font-bold border border-emerald-200">Linked to Tenant</Badge>}
       </Title>
       <Subtitle className="mt-2 flex items-center gap-3 text-sm text-slate-500 font-medium">
         <span className="flex items-center gap-1.5"><Globe size={14}/> {org.website ? <a href={org.website} target="_blank" className="hover:text-indigo-600 hover:underline">{org.website}</a> : 'No website'}</span>
         <span className="text-slate-300">|</span>
         <span className="flex items-center gap-1.5"><MapPin size={14}/> {org.country} {org.region ? \(\)\ : ''}</span>
         <span className="text-slate-300">|</span>
         <span className="flex items-center gap-1.5"><Building2 size={14}/> {ORG_SIZE_LABELS[org.size]}</span>
         <span className="text-slate-300">|</span>
         <span className="text-indigo-600 font-bold ml-2 text-xs uppercase tracking-wider">AUM {fmtAum(org.estAumUsd)}</span>
       </Subtitle>
     </div>
  </div>

  <SecondaryDock 
    tabs={[
      { id: 'info', label: 'Info', icon: '??' },
      { id: 'communications', label: 'Comms', icon: '??' },
      { id: 'contacts', label: 'Contacts', icon: '??', badge: contacts.length > 0 ? <span style={{ background: 'var(--brand-500)22', color: 'var(--brand-500)', fontSize: 10, padding: '2px 6px', borderRadius: 10, marginLeft: 6 }}>{contacts.length}</span> : null },
      { id: 'tenants', label: 'Tenants', icon: '??', badge: linkedSubs.length > 0 ? <span style={{ background: 'var(--brand-500)22', color: 'var(--brand-500)', fontSize: 10, padding: '2px 6px', borderRadius: 10, marginLeft: 6 }}>{linkedSubs.length}</span> : null }
    ]} 
    activeTab={tab} 
    onTabChange={(t) => setTab(t as any)}
    rightAccessory={
      <div className="flex gap-2 items-center">
        <Button size="xs" variant={editMode?'light':'secondary'} onClick={()=>{setEditMode(v=>!v);setEditMsg('');}}>
          {editMode?'? Cancel':'?? Edit Details'}
        </Button>
        <Button size="xs" variant="light" color="red" onClick={async () => {
          if (!window.confirm('Delete this organization?')) return;
          try { await deleteOrg(org.id); onUpdated(); onBack(); } catch (err: any) { alert(err.message); }
        }}>
          ??? Delete Record
        </Button>
      </div>
    }
  />

  <div className="flex-1 overflow-y-auto w-full relative">
  <div className="p-8 mx-auto xl:max-w-[1000px] w-full">
  
  {/* Edit form */}
  {editMode && tab==='info' && (
      <form onSubmit={saveOrgEdit} className="max-w-2xl bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 mx-auto">
      <div style={{ fontWeight:800, fontSize:14, marginBottom:16 }}>?? Edit Organization</div>
      {editMsg && <div style={{ marginBottom:14, padding:'9px 14px', borderRadius:8, fontSize:13, background:editMsg.startsWith('?')?'#22c55e15':'#ef444415', color:editMsg.startsWith('?')?'#22c55e':'#ef4444' }}>{editMsg}</div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
      <div style={{ gridColumn:'1/-1' }}><FieldLabel>Name *</FieldLabel><input required className="input w-full" value={editForm.name} onChange={ef('name')} /></div>
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

  {/* Info Tab */}
  {tab==='info' && !editMode && (
      <div className="mx-auto space-y-6 pb-12">
        {editMsg && <div style={{ marginBottom:16, padding:'9px 14px', borderRadius:8, fontSize:13, background:'#22c55e15', color:'#22c55e' }}>{editMsg}</div>}
        <Grid numItemsSm={2} numItemsLg={3} className="gap-6 w-full">
          <Card className="shadow-sm border-slate-200" decoration="left" decorationColor="indigo">
            <Text className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Estimated AUM</Text>
            <Metric className="text-indigo-600 font-extrabold tracking-tight">{fmtAum(org.estAumUsd)}</Metric>
          </Card>
          <Card className="shadow-sm border-slate-200" decoration="left" decorationColor="teal">
            <Text className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Deal Stage</Text>
            <Metric className="text-teal-600 font-extrabold tracking-tight capitalize">{STAGE_LABELS[org.stage].replace(/^.+ /,'')}</Metric>
          </Card>
          <Card className="shadow-sm border-slate-200" decoration="left" decorationColor="fuchsia">
            <Text className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Linked Tenants</Text>
            <Metric className="text-fuchsia-600 font-extrabold tracking-tight">{org.tenantIds.length}</Metric>
          </Card>
        </Grid>

        <Card className="shadow-sm border-slate-200 p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <Title className="text-slate-800 flex items-center gap-2 text-[15px]">
              <Building size={16} className="text-slate-400"/> General Information
            </Title>
          </div>
          <List className="px-6 py-2">
            <ListItem className="py-4 border-b border-slate-50">
              <span className="font-bold text-slate-500 text-xs tracking-wider uppercase">Website</span>
              <span className="font-semibold text-slate-800">{org.website ? <a href={org.website} target="_blank" className="text-indigo-600 hover:underline">{org.website}</a> : '—'}</span>
            </ListItem>
            <ListItem className="py-4 border-b border-slate-50">
              <span className="font-bold text-slate-500 text-xs tracking-wider uppercase">Assigned Rep</span>
              <span className="font-semibold text-slate-800">{org.assignedTo || '—'}</span>
            </ListItem>
            <ListItem className="py-4 border-b border-slate-50">
              <span className="font-bold text-slate-500 text-xs tracking-wider uppercase">Lead Tags</span>
              <span className="font-semibold text-slate-600 flex gap-2">
                {org.tags.length > 0 ? org.tags.map((t, i) => <Badge size="xs" color="gray" key={i}>{t}</Badge>) : '—'}
              </span>
            </ListItem>
            <ListItem className="py-4 text-xs">
              <span className="font-bold text-slate-500 tracking-wider uppercase">Internal ID</span>
              <span className="font-medium text-slate-400 font-mono tracking-wider bg-slate-50 px-2 py-1 rounded border border-slate-100">{org.id}</span>
            </ListItem>
          </List>
        </Card>

        {org.notes && (
          <Card className="shadow-sm border-slate-200">
            <Title className="mb-3 text-slate-800 text-sm font-bold flex items-center gap-2"><TextIcon size={16} className="text-amber-500"/> Internal Note</Title>
            <Text className="leading-relaxed font-medium text-slate-700 p-4 bg-amber-50 rounded-lg text-sm border border-amber-100/50">
              {org.notes}
            </Text>
          </Card>
        )}
      </div>
  )}

  {/* Comms */}
  {tab==='communications' && <div style={{ height:700, margin:'0 auto', borderRadius:16, overflow:'hidden', border:'1px solid var(--border)', boxShadow:'var(--shadow-sm)' }}><CommunicationPanel orgId={org.id} familyName={org.name} linkedRecordType="org" linkedRecordId={org.id} /></div>}

  {/* Contacts */}
  {tab==='contacts' && (
  <div className="mx-auto pb-12">
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
  <Title className="font-bold whitespace-nowrap">Associated Contacts ({contacts.length})</Title>
  <Button size="xs" variant="primary" onClick={()=>{setShowAddC(v=>!v);setContactMsg('');}}>{showAddC?'? Cancel':'+ Add Contact'}</Button>
  </div>
  {contactMsg && <div style={{ marginBottom:14, padding:'9px 14px', borderRadius:8, fontSize:13, background:contactMsg.startsWith('?')?'#22c55e15':'#ef444415', color:contactMsg.startsWith('?')?'#22c55e':'#ef4444' }}>{contactMsg}</div>}
  {showAddC && (
  <Card className="mb-6 shadow-sm border-slate-200 p-6">
  <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }} className="flex items-center gap-2 text-slate-800">?? New Contact Form</div>
  <form onSubmit={handleAddContact}>
  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
  <div><FieldLabel>Name *</FieldLabel><input required className="input w-full" value={nc.name} onChange={e=>setNc(p=>({...p,name:e.target.value}))} /></div>
  <div><FieldLabel>Email *</FieldLabel><input required type="email" className="input w-full" value={nc.email} onChange={e=>setNc(p=>({...p,email:e.target.value}))} /></div>
  <div><FieldLabel>Role / Title</FieldLabel><input className="input w-full" value={nc.role} onChange={e=>setNc(p=>({...p,role:e.target.value}))} placeholder="CEO / CIO" /></div>
  <div><FieldLabel>Phone</FieldLabel><input className="input w-full" value={nc.phone} onChange={e=>setNc(p=>({...p,phone:e.target.value}))} /></div>
  </div>
  <div style={{ display:'flex', gap:10, marginTop:20 }}>
  <Button type="button" variant="light" size="xs" onClick={()=>setShowAddC(false)}>Cancel</Button>
  <Button type="submit" variant="primary" size="xs" disabled={addingC||!nc.name||!nc.email}>{addingC?'…':'? Create Contact'}</Button>
  </div>
  </form>
  </Card>
  )}
  {contacts.length===0 ? (
  <div style={{ textAlign:'center', padding:'40px 20px', border:'1px dashed var(--border)', borderRadius:12, color:'var(--text-tertiary)' }}>No contacts established.</div>
  ) : (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {contacts.map(c=>(
  <Card key={c.id} className="p-5 shadow-sm border border-slate-200 bg-white hover:shadow-md transition-shadow relative overflow-hidden group">
  <div className="flex justify-between items-start">
    <div className="flex items-center gap-3 mb-3">
       <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-800 font-bold shadow-sm text-xs">
         {c.name.slice(0, 2).toUpperCase()}
       </span>
       <div>
         <div style={{ fontWeight:800, fontSize:15 }} className="text-slate-900 flex items-center gap-2">{c.name}</div>
         <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">{c.role}</div>
       </div>
    </div>
    {c.isPrimary && <Badge color="indigo" size="xs" className="font-bold border border-indigo-200">PRIMARY</Badge>}
  </div>
  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
    <div className="flex items-center gap-2 text-sm text-slate-600 font-medium"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg> {c.email}</div>
    {c.phone && <div className="flex items-center gap-2 text-sm text-slate-600 font-medium"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> {c.phone}</div>}
  </div>
  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
    <Button variant="light" color="red" size="xs" onClick={async () => {
    if (!window.confirm('Delete contact constraint?')) return;
    try { await deleteContact(c.id); setContacts(p => p.filter(x => x.id !== c.id)); setContactMsg('? Contact wiped.'); }
    catch (err: any) { setContactMsg(\? \\); }
    }} className="bg-white shadow border border-rose-100">??? Remove</Button>
  </div>
  </Card>
  ))}
  </div>
  )}
  </div>
  )}

  {/* Tenants */}
  {tab==='tenants' && (
  <div className="mx-auto pb-12">
  {linkedSubs.length===0 ? (
  <div style={{ textAlign:'center', padding:'40px 20px', border:'1px dashed var(--border)', borderRadius:12, color:'var(--text-tertiary)' }}>No production tenants currently mapped to this organization.</div>
  ) : linkedSubs.map(sub=>{
  const sc: Record<string,string> = { trial:'amber', active:'emerald', past_due:'rose', suspended:'slate', cancelled:'slate' };
  return (
  <Card key={sub.tenantId} className="mb-4 shadow-sm border-slate-200 p-6 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4 hover:shadow-md transition-shadow">
  <div>
    <div className="font-black text-slate-900 text-lg flex items-center gap-3">
      {sub.tenantName}
      <Badge color={sc[sub.status] as any || 'gray'} size="xs" className="font-bold uppercase tracking-wider shadow-sm">{sub.status}</Badge>
    </div>
    <div className="font-mono text-xs text-slate-400 mt-1">{sub.tenantId}</div>
    <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-slate-600">
      <div className="bg-slate-50 px-3 py-1.5 rounded border border-slate-100"><span className="text-slate-400 uppercase tracking-widest mr-1">Plan:</span> {sub.planId}</div>
      <div className="bg-slate-50 px-3 py-1.5 rounded border border-slate-100"><span className="text-slate-400 uppercase tracking-widest mr-1">Seats:</span> {sub.licensedSeats} seats</div>
      <div className="bg-slate-50 px-3 py-1.5 rounded border border-slate-100"><span className="text-slate-400 uppercase tracking-widest mr-1">Started:</span> {sub.subscriptionStart?.slice(0,10)}</div>
    </div>
  </div>
  </Card>
  );
  })}
  </div>
  )}
  </div>
  </div>
  </div>
  );
}
'''
] + lines[287:]

with open('apps/web/app/(dashboard)/platform/crm/page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('Replaced successfully')
