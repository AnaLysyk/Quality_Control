import fs from "node:fs/promises";
import path from "node:path";
import { Redis } from "@upstash/redis";

const DATA_DIR = path.join(process.cwd(), "data");
const PREFIX = "qc:jsondb:";

function keyFor(fileName) {
  return `${PREFIX}${fileName}`;
}

function normalizeJson(fileName, parsed) {
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
    return parsed;
  }
  if (Array.isArray(parsed)) {
    return { items: parsed };
  }
  console.warn(`[warn] ${fileName}: formato desconhecido; usando { items: [] }`);
  return { items: [] };
}

async function main() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.error("Faltam env vars: UPSTASH_REDIS_REST_URL e/ou UPSTASH_REDIS_REST_TOKEN");
    process.exit(1);
  }

  const redis = new Redis({ url, token });

  let files = [];
  try {
    files = await fs.readdir(DATA_DIR);
  } catch {
    console.error(`Pasta data/ não existe em: ${DATA_DIR}`);
    process.exit(1);
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  if (jsonFiles.length === 0) {
    console.log("Nenhum .json encontrado em data/");
    return;
  }

  console.log(`Encontrados ${jsonFiles.length} arquivos .json em data/`);
  console.log("Migrando para Upstash Redis...\n");

  const report = [];

  for (const fileName of jsonFiles) {
    const filePath = path.join(DATA_DIR, fileName);
    const key = keyFor(fileName);

    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const normalized = normalizeJson(fileName, parsed);

      const payload = JSON.stringify(normalized);
      await redis.set(key, payload);

      const count = Array.isArray(normalized.items) ? normalized.items.length : 0;
      report.push({ fileName, key, count, ok: true });
      console.log(`✅ ${fileName} -> ${key} (items: ${count})`);
    } catch (err) {
      report.push({ fileName, key, count: 0, ok: false });
      console.log(`❌ ${fileName} -> ${key} (falhou)`);
      console.error(err);
    }
  }

  console.log("\n--- Relatório ---");
  const ok = report.filter((r) => r.ok).length;
  const fail = report.length - ok;
  console.log(`Sucesso: ${ok} | Falhas: ${fail}`);

  if (fail > 0) process.exit(2);
}

main();
