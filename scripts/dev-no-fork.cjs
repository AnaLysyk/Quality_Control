// Starts `next dev` without the CLI fork wrapper.
//
// Some locked-down Windows environments block `child_process.fork` (EPERM), which
// prevents the standard `next dev` command from booting at all. This script
// calls Next's internal `startServer()` directly in the current process.
//
// Note: this is for internal tooling only. It trades auto-restart behavior for
// the ability to run in restricted environments.
const { startServer } = require("next/dist/server/lib/start-server");

async function main() {
  const dir = process.cwd();
  const port = Number(process.env.PORT || 3000);
  const hostname = process.env.HOSTNAME || "127.0.0.1";

  // Match the repo's default `dev` script behavior (avoid Turbopack on Windows).
  if (!process.env.NEXT_DISABLE_TURBOPACK) {
    process.env.NEXT_DISABLE_TURBOPACK = "1";
  }

  await startServer({
    dir,
    port,
    hostname,
    allowRetry: false,
    isDev: true,
    minimalMode: false,
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
