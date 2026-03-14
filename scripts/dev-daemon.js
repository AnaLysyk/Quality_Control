const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pidFile = path.join(root, ".dev.pid");
const outFile = path.join(root, "dev.out.log");
const errFile = path.join(root, "dev.err.log");
const devDistDir = ".next/dev-runtime";

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

try {
  fs.rmSync(path.join(root, devDistDir), { recursive: true, force: true });
} catch {
  // ignore
}

const isWin = process.platform === "win32";

// On Windows, `.cmd` shims (like node_modules/.bin/next.cmd) cannot be spawned
// directly without a shell. Use Node.js + Next's JS entrypoint instead.
const nextJsBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const nextBin = path.join(root, "node_modules", ".bin", "next");

if (isWin) {
  if (!fs.existsSync(nextJsBin)) {
    console.error("next CLI entry not found. Run `npm install` first.");
    process.exit(1);
  }
} else {
  if (!fs.existsSync(nextBin)) {
    console.error("next binary not found. Run `npm install` first.");
    process.exit(1);
  }
}

const outFd = fs.openSync(outFile, "a");
const errFd = fs.openSync(errFile, "a");

const command = isWin ? process.execPath : nextBin;
const args = isWin ? [nextJsBin, "dev", "--webpack"] : ["dev", "--webpack"];

const child = spawn(command, args, {
  cwd: root,
  env: { ...process.env, NEXT_DIST_DIR: devDistDir },
  detached: true,
  stdio: ["ignore", outFd, errFd],
});

child.unref();
fs.writeFileSync(pidFile, String(child.pid), "utf8");

console.log(`Dev server started (pid ${child.pid}).`);
console.log(`Logs: ${path.basename(outFile)} / ${path.basename(errFile)}`);
console.log("Open: http://localhost:3000");
