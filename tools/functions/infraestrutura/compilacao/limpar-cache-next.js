const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = process.cwd();
const isWin = process.platform === "win32";

function removePath(target) {
  fs.rmSync(target, {
    recursive: true,
    force: true,
    maxRetries: 20,
    retryDelay: 100,
  });
}

function readActiveNextDevPidsWindows() {
  const escapedRoot = root.replace(/'/g, "''");
  const currentPid = process.pid;
  const cmd = `
$ErrorActionPreference='SilentlyContinue'
$root='${escapedRoot}'
$currentPid=${currentPid}
Get-CimInstance Win32_Process |
  Where-Object {
    $_.ProcessId -ne $currentPid -and
    $_.Name -eq 'node.exe' -and
    $_.CommandLine -and
    ($_.CommandLine -like ('*' + $root + '*node_modules\\next\\dist\\*')) -and
    ($_.CommandLine -match '(\\s|^)dev(\\s|$)')
  } |
  Select-Object -ExpandProperty ProcessId
`;

  try {
    return execFileSync("powershell", ["-NoProfile", "-Command", cmd], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => Number(line))
      .filter((value) => Number.isFinite(value));
  } catch {
    return [];
  }
}

function readActiveNextDevPidsPosix() {
  try {
    return execFileSync("ps", ["-eo", "pid=,args="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        const match = line.match(/^(\d+)\s+(.+)$/);
        if (!match) return [];
        const pid = Number(match[1]);
        const command = match[2];
        if (
          pid === process.pid ||
          !command.includes(root) ||
          !command.includes("node_modules/next/dist") ||
          !/(^|\s)dev(\s|$)/.test(command)
        ) {
          return [];
        }
        return [pid];
      });
  } catch {
    return [];
  }
}

function readActiveNextDevPids() {
  return isWin ? readActiveNextDevPidsWindows() : readActiveNextDevPidsPosix();
}

function cleanGeneratedTypesOnly() {
  for (const target of [
    path.resolve(root, ".next", "types"),
    path.resolve(root, ".next", "dev", "types"),
    path.resolve(root, ".next", "dev", "dev", "types"),
    path.resolve(root, ".next", "dev-runtime", "types"),
    path.resolve(root, ".next", "dev-runtime", "dev", "types"),
    path.resolve(root, ".next", "dev-runtime", "dev", "dev", "types"),
    path.resolve(root, ".next-e2e", "types"),
    path.resolve(root, ".next-e2e", "dev", "types"),
  ]) {
    if (path.relative(root, target).startsWith("..") || !fs.existsSync(target)) continue;
    try {
      removePath(target);
    } catch (error) {
      console.warn(`Nao foi possivel remover tipos gerados em ${target}; seguindo.`, error);
    }
  }
}

function cleanNext() {
  const activeDevPids = readActiveNextDevPids();
  if (activeDevPids.length > 0 && process.env.FORCE_NEXT_CACHE_CLEAN !== "1") {
    cleanGeneratedTypesOnly();
    console.warn(
      `[next-cache] Next dev ativo neste repositorio (PID ${activeDevPids.join(", ")}). ` +
        "Limpando apenas tipos gerados e preservando manifests/packs do servidor em execucao. " +
        "Pare o servidor ou defina FORCE_NEXT_CACHE_CLEAN=1 para forcar.",
    );
    return;
  }

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
