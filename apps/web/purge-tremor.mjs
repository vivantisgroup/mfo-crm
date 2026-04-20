import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function getFiles(dir, ext = ['.tsx', '.ts']) {
  let results = [];
  const list = readdirSync(dir);
  for (const file of list) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath, ext));
    } else {
      if (ext.some(e => file.endsWith(e))) {
        results.push(filePath);
      }
    }
  }
  return results;
}

const files = [
  ...getFiles('c:/MFO-CRM/apps/web/app/(dashboard)'),
  ...getFiles('c:/MFO-CRM/apps/web/components')
];

let updatedFiles = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  let original = content;

  // Remove Tremor import
  content = content.replace(/import\s+\{[^}]+\}\s+from\s+['"]@tremor\/react['"];?\r?\n?/g, '');
  
  if (original === content) continue; // no tremor import found in file (already purged)

  // Replace Components uses precise tag bounds to avoid TableHead matching Tab
  content = content.replace(/<Card(\s+className=['"])([^'"]*)(['"])([^>]*)>/g, '<div$1bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 $2$3$4>');
  content = content.replace(/<Card(\s|>)/g, '<div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5"$1');
  content = content.replace(/<\/Card>/g, '</div>');

  content = content.replace(/<Title(\s+className=['"])([^'"]*)(['"])([^>]*)>/g, '<h3$1text-lg font-semibold tracking-tight mb-2 $2$3$4>');
  content = content.replace(/<Title(\s|>)/g, '<h3 className="text-lg font-semibold tracking-tight mb-2"$1');
  content = content.replace(/<\/Title>/g, '</h3>');

  content = content.replace(/<Text(\s+className=['"])([^'"]*)(['"])([^>]*)>/g, '<div$1text-sm text-[var(--text-secondary)] $2$3$4>');
  content = content.replace(/<Text(\s|>)/g, '<div className="text-sm text-[var(--text-secondary)]"$1');
  content = content.replace(/<\/Text>/g, '</div>');
  
  content = content.replace(/<Metric(\s+className=['"])([^'"]*)(['"])([^>]*)>/g, '<div$1text-3xl font-bold tracking-tight $2$3$4>');
  content = content.replace(/<Metric(\s|>)/g, '<div className="text-3xl font-bold tracking-tight"$1');
  content = content.replace(/<\/Metric>/g, '</div>');

  content = content.replace(/<TextInput(\s|>)/g, '<input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"$1');

  content = content.replace(/<Badge(\s|>)/g, '<span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-[var(--brand-500)] text-white shadow hover:bg-[var(--brand-600)]"$1');
  content = content.replace(/<\/Badge>/g, '</span>');

  content = content.replace(/<Button(\s+variant=['"]\w+['"])?(\s|>)/g, '<button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2"$1$2');
  content = content.replace(/<\/Button>/g, '</button>');
  
  content = content.replace(/<Select(\s|>)/g, '<select className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-sm ring-offset-background"$1');
  content = content.replace(/<\/Select>/g, '</select>');
  
  content = content.replace(/<SelectItem(\s|>)/g, '<option$1');
  content = content.replace(/<\/SelectItem>/g, '</option>');
  
  content = content.replace(/<TabGroup(\s|>)/g, '<div className="w-full"$1');
  content = content.replace(/<\/TabGroup>/g, '</div>');
  content = content.replace(/<TabList(\s|>)/g, '<div className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--bg-muted)] p-1 text-[var(--text-tertiary)]"$1');
  content = content.replace(/<\/TabList>/g, '</div>');
  
  content = content.replace(/<Tab(\s|>)/g, '<button className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] data-[selected]:bg-[var(--bg-surface)] data-[selected]:text-[var(--text-primary)] data-[selected]:shadow-sm"$1');
  content = content.replace(/<\/Tab>/g, '</button>');
  
  content = content.replace(/<TabPanels(\s|>)/g, '<div className="mt-2"$1');
  content = content.replace(/<\/TabPanels>/g, '</div>');
  content = content.replace(/<TabPanel(\s|>)/g, '<div className="mt-2 ring-offset-background"$1');
  content = content.replace(/<\/TabPanel>/g, '</div>');
  
  content = content.replace(/<Divider\s*\/>/g, '<hr className="my-4 border-t border-[var(--border)]" />');
  content = content.replace(/<Divider([^>]*)>/g, '<hr className="my-4 border-t border-[var(--border)]"$1/>');
  
  writeFileSync(file, content, 'utf8');
  console.log(`Purged Tremor safely from: ${file}`);
  updatedFiles++;
}

console.log(`\nCompleted safely. Updated ${updatedFiles} files.`);
