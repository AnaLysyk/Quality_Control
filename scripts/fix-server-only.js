const fs = require("fs");
const path = require("path");

const targets = [
  path.join(process.cwd(), "node_modules", "server-only", "empty.js"),
  path.join(process.cwd(), "node_modules", "next", "dist", "compiled", "server-only", "empty.js"),
];

for (const filePath of targets) {
  if (fs.existsSync(filePath)) continue;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "module.exports = {};\n", "utf8");
    console.log(`fix-server-only: created ${filePath}`);
  } catch (err) {
    console.warn(`fix-server-only: failed to create ${filePath}`, err);
  }
}
