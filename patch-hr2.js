const fs = require('fs');

let code = fs.readFileSync('apps/web/app/(dashboard)/platform/hr/page.tsx', 'utf8');

// Add usePageTitle
if (!code.includes('usePageTitle')) {
  code = code.replace("import { useAuth } from '@/lib/AuthContext';", "import { useAuth } from '@/lib/AuthContext';\nimport { usePageTitle } from '@/lib/PageTitleContext';");
}

// Add state for EmployeeDetailView
if (!code.includes('detailEmpId')) {
  code = code.replace("const [peopleSearch, setPeopleSearch] = useState('');", "const [peopleSearch, setPeopleSearch] = useState('');\n  const [detailEmpId, setDetailEmpId] = useState<string|null>(null);");
}

// Remove the Add Employee state and modal
code = code.replace(/const \[showAddEmployee, setShowAddEmployee\] = useState\(false\);\n  const \[empForm, setEmpForm\] = useState<Partial<Employee>>\(\{\}\);\n/, '');

const handleAddEmpMatch = /const handleAddEmployee = async \(\) => \{\n[\s\S]*?setEmpForm\(\{\}\);\n  \};\n/;
code = code.replace(handleAddEmpMatch, '');

// Clean the slide-over from JSX
let slide1 = code.indexOf("{/* Slide-over: Add Employee */}");
if (slide1 !== -1) {
  let slide2 = code.indexOf("{/* Slide-over: Add Commission */}");
  if (slide2 !== -1) {
    code = code.substring(0, slide1) + code.substring(slide2);
  }
}

// Ensure the new component exists
const newComponent = `
function EmployeeDetailComponent({ emp, onBack, onSave }: { emp: any, onBack: () => void, onSave: (f: any) => Promise<void> }) {
  const { setPageTitle } = usePageTitle();
  
  useEffect(() => {
    setPageTitle(emp.id === "new" ? "HR Control Center / People Directory / New Registration" : "HR Control Center / People Directory / " + (emp.name || 'Editing'));
    return () => setPageTitle("HR Control Center");
  }, [emp, setPageTitle]);

  const [form, setForm] = useState<any>(emp);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    await onSave(form);
    setIsSaving(false);
  };

  return (
    <div className="max-w-4xl mx-auto py-2 animate-fade-in relative z-10 w-full mb-20 space-y-6">
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
              <TextInput type="date" value={form.startDate ? form.startDate.split("T")[0] : ""} onChange={e => setForm({...form, startDate: e.target.value})} disabled={isSaving} />
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
                  <SelectItem value="Executive">Executive</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
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
`;

if (!code.includes('EmployeeDetailComponent')) {
  code = code.replace("export default function HumanResourcesPage() {", newComponent + "\nexport default function HumanResourcesPage() {");
}

// Modify the renderPeople function
const oldRenderMatch = code.match(/const renderPeople = \(\) => \([\s\S]*?\);\n/);
if (oldRenderMatch) {
  const innerHtml = oldRenderMatch[0]
     .replace("setShowAddEmployee(true)", 'setDetailEmpId("new")')
     .replace("const renderPeople = () => (", "const renderPeopleList = () => (");
     
  const newRenderBlock = "  const handleSaveEmp = async (form: any) => {\n" +
"    if (form.id === 'new') {\n" +
"       const newEmp = await addEmployee({\n" +
"         name: form.name,\n" +
"         title: form.title || '',\n" +
"         department: form.department as any,\n" +
"         employmentType: (form.employmentType as any) || 'Full-Time',\n" +
"         baseSalary: Number(form.baseSalary),\n" +
"         location: form.location || '',\n" +
"         startDate: form.startDate || new Date().toISOString(),\n" +
"         avatarUrl: 'https://api.dicebear.com/7.x/notionists/svg?seed=' + form.name\n" +
"       });\n" +
"       setEmployees([...employees, newEmp]);\n" +
"    } else {\n" +
"       // if edit exists\n" +
"    }\n" +
"    setDetailEmpId(null);\n" +
"  };\n\n" +
  innerHtml + "\n\n" +
"  const renderPeople = () => {\n" +
"    if (detailEmpId) {\n" +
"      const empData = detailEmpId === 'new' \n" +
"         ? { id: 'new', name: '', title: '', department: 'Engineering', employmentType: 'Full-Time', location: '', baseSalary: 0 } \n" +
"         : employees.find(e => e.id === detailEmpId);\n" +
"      \n" +
"      return <EmployeeDetailComponent emp={empData} onBack={() => setDetailEmpId(null)} onSave={handleSaveEmp} />;\n" +
"    }\n" +
"    return renderPeopleList();\n" +
"  };\n";
  code = code.replace(oldRenderMatch[0], newRenderBlock);
}

// Hook usePageTitle inside the top level
if (!code.includes("setPageTitle('HR Control Center')")) {
  code = code.replace("const { user } = useAuth();", "const { user } = useAuth();\n  const { setPageTitle } = usePageTitle();\n  useEffect(() => { setPageTitle('HR Control Center'); }, [setPageTitle]);");
}

fs.writeFileSync('apps/web/app/(dashboard)/platform/hr/page.tsx', code);
console.log('Patched HR page');
