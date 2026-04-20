with open(r'c:\MFO-CRM\apps\web\app\(dashboard)\communications\page.tsx', 'r', encoding='utf-8') as f:
    lines = f.read().split('\n')

for i, line in enumerate(lines):
    if 'handleCreateEvent' in line:
        print(f"Line {i+1}: {line.strip()}")
        # print context lines Around
        for j in range(max(0, i-5), min(len(lines), i+20)):
            print(f"{j+1}: {lines[j]}")
        break  # Just first occurrence of definition
