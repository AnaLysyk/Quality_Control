import fs from "node:fs/promises";
import path from "node:path";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

export type ApiRouteDescriptor = {
  filePath: string;
  routePath: string;
  methods: HttpMethod[];
};

export type OpenApiDocument = {
  openapi: string;
  info?: {
    title?: string;
    version?: string;
  };
  paths?: Record<string, Record<string, unknown>>;
};

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

function normalizeSeparators(value: string) {
  return value.replace(/\\/g, "/");
}

function toOpenApiSegment(segment: string) {
  if (/^\[\[\.\.\.(.+)\]\]$/.test(segment)) {
    const name = segment.replace(/^\[\[\.\.\.(.+)\]\]$/, "$1");
    return `{${name}*}`;
  }
  if (/^\[\.\.\.(.+)\]$/.test(segment)) {
    const name = segment.replace(/^\[\.\.\.(.+)\]$/, "$1");
    return `{${name}+}`;
  }
  if (/^\[(.+)\]$/.test(segment)) {
    const name = segment.replace(/^\[(.+)\]$/, "$1");
    return `{${name}}`;
  }
  return segment;
}

export function extractHttpMethods(source: string): HttpMethod[] {
  const matches = source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g);
  const found = new Set<HttpMethod>();
  for (const match of matches) {
    found.add(match[1] as HttpMethod);
  }
  return HTTP_METHODS.filter((method) => found.has(method));
}

export function routeFileToApiPath(filePath: string, rootDir = process.cwd()) {
  const appApiRoot = normalizeSeparators(path.join(rootDir, "app", "api"));
  const absolute = normalizeSeparators(path.resolve(rootDir, filePath));
  const relative = absolute.startsWith(appApiRoot)
    ? absolute.slice(appApiRoot.length).replace(/^\/+/, "")
    : normalizeSeparators(filePath);
  const trimmed = relative.replace(/\/route\.ts$/, "").replace(/^\/+/, "");
  const segments = trimmed.split("/").filter(Boolean).map(toOpenApiSegment);
  return `/api/${segments.join("/")}`;
}

async function collectRouteFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectRouteFiles(entryPath)));
      continue;
    }
    if (entry.isFile() && entry.name === "route.ts") {
      files.push(entryPath);
    }
  }

  return files;
}

export async function collectApiRouteDescriptors(rootDir = process.cwd()): Promise<ApiRouteDescriptor[]> {
  const apiDir = path.join(rootDir, "app", "api");
  const routeFiles = await collectRouteFiles(apiDir);
  const descriptors: ApiRouteDescriptor[] = [];

  for (const filePath of routeFiles) {
    const source = await fs.readFile(filePath, "utf8");
    const methods = extractHttpMethods(source);
    descriptors.push({
      filePath: normalizeSeparators(path.relative(rootDir, filePath)),
      routePath: routeFileToApiPath(filePath, rootDir),
      methods,
    });
  }

  descriptors.sort((a, b) => a.routePath.localeCompare(b.routePath) || a.filePath.localeCompare(b.filePath));
  return descriptors;
}

export function collectOpenApiOperations(document: OpenApiDocument) {
  const operations = new Set<string>();
  for (const [routePath, methods] of Object.entries(document.paths ?? {})) {
    for (const method of Object.keys(methods ?? {})) {
      const upperMethod = method.toUpperCase();
      if (HTTP_METHODS.includes(upperMethod as HttpMethod)) {
        operations.add(`${upperMethod} ${routePath}`);
      }
    }
  }
  return operations;
}

export function findUndocumentedOperations(routes: ApiRouteDescriptor[], document: OpenApiDocument) {
  const documented = collectOpenApiOperations(document);
  const missing: Array<{ method: HttpMethod; routePath: string; filePath: string }> = [];

  for (const route of routes) {
    for (const method of route.methods) {
      const key = `${method} ${route.routePath}`;
      if (!documented.has(key)) {
        missing.push({
          method,
          routePath: route.routePath,
          filePath: route.filePath,
        });
      }
    }
  }

  return missing;
}
