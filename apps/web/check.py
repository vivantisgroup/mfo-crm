import codecs
with codecs.open('c:/MFO-CRM/apps/web/app/(dashboard)/financial-engineer/components/AdvisorSimulator.tsx', 'r', 'utf8') as f:
    text = f.read()

count = text.count('`')
print("Total regular backticks:", count)

if count % 2 != 0:
    print("UNBALANCED BACKTICKS! Finding the line of the last one...")
    lines = text.split('\n')
    for i, line in enumerate(lines):
        if '`' in line:
            print(f"Line {i+1}: {line.strip()}")
