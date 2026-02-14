const { rmSync, existsSync } = require("fs");
const { spawn } = require("child_process");

function cleanDir(dir) {
  if (existsSync(dir)) {
    try {
      rmSync(dir, { recursive: true, force: true });
      console.log(`[clean] Removed ${dir}`);
    } catch {
      // ignore
    }
  }
}

cleanDir(".next");
cleanDir(".turbo");
cleanDir(".cache");

console.log("[dev-clean] Starting dev server...");
const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
  stdio: "inherit",
  shell: false,
});

function shutdown() {
  if (!child.killed) {
    child.kill();
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

child.on("close", (code) => {
  console.log(`[dev-clean] Dev server exited with code ${code}`);
  process.exit(code ?? 0);
});
