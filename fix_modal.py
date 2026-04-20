import re, sys
with open('c:/MFO-CRM/apps/web/app/(dashboard)/communications/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add Modal
modal_jsx = '''

      {/* Raw Email Data Modal */}
      {showRawRaw && rawEmailData && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800">Raw Email Header JSON</h3>
              <button onClick={() => setShowRawRaw(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh] bg-slate-900 text-emerald-400 font-mono text-xs">
              <pre>{JSON.stringify(rawEmailData, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
'''
# Replace the exact last 4 lines which are usually:
#     </div>\n  );\n}
text = re.sub(r'</div>\s*\);\s*}\s*$', modal_jsx, text)

# Render pills in message list
list_pill_inject = '''<div className="flex justify-between items-center mt-1">
                                <span className={	ext-xs }>
                                  {log.toEmails.length > 0 ? To:  : 'No Recipient'}
                                </span>
                                {log.pillIds && log.pillIds.length > 0 && (
                                   <div className="flex -space-x-1">
                                     {log.pillIds.slice(0,3).map(pid => {
                                        const p = pills.find(px => px.id === pid);
                                        if (!p) return null;
                                        return <divey={p.id} title={p.name} className={w-3 h-3 rounded-full border border-white bg--500 shadow-sm} />
                                     })}
                                   </div>
                                )}
                              </div>'''
text = re.sub(r'<div className="text-xs text-slate-400 truncate mt-1">\s*\{log\.toEmails\.length > 0 \? To: \$\{log\.toEmails\[0\]\} : \'No Recipient\'\}\s*</div>', list_pill_inject, text)

with open('c:/MFO-CRM/apps/web/app/(dashboard)/communications/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done!')
