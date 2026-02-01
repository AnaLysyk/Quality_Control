import { execSync } from "node:child_process";

export default async function globalSetup() {
  execSync("npx prisma db push", { stdio: "inherit" });
  execSync("npm run seed:all", { stdio: "inherit" });
}
