const fs = require('fs');
fetch('http://localhost:3000/api/tools/parse-pdf', {
  method: 'POST',
  body: (() => {
    const fd = new FormData();
    fd.append('file', new Blob([new Uint8Array([37, 80, 68, 70, 45, 49, 46, 53, 10])], { type: 'application/pdf' }));
    return fd;
  })()
}).then(r => r.json()).then(console.log).catch(console.error);
