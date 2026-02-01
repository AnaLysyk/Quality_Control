
import path from "node:path";
import { config as loadEnv } from "dotenv";

const repoRoot = path.resolve(__dirname, "..");
// Carrega apenas .env para evitar conflitos
loadEnv({ path: path.join(repoRoot, ".env") });
