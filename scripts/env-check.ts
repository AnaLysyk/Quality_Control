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
    // Não sobrescreve valores já definidos pelo processo.
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// Carrega .env.local/.env para uso em scripts (Next.js carrega automaticamente em runtime, mas scripts não).
const root = path.resolve(process.cwd());
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

// 1) Bloqueia prefixo legado (determinístico).
const legacy = Object.keys(process.env).filter((k) => k.startsWith("painelQa_"));
if (legacy.length) {
  // Não falhamos: no Windows/Vercel pode existir env legado definido no ambiente.
  // A regra é: o app deve operar com variáveis CANÔNICAS; legado é ignorado.
  console.warn(
    `ENV_LEGACY_PREFIX_PRESENT: variaveis painelQa_* detectadas no ambiente (ignoradas). Encontradas: ${legacy.join(", ")}`,
  );
}

// 2) Variáveis canônicas mínimas.
const required = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const missing = required.filter((k) => !process.env[k] || !String(process.env[k]).trim());
if (missing.length) {
  fail(`ENV_MISSING_REQUIRED: ${missing.join(", ")}`);
}

// 3) Consistência de projeto.
if (process.env.SUPABASE_URL !== process.env.NEXT_PUBLIC_SUPABASE_URL) {
  fail(
    `ENV_INCONSISTENT: SUPABASE_URL (${process.env.SUPABASE_URL}) != NEXT_PUBLIC_SUPABASE_URL (${process.env.NEXT_PUBLIC_SUPABASE_URL})`,
  );
}

console.log("ENV_OK");
