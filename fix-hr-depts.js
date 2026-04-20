const fs = require('fs');

let code = fs.readFileSync('apps/web/app/(dashboard)/platform/hr/page.tsx', 'utf8');

// 1. Modify imports to include updateDepartment
if (!code.includes('updateDepartment')) {
  code = code.replace(
    "deleteDepartment } from '@/lib/hrService';", 
    "deleteDepartment, updateDepartment } from '@/lib/hrService';"
  );
}

// 2. Modify handleAddDepartment
const newHandleAdd = `  const handleAddDepartment = async () => {
    if (!deptForm.name) return;
    if (deptForm.id) {
       await updateDepartment(deptForm.id, {
         name: deptForm.name,
         headCfo: deptForm.headCfo || '',
         annualBudget: Number(deptForm.annualBudget || 0)
       });
       setDepartments(departments.map(d => d.id === deptForm.id ? { ...deptForm } as Department : d));
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
  };`;

const oldHandleAddRegex = /const handleAddDepartment = async \(\) => \{[\s\S]*?setDeptForm\(\{\}\);\n  \};\n/;
code = code.replace(oldHandleAddRegex, newHandleAdd + '\n');

// 3. Modify chartData logic
const oldChartData = `    const chartData = Object.keys(deptMap).map(k => ({
       Department: k,
       "Total Base Burden": deptMap[k].totalBase,
       Headcount: deptMap[k].headcount
    }));`;

const newChartData = `    const chartData = [...departments].sort((a,b) => a.name.localeCompare(b.name)).map(d => ({
       Department: d.name,
       "Total Base Burden": deptMap[d.name]?.totalBase || 0,
       Headcount: deptMap[d.name]?.headcount || 0
    }));`;
code = code.replace(oldChartData, newChartData);

// 4. Update the form values in the Provision form to show edit vs add text and pre-fill form
// We need to pass `value` to TextInputs!
// "Provision New Department"
code = code.replace("<Title>Provision New Department</Title>", "<Title>{deptForm.id ? 'Edit Department' : 'Provision New Department'}</Title>");
// onChange={e => setDeptForm({...deptForm, name: e.target.value})} -> we need to add value={deptForm.name || ""}
code = code.replace(/<TextInput placeholder="Engineering" onChange=\{e => setDeptForm\(\{\.\.\.deptForm, name: e\.target\.value\}\)\} \/>/g, 
  '<TextInput placeholder="Engineering" value={deptForm.name || ""} onChange={e => setDeptForm({...deptForm, name: e.target.value})} />');
code = code.replace(/<TextInput placeholder="Jane Doe" onChange=\{e => setDeptForm\(\{\.\.\.deptForm, headCfo: e\.target\.value\}\)\} \/>/g, 
  '<TextInput placeholder="Jane Doe" value={deptForm.headCfo || ""} onChange={e => setDeptForm({...deptForm, headCfo: e.target.value})} />');
code = code.replace(/<TextInput placeholder="1200000" type="number" onChange=\{e => setDeptForm\(\{\.\.\.deptForm, annualBudget: Number\(e\.target\.value\)\}\} \/>/g, 
  '<TextInput placeholder="1200000" type="number" value={deptForm.annualBudget || ""} onChange={e => setDeptForm({...deptForm, annualBudget: Number(e.target.value)})} />');
// Wait, the number one has `Number(e.target.value)}` ending brace. Let's just fix it globally if it matches:
code = code.replace(/<TextInput placeholder="1200000" type="number" onChange=\{e => setDeptForm\(\{\.\.\.deptForm, annualBudget: Number\(e\.target\.value\)\}\)\} \/>/,
  '<TextInput placeholder="1200000" type="number" value={deptForm.annualBudget || ""} onChange={e => setDeptForm({...deptForm, annualBudget: Number(e.target.value)})} />');

// <Button onClick={handleAddDepartment} disabled={!deptForm.name}>Confirm Provision</Button>
code = code.replace("<Button onClick={handleAddDepartment} disabled={!deptForm.name}>Confirm Provision</Button>", "<Button onClick={handleAddDepartment} disabled={!deptForm.name}>{deptForm.id ? 'Save Changes' : 'Confirm Provision'}</Button>");

// Also when they click "Add Department" button at the top of the table:
code = code.replace("onClick={() => setShowAddDept(true)}>Add Department</Button>", "onClick={() => { setDeptForm({}); setShowAddDept(true); }}>Add Department</Button>");

// 5. Add the edit button to the table row
const oldActions = `<TableCell className="text-right">
                            <button onClick={() => handleDeleteDepartment(dept.id)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition-colors" title="Delete Department">
                              <Trash2 size={14} />
                            </button>
                          </TableCell>`;

const newActions = `<TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { setDeptForm(dept); setShowAddDept(true); }} className="text-slate-500 hover:text-brand-600 bg-slate-50 hover:bg-slate-100 p-1.5 rounded transition-colors" title="Edit Department">
                                <Edit size={14} />
                              </button>
                              <button onClick={() => handleDeleteDepartment(dept.id)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition-colors" title="Delete Department">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </TableCell>`;

code = code.replace(oldActions, newActions);

fs.writeFileSync('apps/web/app/(dashboard)/platform/hr/page.tsx', code);
console.log('Fixed HR Departments logic');
