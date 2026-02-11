const fs = require("node:fs");
const path = require("node:path");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function loadEnvFile(filePath) {
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
    `ENV_LEGACY_PREFIX_PRESENT: variaveis painelQa_* detectadas no ambiente (ignoradas). Encontradas: ${legacy.join(", ")}`
  );
}

const strict = ["1", "true", "yes"].includes(
  String(process.env.ENV_STRICT || "").trim().toLowerCase()
);

function hasEnv(key) {
  const raw = process.env[key];
  return Boolean(raw && String(raw).trim());
}

// Internal tool: keep the bar low. JWT is recommended; DB/Prisma is optional/legacy.
const recommended = ["JWT_SECRET"];
const missingRecommended = recommended.filter((k) => !hasEnv(k));
if (missingRecommended.length) {
  console.warn(
    `ENV_WARN_MISSING_RECOMMENDED: ${missingRecommended.join(", ")} (JWT desativado; sessao usa fallback via session_id + Redis/memoria).`
  );
  if (strict) {
    fail(`ENV_MISSING_RECOMMENDED (strict): ${missingRecommended.join(", ")}`);
  }
}

const hasDb = hasEnv("DATABASE_URL") || hasEnv("POSTGRES_URL") || hasEnv("POSTGRES_PRISMA_URL");
if (!hasDb) {
  console.warn(
    "ENV_INFO: banco nao configurado (Prisma/DB legacy desativado). Configure DATABASE_URL/POSTGRES_URL/POSTGRES_PRISMA_URL apenas se precisar."
  );
}

const hasUpstashUrl = hasEnv("UPSTASH_REDIS_REST_URL");
const hasUpstashToken = hasEnv("UPSTASH_REDIS_REST_TOKEN");
if (hasUpstashUrl !== hasUpstashToken) {
  console.warn("ENV_WARN: UPSTASH_REDIS_REST_URL/TOKEN incompleto; Redis vai cair no fallback em memoria.");
}

console.log("ENV_OK");

