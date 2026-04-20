import re

with open('apps/web/app/(dashboard)/platform/crm/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace TABS definition robustly
text = re.sub(
    r'(const TABS = \[.*?\];)',
    r'''const TABS = [
 {id:'dashboard', icon:'??', label:'Dashboard'},
 {id:'pipeline', icon:'??', label:'Pipeline', count: opps.filter(o=>OPEN_STAGES.includes(o.stage)).length},
 {id:'organizations', icon:'??', label:'Entities', count: orgs.length},
 {id:'activities', icon:'??', label:'Activities', count: activities.length},
 {id:'teams', icon:'??', label:'Operations', count: teams.length},
 {id:'reports', icon:'??', label:'Reports'},
 ];''',
    text,
    flags=re.DOTALL
)

with open('apps/web/app/(dashboard)/platform/crm/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("TABS fixed.")
