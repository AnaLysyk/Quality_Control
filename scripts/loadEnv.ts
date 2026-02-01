import path from "node:path";
import { config as loadEnv } from "dotenv";

const repoRoot = path.resolve(__dirname, "..");
loadEnv({ path: path.join(repoRoot, ".env.local") });
loadEnv({ path: path.join(repoRoot, ".env") });
