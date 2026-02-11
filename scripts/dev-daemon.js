const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pidFile = path.join(root, ".dev.pid");
const outFile = path.join(root, "dev.out.log");
const errFile = path.join(root, "dev.err.log");

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readExistingPid() {
  try {
    const raw = fs.readFileSync(pidFile, "utf8").trim();
    const pid = Number(raw);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

const existing = readExistingPid();
if (existing && isRunning(existing)) {
  console.log(`Dev server already running (pid ${existing}).`);
  process.exit(0);
}

// Reset logs (truncate). Deleting can fail on Windows if a previous process
// still holds the file handle.
try {
  fs.writeFileSync(outFile, "");
} catch {
  // ignore
}

try {
  fs.writeFileSync(errFile, "");
} catch {
  // ignore
}

const isWin = process.platform === "win32";

const devNoForkScript = path.join(root, "scripts", "dev-no-fork.cjs");
if (!fs.existsSync(devNoForkScript)) {
  console.error("dev-no-fork script not found. Check scripts/dev-no-fork.cjs.");
  process.exit(1);
}

const outFd = fs.openSync(outFile, "a");
const errFd = fs.openSync(errFile, "a");

// Run in-process dev server starter to avoid environments where `child_process.fork`
// is blocked (EPERM) for the Next.js CLI.
const command = process.execPath;
const args = [devNoForkScript];

const child = spawn(command, args, {
  cwd: root,
  env: { ...process.env, NEXT_DISABLE_TURBOPACK: "1" },
  detached: true,
  stdio: ["ignore", outFd, errFd],
});

child.unref();
fs.writeFileSync(pidFile, String(child.pid), "utf8");

console.log(`Dev server started (pid ${child.pid}).`);
console.log(`Logs: ${path.basename(outFile)} / ${path.basename(errFile)}`);
console.log("Open: http://localhost:3000");
