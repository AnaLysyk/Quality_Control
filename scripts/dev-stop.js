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

const pid = readPid();
if (!pid) {
  console.log("No .dev.pid found (nothing to stop). ");
  process.exit(0);
}

function tryTaskkill(targetPid) {
  execFileSync("taskkill", ["/PID", String(targetPid), "/T", "/F"], { stdio: "inherit" });
}

try {
  if (process.platform === "win32") {
    try {
      tryTaskkill(pid);
    } catch {
      // PID may already be gone; continue with fallback discovery below.
    }

    // Fallback: stop any "next dev" processes for THIS repo.
    // This covers cases where Next spawns a different PID that actually owns port 3000.
    try {
      const escapedRoot = root.replace(/'/g, "''");
      const cmd = [
        "$ErrorActionPreference='SilentlyContinue'",
        `$root='${escapedRoot}'`,
        "Get-CimInstance Win32_Process",
        "| Where-Object { $_.CommandLine -and ($_.CommandLine -match 'next(\\.js)?\\s+dev') -and ($_.CommandLine -like ('*' + $root + '*')) }",
        "| Select-Object -ExpandProperty ProcessId",
      ].join("; ");

      const stdout = execFileSync("powershell", ["-NoProfile", "-Command", cmd], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });

      const pids = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => Number(line))
        .filter((n) => Number.isFinite(n));

      for (const otherPid of pids) {
        if (otherPid === pid) continue;
        try {
          tryTaskkill(otherPid);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  } else {
    // kill the whole process group
    process.kill(-pid, "SIGTERM");
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

console.log(`Stopped dev server (pid ${pid}).`);
