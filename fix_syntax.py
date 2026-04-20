with open(r'c:\MFO-CRM\apps\web\app\(dashboard)\communications\page.tsx', 'r', encoding='utf-8') as file:
    content = file.read()

# Fix the broken class names safely
content = content.replace("className={\f", "className={")
content = content.replace("className={\\", "className={")
content = content.replace("transition-colors \\}", "transition-colors }")
content = content.replace("transition-colors }", "transition-colors }")

with open(r'c:\MFO-CRM\apps\web\app\(dashboard)\communications\page.tsx', 'w', encoding='utf-8') as file:
    file.write(content)
print("Applied Python targeted string fixes.")
