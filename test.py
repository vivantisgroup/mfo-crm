with open(r'c:\MFO-CRM\apps\web\app\(dashboard)\communications\page.tsx', 'r', encoding='utf-8') as f:
    lines = f.read().split('\n')

for i, line in enumerate(lines[440:460]):
    print(f"{i+440}: {line}")
