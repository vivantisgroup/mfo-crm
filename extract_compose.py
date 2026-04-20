import re

with open(r'c:\MFO-CRM\apps\web\app\(dashboard)\communications\page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

compose_lines = text.split('\n')
for i, line in enumerate(compose_lines):
    if 'handleSendMail' in line or 'handleSend' in line:
        print(f"Line {i+1}: {line.strip()}")
        start = max(0, i-5)
        end = min(len(compose_lines), i+30)
        for j in range(start, end):
             print(compose_lines[j])
        break
