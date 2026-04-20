import re

with open('c:/MFO-CRM/apps/web/app/(dashboard)/platform/finance/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove the Tab itself
text = re.sub(r'<Tab className[^>]*?>\s*People & Commissions\s*</Tab>', '', text, flags=re.DOTALL)

# Remove PPL_TABS
text = re.sub(r'const PPL_TABS = \[[^\]]*?\];', '', text, flags=re.DOTALL)

# Remove useState
text = re.sub(r'const \[pplTab,\s*setPplTab\]\s*=\s*useState[^;]+;', '', text)

# Remove TabPanel
text = re.sub(r'\{\s*/\*\s*---\s*PEOPLE & COMMISSIONS PANEL\s*---\s*\*/\s*\}.*?</TabPanel>', '', text, flags=re.DOTALL)

with open('c:/MFO-CRM/apps/web/app/(dashboard)/platform/finance/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done!')
