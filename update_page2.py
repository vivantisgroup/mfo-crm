import re

with open('apps/web/app/(dashboard)/platform/finance/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add sub-components
if "function LedgerTab(" not in text:
    components = """
function LedgerTab({ ledger }: { ledger: LedgerEntry[] }) {
  return (
    <div className="animate-fade-in py-6">
      <Card className="p-0 overflow-hidden">
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
            {ledger.map((entry) => (
              <TableRow key={entry.id} className="hover:bg-tremor-background-subtle">
                <TableCell className="font-mono text-xs text-slate-500">{fmtDate(entry.date)}</TableCell>
                <TableCell className="font-semibold text-tremor-content-strong">{entry.accountName} <span className="text-xs font-normal text-slate-400">({entry.accountId})</span></TableCell>
                <TableCell><Badge size="xs" color="slate">{entry.type}</Badge></TableCell>
                <TableCell>{entry.description}</TableCell>
                <TableCell className="text-right font-mono">{entry.debit > 0 ? fmt(entry.debit) : '-'}</TableCell>
                <TableCell className="text-right font-mono">{entry.credit > 0 ? fmt(entry.credit) : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function EmployeesTab({ employees }: { employees: Employee[] }) {
  return (
    <div className="animate-fade-in py-6">
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Employee</TableHeaderCell>
              <TableHeaderCell>Title & Dept</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Location</TableHeaderCell>
              <TableHeaderCell>Base Salary</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((emp) => (
              <TableRow key={emp.id} className="hover:bg-tremor-background-subtle">
                <TableCell className="font-bold text-tremor-content-strong">{emp.name}</TableCell>
                <TableCell>
                  <div className="font-medium">{emp.title}</div>
                  <div className="text-xs text-slate-500 mt-1">{emp.department}</div>
                </TableCell>
                <TableCell><Badge size="xs" color="indigo">{emp.employmentType}</Badge></TableCell>
                <TableCell>{emp.location}</TableCell>
                <TableCell className="font-semibold">{fmt(emp.baseSalary)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function CommissionsTab({ employees }: { employees: Employee[] }) {
  const reps = employees.filter(e => e.department === 'Sales' && e.quota);
  return (
    <div className="animate-fade-in py-6">
      <Grid numItemsSm={1} numItemsLg={3} className="gap-6 mb-6">
        {reps.map(rep => (
          <Card key={rep.id} decoration="top" decorationColor="emerald">
            <Text className="font-bold">{rep.name}</Text>
            <Text className="text-xs mt-1 text-slate-500">{rep.title}</Text>
            <Flex className="mt-4 border-t border-slate-100 pt-4">
              <div>
                <Text className="text-xs font-bold text-slate-400 uppercase">YTD Comm</Text>
                <Metric className="text-xl text-emerald-600">{fmt(rep.ytdCommission || 0)}</Metric>
              </div>
              <div className="text-right">
                <Text className="text-xs font-bold text-slate-400 uppercase">Quota</Text>
                <Text className="text-xl font-bold">{fmt(rep.quota || 0)}</Text>
              </div>
            </Flex>
          </Card>
        ))}
      </Grid>
    </div>
  );
}

// --- Main Page Component ----------------------------------------------------
"""
    text = text.replace("// --- Main Page Component ----------------------------------------------------", components)

if "Accounting & Ledgers" not in text:
    pass # handled above

panels_to_inject = """            {/* --- ACCOUNTING PANEL --- */}
            <TabPanel>
              <SecondaryDock tabs={ACC_TABS} activeTab={accTab} onTabChange={setAccTab} />
              <div className=\"page-wrapper animate-fade-in w-full lg:px-6 pt-6 pb-12 overflow-y-auto\">
                {accTab === 'ledger' && <LedgerTab ledger={ledger} />}
                {accTab === 'pl' && <Card><Title>P&L Statement</Title><Text className="mt-4">Aggregated view coming soon.</Text></Card>}
                {accTab === 'balance' && <Card><Title>Balance Sheet</Title><Text className="mt-4">Summary coming soon.</Text></Card>}
              </div>
            </TabPanel>

            {/* --- PEOPLE & COMMISSIONS PANEL --- */}
            <TabPanel>
              <SecondaryDock tabs={PPL_TABS} activeTab={pplTab} onTabChange={setPplTab} />
              <div className=\"page-wrapper animate-fade-in w-full lg:px-6 pt-6 pb-12 overflow-y-auto\">
                {pplTab === 'directory' && <EmployeesTab employees={employees} />}
                {pplTab === 'commissions' && <CommissionsTab employees={employees} />}
                {pplTab === 'payroll' && <Card><Title>Payroll Cycle</Title><Text className="mt-4">Integration summary coming soon.</Text></Card>}
              </div>
            </TabPanel>
          </TabPanels>"""

if "ACCOUNTING PANEL" not in text:
    text = text.replace("          </TabPanels>", panels_to_inject)

with open('apps/web/app/(dashboard)/platform/finance/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

