import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const collectionFile = path.join(repoRoot, "docs", "api", "Quality_Control_API_RBAC.postman_collection.json");
const envFile =
  process.env.NEWMAN_ENV_FILE ||
  path.join(repoRoot, "docs", "api", "Quality_Control_API_RBAC.postman_environment.json");

if (!existsSync(collectionFile)) {
  console.error(`[newman] collection not found: ${collectionFile}`);
  process.exit(1);
}

if (!existsSync(envFile)) {
  console.error(`[newman] environment not found: ${envFile}`);
  process.exit(1);
}

const baseUrl =
  process.env.API_BASE_URL ||
  process.env.POSTMAN_BASE_URL ||
  process.env.NEWMAN_BASE_URL ||
  "";
const login = process.env.API_LOGIN || process.env.POSTMAN_LOGIN || "";
const password = process.env.API_PASSWORD || process.env.POSTMAN_PASSWORD || "";

const isWindows = process.platform === "win32";
const quote = (value) => {
  if (!isWindows) return value;
  if (!value.includes(" ")) return value;
  return `"${value}"`;
};

const args = [
  "newman",
  "run",
  quote(collectionFile),
  "-e",
  quote(envFile),
];

if (baseUrl) {
  args.push("--env-var", `base_url=${baseUrl}`);
}
if (login) {
  args.push("--env-var", `login=${login}`);
}
if (password) {
  args.push("--env-var", `password=${password}`);
}

const cmd = isWindows ? "npx.cmd" : "npx";
const child = spawn(cmd, args, { stdio: "inherit", shell: isWindows });

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
