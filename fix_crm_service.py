import re

with open('apps/web/lib/crmService.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# Add commissionPlanText to SalesTeam interface
if "commissionPlanText?:" not in text:
    text = re.sub(
        r'(export\s+interface\s+SalesTeam\s+{.*?)(})',
        r'\1  commissionPlanText?: string;\n\2',
        text,
        flags=re.DOTALL
    )

# Add commissionPlanText to createSalesTeam parameters and payload
text = text.replace("export async function createSalesTeam(data: Omit<SalesTeam, 'id' | 'createdAt' | 'updatedAt'>)", "export async function createSalesTeam(data: Omit<SalesTeam, 'id' | 'createdAt' | 'updatedAt'>)")
# Actually, since it's Omit<...>, it's already accepted in data. We just map it.
if "commissionPlanText:" not in text and "createdAt: new Date().toISOString()" in text:
    text = re.sub(
        r'(const\s+payload\s*=\s*{.*?)(createdAt:\s*new Date\(\)\.toISOString\(\),\s*})',
        r'\1commissionPlanText: data.commissionPlanText || "",\n    \2',
        text,
        flags=re.DOTALL
    )

with open('apps/web/lib/crmService.ts', 'w', encoding='utf-8') as f:
    f.write(text)

print("crmService.ts updated.")
