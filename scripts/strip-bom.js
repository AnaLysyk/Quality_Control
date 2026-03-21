const fs = require('fs');
const path = require('path');

const target = process.argv[2];
if (!target) {
  console.error('Usage: node strip-bom.js <file>');
  process.exit(2);
}

const p = path.resolve(process.cwd(), target);
if (!fs.existsSync(p)) {
  console.error('File not found:', p);
  process.exit(2);
}

const buf = fs.readFileSync(p);
if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
  console.log('BOM detected — removing...');
  const newBuf = buf.slice(3);
  fs.writeFileSync(p, newBuf);
  console.log('BOM removed from', target);
} else {
  console.log('No BOM found in', target);
}
