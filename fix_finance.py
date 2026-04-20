import re

with open('apps/web/app/(dashboard)/platform/finance/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace TabGroup imports with just what we need, adding Accounting/People services
imports_add = """import { getLedgerEntries, addLedgerEntry, type LedgerEntry } from '@/lib/accountingService';
import { getEmployees, type Employee } from '@/lib/peopleService';"""

if "import { getLedgerEntries" not in code:
    code = code.replace("import { getAllExpenses,", imports_add + "\nimport { getAllExpenses,")

# 1. Update states in FinanceHubPage
states_add = """
  // Accounting & HR state
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // Dock Nav
  type MainTab = 'dashboard' | 'billing' | 'expenses' | 'accounting' | 'people';
  const [mainTab, setMainTab] = useState<MainTab>('dashboard');
"""
code = re.sub(r'(const \[expensesSummary, setExpensesSummary\] = useState<Expense\[\]>\(\[\]\);)', r'\1' + states_add, code)

# 2. Update loadData
load_add_req = ", liveLedger, liveEmps] = await Promise.all([\n          getPlans(), getAllSubscriptions(), getAllInvoices(), getAllExpenses(), listRenewals(), getAllOrgs(),\n          getLedgerEntries(), getEmployees()"
code = re.sub(r'\] = await Promise\.all\(\[\n\s*getPlans\(\), getAllSubscriptions\(\), getAllInvoices\(\), getAllExpenses\(\), listRenewals\(\), getAllOrgs\(\),', load_add_req, code)

load_add_set = """
        setRenewals(liveRenewals);
        setOrgs(liveOrgs);
        setLedger(liveLedger);
        setEmployees(liveEmps);
"""
code = re.sub(r'setRenewals\(liveRenewals\);\n\s*setOrgs\(liveOrgs\);', load_add_set, code)

# 3. Completely Rewrite the Main Component Return Block
new_return = """
  const TABS: SecondaryDockTab[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '??' },
    { id: 'billing', label: 'Billing & Invoices', icon: '??' },
    { id: 'expenses', label: 'Expenses', icon: '??' },
    { id: 'accounting', label: 'Accounting', icon: '??' },
    { id: 'people', label: 'People & HR', icon: '??' }
  ];

  return (
    <div className="flex flex-col h-full w-full bg-slate-50/50">
      <SecondaryDock tabs={TABS} activeTab={mainTab} onTabChange={(id) => setMainTab(id as MainTab)} />
      
      <div className="page-wrapper animate-fade-in w-full h-full flex flex-col flex-1 px-4 lg:px-6 pt-6 pb-12 overflow-y-auto">
        {mainTab === 'dashboard' && (
          <div className="space-y-8">
             <OverviewTab plans={plans} subscribers={subscribers} expenses={expensesSummary} />
             <div className="mt-8">
               <Grid numItemsSm={1} numItemsLg={4} className="gap-6">
                 <Card className="shadow-sm border-slate-200" decoration="top" decorationColor="blue"><Text>MTD Operating Expenses</Text><Metric className="text-3xl font-black">{fmt(totalMonthlyOpex)}</Metric></Card>
                 <Card className="shadow-sm border-slate-200" decoration="top" decorationColor="amber"><Text>Projected Annual Burn</Text><Metric className="text-3xl font-black">{fmt(projectedAnnual)}</Metric></Card>
                 <Card className="shadow-sm border-slate-200" decoration="top" decorationColor="emerald"><Text>Cash Efficiency Ratio</Text><Metric className="text-3xl font-black">1.14x</Metric></Card>
                 <Card className="shadow-sm border-slate-200" decoration="top" decorationColor="indigo"><Text>Total Headcount</Text><Metric className="text-3xl font-black">{employees.length}</Metric></Card>
               </Grid>
             </div>
          </div>
        )}

        {mainTab === 'billing' && (
          <div className="space-y-8">
             <SubscribersTab plans={plans} subscribers={subscribers} />
             <InvoicesTab invoices={invoices} />
          </div>
        )}

        {mainTab === 'expenses' && (
          <div className="space-y-6">
            <div className="flex justify-end mb-4 gap-3">
              <Button size="sm" icon={() => <span className="mr-2">??</span>}>Scan Receipt PDF</Button>
              <Button size="sm" variant="primary" onClick={() => setIsManualEntryOpen(true)}>Manual Entry</Button>
            </div>
            <Grid numItemsSm={1} numItemsLg={3} className="gap-6">
              <Card className="col-span-2 shadow-sm border-slate-200">
                <Title>T30 Expense Trend</Title>
                <AreaChart className="mt-6 h-72" data={chartData} index="Month" categories={['SaaS & Infra', 'Travel & Ent', 'Office & Supplies', 'Legal & Prof']} colors={['blue', 'rose', 'amber', 'emerald']} valueFormatter={(num) => $c:\MFO-CRM{Intl.NumberFormat('us').format(num).toString()}} stack={true} />
              </Card>
              <Card className="shadow-sm border-slate-200">
                <Title>Top SaaS Subscriptions</Title>
                <div className="mt-6 space-y-4">
                  {activeExpenses.sort((a,b) => monthlyEquivalent(b) - monthlyEquivalent(a)).slice(0, 5).map(e => (
                    <div key={e.id} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0">
                      <div><p className="font-bold text-sm">{e.name}</p><p className="text-xs text-slate-500">{e.vendor}</p></div>
                      <p className="font-bold text-sm">{fmt(monthlyEquivalent(e))}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </Grid>
            <Card className="p-0 shadow-sm border-slate-200 overflow-hidden mt-6">
              <Table>
                <TableHead><TableRow><TableHeaderCell>Date</TableHeaderCell><TableHeaderCell>Merchant</TableHeaderCell><TableHeaderCell>Category</TableHeaderCell><TableHeaderCell>Amount</TableHeaderCell></TableRow></TableHead>
                <TableBody>
                  {expensesList.map(exp => (
                    <TableRow key={exp.id}>
                      <TableCell>{fmtDate(exp.startDate)}</TableCell>
                      <TableCell>{exp.vendor || exp.name}</TableCell>
                      <TableCell>{exp.category}</TableCell>
                      <TableCell className="font-bold text-rose-500">{fmt(exp.amountUsd)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {mainTab === 'accounting' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><Title className="text-xl font-black text-slate-900 tracking-tight">General Ledger Book</Title><Text>Double-entry accounting journal tracking Assets, Liabilities, Revenue, and Expenses.</Text></div>
              <div className="flex gap-3"><Button size="sm" variant="secondary">Export CSV</Button><Button size="sm" variant="primary">New Journal Entry</Button></div>
            </div>
            <Grid numItemsSm={1} numItemsLg={3} className="gap-6">
               <Card decoration="top" decorationColor="emerald"><Text className="uppercase text-[10px] font-bold tracking-widest text-slate-500">Total Assets</Text><Metric className="text-2xl font-black mt-2">{fmt(ledger.filter(l=>l.type==='ASSET').reduce((s,l)=>s+l.debit-l.credit,0))}</Metric></Card>
               <Card decoration="top" decorationColor="indigo"><Text className="uppercase text-[10px] font-bold tracking-widest text-slate-500">Recognized Revenue</Text><Metric className="text-2xl font-black mt-2">{fmt(ledger.filter(l=>l.type==='REVENUE').reduce((s,l)=>s+l.credit-l.debit,0))}</Metric></Card>
               <Card decoration="top" decorationColor="rose"><Text className="uppercase text-[10px] font-bold tracking-widest text-slate-500">Total Expenses</Text><Metric className="text-2xl font-black mt-2">{fmt(ledger.filter(l=>l.type==='EXPENSE').reduce((s,l)=>s+l.debit-l.credit,0))}</Metric></Card>
            </Grid>
            <Card className="p-0 shadow-sm border-slate-200 overflow-hidden">
               <Table>
                 <TableHead>
                   <TableRow>
                     <TableHeaderCell>Date</TableHeaderCell>
                     <TableHeaderCell>Account</TableHeaderCell>
                     <TableHeaderCell>Type</TableHeaderCell>
                     <TableHeaderCell>Description</TableHeaderCell>
                     <TableHeaderCell className="text-right">Debit</TableHeaderCell>
                     <TableHeaderCell className="text-right">Credit</TableHeaderCell>
                   </TableRow>
                 </TableHead>
                 <TableBody>
                   {ledger.map(entry => (
                     <TableRow key={entry.id} className="hover:bg-slate-50">
                       <TableCell className="text-xs">{fmtDate(entry.date)}</TableCell>
                       <TableCell className="font-bold text-slate-800 text-sm">{entry.accountId} - {entry.accountName}</TableCell>
                       <TableCell><Badge size="xs" color={entry.type==='ASSET'?'emerald':entry.type==='REVENUE'?'indigo':entry.type==='LIABILITY'?'amber':'rose'}>{entry.type}</Badge></TableCell>
                       <TableCell className="text-xs text-slate-600 truncate max-w-[200px]">{entry.description}</TableCell>
                       <TableCell className="text-right font-mono text-sm">{entry.debit > 0 ? fmt(entry.debit) : ''}</TableCell>
                       <TableCell className="text-right font-mono text-sm">{entry.credit > 0 ? fmt(entry.credit) : ''}</TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
            </Card>
          </div>
        )}

        {mainTab === 'people' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><Title className="text-xl font-black text-slate-900 tracking-tight">People & Organization</Title><Text>Directory of employees, departments, quotas, and YTD commissions.</Text></div>
              <Button size="sm" variant="primary">Add Employee</Button>
            </div>
            <Card className="p-0 shadow-sm border-slate-200 overflow-hidden">
               <Table>
                 <TableHead>
                   <TableRow>
                     <TableHeaderCell>Employee</TableHeaderCell>
                     <TableHeaderCell>Department</TableHeaderCell>
                     <TableHeaderCell>Employment</TableHeaderCell>
                     <TableHeaderCell>Manager</TableHeaderCell>
                     <TableHeaderCell className="text-right">Base Salary</TableHeaderCell>
                     <TableHeaderCell className="text-right">Commission YTD</TableHeaderCell>
                   </TableRow>
                 </TableHead>
                 <TableBody>
                   {employees.map(emp => (
                     <TableRow key={emp.id} className="hover:bg-slate-50 cursor-pointer">
                       <TableCell>
                          <div className="font-bold text-slate-900 text-sm">{emp.name}</div>
                          <div className="text-xs text-slate-500">{emp.title} • {emp.location}</div>
                       </TableCell>
                       <TableCell><Badge size="xs" color={emp.department==='Sales'?'emerald':emp.department==='Engineering'?'blue':'slate'}>{emp.department}</Badge></TableCell>
                       <TableCell><span className="text-xs font-semibold text-slate-600 uppercase tracking-widest">{emp.employmentType}</span></TableCell>
                       <TableCell className="text-sm font-medium text-slate-700">{emp.managerName || '—'}</TableCell>
                       <TableCell className="text-right font-black text-slate-700">{fmt(emp.baseSalary)}</TableCell>
                       <TableCell className="text-right">
                         {emp.ytdCommission ? (
                           <div>
                             <div className="font-black text-emerald-600">{fmt(emp.ytdCommission)}</div>
                             <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1">Quota: {fmt(emp.quota || 0)}</div>
                           </div>
                         ) : <span className="text-slate-300 font-bold">—</span>}
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={isManualEntryOpen} onClose={() => setIsManualEntryOpen(false)} static={true}>
        <DialogPanel className="max-w-md w-full">
          <div className="flex justify-between items-center mb-4"><Title>Log Corporate Expense</Title><button onClick={()=>setIsManualEntryOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button></div>
          <Text className="mb-6">Manually record a liability or operating expense into the generalized ledger.</Text>
          <div className="space-y-4">
             <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Merchant / Vendor</label><TextInput className="mt-1" placeholder="e.g. Amazon Web Services" value={newExpenseForm.vendor} onValueChange={(v)=>setNewExpenseForm({...newExpenseForm,vendor:v})} /></div>
             <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Amount (USD)</label><TextInput className="mt-1 font-mono font-bold" type="number" placeholder="500" value={newExpenseForm.amountUsd.toString()} onValueChange={(v)=>setNewExpenseForm({...newExpenseForm,amountUsd:Number(v)})} /></div>
             <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Category</label><Select value={newExpenseForm.category} onValueChange={(v)=>setNewExpenseForm({...newExpenseForm,category:v})} className="mt-1"><SelectItem value="software">Software & SaaS</SelectItem><SelectItem value="travel">Travel & Meals</SelectItem><SelectItem value="office">Office & Rent</SelectItem><SelectItem value="legal">Legal & Professional</SelectItem></Select></div>
             <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Date</label><input type="date" className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 focus:ring-2 focus:ring-brand-500 outline-none" value={newExpenseForm.startDate} onChange={(e)=>setNewExpenseForm({...newExpenseForm,startDate:e.target.value})} /></div>
             <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Justification / Description</label><TextInput className="mt-1" placeholder="Q3 Client Outreach Dinner" value={newExpenseForm.description} onValueChange={(v)=>setNewExpenseForm({...newExpenseForm,description:v})} /></div>
          </div>
          <div className="flex justify-end gap-3 mt-8">
            <Button variant="light" onClick={()=>setIsManualEntryOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={async () => {
              try { await createExpense(newExpenseForm as any); window.location.reload(); } catch (e) { alert('Error recording expense'); }
            }}>Record Entry</Button>
          </div>
        </DialogPanel>
      </Dialog>
    </div>
  );
}
"""

code = re.sub(r'  return \(\n\s*<div className="flex flex-col h-full w-full bg-slate-50/50">.*', new_return, code, flags=re.DOTALL)

with open('apps/web/app/(dashboard)/platform/finance/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Finance UI successfully rewritten.")
