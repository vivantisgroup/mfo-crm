import re

with open('apps/web/app/(dashboard)/platform/analytics/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# remove comments
text = re.sub(r'\{/\*.*?\*/\}', '', text, flags=re.DOTALL)

open_div = len(re.findall(r'<div(?:\s[^>]*)?(?<!/)>', text))
self_div = len(re.findall(r'<div\s[^>]*/>', text))
close_div = len(re.findall(r'</div\s*>', text))

print(f"open: {open_div}, close: {close_div}, self: {self_div}")

# also let's check for braces { }
import sys
braces = 0
for i, char in enumerate(text):
    if char == '{': braces += 1
    elif char == '}': braces -= 1
print(f"Braces balance: {braces}")

