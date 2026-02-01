import fs from "node:fs";
import path from "node:path";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const root = path.resolve(process.cwd());
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const legacy = Object.keys(process.env).filter((k) => k.startsWith("painelQa_"));
if (legacy.length) {
  console.warn(
    `ENV_LEGACY_PREFIX_PRESENT: variaveis painelQa_* detectadas no ambiente (ignoradas). Encontradas: ${legacy.join(", ")}`,
  );
}

const required = ["DATABASE_URL", "JWT_SECRET"];

const missing = required.filter((k) => !process.env[k] || !String(process.env[k]).trim());
if (missing.length) {
  fail(`ENV_MISSING_REQUIRED: ${missing.join(", ")}`);
}

console.log("ENV_OK");
