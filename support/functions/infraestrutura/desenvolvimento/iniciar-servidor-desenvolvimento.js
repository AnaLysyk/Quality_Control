const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const nextJsBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const nextBin = path.join(root, "node_modules", ".bin", "next");
const isWin = process.platform === "win32";
function tryTaskkill(targetPid) {
  execFileSync("taskkill", ["/PID", String(targetPid), "/T", "/F"], { stdio: "ignore" });
}

function readRepoNextPidsWindows() {
  const escapedRoot = root.replace(/'/g, "''");
  const cmd = `
$ErrorActionPreference='SilentlyContinue'
$root='${escapedRoot}'
Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq 'node.exe' -and
    $_.CommandLine -and
    ($_.CommandLine -like ('*' + $root + '*node_modules\\next\\dist\\*'))
  } |
  Select-Object -ExpandProperty ProcessId
`;

  const stdout = execFileSync("powershell", ["-NoProfile", "-Command", cmd], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => Number(line))
    .filter((value) => Number.isFinite(value));
}

function stopStaleRepoDevServers() {
  if (!isWin) return;

  const pids = new Set(readRepoNextPidsWindows());

  for (const pid of pids) {
    if (pid === process.pid) continue;
    try {
      tryTaskkill(pid);
    } catch {
      // ignore already-dead or unrelated processes
    }
  }
}

function removeStaleLocks() {
  for (const lockPath of [
    path.join(root, ".next", "dev", "lock"),
    path.join(root, ".next", "dev-runtime", "dev", "lock"),
    path.join(root, ".next", "dev-turbo", "dev", "lock"),
  ]) {
    try {
      fs.rmSync(lockPath, { force: true });
    } catch {
      // ignore
    }
  }
}

function removePath(targetPath) {
  try {
    fs.rmSync(targetPath, {
      recursive: true,
      force: true,
      maxRetries: 20,
      retryDelay: 100,
    });
  } catch (error) {
    console.warn(`[dev-start] Nao foi possivel limpar ${targetPath}; seguindo com cache residual.`, error);
  }
}

function cleanDevOutput() {
  for (const targetPath of [
    path.join(root, ".next", "dev"),
    path.join(root, ".next", "dev-runtime"),
    path.join(root, ".next", "dev-turbo"),
  ]) {
    if (fs.existsSync(targetPath)) {
      removePath(targetPath);
    }
  }
}

function run() {
  stopStaleRepoDevServers();
  removeStaleLocks();
  cleanDevOutput();

  const bundlerFlag = process.argv.includes("--turbo") ? "--turbo" : "--webpack";
  const command = isWin ? process.execPath : nextBin;
  const hostname = process.env.HOST || process.env.HOSTNAME || "0.0.0.0";
  const port = process.env.PORT || "3000";
  const args = isWin
    ? [nextJsBin, "dev", "--hostname", hostname, "--port", port, bundlerFlag]
    : ["dev", "--hostname", hostname, "--port", port, bundlerFlag];

  const child = spawn(command, args, {
    cwd: root,
    env: {
      ...process.env,
      REDIS_FALLBACK: process.env.REDIS_FALLBACK || "memory",
    },
    stdio: "inherit",
    shell: false,
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });
}

run();
