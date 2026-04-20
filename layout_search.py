with open(r'c:\MFO-CRM\apps\web\app\(dashboard)\communications\page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')
for i, line in enumerate(lines[400:850]):
    if "activeTab === 'email'" in line:
        print(f"FOUND EMAIL START AT LINE {i+400}: {line.strip()}")
            
    if "activeTab === 'calendar'" in line:
        print(f"FOUND CALENDAR START AT LINE {i+400}: {line.strip()}")
        
    if "activeTab === 'messaging'" in line:
        print(f"FOUND MESSAGING START AT LINE {i+400}: {line.strip()}")
