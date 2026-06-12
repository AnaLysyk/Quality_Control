const { spawn } = require("child_process");
const limparCacheNext = require("../compilacao/limpar-cache-next");

limparCacheNext();

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const child = spawn(npmCommand, ["run", "dev"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});
