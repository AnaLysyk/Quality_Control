import fs from "node:fs";
import path from "node:path";

function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
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
  process.exit(2);
}

// Permite passar variáveis obrigatórias via argumento: --require VAR1,VAR2
let required = ["DATABASE_URL", "JWT_SECRET"];
const reqIdx = process.argv.indexOf("--require");
if (reqIdx !== -1 && process.argv[reqIdx + 1]) {
  required = process.argv[reqIdx + 1].split(",").map((s) => s.trim()).filter(Boolean);
}

const missing = required.filter((k) => !process.env[k] || !String(process.env[k]).trim());
if (missing.length) {
  fail(`ENV_MISSING_REQUIRED: ${missing.join(", ")}`);
}

const loaded = required.filter((k) => process.env[k]);
console.log(`ENV_OK. Loaded: ${loaded.join(", ")}`);
