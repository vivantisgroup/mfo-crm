import re

with open('apps/web/app/(dashboard)/platform/crm/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Expand MainTab
if "'copilot'" not in code:
    code = code.replace("type MainTab = 'dashboard' | 'pipeline' | 'organizations' | 'contacts' | 'activities' | 'teams' | 'reports';", "type MainTab = 'dashboard' | 'pipeline' | 'organizations' | 'contacts' | 'activities' | 'teams' | 'reports' | 'copilot';")

# 2. Find where TABS are defined for SecondaryDock. It's usually inside CrmDashboard. Let's see.
# Alternatively, I can just inject it. Let's look at how tabs are defined.
