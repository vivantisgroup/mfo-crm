import re

with open(r'c:\MFO-CRM\apps\web\app\(dashboard)\communications\page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

for match in re.finditer(r'fetch\([^\)]+\)', text):
    print(match.group(0))
