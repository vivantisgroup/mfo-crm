import re

with open('apps/web/app/(dashboard)/platform/finance/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Add Dialog and createExpense to imports
if 'Dialog' not in code:
    code = code.replace("AreaChart, BadgeDelta", "AreaChart, BadgeDelta, Dialog, DialogPanel")
if 'createExpense' not in code:
    code = code.replace("getAllExpenses, monthlyEquivalent, EXPENSE_CATEGORIES, type PlatformExpense", "getAllExpenses, createExpense, monthlyEquivalent, EXPENSE_CATEGORIES, type PlatformExpense")
if 'useAuth' not in code:
    code = code.replace("import { usePageTitle } from '@/lib/PageTitleContext';", "import { usePageTitle } from '@/lib/PageTitleContext';\nimport { useAuth } from '@/lib/AuthContext';\nimport { getAllOrgs, type PlatformOrg } from '@/lib/crmService';")
    
# Add useAuth hooks logic inside FinanceHubPage
if 'const { user } = useAuth();' not in code:
    code = code.replace("usePageTitle('Finance Control Center');", "usePageTitle('Finance Control Center');\n  const { user } = useAuth();")

# Add state for Orgs and Dialog
if 'const [isManualEntryOpen, setIsManualEntryOpen]' not in code:
    code = code.replace("const [renewals, setRenewals] = useState<RenewalRecord[]>([]);", "const [renewals, setRenewals] = useState<RenewalRecord[]>([]);\n  const [orgs, setOrgs] = useState<PlatformOrg[]>([]);\n  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);\n  const [newExpenseForm, setNewExpenseForm] = useState({ name: '', vendor: '', category: 'software', amountUsd: 0, frequency: 'monthly', description: '', startDate: new Date().toISOString().split('T')[0] });")

# Fetch orgs in loadData
if 'getAllOrgs()' not in code:
    code = code.replace("getAllExpenses(), listRenewals(),", "getAllExpenses(), listRenewals(), getAllOrgs(),")
    code = code.replace("const [livePlans, liveSubs, liveInvoices, liveExpenses, liveRenewals]", "const [livePlans, liveSubs, liveInvoices, liveExpenses, liveRenewals, liveOrgs]")
    code = code.replace("setRenewals(liveRenewals);", "setRenewals(liveRenewals);\n        setOrgs(liveOrgs);")

# Update Manual Entry Button onClick
code = code.replace("<Button size=\"sm\" variant=\"primary\">Manual Entry</Button>", "<Button size=\"sm\" variant=\"primary\" onClick={() => setIsManualEntryOpen(true)}>Manual Entry</Button>")

# Add Dialog UI at the end
dialog_ui = """
      <Dialog open={isManualEntryOpen} onClose={(val) => setIsManualEntryOpen(val)} static={true}>
        <DialogPanel className="max-w-md mx-auto p-6 bg-white rounded-2xl shadow-xl">
          <Title>Add Corporate Expense</Title>
          <form className="mt-6 flex flex-col gap-4" onSubmit={async (e) => {
            e.preventDefault();
            try {
              const res = await createExpense({ ...newExpenseForm, category: newExpenseForm.category as any, frequency: newExpenseForm.frequency as any, createdBy: user?.uid ?? 'system' }, { uid: user?.uid ?? 'system' });
              setExpensesList([res, ...expensesList]);
              setIsManualEntryOpen(false);
              setNewExpenseForm({ name: '', vendor: '', category: 'software', amountUsd: 0, frequency: 'monthly', description: '', startDate: new Date().toISOString().split('T')[0] });
            } catch (err) { alert('Failed'); }
          }}>
            <div>
              <Text className="text-xs font-bold mb-1 uppercase text-slate-500">Expense Title</Text>
              <TextInput required value={newExpenseForm.name} onValueChange={v => setNewExpenseForm(p => ({...p, name: v}))} placeholder="e.g. AWS Hosting" />
            </div>
            <div>
              <Text className="text-xs font-bold mb-1 uppercase text-slate-500">Vendor / Supplier (Search CRM)</Text>
              <Select enableClear={false} value={newExpenseForm.vendor} onValueChange={v => setNewExpenseForm(p => ({...p, vendor: v}))}>
                {orgs.filter(o => o.orgType === 'supplier' || o.orgType === 'partner' || !o.orgType).map(o => (
                  <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text className="text-xs font-bold mb-1 uppercase text-slate-500">Amount (USD)</Text>
                <TextInput type="number" required value={String(newExpenseForm.amountUsd)} onValueChange={v => setNewExpenseForm(p => ({...p, amountUsd: Number(v)}))} />
              </div>
              <div>
                <Text className="text-xs font-bold mb-1 uppercase text-slate-500">Frequency</Text>
                <Select value={newExpenseForm.frequency} onValueChange={v => setNewExpenseForm(p => ({...p, frequency: v}))}>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="one_time">One-time</SelectItem>
                </Select>
              </div>
            </div>
            <div>
              <Text className="text-xs font-bold mb-1 uppercase text-slate-500">Category</Text>
              <Select value={newExpenseForm.category} onValueChange={v => setNewExpenseForm(p => ({...p, category: v}))}>
                {Object.keys(EXPENSE_CATEGORIES).map(k => (
                  <SelectItem key={k} value={k}>{EXPENSE_CATEGORIES[k as keyof typeof EXPENSE_CATEGORIES].label}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="mt-4 flex gap-3 justify-end">
              <Button type="button" variant="light" onClick={() => setIsManualEntryOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Add Expense</Button>
            </div>
          </form>
        </DialogPanel>
      </Dialog>
"""

if "setIsManualEntryOpen" not in code or "DialogPanel" not in code:
    code = code.replace("    </div>\n  );\n}", dialog_ui + "    </div>\n  );\n}")

with open('apps/web/app/(dashboard)/platform/finance/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print('Patched Finance page.')
