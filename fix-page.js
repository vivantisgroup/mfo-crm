const fs = require('fs');
let content = fs.readFileSync('apps/web/app/(dashboard)/platform/finance/page.tsx', 'utf8');

const replacement = `function EmployeesTab({ employees, onAddClick }: { employees: any[], onAddClick: () => void }) {
  if (!employees.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-lg border border-slate-200 shadow-sm mt-4">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-2xl">👥</div>
        <h3 className="text-lg font-bold text-slate-800">No Employees Found</h3>
        <p className="text-sm text-slate-500 max-w-sm mt-2 mb-4">There are no employees registered on the platform directory.</p>
        <Button onClick={onAddClick} icon={() => <span className="mr-2">➕</span>}>Add First Employee</Button>
      </div>
    );
  }
  return (
    <Card className="mt-4 shadow-sm border-slate-200">
      <Flex justifyContent="between" className="mb-6">
        <Title>Employee Directory</Title>
        <Button size="sm" onClick={onAddClick} icon={() => <span className="mr-2">➕</span>}>New Employee</Button>
      </Flex>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {employees.map(emp => (
          <div key={emp.id} className="p-4 rounded-xl border border-slate-200 flex flex-col items-start bg-slate-50/50 hover:border-indigo-200 transition-colors">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-lg mb-3">
              {emp.name.charAt(0)}
            </div>
            <h4 className="font-bold text-slate-800 text-base">{emp.name}</h4>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{emp.title} • {emp.department}</p>
            <div className="text-xs text-slate-500 mb-1">Type: <span className="font-bold text-emerald-600 capitalize">{emp.employmentType}</span></div>
            <div className="text-xs text-slate-500">Base Salary: <span className="font-mono text-slate-800">\${(emp.baseSalary).toLocaleString()}</span></div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CommissionsTab({ employees }: { employees?: any[] }) {
  return (
    <Card className="mt-4 shadow-sm border-slate-200">
      <Title>Commission Accounting</Title>
      <Text className="mt-2 text-slate-500">Commissions engine is syncing with the Revenue pipeline...</Text>
    </Card>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function FinanceHubPage() {
  usePageTitle("Finance Control Center");
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);

  // Revenue state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [renewals, setRenewals] = useState<RenewalRecord[]>([]);
  const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([]);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState<any>({ name: "", code: "", type: "EXPENSE", isGroup: false });
  const [contacts, setContacts] = useState<PlatformContact[]>([]);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [newExpenseForm, setNewExpenseForm] = useState({
    name: "",
    vendor: "",
    category: "software",
    amountUsd: 0,
    frequency: "monthly",
    description: "",
    startDate: new Date().toISOString().split("T")[0],
  });

  // Expenses state
  const [expensesList, setExpensesList] = useState<PlatformExpense[]>([]);
  const [expensesSummary, setExpensesSummary] = useState<Expense[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [
          livePlans,
          liveSubs,
          liveInvoices,
          liveExpenses,
          liveRenewals,
          liveOrgs,
          liveLedger,
          liveEmps,
          liveMembers,
          liveContacts,
          liveCOA,
        ] = await Promise.all([
          getPlans(),
          getAllSubscriptions(),
          getAllInvoices(),
          getAllExpenses(),
          listRenewals(),
          getAllOrgs(),
          getLedgerEntries(),
          getEmployees(),
          getTenantMembers("platform").catch(() => []),
          getContactsForOrg("MFO-Central-Platform-Org-Id").catch(() => []),
          getChartOfAccounts()
        ]);

        setPlans(
          livePlans.map((p) => ({
            id: p.code,
            name: p.name,
            priceMonthly: p.baseMonthly,
            priceAnnual: p.baseAnnual,
            seats: p.maxSeats,
            color: p.color,
          })),
        );

        setSubscribers(
`;

const startIdx = content.indexOf('function EmployeesTab({ employees, onAddClick }: { employees: any[], onAddClick: () => void }) {');
const endMarker = '        setSubscribers(';
const endIdx = content.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
  const newContent = content.substring(0, startIdx) + replacement + content.substring(endIdx + endMarker.length);
  fs.writeFileSync('apps/web/app/(dashboard)/platform/finance/page.tsx', newContent);
  console.log('Fixed exactly using clean boundaries.');
} else {
  console.log('Could not find markers', startIdx, endIdx);
}
