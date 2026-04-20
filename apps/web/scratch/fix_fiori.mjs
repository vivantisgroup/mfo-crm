import fs from 'fs';
import path from 'path';

const rootDir = 'c:\\MFO-CRM\\apps\\web\\app\\(dashboard)';
const componentsDir = 'c:\\MFO-CRM\\apps\\web\\components';

function traverse(dir) {
    let files = [];
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            files = files.concat(traverse(fullPath));
        } else if (fullPath.endsWith('.tsx')) {
            files.push(fullPath);
        }
    }
    return files;
}

const allFiles = traverse(rootDir).concat(traverse(componentsDir));

let modifiedCount = 0;

for (const file of allFiles) {
    if (file.includes('FioriBase.tsx')) continue;
    
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // We use robust regexes to replace buttons with FioriButton where class 'btn' is used
    // We must also replace the closing tags.
    // To do this safely, we will only replace `<button className="btn...` and then immediately replace the CLOSING tag `</button>` ONLY if we are sure it's a structural hit.
    // Actually, `ts-morph` or `jscodeshift` is safer. But we can do a naive targeted pass:
    
    // Pass 1: Primary buttons
    content = content.replace(/<button([^>]*?)className=(["'][^"']*?\bbtn\s+btn-primary\b[^"']*?["'])([^>]*?)>/g, '<FioriButton variant="Emphasized"$1$3>');
    
    // Pass 2: Secondary buttons
    content = content.replace(/<button([^>]*?)className=(["'][^"']*?\bbtn\s+btn-secondary\b[^"']*?["'])([^>]*?)>/g, '<FioriButton variant="Standard"$1$3>');

    // Pass 3: Ghost buttons
    content = content.replace(/<button([^>]*?)className=(["'][^"']*?\bbtn\s+btn-ghost\b[^"']*?["'])([^>]*?)>/g, '<FioriButton variant="Ghost"$1$3>');

    // Pass 4: Other raw btn
    content = content.replace(/<button([^>]*?)className=(["'][^"']*?\bbtn\b[^"']*?["'])([^>]*?)>/g, '<FioriButton$1$3>');

    // Replace closing tag conditionally: if we modified the content, it's very likely we replaced a button tag. 
    // To replace `</button>` with `</FioriButton>`, we must match them manually. 
    // This script won't replace `</button>` safely without AST because of nested buttons without classes.
    // Instead of replacing all button loops, I will not do this massively because it WILL break nested buttons.
}

