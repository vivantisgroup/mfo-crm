const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '../app/(dashboard)');

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

  // Standardize the outer frame
  let newContent = content.replace(/<div className="page animate-fade-in">/g, '<div className="page-wrapper animate-fade-in mx-auto max-w-7xl">');
  newContent = newContent.replace(/<div className="page">/g, '<div className="page-wrapper animate-fade-in mx-auto max-w-7xl">');

  // Standardize the header block
  const headerRegex = /<div className="page-header"([\s\S]*?)<h1 className="page-title">([\s\S]*?)<\/h1>\s*<p className="page-subtitle">([\s\S]*?)<\/p>/g;
  
  if (headerRegex.test(newContent)) {
    newContent = newContent.replace(headerRegex, (match, p1, title, subtitle) => {
      // p1 captures any styling or inner divs immediately trailing "page-header"
      // We will completely replace the semantic shell
      return `<div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 pb-5 border-b border-tremor-border gap-4"${p1}<h1 className="text-3xl font-bold text-tremor-content-strong tracking-tight">${title}</h1>\n            <p className="mt-2 text-tremor-content">${subtitle}</p>`;
    });
  }

  // Also replace `<div className="card"` with tremor card equivalents on legacy panels
  newContent = newContent.replace(/<div className="card"/g, '<div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6"');
  newContent = newContent.replace(/<div className="card">/g, '<div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6">');


  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    changedCount++;
    console.log(`Refactored: ${path.relative(targetDir, filePath)}`);
  }
}

console.log(`\nSuccessfully deployed unified Tremor UI Layout across ${changedCount} pages.`);
