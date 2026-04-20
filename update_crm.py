import re

with open('apps/web/lib/crmService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add OrgType type
if "export type OrgType" not in content:
    content = re.sub(
        r"export type DealStage\s*=\s*'lead' \| 'qualification' \| 'demo' \| 'proposal' \| 'negotiation' \| 'closed_won' \| 'closed_lost';",
        "export type OrgType = 'client' | 'prospect' | 'supplier' | 'partner';\nexport type DealStage   = 'lead' | 'qualification' | 'demo' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';",
        content
    )

    # Add orgType to PlatformOrg
    content = re.sub(
        r"id:\s*string;\n\s*name:\s*string;",
        "id:           string;\n  name:         string;\n  orgType?:     OrgType;",
        content
    )

    # Add orgType to createOrg input
    content = re.sub(
        r"const ref = await addDoc\(collection\(db, 'platform_orgs'\), {\n\s*\.\.\.data, region: data\.region",
        "const ref = await addDoc(collection(db, 'platform_orgs'), {\n    ...data, orgType: data.orgType ?? 'client', region: data.region",
        content
    )

    # Add orgType to SAMPLE_ORGS
    content = re.sub(r"tenantIds: \[\], createdBy: 'system' }", r"tenantIds: [], createdBy: 'system', orgType: 'client' }", content)

    # Add ORG_TYPE_LABELS helper
    content = content + "\nexport const ORG_TYPE_LABELS: Record<OrgType, string> = {\n  client: 'Client',\n  prospect: 'Prospect',\n  supplier: 'Supplier / Vendor',\n  partner: 'Partner / Affiliate',\n};\n"

    with open('apps/web/lib/crmService.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("crmService.updated")
else:
    print("already updated")
