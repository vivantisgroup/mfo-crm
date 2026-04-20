with open(r'c:\MFO-CRM\apps\web\app\(dashboard)\communications\page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')
for i, line in enumerate(lines):
    if "activeTab === 'calendar'" in line:
        print(f"FOUND CALENDAR AT LINE {i+1}")
        break
