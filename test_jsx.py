import sys

def check_div_balance(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # Simple count of <div and </div just to see the delta
    div_open = content.count("<div")
    div_close = content.count("</div")
    print(f"Total <div: {div_open}, Total </div: {div_close}")
    print(f"Delta: {div_open - div_close}")

check_div_balance('apps/web/app/(dashboard)/platform/analytics/page.tsx')
