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
  const cacheDirs = [".next", ".next-e2e", ".next-runtime", ".next-dev-runtime"];

  for (const cacheDir of cacheDirs) {
    const target = path.resolve(root, cacheDir);
    if (path.dirname(target) !== root || !fs.existsSync(target)) continue;

    try {
      removePath(target);
      continue;
    } catch {
      // Fall through to a more defensive cleanup for Windows file-handle races.
    }

    for (const entry of fs.readdirSync(target)) {
      const entryPath = path.join(target, entry);
      try {
        removePath(entryPath);
      } catch (error) {
        console.warn(`Nao foi possivel remover ${entryPath}; seguindo com cache residual.`, error);
      }
    }

    try {
      fs.rmdirSync(target);
    } catch (error) {
      console.warn(`Nao foi possivel remover ${target} completamente; seguindo com cache residual.`, error);
    }
  }
}

if (require.main === module) {
  cleanNext();
}

module.exports = cleanNext;
