const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '../app/(dashboard)');

// Recursively get all .tsx files
function getAllPageFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllPageFiles(fullPath, fileList);
    } else if (file === 'page.tsx' || file.endsWith('Page.tsx')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const pageFiles = getAllPageFiles(targetDir);
let changedCount = 0;

for (const filePath of pageFiles) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Pattern 1: Target the massive Tremor Flex Header with Button arrays we injected earlier
  const headerWithButtonsRegex = /<div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 pb-5 border-b border-tremor-border gap-4">\s*<div>[\s\S]*?<\/div>(\s*<div className="flex gap-3">[\s\S]*?<\/div>\s*)<\/div>/g;
  
  // Replace the entire header block with just the right-aligned action buttons floating compactly
  content = content.replace(headerWithButtonsRegex, (match, buttonSection) => {
    return `<div className="flex justify-end mb-6">${buttonSection}</div>`;
  });

  // Pattern 2: Target the massive Tremor Flex Header Without any action buttons (just empty or missing right col)
  const headerWithoutButtonsRegex = /<div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 pb-5 border-b border-tremor-border gap-4">\s*<div>[\s\S]*?<\/div>\s*<\/div>/g;
  
  content = content.replace(headerWithoutButtonsRegex, '');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    changedCount++;
    console.log(`Stripped redundant H1 headers from: ${path.relative(targetDir, filePath)}`);
  }
}

console.log(`\nSuccessfully optimized screen real estate across ${changedCount} pages.`);
