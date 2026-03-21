const fs = require('fs');
const path = require('path');

const target = process.argv[2];
if (!target) {
  console.error('Usage: node dump-bytes.js <file>');
  process.exit(2);
}

const p = path.resolve(process.cwd(), target);
if (!fs.existsSync(p)) {
  console.error('File not found:', p);
  process.exit(2);
}

const buf = fs.readFileSync(p);
const len = buf.length;
const show = Math.min(len, 64);
const bytes = [];
for (let i = 0; i < show; i++) bytes.push(buf[i].toString(16).padStart(2, '0'));
console.log('path:', target);
console.log('length:', len);
console.log('first', show, 'bytes (hex):', bytes.join(' '));
console.log('first bytes (ascii):', buf.slice(0, show).toString('utf8').replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
