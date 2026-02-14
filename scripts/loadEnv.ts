import path from "node:path";
import { config as loadEnv } from "dotenv";
import fs from "node:fs";

const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, ".env");
const envLocalPath = path.join(repoRoot, ".env.local");

if (fs.existsSync(envPath)) {
  loadEnv({ path: envPath });
  console.log(`[loadEnv] Loaded .env`);
} else if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath });
  console.log(`[loadEnv] Loaded .env.local`);
} else {
  console.warn("[loadEnv] Nenhum arquivo .env ou .env.local encontrado.");
}
