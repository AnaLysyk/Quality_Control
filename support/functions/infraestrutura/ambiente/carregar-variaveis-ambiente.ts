
import path from "node:path";
import { config as loadEnv } from "dotenv";

const repoRoot = process.cwd();
// Carrega apenas .env para evitar conflitos
loadEnv({ path: path.join(repoRoot, ".env") });

