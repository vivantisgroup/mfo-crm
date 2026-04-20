import re

with open('apps/web/app/(dashboard)/platform/analytics/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

start = text.find("tab === 'roi'")
roi_text = text[start:text.find("tab === 'reports'")]

lines = roi_text.split('\n')
cur = 0
for i, l in enumerate(lines):
    opens = len(re.findall(r'<div(?:\s+[^>]*)?>', l))
    closes = len(re.findall(r'</div\s*>', l))
    cur += opens - closes
    print(f"{i}: {l.strip()}  | delta: {opens - closes} | cur: {cur}")

