'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-slate-100 text-slate-700 shadow hover:bg-slate-200 h-9 px-4 py-2" onClick={onBack}>← Directory</button>
          <h3 className="text-lg font-semibold tracking-tight mb-2">{emp.id === "new" ? "Register New Employee" : "Edit Profile"}</h3>
        </div>
        <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2" onClick={save} disabled={isSaving || !form.name || !form.department || !form.baseSalary}>
          {isSaving ? "Saving..." : "Save Profile"}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 shadow-sm border-slate-200">
          <h3 className="text-lg font-semibold tracking-tight mb-2 mb-4">Personal Details</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Full Name</label>
              <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={form.name} onChange={e => setForm({...form, name: e.target.value})} disabled={isSaving} placeholder="Jane Doe" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Location</label>
              <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={form.location || ""} onChange={e => setForm({...form, location: e.target.value})} disabled={isSaving} placeholder="Remote, UK" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Start Date</label>
              <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" type={"date" as any} value={form.startDate ? form.startDate.split("T")[0] : ""} onChange={e => setForm({...form, startDate: e.target.value})} disabled={isSaving} />
            </div>
          </div>
        </div>
        
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 shadow-sm border-slate-200">
          <h3 className="text-lg font-semibold tracking-tight mb-2 mb-4">Employment Data</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Title / Role</label>
              <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={form.title} onChange={e => setForm({...form, title: e.target.value})} disabled={isSaving} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">Department</label>
                <select className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-sm ring-offset-background" value={form.department} onChange={e => setForm({...form, department: e.target.value})} disabled={isSaving}>
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">Type</label>
                <select className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-sm ring-offset-background" value={form.employmentType || "Full-Time"} onChange={e => setForm({...form, employmentType: e.target.value})} disabled={isSaving}>
                  <option value="Full-Time">Full-Time</option>
                  <option value="Contractor">Contractor</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Base Salary (USD)</label>
              <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" type="number" value={form.baseSalary || ""} onChange={e => setForm({...form, baseSalary: Number(e.target.value)})} disabled={isSaving} />
            </div>
          </div>
        </div>
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
         <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2" onClick={() => setDetailEmpId("new")}><UserPlus size={16} className="mr-2 inline"/>Add Employee</button>
      </div>
      
      <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-0 overflow-hidden shadow-sm border-slate-200">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Title & Department</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium text-right">Base Salary</th>
                <th className="px-4 py-3 font-medium text-right">Start Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPeople.map((emp) => (
                <tr key={emp.id} onClick={() => setDetailEmpId(emp.id)} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={emp.avatarUrl} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200" alt={emp.name} />
                      <div className="font-medium text-slate-900 group-hover:text-[var(--brand-600)] transition-colors">{emp.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900">{emp.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{emp.department}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent shadow-sm bg-indigo-50 text-indigo-700 border-indigo-200">
                      {emp.employmentType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{emp.location}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{fmtMoney(emp.baseSalary)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{new Date(emp.startDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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

          <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 shadow-sm border-slate-200">
             <h3 className="text-lg font-semibold tracking-tight mb-2">{deptForm.id ? 'Edit Department' : 'Provision New Department'}</h3>
             <div className="text-sm text-[var(--text-secondary)] mt-2 text-slate-500">Enter the details for the new department to add to your organization.</div>
             
             <div className="mt-6 flex flex-col gap-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block">Department Name</label>
                  <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" placeholder="Engineering" value={deptForm.name || ""} onChange={e => setDeptForm({...deptForm, name: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block">Head / CFO (Optional)</label>
                  <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" placeholder="Jane Doe" value={deptForm.headCfo || ""} onChange={e => setDeptForm({...deptForm, headCfo: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block">Annual Budget Forecast (USD)</label>
                  <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" placeholder="1200000" type={"number" as any} value={deptForm.annualBudget?.toString() || ""} onChange={e => setDeptForm({...deptForm, annualBudget: Number(e.target.value)})} />
                </div>
             </div>
             
             <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
               <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-slate-100 text-slate-900 shadow-sm hover:bg-slate-200 h-9 px-4 py-2" onClick={() => setShowAddDept(false)}>Cancel</button>
               <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2" onClick={handleAddDepartment} disabled={!deptForm.name}>{deptForm.id ? 'Save Changes' : 'Confirm Provision'}</button>
             </div>
          </div>
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
           <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2" onClick={() => { setDeptForm({}); setShowAddDept(true); }}><Building size={16} className="mr-2 inline"/>Add Department</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 shadow-sm border-t-4 border-t-blue-500 border-x-slate-200 border-b-slate-200">
            <div className="text-sm text-[var(--text-secondary)]">Total Headcount</div>
            <div className="text-3xl font-bold tracking-tight text-3xl font-black mt-2">{totalHeadcount}</div>
          </div>
          <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 shadow-sm border-t-4 border-t-emerald-500 border-x-slate-200 border-b-slate-200">
            <div className="text-sm text-[var(--text-secondary)]">Total Annual Base</div>
            <div className="text-3xl font-bold tracking-tight text-3xl font-black mt-2">{fmtMoney(totalAnnualBase)}</div>
          </div>
          <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 shadow-sm border-t-4 border-t-amber-500 border-x-slate-200 border-b-slate-200">
            <div className="text-sm text-[var(--text-secondary)]">Average Base Salary</div>
            <div className="text-3xl font-bold tracking-tight text-3xl font-black mt-2">{fmtMoney(totalHeadcount ? totalAnnualBase / totalHeadcount : 0)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 shadow-sm border-slate-200 lg:col-span-4">
            <h3 className="text-lg font-semibold tracking-tight mb-2">Salary Burden Distribution</h3>
            <div className="mt-6 h-72 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg">
              <p className="text-sm text-slate-500">Chart visualization temporarily disabled</p>
            </div>
          </div>
          
          <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 shadow-sm border-slate-200 overflow-hidden px-0 pb-0 lg:col-span-8">
             <div className="px-6 pb-4">
               <h3 className="text-lg font-semibold tracking-tight mb-2">Cost Centers Registry</h3>
             </div>
             <div className="overflow-x-auto w-full">
               <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                     <tr>
                       <th className="px-4 py-3 font-medium">Department Name</th>
                       <th className="px-4 py-3 font-medium">Head/CFO</th>
                       <th className="px-4 py-3 font-medium text-right">Headcount</th>
                       <th className="px-4 py-3 font-medium text-right">Deployed Annual Cost</th>
                       <th className="px-4 py-3 font-medium text-right">Annual Budget</th>
                       <th className="px-4 py-3 font-medium text-right">Actions</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {sortedDepts.map(dept => {
                       const hc = deptMap[dept.name]?.headcount || 0;
                       const cost = deptMap[dept.name]?.totalBase || 0;
                       return (
                         <tr key={dept.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-bold text-slate-900">{dept.name}</td>
                            <td className="px-4 py-3 text-slate-600">{dept.headCfo || '—'}</td>
                            <td className="px-4 py-3 text-right">{hc}</td>
                            <td className="px-4 py-3 text-right font-medium text-slate-900">{fmtMoney(cost)}</td>
                            <td className="px-4 py-3 text-right text-slate-500">{dept.annualBudget ? fmtMoney(dept.annualBudget) : '—'}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => { setDeptForm(dept); setShowAddDept(true); }} className="text-slate-500 hover:text-[var(--brand-600)] bg-slate-50 hover:bg-slate-100 p-1.5 rounded transition-colors" title="Edit Department">
                                  <Edit size={14} />
                                </button>
                                <button onClick={() => handleDeleteDepartment(dept.id)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition-colors" title="Delete Department">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                         </tr>
                       );
                     })}
                     {sortedDepts.length === 0 && (
                       <tr>
                          <td colSpan={6} className="text-center py-6 text-slate-500">No departments configured.</td>
                       </tr>
                     )}
                  </tbody>
               </table>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCommissions = () => (
    <div className="animate-fade-in space-y-6">
       <div className="flex justify-between items-end">
         <div>
           <h3 className="text-lg font-semibold tracking-tight mb-2">Sales Commissions</h3>
           <div className="text-sm text-[var(--text-secondary)]">Recent payouts generated by closed-won CRM opportunities or manual overrides.</div>
         </div>
         <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2" onClick={() => setShowAddCommission(true)}><PlusCircle size={16} className="mr-2 inline"/>Log Commission</button>
       </div>

       <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 p-0 overflow-hidden shadow-sm border-slate-200">
         <div className="overflow-x-auto w-full">
           <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Rep Name</th>
                  <th className="px-4 py-3 font-medium">Deal Origination</th>
                  <th className="px-4 py-3 font-medium text-right">Deal Value (ARR)</th>
                  <th className="px-4 py-3 font-medium text-right">Final Commission</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {commissions.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.employeeName}</td>
                    <td className="px-4 py-3 text-slate-600">{c.dealName}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{fmtMoney(c.dealValueUsd)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">+{fmtMoney(c.commissionAmount)}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(c.timestamp).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${c.status === 'paid' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                        {c.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
           </table>
         </div>
       </div>
    </div>
  );

  const renderPayroll = () => (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
         <div>
           <h3 className="text-lg font-semibold tracking-tight mb-2">Payroll Runs</h3>
           <div className="text-sm text-[var(--text-secondary)]">Execute and approve total compensation outflows.</div>
         </div>
         <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2" onClick={handleGeneratePayRun}><CheckCircle2 size={16} className="mr-2 inline"/>New Pay Run</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {payruns.map(run => (
          <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 shadow-sm border-slate-200 flex flex-col pt-5" key={run.id}>
             <div className="flex justify-between items-start mb-6">
               <div>
                  <div className="text-sm font-bold text-slate-900 mb-1">{run.period} Payload</div>
                  <div className="text-xs text-slate-500">Authorized: {run.runDate ? new Date(run.runDate).toLocaleDateString() : '—'}</div>
               </div>
               <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-[10px] font-semibold transition-colors border-transparent bg-[var(--brand-500)] text-white shadow">
                  {run.status.toUpperCase()}
               </span>
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
                 <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-blue-600 hover:bg-blue-700 text-white shadow h-9 px-4 py-2 w-full" onClick={() => handleApprovePayrun(run.id)}>Approve Run</button>
               ) : (
                 <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-slate-100 text-slate-900 hover:bg-slate-200 shadow-sm h-9 px-4 py-2 w-full" onClick={() => {}}><Download size={14} className="mr-1 inline" />Export Ledger</button>
               )}
             </div>
          </div>
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
            <div><label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">Agent / Employee Name</label><input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" placeholder="Carlos Mendoza" onChange={e => setCommForm({...commForm, employeeName: e.target.value})} /></div>
            <div><label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">Deal Info</label><input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" placeholder="Annual SaaS Renewal" onChange={e => setCommForm({...commForm, dealName: e.target.value})} /></div>
            <div><label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">Deal Value (ARR)</label><input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" placeholder="50000" type="number" onChange={e => setCommForm({...commForm, dealValueUsd: Number(e.target.value)})} /></div>
            <div><label className="text-xs font-bold text-[var(--text-secondary)] mb-1 block">Commission Amount Payout</label><input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" placeholder="5000" type="number" onChange={e => setCommForm({...commForm, commissionAmount: Number(e.target.value)})} /></div>
          </div>
          <div className="p-6 border-t border-[var(--border)] bg-[var(--bg-elevated)] pb-12">
            <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2 w-full" onClick={handleAddCommission} disabled={!commForm.employeeName || !commForm.commissionAmount}>Log Commission</button>
          </div>
        </div>
        </>
      )}

    </div>
  );
}
