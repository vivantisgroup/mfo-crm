import re

with open(r'c:\MFO-CRM\apps\web\lib\crmService.ts', 'r', encoding='utf-8') as f:
    text = f.read()

for match in re.finditer(r'export (?:async )?function (get[A-Za-z0-9_]+)\(', text):
    print(match.group(1))
