import re

with open('apps/web/app/(dashboard)/platform/analytics/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

def check_jsx_balance(code):
    open_count = 0
    close_count = 0
    lines = code.split('\n')
    for i, line in enumerate(lines):
        open_count += len(re.findall(r'<div[^>]*($|[^/]>)', line))
        close_count += len(re.findall(r'</div\s*>', line))
        
    print(open_count, close_count)

# let's look at the ROI tab precisely
start = text.find("tab === 'roi'")
roi_text = text[start:]

open_divs = len(re.findall(r'<div(?:\s+[^>]*)?>', roi_text))
close_divs = len(re.findall(r'</div\s*>', roi_text))
self_close = len(re.findall(r'<div\s+[^>]*/>', roi_text))

print(f"ROI open divs: {open_divs}, close divs: {close_divs}, self closing: {self_close}")

