const fs=require('fs'); 
let c=fs.readFileSync('c:/MFO-CRM/apps/web/app/(dashboard)/relationships/contacts/page.tsx','utf8'); 

c = c.replace(
  /<button className="btn btn-primary" onClick=\{\(\) => setShowCreate\(true\)\}>[^<]*<Plus size=\{16\} className="mr\.1\.5" \/>[^<]*New Contact[^<]*<\/button>/g, 
  `<div className="flex gap-3">
              <button className="btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold shadow-sm" onClick={() => setShowImport(true)}>
                <DownloadCloud size={16} className="mr-1.5 text-indigo-500" />
                Import
              </button>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                <Plus size={16} className="mr-1.5" />
                New Contact
              </button>
            </div>`
);

c = c.replace(
  /\) : \(\s*<>\s*<header className="mb-8 pt-6">/g,
  `) : showImport && tenantId ? (
      <div className="bg-white rounded-2xl shadow-sm border border-[var(--border)] h-[800px] max-h-[85vh] flex flex-col overflow-hidden relative mt-6 mb-6">
        <OdooMigrationUtility 
           tenantId={tenantId} 
           initialTargetType="contacts" 
           hideTargetSelection={true} 
           onClose={() => setShowImport(false)} 
        />
      </div>
    ) : (
      <>
        <header className="mb-8 pt-6">`
);

fs.writeFileSync('c:/MFO-CRM/apps/web/app/(dashboard)/relationships/contacts/page.tsx', c);
console.log('Fixed');
