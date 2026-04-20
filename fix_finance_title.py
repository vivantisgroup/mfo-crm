import re

# 1. FIX FINANCE/PAGE.TSX Top Title
with open('apps/web/app/(dashboard)/platform/finance/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# I want to remove:
# <Title className="text-2xl font-black text-slate-900 tracking-tight">Finance & Operations</Title>
# <Text className="text-slate-500 mt-1">Manage platform revenue, tenant billing, and corporate expenses.</Text>
# And anything wrapping it, leaving TabGroup flush.

old_header = """            <div className="py-6 flex items-center justify-between">
              <div>
                <Title className="text-2xl font-black text-slate-900 tracking-tight">Finance & Operations</Title>
                <Text className="text-slate-500 mt-1">Manage platform revenue, tenant billing, and corporate expenses.</Text>
              </div>
              <div className="flex gap-2">
                <Button variant="light" size="sm" icon={() => <span className="mr-1">??</span>} onClick={() => setIsManualEntryOpen(true)}>Manual Expense</Button>
                <Button variant="primary" size="sm">Download Report</Button>
              </div>
            </div>
            {/* Nav Tabs */}
            <div className="flex items-center space-x-8">
              <TabList variant="line" className="mt-6 flex-1 border-b-0 space-x-6">"""

new_header = """            <div className="py-2 flex items-center justify-between">
              {/* Top-Level Header Title strictly removed per UI/UX specifications */}
              <TabList variant="line" className="flex-1 border-b-0 space-x-6">"""

if old_header in text:
    text = text.replace(old_header, new_header)

    # Need to keep the buttons but move them to the right. 
    # Actually, secondary Dock elements handle that. Wait, we can put the buttons next to TabList.
    new_header_with_buttons = """            <div className="-mt-2 flex items-center justify-between relative pt-4 pb-2">
              <TabList variant="line" className="flex-1 border-b-0 space-x-6">"""
    
    text = text.replace(new_header, new_header_with_buttons)

    # Put the buttons back inside the right side of the flex box
    ext = """              </TabList>
              <div className="flex gap-2 relative z-10 hidden sm:flex">
                <Button variant="light" size="sm" icon={() => <span className="mr-1">??</span>} onClick={() => setIsManualEntryOpen(true)}>Manual Expense</Button>
                <Button variant="primary" size="sm">Download Report</Button>
              </div>"""
    text = text.replace("              </TabList>", ext)

with open('apps/web/app/(dashboard)/platform/finance/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Title scrubbed from Finance module.")
