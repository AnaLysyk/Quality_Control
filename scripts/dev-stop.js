const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pidFile = path.join(root, ".dev.pid");

function readPid() {
  try {
    const raw = fs.readFileSync(pidFile, "utf8").trim();
    const pid = Number(raw);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

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
    .filter((n) => Number.isFinite(n));
}

const pid = readPid();
let stoppedAny = false;

try {
  if (process.platform === "win32") {
    if (pid) {
      try {
        tryTaskkill(pid);
        stoppedAny = true;
      } catch {
        // PID may already be gone; continue with fallback discovery below.
      }
    }

    try {
      const pids = readRepoNextPidsWindows();

      for (const otherPid of pids) {
        if (pid && otherPid === pid) continue;
        try {
          tryTaskkill(otherPid);
          stoppedAny = true;
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  } else {
    if (!pid) {
      console.log("No .dev.pid found (nothing to stop).");
      process.exit(0);
    }
    // kill the whole process group
    process.kill(-pid, "SIGTERM");
    stoppedAny = true;
  }
} catch {
  // ignore
}

try {
  fs.rmSync(pidFile, { force: true });
} catch {
  // ignore
}

// Clean up Next dev locks if present.
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

if (stoppedAny) {
  console.log(pid ? `Stopped dev server (pid ${pid}).` : "Stopped dev server(s).");
} else {
  console.log("No running dev server found for this repo.");
}
