const fs = require('fs');
let c = fs.readFileSync('apps/web/app/(dashboard)/platform/finance/page.tsx', 'utf8');

// 1. Imports
c = c.replace(
  'import { getLedgerEntries, type LedgerEntry } from "@/lib/accountingService";',
  'import { getLedgerEntries, getChartOfAccounts, addChartAccount, type LedgerEntry, type ChartAccount } from "@/lib/accountingService";'
);
if (!c.includes('Layers')) {
  c = c.replace('FileText, CheckCircle2 }', 'FileText, CheckCircle2, Layers }');
}

// 2. Insert ChartOfAccountsTab right before LedgerTab
const coaCode = `
function ChartOfAccountsTab({ accounts, onAddAccount }: { accounts: ChartAccount[], onAddAccount: () => void }) {
  // Sort accounts strictly by Code
  const sorted = [...accounts].sort((a,b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));

  return (
    <Card className="mt-4 shadow-sm border-slate-200">
      <Flex justifyContent="between" className="mb-6">
        <Title>Chart of Accounts</Title>
        <Button size="sm" onClick={onAddAccount} icon={() => <span className="mr-2">➕</span>}>New Account</Button>
      </Flex>
      <div className="overflow-x-auto">
        <Table>
          <TableHead className="bg-slate-50 border-b border-slate-200">
            <TableRow>
              <TableHeaderCell className="w-32">Code</TableHeaderCell>
              <TableHeaderCell>Account Name</TableHeaderCell>
              <TableHeaderCell>Classification</TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map(acc => {
              const depth = acc.code.split('.').length - 1;
              const indentClass = depth === 0 ? 'pl-4' : depth === 1 ? 'pl-8' : depth === 2 ? 'pl-12' : 'pl-16';
              return (
                <TableRow key={acc.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                  <TableCell className="font-mono text-xs font-semibold text-slate-500">
                     {acc.code}
                  </TableCell>
                  <TableCell className={\`\${indentClass} \${acc.isGroup ? 'font-black text-slate-800' : 'font-medium text-slate-600'}\`}>
                     <div className="flex items-center gap-2">
                       {acc.isGroup && <span className="text-indigo-500 text-xs mt-0.5">▾</span>}
                       {!acc.isGroup && <span className="text-slate-300 text-xs mt-0.5">·</span>}
                       {acc.name}
                     </div>
                  </TableCell>
                  <TableCell>
                     <Badge size="xs" color={acc.type === 'ASSET' ? 'emerald' : acc.type === 'LIABILITY' ? 'rose' : acc.type === 'EQUITY' ? 'indigo' : acc.type === 'REVENUE' ? 'teal' : 'amber'}>
                       {acc.type}
                     </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                     {acc.isSystem ? <span className="text-xs text-slate-400 font-semibold bg-slate-100 px-2 rounded-md">SYSTEM</span> : <button className="text-xs text-indigo-600 font-bold hover:text-indigo-800">Edit</button>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

`;
c = c.replace('function LedgerTab(', coaCode + 'function LedgerTab(');

// 3. Inject ACC_TABS
c = c.replace(
  '{ id: "pl", label: "P&L Statement", icon: FileBarChart },',
  '{ id: "pl", label: "P&L Statement", icon: FileBarChart },\n    { id: "coa", label: "Chart of Accounts", icon: Layers },'
);

// 4. Inject global state and loading into loadData
c = c.replace(
  'const [ledger, setLedger] = useState<LedgerEntry[]>([]);',
  'const [ledger, setLedger] = useState<LedgerEntry[]>([]);\n  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([]);\n  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);\n  const [newAccountForm, setNewAccountForm] = useState<any>({ name: "", code: "", type: "EXPENSE", isGroup: false });'
);

// loadData array
c = c.replace(
  'liveLedger,\n          liveEmps,\n          liveMembers,\n          liveContacts,\n        ] = await Promise.all([',
  'liveLedger,\n          liveEmps,\n          liveMembers,\n          liveContacts,\n          liveCOA,\n        ] = await Promise.all(['
);

c = c.replace(
  'getLedgerEntries(),',
  'getLedgerEntries(),\n          getChartOfAccounts(),'
);

c = c.replace(
  'setLedger(liveLedger);',
  'setLedger(liveLedger);\n        setChartAccounts(liveCOA);'
);

// 5. Inject rendering
c = c.replace(
  '{accTab === "ledger" && <LedgerTab ledger={ledger} />}',
  '{accTab === "ledger" && <LedgerTab ledger={ledger} />}\n                {accTab === "coa" && <ChartOfAccountsTab accounts={chartAccounts} onAddAccount={() => setIsAddAccountOpen(true)} />}'
);

// 6. Inject the overlay popup below Employee Dialog
const popupCode = `
      <Dialog open={isAddAccountOpen} onClose={(v) => { if(!isSavingEmployee) setIsAddAccountOpen(v); }} static={true}>
        <DialogPanel className="max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-6">
            <Title className="font-black text-slate-800">Add Account Plan</Title>
            <button className="text-slate-400 hover:text-slate-600" onClick={() => setIsAddAccountOpen(false)}>×</button>
          </div>
          <div className="space-y-4">
             <div>
               <Text className="text-xs uppercase font-bold text-slate-500 mb-1">Account Code</Text>
               <TextInput placeholder="e.g. 1.1.3" value={newAccountForm.code} onChange={e => setNewAccountForm({...newAccountForm, code: e.target.value})} />
               <Text className="text-[10px] text-slate-400 mt-1">Use dot decimal notation (e.g., 5.1.4) to auto-nest.</Text>
             </div>
             <div>
               <Text className="text-xs uppercase font-bold text-slate-500 mb-1">Account Name</Text>
               <TextInput placeholder="e.g. Prepaid Insurance" value={newAccountForm.name} onChange={e => setNewAccountForm({...newAccountForm, name: e.target.value})} />
             </div>
             <div>
               <Text className="text-xs uppercase font-bold text-slate-500 mb-1">Classification Type</Text>
               <Select value={newAccountForm.type} onValueChange={v => setNewAccountForm({...newAccountForm, type: v as any})}>
                 <SelectItem value="ASSET">Asset (Ativo)</SelectItem>
                 <SelectItem value="LIABILITY">Liability (Passivo)</SelectItem>
                 <SelectItem value="EQUITY">Equity (Patrimônio)</SelectItem>
                 <SelectItem value="REVENUE">Revenue (Receita)</SelectItem>
                 <SelectItem value="EXPENSE">Expense (Despesa)</SelectItem>
               </Select>
             </div>
             <div className="flex items-center gap-2 mt-4 ml-1">
               <input type="checkbox" id="isGroup" checked={newAccountForm.isGroup} onChange={e => setNewAccountForm({...newAccountForm, isGroup: e.target.checked})} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" />
               <label htmlFor="isGroup" className="text-sm font-semibold text-slate-700 cursor-pointer">This is a Group Account</label>
             </div>
          </div>
          <div className="mt-8 flex justify-end gap-3">
            <Button size="sm" variant="secondary" onClick={() => setIsAddAccountOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={async () => {
                const added = await addChartAccount(newAccountForm);
                setChartAccounts(prev => [...prev, added]);
                setIsAddAccountOpen(false);
                setNewAccountForm({ name: "", code: "", type: "EXPENSE", isGroup: false });
            }}>Add Account</Button>
          </div>
        </DialogPanel>
      </Dialog>
`;

c = c.replace(
  '</DialogPanel>\n      </Dialog>\n    </div>',
  '</DialogPanel>\n      </Dialog>\n' + popupCode + '    </div>'
);

fs.writeFileSync('apps/web/app/(dashboard)/platform/finance/page.tsx', c, 'utf8');
console.log('Script done.');
