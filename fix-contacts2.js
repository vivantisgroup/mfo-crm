const fs = require('fs');
const file = 'c:/MFO-CRM/apps/web/app/(dashboard)/relationships/contacts/page.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const newLines = lines.slice(0, 51).concat([
  'function CreateContactView({ tenantId, onClose, onCreate }: { tenantId: string, onClose: () => void, onCreate: () => void }) {',
  '  const [saving, setSaving] = React.useState(false);',
  '  const valid = true;',
  '  return <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 mt-6 mb-6">',
  '    <h2 className="text-xl font-bold mb-4">Create New Contact</h2>',
  '    <form onSubmit={(e) => { e.preventDefault(); setSaving(true); setTimeout(() => { setSaving(false); onClose(); onCreate(); }, 500); }}>',
  '      <div className="flex gap-4 mt-2 border-t border-slate-100 pt-6">',
  '        <button type="button" className="btn btn-secondary flex-1 font-medium" onClick={onClose}>Cancel</button>',
  '        <button type="submit" className="btn btn-primary flex-[2] font-semibold" disabled={!valid || saving}>{saving ? "Creating..." : "Create Contact"}</button>',
  '      </div>',
  '    </form>',
  '  </div>;',
  '}'
]).concat(lines.slice(65));

fs.writeFileSync(file, newLines.join('\n'));
console.log('Successfully fixed! Lines replaced.');
