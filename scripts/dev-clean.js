const { rmSync } = require("fs");
const { spawn } = require("child_process");

try {
  rmSync(".next", { recursive: true, force: true });
} catch {
  // ignore
}

const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
  stdio: "inherit",
  shell: false,
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});
