with open('apps/web/app/(dashboard)/platform/catalog-explorer/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

import re
old_text = re.search(r'onTabChange=\{\(id\) => setTab\(id as any\)\}\s*/>.*\{tab === \'explorer\'    && <DatabaseExplorer />\}', text, re.DOTALL)

if old_text:
    new_text = "onTabChange={(id) => setTab(id as any)}\n      />\n      <div className=\"page-wrapper animate-fade-in w-full h-full flex flex-col flex-1 px-4 lg:px-6 pt-6 pb-12 overflow-y-auto\">\n        {tab === 'explorer'    && <DatabaseExplorer />}"
    text = text.replace(old_text.group(0), new_text)
    with open('apps/web/app/(dashboard)/platform/catalog-explorer/page.tsx', 'w', encoding='utf-8') as f:
        f.write(text)
