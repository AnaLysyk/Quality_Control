const fs = require("fs");
const path = require("path");

function removePath(target) {
  fs.rmSync(target, {
    recursive: true,
    force: true,
    maxRetries: 20,
    retryDelay: 100,
  });
}

function cleanNext() {
  const root = path.resolve(__dirname, "..");
  const nextDir = path.join(root, ".next");

  if (!fs.existsSync(nextDir)) {
    return;
  }

  try {
    removePath(nextDir);
    return;
  } catch {
    // Fall through to a more defensive cleanup for Windows file-handle races.
  }

  for (const entry of fs.readdirSync(nextDir)) {
    removePath(path.join(nextDir, entry));
  }

  try {
    fs.rmdirSync(nextDir);
  } catch (error) {
    console.error(`Falha ao limpar ${nextDir}:`, error);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  cleanNext();
}

module.exports = cleanNext;
