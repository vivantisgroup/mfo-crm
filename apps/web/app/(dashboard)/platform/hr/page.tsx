'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Title, Subtitle, Text, Badge, Button, TextInput, Select, SelectItem, Metric, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell, BarChart } from '@tremor/react';
import { useAuth } from '@/lib/AuthContext';
import { usePageTitle } from '@/lib/PageTitleContext';
import { SecondaryDock } from '@/components/SecondaryDock';
import { Users, Building, Receipt, FileText, CheckCircle2, UserPlus, FileSpreadsheet, Download, Search, DollarSign, ReceiptText, X, PlusCircle, Trash2, Edit } from 'lucide-react';
import { Employee, CommissionRecord, PayRun, Department, getEmployees, getCommissions, getPayruns, getDepartments, addEmployee, updateEmployee, addCommission, addPayrun, updatePayrunStatus, addDepartment, deleteDepartment, updateDepartment } from '@/lib/hrService';

function fmtMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}


function EmployeeDetailComponent({ emp, departments, onBack, onSave }: { emp: any, departments: any[], onBack: () => void, onSave: (f: any) => Promise<void> }) {
  const [form, setForm] = useState<any>(emp);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    await onSave(form);
    setIsSaving(false);
  };

  return (
    <div className="mx-auto py-2 animate-fade-in relative z-10 w-full mb-20 space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <Button variant="light" color="slate" onClick={onBack}>← Directory</Button>
          <Title>{emp.id === "new" ? "Register New Employee" : "Edit Profile"}</Title>
        </div>
        <Button onClick={save} disabled={isSaving || !form.name || !form.department || !form.baseSalary}>
          {isSaving ? "Saving..." : "Save Profile"}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        <Card className="shadow-sm border-slate-200">
          <Title className="mb-4">Personal Details</Title>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Full Name</label>
              <TextInput value={form.name} onChange={e => setForm({...form, name: e.target.value})} disabled={isSaving} placeholder="Jane Doe" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Location</label>
              <TextInput value={form.location || ""} onChange={e => setForm({...form, location: e.target.value})} disabled={isSaving} placeholder="Remote, UK" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Start Date</label>
              <TextInput type={"date" as any} value={form.startDate ? form.startDate.split("T")[0] : ""} onChange={e => setForm({...form, startDate: e.target.value})} disabled={isSaving} />
            </div>
          </div>
        </Card>
        
        <Card className="shadow-sm border-slate-200">
          <Title className="mb-4">Employment Data</Title>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Title / Role</label>
              <TextInput value={form.title} onChange={e => setForm({...form, title: e.target.value})} disabled={isSaving} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">Department</label>
                <Select value={form.department} onValueChange={v => setForm({...form, department: v})} disabled={isSaving}>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">Type</label>
                <Select value={form.employmentType || "Full-Time"} onValueChange={v => setForm({...form, employmentType: v})} disabled={isSaving}>
                  <SelectItem value="Full-Time">Full-Time</SelectItem>
                  <SelectItem value="Contractor">Contractor</SelectItem>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Base Salary (USD)</label>
              <TextInput type="number" value={form.baseSalary || ""} onChange={e => setForm({...form, baseSalary: Number(e.target.value)})} disabled={isSaving} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function HumanResourcesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'people'|'departments'|'commissions'|'payroll'>('people');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [payruns, setPayruns] = useState<PayRun[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [peopleSearch, setPeopleSearch] = useState('');
  const [detailEmpId, setDetailEmpId] = useState<string|null>(null);
  const [deptSearch, setDeptSearch] = useState('');

  const handleBackFromDetail = useCallback(() => setDetailEmpId(null), []);
  const detailEmp = useMemo(() => detailEmpId && detailEmpId !== 'new' ? employees.find(e => e.id === detailEmpId) : null, [detailEmpId, employees]);

  const titleStr = detailEmpId 
    ? (detailEmpId === 'new' ? "Register Employee" : `Edit ${detailEmp?.name || ''}`)
    : 'HR Control Center';

  const titleCrumbs = useMemo(() => {
    if (!detailEmpId) return undefined;
    return [
      { label: 'Directory', onClick: handleBackFromDetail },
      { label: detailEmpId === "new" ? "New Registration" : "Edit Profile" }
    ];
  }, [detailEmpId, handleBackFromDetail]);

  usePageTitle(titleStr, undefined, titleCrumbs);

  // Modals state
  
  const [showAddCommission, setShowAddCommission] = useState(false);
  const [commForm, setCommForm] = useState<Partial<CommissionRecord>>({});

  const [showAddDept, setShowAddDept] = useState(false);
  const [deptForm, setDeptForm] = useState<Partial<Department>>({});

  useEffect(() => {
    async function init() {
      setLoading(true);
      const [ppl, coms, pruns, depts] = await Promise.all([
        getEmployees(),
        getCommissions(),
        getPayruns(),
        getDepartments()
      ]);
      setEmployees(ppl);
      setCommissions(coms);
      setPayruns(pruns);
      setDepartments(depts);
      setLoading(false);
    }
    init();
  }, []);

  
  const handleAddCommission = async () => {
    if(!commForm.employeeName || !commForm.commissionAmount) return;
    const newComm = await addCommission({
      employeeId: 'manual',
      employeeName: commForm.employeeName,
      dealName: commForm.dealName || 'Manual Adjustment',
      dealValueUsd: Number(commForm.dealValueUsd || 0),
      commissionAmount: Number(commForm.commissionAmount),
      timestamp: new Date().toISOString(),
      status: 'pending'
    });
    setCommissions([newComm, ...commissions]);
    setShowAddCommission(false);
    setCommForm({});
  };

  const handleGeneratePayRun = async () => {
    const totalBaseMonthly = employees.reduce((acc, e) => acc + (e.baseSalary / 12), 0);
    const pendingComms = commissions.filter(c => c.status === 'pending');
    const totalPendingComms = pendingComms.reduce((acc, c) => acc + c.commissionAmount, 0);

    const period = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date());
    const taxes = (totalBaseMonthly + totalPendingComms) * 0.20;
    const net = (totalBaseMonthly + totalPendingComms) - taxes;

    const pr = await addPayrun({
      period, status: 'draft', totalBaseSalaries: totalBaseMonthly, totalCommissions: totalPendingComms, totalTaxes: taxes, netPayout: net, runDate: new Date().toISOString()
    });
    setPayruns([pr, ...payruns]);
  };

  const handleApprovePayrun = async (id: string) => {
    await updatePayrunStatus(id, 'approved');
    setPayruns(payruns.map(p => p.id === id ? { ...p, status: 'approved' } : p));
  };

    const handleAddDepartment = async () => {
    if (!deptForm.name) return;
    if (deptForm.id) {
       const oldDept = departments.find(d => d.id === deptForm.id);
       await updateDepartment(deptForm.id, {
         name: deptForm.name,
         headCfo: deptForm.headCfo || '',
         annualBudget: Number(deptForm.annualBudget || 0)
       });
       setDepartments(departments.map(d => d.id === deptForm.id ? { ...deptForm } as Department : d));
       
       if (oldDept && oldDept.name !== deptForm.name) {
          const employeesToUpdate = employees.filter(e => e.department === oldDept.name);
          await Promise.all(employeesToUpdate.map(e => 
             updateEmployee(e.id, { department: deptForm.name as any })
          ));
          setEmployees(employees.map(e => e.department === oldDept.name ? { ...e, department: deptForm.name } as any : e));
       }
    } else {
       const newDept = await addDepartment({
         name: deptForm.name,
         headCfo: deptForm.headCfo || '',
         annualBudget: Number(deptForm.annualBudget || 0)
       });
       setDepartments([...departments, newDept]);
    }
    setShowAddDept(false);
    setDeptForm({});
  };

  const handleDeleteDepartment = async (id: string) => {
    if(!confirm('Are you sure you want to permanently delete this department?')) return;
    await deleteDepartment(id);
    setDepartments(departments.filter(d => d.id !== id));
  };

  const TABS = [
    { id: 'people', label: 'People Directory', icon: <Users size={16} /> },
    { id: 'departments', label: 'Departments', icon: <Building size={16} /> },
    { id: 'commissions', label: 'Commissions', icon: <DollarSign size={16} /> },
    { id: 'payroll', label: 'Payroll Runs', icon: <ReceiptText size={16} /> },
  ];

  const filteredPeople = useMemo(() => {
    return employees.filter(e => e.name.toLowerCase().includes(peopleSearch.toLowerCase()) || e.title.toLowerCase().includes(peopleSearch.toLowerCase()));
  }, [employees, peopleSearch]);

  const totalHeadcount = employees.length;
  const totalAnnualBase = employees.reduce((acc, e) => acc + e.baseSalary, 0);

    const handleSaveEmp = async (form: any) => {
    if (form.id === 'new') {
       const newEmp = await addEmployee({
         name: form.name,
         title: form.title || '',
         department: form.department as any,
         employmentType: (form.employmentType as any) || 'Full-Time',
         baseSalary: Number(form.baseSalary),
         location: form.location || '',
         startDate: form.startDate || new Date().toISOString(),
         avatarUrl: 'https://api.dicebear.com/7.x/notionists/svg?seed=' + form.name
       });
       setEmployees([...employees, newEmp]);
    } else {
       await updateEmployee(form.id, {
         name: form.name,
         title: form.title || '',
         department: form.department as any,
         employmentType: (form.employmentType as any) || 'Full-Time',
         baseSalary: Number(form.baseSalary),
         location: form.location || '',
         startDate: form.startDate || new Date().toISOString()
       });
       setEmployees(employees.map(e => e.id === form.id ? { ...form } as any : e));
    }
    setDetailEmpId(null);
  };

const renderPeopleList = () => (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
         <div className="header-search cursor-text w-full max-w-md">
           <Search size={16} className="text-tertiary shrink-0" />
           <input 
             type="text"
             className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] text-primary placeholder-tertiary"
             placeholder="Search employees..." 
             value={peopleSearch}
             onChange={(e) => setPeopleSearch(e.target.value)}
           />
         </div>
         <Button icon={() => <UserPlus size={16} className="mr-2 inline"/>} onClick={() => setDetailEmpId("new")}>Add Employee</Button>
      </div>
      
      <Card className="p-0 overflow-hidden shadow-sm border-slate-200">
        <Table>
          <TableHead className="bg-slate-50 border-b border-slate-200">
            <TableRow>
              <TableHeaderCell>Employee</TableHeaderCell>
              <TableHeaderCell>Title & Department</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Location</TableHeaderCell>
              <TableHeaderCell className="text-right">Base Salary</TableHeaderCell>
              <TableHeaderCell className="text-right">Start Date</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPeople.map((emp) => (
              <TableRow key={emp.id} onClick={() => setDetailEmpId(emp.id)} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <img src={emp.avatarUrl} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200" alt={emp.name} />
                    <div className="font-medium text-slate-900 group-hover:text-brand-600 transition-colors">{emp.name}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-slate-900">{emp.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{emp.department}</div>
                </TableCell>
                <TableCell>
                  <Badge size="xs" color={emp.employmentType === 'Full-Time' ? 'indigo' : 'slate'}>
                    {emp.employmentType}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-600">{emp.location}</TableCell>
                <TableCell className="text-right font-medium text-slate-900">{fmtMoney(emp.baseSalary)}</TableCell>
                <TableCell className="text-right text-slate-500">{new Date(emp.startDate).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );


  const renderPeople = () => {
    if (detailEmpId) {
      const empData = detailEmpId === 'new' 
         ? { id: 'new', name: '', title: '', department: 'Engineering', employmentType: 'Full-Time', location: '', baseSalary: 0 } 
         : employees.find(e => e.id === detailEmpId);
      
      return <EmployeeDetailComponent emp={empData} departments={departments} onBack={handleBackFromDetail} onSave={handleSaveEmp} />;

    }
    return renderPeopleList();
  };

  const renderDepartments = () => {
    if (showAddDept) {
      return (
        <div className="animate-fade-in space-y-6 max-w-2xl">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <button onClick={() => setShowAddDept(false)} className="hover:text-brand-600 transition-colors">Departments</button>
            <span>/</span>
            <span className="text-slate-900 font-medium">Add Department</span>
          </div>

          <Card className="shadow-sm border-slate-200">
             <Title>{deptForm.id ? 'Edit Department' : 'Provision New Department'}</Title>
             <Text className="mt-2 text-slate-500">Enter the details for the new department to add to your organization.</Text>
             
             <div className="mt-6 flex flex-col gap-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block">Department Name</label>
                  <TextInput placeholder="Engineering" value={deptForm.name || ""} onChange={e => setDeptForm({...deptForm, name: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block">Head / CFO (Optional)</label>
                  <TextInput placeholder="Jane Doe" value={deptForm.headCfo || ""} onChange={e => setDeptForm({...deptForm, headCfo: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block">Annual Budget Forecast (USD)</label>
                  <TextInput placeholder="1200000" type={"number" as any} value={deptForm.annualBudget?.toString() || ""} onChange={e => setDeptForm({...deptForm, annualBudget: Number(e.target.value)})} />
                </div>
             </div>
             
             <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
               <Button variant="secondary" onClick={() => setShowAddDept(false)}>Cancel</Button>
               <Button onClick={handleAddDepartment} disabled={!deptForm.name}>{deptForm.id ? 'Save Changes' : 'Confirm Provision'}</Button>
             </div>
          </Card>
        </div>
      );
    }

    // Aggregate by department
    const deptMap: Record<string, { headcount: number, totalBase: number }> = {};
    employees.forEach(e => {
       if (!deptMap[e.department]) deptMap[e.department] = { headcount: 0, totalBase: 0 };
       deptMap[e.department].headcount += 1;
       deptMap[e.department].totalBase += e.baseSalary;
    });
    
    const chartData = [...departments].sort((a,b) => a.name.localeCompare(b.name)).map(d => ({
       Department: d.name,
       "Total Base Burden": deptMap[d.name]?.totalBase || 0,
       Headcount: deptMap[d.name]?.headcount || 0
    }));

    const sortedDepts = [...departments].filter(d => d.name.toLowerCase().includes(deptSearch.toLowerCase())).sort((a,b) => a.name.localeCompare(b.name));

    return (
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between">
           <div className="header-search cursor-text w-full max-w-md">
             <Search size={16} className="text-tertiary shrink-0" />
             <input 
               type="text"
               className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] text-primary placeholder-tertiary"
               placeholder="Search departments..." 
               value={deptSearch}
               onChange={(e) => setDeptSearch(e.target.value)}
             />
           </div>
           <Button icon={() => <Building size={16} className="mr-2 inline"/>} onClick={() => { setDeptForm({}); setShowAddDept(true); }}>Add Department</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-sm border-slate-200" decoration="top" decorationColor="blue">
            <Text>Total Headcount</Text>
            <Metric className="text-3xl font-black mt-2">{totalHeadcount}</Metric>
          </Card>
          <Card className="shadow-sm border-slate-200" decoration="top" decorationColor="emerald">
            <Text>Total Annual Base</Text>
            <Metric className="text-3xl font-black mt-2">{fmtMoney(totalAnnualBase)}</Metric>
          </Card>
          <Card className="shadow-sm border-slate-200" decoration="top" decorationColor="amber">
            <Text>Average Base Salary</Text>
            <Metric className="text-3xl font-black mt-2">{fmtMoney(totalHeadcount ? totalAnnualBase / totalHeadcount : 0)}</Metric>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          <Card className="shadow-sm border-slate-200 lg:col-span-4">
            <Title>Salary Burden Distribution</Title>
            <BarChart
              className="mt-6 h-72"
              data={chartData}
              index="Department"
              categories={["Total Base Burden"]}
              colors={["indigo"]}
              valueFormatter={fmtMoney}
            />
          </Card>
          
          <Card className="shadow-sm border-slate-200 overflow-hidden px-0 pb-0 lg:col-span-8">
             <div className="px-6 pb-4">
               <Title>Cost Centers Registry</Title>
             </div>
             <Table>
                <TableHead className="bg-slate-50">
                   <TableRow>
                     <TableHeaderCell>Department Name</TableHeaderCell>
                     <TableHeaderCell>Head/CFO</TableHeaderCell>
                     <TableHeaderCell className="text-right">Headcount</TableHeaderCell>
                     <TableHeaderCell className="text-right">Deployed Annual Cost</TableHeaderCell>
                     <TableHeaderCell className="text-right">Annual Budget</TableHeaderCell>
                     <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                   </TableRow>
                </TableHead>
                <TableBody>
                   {sortedDepts.map(dept => {
                     const hc = deptMap[dept.name]?.headcount || 0;
                     const cost = deptMap[dept.name]?.totalBase || 0;
                     return (
                       <TableRow key={dept.id}>
                          <TableCell className="font-bold text-slate-900">{dept.name}</TableCell>
                          <TableCell className="text-slate-600">{dept.headCfo || '—'}</TableCell>
                          <TableCell className="text-right">{hc}</TableCell>
                          <TableCell className="text-right font-medium text-slate-900">{fmtMoney(cost)}</TableCell>
                          <TableCell className="text-right text-slate-500">{dept.annualBudget ? fmtMoney(dept.annualBudget) : '—'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { setDeptForm(dept); setShowAddDept(true); }} className="text-slate-500 hover:text-brand-600 bg-slate-50 hover:bg-slate-100 p-1.5 rounded transition-colors" title="Edit Department">
                                <Edit size={14} />
                              </button>
                              <button onClick={() => handleDeleteDepartment(dept.id)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition-colors" title="Delete Department">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </TableCell>
                       </TableRow>
                     );
                   })}
                   {sortedDepts.length === 0 && (
                     <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-slate-500">No departments configured.</TableCell>
                     </TableRow>
                   )}
                </TableBody>
             </Table>
          </Card>
        </div>
      </div>
    );
  };

  const renderCommissions = () => (
    <div className="animate-fade-in space-y-6">
       <div className="flex justify-between items-end">
         <div>
           <Title>Sales Commissions</Title>
           <Text>Recent payouts generated by closed-won CRM opportunities or manual overrides.</Text>
         </div>
         <Button icon={() => <PlusCircle size={16} className="mr-2 inline"/>} onClick={() => setShowAddCommission(true)}>Log Commission</Button>
       </div>

       <Card className="p-0 overflow-hidden shadow-sm border-slate-200">
         <Table>
            <TableHead className="bg-slate-50">
              <TableRow>
                <TableHeaderCell>Rep Name</TableHeaderCell>
                <TableHeaderCell>Deal Origination</TableHeaderCell>
                <TableHeaderCell className="text-right">Deal Value (ARR)</TableHeaderCell>
                <TableHeaderCell className="text-right">Final Commission</TableHeaderCell>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {commissions.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-slate-900">{c.employeeName}</TableCell>
                  <TableCell className="text-slate-600">{c.dealName}</TableCell>
                  <TableCell className="text-right text-slate-500">{fmtMoney(c.dealValueUsd)}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-600">+{fmtMoney(c.commissionAmount)}</TableCell>
                  <TableCell className="text-slate-500">{new Date(c.timestamp).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge size="xs" color={c.status === 'paid' ? 'emerald' : 'amber'}>
                      {c.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
         </Table>
       </Card>
    </div>
  );

  const renderPayroll = () => (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
         <div>
           <Title>Payroll Runs</Title>
           <Text>Execute and approve total compensation outflows.</Text>
         </div>
         <Button icon={() => <CheckCircle2 size={16} className="mr-2 inline"/>} onClick={handleGeneratePayRun}>New Pay Run</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {payruns.map(run => (
          <Card key={run.id} className="shadow-sm border-slate-200 flex flex-col pt-5">
             <div className="flex justify-between items-start mb-6">
               <div>
                  <div className="text-sm font-bold text-slate-900 mb-1">{run.period} Payload</div>
                  <div className="text-xs text-slate-500">Authorized: {run.runDate ? new Date(run.runDate).toLocaleDateString() : '—'}</div>
               </div>
               <Badge size="xs" color={run.status === 'paid' ? 'emerald' : run.status === 'approved' ? 'blue' : 'amber'}>
                  {run.status.toUpperCase()}
               </Badge>
             </div>

             <div className="space-y-3 mb-6">
               <div className="flex justify-between text-sm">
                 <span className="text-slate-500">Monthly Base Wages</span>
                 <span className="font-medium text-slate-900">{fmtMoney(run.totalBaseSalaries)}</span>
               </div>
               <div className="flex justify-between text-sm">
                 <span className="text-slate-500">Sales Commissions</span>
                 <span className="font-medium text-slate-900">{fmtMoney(run.totalCommissions)}</span>
               </div>
               <div className="flex justify-between text-sm">
                 <span className="text-slate-500">Taxes & Deductions</span>
                 <span className="font-medium text-rose-600">-{fmtMoney(run.totalTaxes)}</span>
               </div>
               <div className="h-px bg-slate-200 my-2" />
               <div className="flex justify-between items-end pt-1">
                 <span className="text-sm font-bold text-slate-900">Net Corporate Burn</span>
                 <span className="text-xl font-black text-slate-900">{fmtMoney(run.netPayout)}</span>
               </div>
             </div>

             <div className="mt-auto flex gap-2">
               {run.status === 'draft' ? (
                 <Button className="w-full" color="blue" onClick={() => handleApprovePayrun(run.id)}>Approve Run</Button>
               ) : (
                 <Button className="w-full" variant="secondary" icon={() => <Download size={14} className="mr-1 inline" />}>Export Ledger</Button>
               )}
             </div>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col absolute inset-0 overflow-hidden bg-canvas z-0">
      <SecondaryDock 
        tabs={TABS} 
        activeTab={activeTab} 
        onTabChange={(id) => setActiveTab(id as any)} 
      />
      
      <main className="flex-1 flex flex-col min-h-0 relative animate-fade-in px-4 lg:px-8 pt-8 pb-12 overflow-y-auto w-full">
        {loading ? (
          <div className="flex-1 flex justify-center items-center text-slate-400">Loading HR Data...</div>
        ) : (
          <div className="w-full h-full flex flex-col">
            {activeTab === 'people' && renderPeople()}
            {activeTab === 'departments' && renderDepartments()}
            {activeTab === 'commissions' && renderCommissions()}
            {activeTab === 'payroll' && renderPayroll()}
          </div>
        )}
      </main>

      {/* Slide-over: Add Commission */}
      {showAddCommission && (
        <>
        <div className="fixed inset-0 bg-black/30 z-40 transition-opacity" onClick={() => setShowAddCommission(false)} />
        <div className="fixed top-0 right-0 w-96 h-full bg-[var(--bg-surface)] border-l border-[var(--border)] shadow-2xl z-50 flex flex-col pt-4 animate-fade-in">
          <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-elevated)]">
            <h3 className="font-bold text-lg text-[var(--text-primary)]">Log Commission</h3>
            <button onClick={() => setShowAddCommission(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={20} /></button>
          </div>
          <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
            <div><label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">Agent / Employee Name</label><TextInput placeholder="Carlos Mendoza" onChange={e => setCommForm({...commForm, employeeName: e.target.value})} /></div>
            <div><label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">Deal Info</label><TextInput placeholder="Annual SaaS Renewal" onChange={e => setCommForm({...commForm, dealName: e.target.value})} /></div>
            <div><label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">Deal Value (ARR)</label><TextInput placeholder="50000" type="number" onChange={e => setCommForm({...commForm, dealValueUsd: Number(e.target.value)})} /></div>
            <div><label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">Commission Amount Payout</label><TextInput placeholder="5000" type="number" onChange={e => setCommForm({...commForm, commissionAmount: Number(e.target.value)})} /></div>
          </div>
          <div className="p-6 border-t border-[var(--border)] bg-[var(--bg-elevated)] pb-12">
            <Button className="w-full" onClick={handleAddCommission} disabled={!commForm.employeeName || !commForm.commissionAmount}>Log Commission</Button>
          </div>
        </div>
        </>
      )}

    </div>
  );
}
