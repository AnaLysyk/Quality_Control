const { spawn } = require("child_process");
const cleanNext = require("./clean-next");

cleanNext();

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const child = spawn(npmCommand, ["run", "dev"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});
