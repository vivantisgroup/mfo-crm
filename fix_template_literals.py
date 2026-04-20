import re

with open('c:/MFO-CRM/apps/web/app/(dashboard)/communications/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix divey
text = re.sub(
    r'<divey=\{p\.id\} title=\{p\.name\} className=\{w-3 h-3 rounded-full border border-white bg--500 shadow-sm\} />',
    r'<div key={p.id} title={p.name} className={w-3 h-3 rounded-full border border-white bg--500 shadow-sm} />',
    text
)

# Fix span key
text = re.sub(
    r'<span key=\{pill\.id\} className=\{inline-flex items-center gap-1 px-2 py-0\.5 rounded text-\[10px\] font-medium bg--100 text--800\}>\s*\{pill\.name\}\s*<button onClick=\{async \(\) => \{\s*const newIds = selectedLog\.pillIds\?\.filter\(id => id !== pill\.id\) \|\| \[\];\s*selectedLog\.pillIds = newIds;\s*setLogs\(prev => \[\.\.\.prev\]\);\s*const docRef = \(await import\(\'firebase/firestore\'\)\)\.doc\(\(await import\(\'@/lib/firebase\'\)\)\.db, \'users\', user!\.uid, \'email_logs\', selectedLog\.id\);\s*\(await import\(\'firebase/firestore\'\)\)\.updateDoc\(docRef, \{ pillIds: newIds \}\);\s*\}\} className=\{text--600 hover:text--900\}>',
    r'<span key={pill.id} className={inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg--100 text--800}>\n                                  {pill.name}\n                                  <button onClick={async () => {\n                                      const newIds = selectedLog.pillIds?.filter(id => id !== pill.id) || [];\n                                      selectedLog.pillIds = newIds;\n                                      setLogs(prev => [...prev]);\n                                      const docRef = (await import(\'firebase/firestore\')).doc((await import(\'@/lib/firebase\')).db, \'users\', user!.uid, \'email_logs\', selectedLog.id);\n                                      (await import(\'firebase/firestore\')).updateDoc(docRef, { pillIds: newIds });\n                                  }} className={	ext--600 hover:text--900}>',
    text
)

with open('c:/MFO-CRM/apps/web/app/(dashboard)/communications/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done!')
