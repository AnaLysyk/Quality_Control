import "server-only";
import fs from "fs/promises";
import path from "path";
import os from "os";

const WORKSPACE_ROOT = path.join(os.tmpdir(), "pw-workspaces");

/** Sanitize to prevent path traversal â€” keep only safe characters */
function sanitizeSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 64);
}

/** Returns absolute path of the workspace dir for a given run */
export function getRunDir(companySlug: string, runId: string): string {
  return path.join(
    WORKSPACE_ROOT,
    sanitizeSegment(companySlug),
    sanitizeSegment(runId),
  );
}

export interface ScriptFile {
  path: string;
  content: string;
}

export interface PlaywrightConfigOptions {
  baseURL: string;
  browser: string;
  browsers?: string[];
  headless: boolean;
  timeoutMs: number;
  workers: number;
  retries: number;
  screenshotOn: string;
  videoOn: string;
  traceOn: string;
}

/** Writes all script files + playwright.config.ts into a fresh workspace dir */
export async function prepareWorkspace(
  companySlug: string,
  runId: string,
  scripts: ScriptFile[],
  config: PlaywrightConfigOptions,
): Promise<string> {
  const runDir = getRunDir(companySlug, runId);
  await fs.rm(runDir, { recursive: true, force: true });
  await fs.mkdir(runDir, { recursive: true });

  // Write each script file, validating path safety
  for (const script of scripts) {
    const normalised = path.normalize(script.path).replace(/\\/g, "/");
    // Reject absolute paths or parent-traversal
    if (path.isAbsolute(normalised) || normalised.startsWith("..")) {
      throw new Error(`Unsafe script path: ${script.path}`);
    }
    const target = path.join(runDir, normalised);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, script.content, "utf8");
  }

  // Generate playwright.config.ts
  const configContent = buildPlaywrightConfig(config);
  await fs.writeFile(path.join(runDir, "playwright.config.ts"), configContent, "utf8");

  // Minimal package.json so npx playwright test can run
  await fs.writeFile(
    path.join(runDir, "package.json"),
    JSON.stringify({ name: "pw-run", version: "1.0.0", private: true }, null, 2),
    "utf8",
  );

  return runDir;
}

/** Remove workspace dir after run completes */
export async function cleanupWorkspace(companySlug: string, runId: string): Promise<void> {
  const runDir = getRunDir(companySlug, runId);
  await fs.rm(runDir, { recursive: true, force: true }).catch(() => {});
}

function buildPlaywrightConfig(opts: PlaywrightConfigOptions): string {
  const allowedBrowsers = ["chromium", "firefox", "webkit"] as const;
  const normalized = Array.from(new Set((opts.browsers ?? [opts.browser]).filter((item) => allowedBrowsers.includes(item as (typeof allowedBrowsers)[number]))));
  const browsers = normalized.length > 0 ? normalized : ["chromium"];
  const projects = browsers
    .map((browser) => {
      const device = browser === "chromium" ? "Desktop Chrome" : browser === "firefox" ? "Desktop Firefox" : "Desktop Safari";
      return `    {
      name: ${JSON.stringify(browser)},
      use: { ...devices[${JSON.stringify(device)}] },
    },`;
    })
    .join("\n");

  return `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: false,
  retries: ${opts.retries},
  workers: ${opts.workers},
  reporter: [['list'], ['json', { outputFile: 'results.json' }]],
  use: {
    baseURL: ${JSON.stringify(opts.baseURL)},
    headless: ${opts.headless},
    actionTimeout: ${opts.timeoutMs},
    navigationTimeout: ${opts.timeoutMs},
    screenshot: ${JSON.stringify(opts.screenshotOn)},
    video: ${JSON.stringify(opts.videoOn)},
    trace: ${JSON.stringify(opts.traceOn)},
  },
  projects: [
${projects}
  ],
});
`;
}

