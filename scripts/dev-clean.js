const { spawn } = require("child_process");
const cleanNext = require("./clean-next");

cleanNext();

const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
  stdio: "inherit",
  shell: false,
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});
