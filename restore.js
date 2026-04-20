const fs = require('fs');
const file = 'c:/MFO-CRM/apps/web/app/(dashboard)/platform/finance/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// I will just find the substring up to line <TabPanels className="mt-0 flex-1 flex flex-col min-h-0 relative overflow-hidden h-full shadow-inner">
const splitPoint = '<TabPanels className="mt-0 flex-1 flex flex-col min-h-0 relative overflow-hidden h-full shadow-inner">';
const parts = txt.split(splitPoint);
if (parts.length >= 2) {
  const top = parts[0];
  const replacement = splitPoint + \
            {/* --- REVENUE PANEL --- */}
            <TabPanel>
              <div className="flex-1 flex flex-col min-h-0 relative h-full">
              <SecondaryDock
                tabs={REV_TABS}
                activeTab={revTab}
                onTabChange={setRevTab}
              />
              <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 w-full animate-fade-in relative bg-slate-50/50">
                {revTab === "overview" && (
                  <OverviewTab
                    plans={plans}
                    subscribers={subscribers}
                    expenses={expensesSummary}
                  />
                )}
                {revTab === "subscribers" && (
                  <SubscribersTab plans={plans} subscribers={subscribers} />
                )}
                {revTab === "invoices" && <InvoicesTab invoices={invoices} />}
                {revTab === "renewals" && (
                  <div className="py-6">
                    <RenewalsModule />
                  </div>
                )}
              </div>
              </div>
            </TabPanel>

            {/* --- EXPENSES PANEL --- */}
            <TabPanel>
              <div className="flex-1 flex flex-col min-h-0 relative h-full">
              <SecondaryDock
                tabs={EXP_TABS}
                activeTab={expTab}
                onTabChange={setExpTab}
              />
              <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 w-full animate-fade-in relative bg-slate-50/50">
                <div className="flex justify-end mb-4 gap-3">
                  <Button size="sm" variant="secondary">
                    ? Refresh
                  </Button>
                  <Button
                    size="sm"
                    icon={() => <span className="mr-2">??</span>}
                  >
                    Scan Receipt PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setIsManualEntryOpen(true)}
                  >
                    Manual Entry
                  </Button>
                </div>

                {expTab === "dashboard" && (
                  <div className="space-y-6">
                    <Grid numItemsSm={1} numItemsLg={4} className="gap-6">
                      <Card
                        className="shadow-sm border-slate-200"
                        decoration="top"
                        decorationColor="blue"
                      >
                        <Text>MTD Operating Expenses</Text>
                        <Metric className="text-3xl font-black">
                          {fmt(totalMonthlyOpex)}
                        </Metric>
                      </Card>
                      <Card
                        className="shadow-sm border-slate-200"
                        decoration="top"
                        decorationColor="amber"
                      >
                        <Text>Projected Annual Burn</Text>
                        <Metric className="text-3xl font-black">
                          {fmt(projectedAnnual)}
                        </Metric>
                      </Card>
                      <Card
                        className="shadow-sm border-slate-200"
                        decoration="top"
                        decorationColor="rose"
                      >
                        <Text>Pending Reimbursable</Text>
                        <Metric className="text-3xl font-black">
                          {fmt(1850)}
                        </Metric>
                        <Flex className="mt-4">
                          <Badge color="rose" size="xs">
                            Requires signature
                          </Badge>
                        </Flex>
                      </Card>
                      <Card
                        className="shadow-sm border-slate-200"
                        decoration="top"
                        decorationColor="emerald"
                      >
                        <Text>Cash Efficiency Ratio</Text>
                        <Metric className="text-3xl font-black">1.14x</Metric>
                      </Card>
                    </Grid>
                    <Grid numItemsSm={1} numItemsLg={3} className="gap-6">
                      <Card className="col-span-2 shadow-sm border-slate-200">
                        <Title>T30 Expense Trend</Title>
                        <AreaChart
                          className="mt-6 h-72"
                          data={chartData}
                          index="Month"
                          categories={[
                            "SaaS & Infra",
                            "Travel & Ent",
                            "Office & Supplies",
                            "Legal & Prof",
                          ]}
                          colors={["blue", "rose", "amber", "emerald"]}
                          valueFormatter={(num) =>
                            \\\
                          }
                          stack={true}
                        />
                      </Card>
                      <Card className="shadow-sm border-slate-200">
                        <Title>Top SaaS Subscriptions</Title>
                        <div className="mt-6 space-y-4">
                          {activeExpenses
                            .sort(
                              (a, b) =>
                                monthlyEquivalent(b) - monthlyEquivalent(a),
                            )
                            .slice(0, 5)
                            .map((e) => (
                              <div
                                key={e.id}
                                className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0"
                              >
                                <div>
                                  <p className="font-bold text-sm">{e.name}</p>
                                  <p className="text-xs text-slate-500">
                                    {e.vendor}
                                  </p>
                                </div>
                                <p className="font-bold text-sm">
                                  {fmt(monthlyEquivalent(e))}
                                </p>
                              </div>
                            ))}
                        </div>
                      </Card>
                    </Grid>
                  </div>
                )}
                {expTab === "reporting" && (
                  <Card className="p-0 shadow-sm border-slate-200 overflow-hidden">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>Date</TableHeaderCell>
                          <TableHeaderCell>Merchant</TableHeaderCell>
                          <TableHeaderCell>Category</TableHeaderCell>
                          <TableHeaderCell>Amount</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {expensesList.map((exp) => (
                          <TableRow key={exp.id}>
                            <TableCell>{fmtDate(exp.startDate)}</TableCell>
                            <TableCell>{exp.vendor || exp.name}</TableCell>
                            <TableCell>{exp.category}</TableCell>
                            <TableCell className="font-bold text-rose-500">
                              {fmt(exp.amountUsd)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}
                {expTab === "approvals" && (
                  <Card>
                    <Title>Approvals Queue</Title>
                    <Text className="mt-4 text-slate-500">
                      All pending reimbursements caught by automated rules.
                    </Text>
                  </Card>
                )}
              </div>
              </div>
            </TabPanel>
            {/* --- ACCOUNTING PANEL --- */}
            <TabPanel>
              <div className="flex-1 flex flex-col min-h-0 relative h-full">
              <SecondaryDock
                tabs={ACC_TABS}
                activeTab={accTab}
                onTabChange={setAccTab}
              />
              <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 w-full animate-fade-in relative bg-slate-50/50">
                {accTab === "ledger" && <LedgerTab ledger={ledger} />}
                {accTab === "coa" && <ChartOfAccountsTab accounts={chartAccounts} onAddAccount={() => setIsAddAccountOpen(true)} />}
                {accTab === "pl" && (
                  <Card>
                    <Title>P&L Statement</Title>
                    <Text className="mt-4">Aggregated view coming soon.</Text>
                  </Card>
                )}
                {accTab === "balance" && (
                  <Card>
                    <Title>Balance Sheet</Title>
                    <Text className="mt-4">Summary coming soon.</Text>
                  </Card>
                )}
              </div>
              </div>
            </TabPanel>

            
            {/* --- PEOPLE & PAYROLL PANEL --- */}
            <TabPanel>
              <div className="flex-1 flex flex-col min-h-0 relative h-full">
              <SecondaryDock
                tabs={PPL_TABS}
                activeTab={pplTab}
                onTabChange={setPplTab}
              />
              <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 w-full animate-fade-in relative bg-slate-50/50">
                {pplTab === "directory" && <EmployeesTab employees={employees} onAddClick={async (data) => { if (!data) return; const { addEmployee } = await import("@/lib/peopleService"); const newEmp = await addEmployee(data); setEmployees(prev => [...prev, newEmp]); }} updateEmp={async (id, data) => { const { updateEmployee } = await import("@/lib/peopleService"); await updateEmployee(id, data); setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...data } : e)); }} contacts={contacts} members={members} />}
                {pplTab === "commissions" && <CommissionsTab employees={employees} />}
                {pplTab === "payroll" && (
                  <Card>
                    <Title>Payroll Overview</Title>
                    <Text className="mt-4">Integration processing...</Text>
                  </Card>
                )}
              </div>
              </div>
            </TabPanel>
          </TabPanels>
        </main>
        </TabGroup>
      </div>

      {/* Modal removed for center view */}

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
    </div>
  );
}
\;

  fs.writeFileSync(file, top + replacement);
}
