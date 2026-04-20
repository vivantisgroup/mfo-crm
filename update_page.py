import re

with open('apps/web/app/(dashboard)/platform/finance/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add new imports
if "{ getLedgerEntries, type LedgerEntry }" not in text:
    text = text.replace(
        "import { getAllOrgs, type PlatformOrg } from '@/lib/crmService';",
        "import { getAllOrgs, type PlatformOrg } from '@/lib/crmService';\nimport { getLedgerEntries, type LedgerEntry } from '@/lib/accountingService';\nimport { getEmployees, type Employee } from '@/lib/peopleService';"
    )

# Add new tabs config
if "ACC_TABS:" not in text:
    text = text.replace(
        "const EXP_TABS: SecondaryDockTab[] =",
        """const ACC_TABS: SecondaryDockTab[] = [
    { id: 'ledger', label: 'General Ledger', icon: '??' },
    { id: 'pl', label: 'P&L Statement', icon: '??' },
    { id: 'balance', label: 'Balance Sheet', icon: '??' },
  ];

  const PPL_TABS: SecondaryDockTab[] = [
    { id: 'directory', label: 'Employee Directory', icon: '??' },
    { id: 'commissions', label: 'Commissions', icon: '??' },
    { id: 'payroll', label: 'Payroll Overview', icon: '??' },
  ];

  const [accTab, setAccTab] = useState('ledger');
  const [pplTab, setPplTab] = useState('directory');

  const EXP_TABS: SecondaryDockTab[] ="""
    )

# Add new state variables
if "const [ledger, setLedger]" not in text:
    text = text.replace(
        "const [orgs, setOrgs] = useState<PlatformOrg[]>([]);",
        "const [orgs, setOrgs] = useState<PlatformOrg[]>([]);\n  const [ledger, setLedger] = useState<LedgerEntry[]>([]);\n  const [employees, setEmployees] = useState<Employee[]>([]);"
    )

# Add to loadData Promise.all
if "getLedgerEntries()" not in text:
    text = text.replace(
        "const [livePlans, liveSubs, liveInvoices, liveExpenses, liveRenewals, liveOrgs] = await Promise.all([",
        "const [livePlans, liveSubs, liveInvoices, liveExpenses, liveRenewals, liveOrgs, liveLedger, liveEmps] = await Promise.all(["
    )
    text = text.replace(
        "getPlans(), getAllSubscriptions(), getAllInvoices(), getAllExpenses(), listRenewals(), getAllOrgs(),",
        "getPlans(), getAllSubscriptions(), getAllInvoices(), getAllExpenses(), listRenewals(), getAllOrgs(), getLedgerEntries(), getEmployees()"
    )
    text = text.replace(
        "setOrgs(liveOrgs);",
        "setOrgs(liveOrgs);\n        setLedger(liveLedger);\n        setEmployees(liveEmps);"
    )

# Add tab headers
if "Tab className=\"data-[selected]:border-b-2" in text and "Accounting & Ledgers" not in text:
    text = text.replace(
        "<Tab className=\"data-[selected]:border-b-2 data-[selected]:border-indigo-600 data-[selected]:text-indigo-600 text-slate-500 pb-2 px-1 outline-none\">Corporate Expenses</Tab>",
        "<Tab className=\"data-[selected]:border-b-2 data-[selected]:border-indigo-600 data-[selected]:text-indigo-600 text-slate-500 pb-2 px-1 outline-none\">Corporate Expenses</Tab>\n            <Tab className=\"data-[selected]:border-b-2 data-[selected]:border-indigo-600 data-[selected]:text-indigo-600 text-slate-500 pb-2 px-1 outline-none\">Accounting & Ledgers</Tab>\n            <Tab className=\"data-[selected]:border-b-2 data-[selected]:border-indigo-600 data-[selected]:text-indigo-600 text-slate-500 pb-2 px-1 outline-none\">People & Commissions</Tab>"
    )

with open('apps/web/app/(dashboard)/platform/finance/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

