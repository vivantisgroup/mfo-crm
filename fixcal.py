import io, os
filepath = 'apps/web/app/(dashboard)/calendar/page.tsx'
with io.open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace CRM redirection with setPreviewItem
target1 = "if (ev.type === 'task') { router.push('/tasks'); } else if (ev.type === 'activity') { router.push('/activities'); } else { toast.info(`Navigate to CRM to view: ${ev.type}`); }"
text = text.replace(target1, "setPreviewItem(ev);")

# Inject Modal right after <div className="flex h-[calc(100vh-var(--header-height))] bg-slate-50 overflow-hidden">
target2 = '<div className="flex h-[calc(100vh-var(--header-height))] bg-slate-50 overflow-hidden">'
modal_code = """<div className="flex h-[calc(100vh-var(--header-height))] bg-slate-50 overflow-hidden">
      
      {/* ITEM PREVIEW MODAL */}
      {previewItem && (
         <div className="fixed inset-0 z-[200] flex items-center justify-center font-sans">
            <div onClick={() => setPreviewItem(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in cursor-pointer" />
            <div className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-in">
               <button onClick={() => setPreviewItem(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full p-1.5 transition-colors">
                  <X size={16} strokeWidth={3} />
               </button>
               <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold bg-opacity-20`} style={{ backgroundColor: EVENT_COLORS[previewItem.type as keyof typeof EVENT_COLORS]?.bg || '#f1f5f9', color: EVENT_COLORS[previewItem.type as keyof typeof EVENT_COLORS]?.border || '#64748b' }}>
                     {previewItem.type === 'task' ? '✓' : '⚡'}
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{previewItem.type} Details</div>
                    <h2 className="text-lg font-extrabold text-slate-800 leading-tight">{previewItem.title}</h2>
                  </div>
               </div>
               
               <div className="space-y-4">
                  <div>
                     <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Scheduled Date</label>
                     <div className="text-sm font-semibold text-slate-700">{format(previewItem.date, 'EEEE, MMMM do, yyyy')}</div>
                  </div>
                  {previewItem.familyName && (
                     <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Associated Entity</label>
                        <div className="text-sm font-semibold text-indigo-600 flex items-center gap-2">🏛 {previewItem.familyName}</div>
                     </div>
                  )}
                  {previewItem.priority && (
                     <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Priority</label>
                        <div className={`text-xs font-bold px-2 py-1 rounded inline-block ${previewItem.priority === 'high' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>{previewItem.priority.toUpperCase()}</div>
                     </div>
                  )}
               </div>

               <div className="mt-8 flex gap-3">
                  <button onClick={() => { setPreviewItem(null); router.push(previewItem.type === 'task' ? '/tasks' : '/activities'); }} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-slate-800 text-white shadow-lg shadow-slate-200 hover:bg-slate-700 hover:-translate-y-0.5 transition-all outline-none">
                     Go to {previewItem.type === 'task' ? 'Tasks' : 'Activities'}
                  </button>
               </div>
            </div>
         </div>
      )}
"""
text = text.replace(target2, modal_code)

with io.open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
print("done")
