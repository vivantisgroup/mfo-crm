const fs = require('fs');
const path = require('path');

function doReplacements(code) {
  return code
    .replace(/getAllPills/g, 'getAllTags')
    .replace(/PillColor/g, 'TagColor')
    .replace(/Pill\[\]/g, 'Tag[]')
    .replace(/Pill\b/g, 'Tag')
    .replace(/Partial<Tag>/g, 'Partial<Tag>') // keep tag
    .replace(/MOCK_PILLS/g, 'MOCK_TAGS')
    .replace(/mock pills/g, 'mock tags')
    .replace(/platform_pills/g, 'platform_tags')
    .replace(/createPill/g, 'createTag')
    .replace(/updatePill/g, 'updateTag')
    .replace(/deletePill/g, 'deleteTag')
    .replace(/pillIds/g, 'tagIds')
    .replace(/pillId/g, 'tagId')
    .replace(/newPill/g, 'newTag')
    .replace(/pill-1/g, 'tag-1')
    .replace(/pill-2/g, 'tag-2')
    .replace(/pill-3/g, 'tag-3')
    .replace(/pill-4/g, 'tag-4')
    .replace(/pill-5/g, 'tag-5')
    .replace(/setPills/g, 'setTags')
    .replace(/pillService/g, 'tagService')
    .replace(/\bpills\b/gi, match => match === 'pills' ? 'tags' : 'Tags')
    .replace(/\bpill\b/gi, match => match === 'pill' ? 'tag' : 'Tag')
    .replace(/Tags \/ Tags/g, 'Tags');
}

function processFile(file) {
  const p = path.join('C:/MFO-CRM/apps/web', file);
  if (!fs.existsSync(p)) return;
  const original = fs.readFileSync(p, 'utf8');
  const modified = doReplacements(original);
  fs.writeFileSync(p, modified);
}

const oldPath = 'C:/MFO-CRM/apps/web/lib/pillService.ts';
const newPath = 'C:/MFO-CRM/apps/web/lib/tagService.ts';
if (fs.existsSync(oldPath)) {
  fs.renameSync(oldPath, newPath);
}

processFile('lib/tagService.ts');
processFile('lib/emailIntegrationService.ts');
processFile('app/(dashboard)/communications/page.tsx');

console.log("Rename complete.");
