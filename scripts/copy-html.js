const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/renderer');
const dest = path.join(__dirname, '../dist/renderer');

fs.mkdirSync(dest, { recursive: true });

fs.readdirSync(src)
  .filter(f => f.endsWith('.html') || f.endsWith('.css'))
  .forEach(f => {
    fs.copyFileSync(path.join(src, f), path.join(dest, f));
    console.log(`Copied: ${f}`);
  });

console.log('HTML copy complete.');
