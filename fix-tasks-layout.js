const fs = require('fs');
const content = fs.readFileSync('apps/web/app/(dashboard)/tasks/page.tsx', 'utf8');
const lines = content.split('\n');

const res = [];
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  if (line.includes("import { Search } from 'lucide-react';")) {
    res.push(line);
    res.push("import { LayoutDashboard, Layers, List, BarChart2 } from 'lucide-react';");
    res.push("import { SecondaryDock, type SecondaryDockTab } from '@/components/SecondaryDock';");
    continue;
  }
  
  if (line.includes("export default function TasksPage() {")) {
    res.push(line);
    res.push("  const { setTitle } = usePageTitle();");
    continue;
  }

  // Rewrite selectedTask return block FIRST inner div
  if (line.includes('<div className="page animate-fade-in" style={{ maxWidth: 1440, margin: \'0 auto\', height: \'calc(100vh - 84px)\' }}>')) {
    // We expect the parent to be <LiveModeGate...> and the child to be this <div>.
    // Wait, let's see if there were wrappers before. Currently there are no absolute inset wrappers here.
    // Let's add them.
    res.push('        <div className="flex flex-col absolute inset-0 overflow-y-auto bg-canvas z-0">');
    res.push('          <div className="page animate-fade-in" style={{ maxWidth: 1440, margin: \'0 auto\', paddingBottom: 60 }}>');
    continue;
  }

  // Rewrite selectedTask return block closing tags
  if (line.includes('</LiveModeGate>')) {
    // If it's the one inside if (selectedTask), we need to inject closing </div>
    // How to distinguish? Let's check previous line maybe? Or just keep state.
  }
  
  if (line.includes("const hasGlobalFilters =")) {
    res.push(line);
    res.push("  const MAIN_TABS: SecondaryDockTab[] = [");
    res.push("    { id: 'board', label: 'Board', icon: LayoutDashboard },");
    res.push("    { id: 'queue', label: 'Queues', icon: Layers },");
    res.push("    { id: 'list', label: 'List', icon: List },");
    res.push("    { id: 'analytics', label: 'Analytics', icon: BarChart2 },");
    res.push("  ];");
    res.push("");
    res.push("  useEffect(() => {");
    res.push("    if (!selectedTask) {");
    res.push("      setTitle('Workflows', 'Task Queues', undefined);");
    res.push("    }");
    res.push("  }, [setTitle, selectedTask]);");
    continue;
  }

  // Rewrite main return block
  if (line.includes('<div className="page animate-fade-in" style={{ maxWidth: 1440, margin: \'0 auto\' }}>')) {
    res.push('    <div className="flex flex-col absolute inset-0 overflow-hidden bg-canvas z-0">');
    res.push('      <SecondaryDock tabs={MAIN_TABS as any} activeTab={view} onTabChange={setView as any} />');
    res.push('      <main className="flex-1 flex flex-col min-h-0 relative animate-fade-in px-4 lg:px-8 pt-6 pb-12 overflow-y-auto w-full">');
    
    // Skip the old header
    while (i < lines.length && !lines[i].includes("view !== 'analytics' && (")) {
      i++;
    }
    i--; // So the loop picks up the filter bar line next iteration
    continue;
  }
  
  res.push(line);
}

// We also need to fix the closing tags for the newly added wrappers.
// For the `if (selectedTask)` branch, we opened an extra `<div className="flex flex-col absolute inset-0...">` 
// For the main branch, we changed `<div className="page...">` into `<div className="flex..."> <main>`
// The old code had one `</div>` before `</LiveModeGate>`. Now main branch needs `</main> </div>`.
// And selectedTask branch needs `</div> </div>`.
for (let i = 0; i < res.length; i++) {
  if (res[i].includes('</LiveModeGate>')) {
    if (res[i-1].includes('</div>')) {
      res[i-1] = res[i-1].replace('</div>', '</div>\n      </div>'); 
    }
  }
}

// Special pass to handle the <main> block closure
for (let i = res.length - 1; i >= 0; i--) {
  if (res[i].includes('</LiveModeGate>')) {
    // The last occurrence is the main branch
    res.splice(i, 0, '      </main>');
    res[i-1] = res[i-1].replace('</div>\n      </div>', '</div>'); // undo previous pass for this one if it matched
    break; // only do for the last one
  }
}

fs.writeFileSync('apps/web/app/(dashboard)/tasks/page.tsx', res.join('\n'), 'utf8');
