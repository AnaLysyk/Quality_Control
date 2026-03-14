const { existsSync } = require("fs");
const { execSync } = require("child_process");

const env = { ...process.env, NEXT_DIST_DIR: ".next/build-runtime" };

if (existsSync("./prisma/schema.prisma") || existsSync("./schema.prisma")) {
  console.log("prisma schema found, running prisma generate");
  execSync("npx prisma generate", { stdio: "inherit", env });
} else {
  console.log("no prisma schema, skipping prisma generate");
}

execSync("npx next build", { stdio: "inherit", env });
