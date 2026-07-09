import fs from "node:fs";
import path from "node:path";

import { SYSTEM_ROUTES } from "./route-map";
import type { SystemRouteDefinition } from "./navigation.types";

const APP_ROOT = path.join(process.cwd(), "app");

export const SYSTEM_PAGE_MAP_EXCLUSIONS = new Set([
  "app/500/page.tsx",
  "app/login/access-request/page.tsx",
  "app/login/access-request/status/page.tsx",
  "app/login/forgot-password/page.tsx",
  "app/login/page.tsx",
  "app/login/reset-password/page.tsx",
  "app/page.tsx",
]);

function collectPageFiles(dir: string, output: string[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectPageFiles(absolutePath, output);
      continue;
    }

    if (entry.isFile() && entry.name === "page.tsx") {
      output.push(path.relative(process.cwd(), absolutePath).replace(/\\/g, "/"));
    }
  }
}

export function getAllSystemPageFiles() {
  const files: string[] = [];
  collectPageFiles(APP_ROOT, files);
  return files.sort((left, right) => left.localeCompare(right));
}

export function getMappedSystemPageFiles(routes: readonly SystemRouteDefinition[] = SYSTEM_ROUTES) {
  return new Set(routes.map((route) => route.mainFile.replace(/\\/g, "/")));
}

export function getUnmappedSystemPageFiles(routes: readonly SystemRouteDefinition[] = SYSTEM_ROUTES) {
  const mappedFiles = getMappedSystemPageFiles(routes);

  return getAllSystemPageFiles().filter(
    (filePath) => !SYSTEM_PAGE_MAP_EXCLUSIONS.has(filePath) && !mappedFiles.has(filePath),
  );
}
