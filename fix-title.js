const fs = require('fs');
let code = fs.readFileSync('apps/web/app/(dashboard)/platform/hr/page.tsx', 'utf8');

const oldDetailHook = `  const { setPageTitle } = usePageTitle();
  
  useEffect(() => {
    setPageTitle(emp.id === "new" ? "HR Control Center / People Directory / New Registration" : "HR Control Center / People Directory / " + (emp.name || 'Editing'));
    return () => setPageTitle("HR Control Center");
  }, [emp, setPageTitle]);`;

const newDetailHook = `  usePageTitle(emp.id === "new" ? "HR Control Center / People Directory / New Registration" : "HR Control Center / People Directory / " + (emp.name || 'Editing'));`;

code = code.replace(oldDetailHook, newDetailHook);

const oldMainHook = `  const { user } = useAuth();
  const { setPageTitle } = usePageTitle();
  useEffect(() => { setPageTitle('HR Control Center'); }, [setPageTitle]);`;

const newMainHook = `  const { user } = useAuth();
  usePageTitle('HR Control Center');`;

code = code.replace(oldMainHook, newMainHook);

fs.writeFileSync('apps/web/app/(dashboard)/platform/hr/page.tsx', code);
console.log('Fixed usePageTitle bugs');
