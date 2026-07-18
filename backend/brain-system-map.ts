import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { connectNodes, upsertNode } from "@/backend/brain";
import { ACTION_LABELS, PERMISSION_MODULES } from "@/backend/permissionCatalog";
import { prisma } from "@/database/prismaClient";
import type { Prisma } from "@prisma/client";

type SystemRouteKind = "page" | "api";

type CodeGraphEntry = {
  type: string;
  refType: string;
  refId: string;
  label: string;
  description: string;
  moduleKey: string;
  moduleLabel: string;
  submoduleKey?: string | null;
  submoduleLabel?: string | null;
  filePath?: string | null;
  routePath?: string | null;
  apiCalls: string[];
  imports: string[];
  modelRefs: string[];
  metadata: Prisma.InputJsonValue;
};

type SystemCodeGraph = {
  entries: CodeGraphEntry[];
  importsByEntry: Map<string, string[]>;
  apiCallsByEntry: Map<string, string[]>;
  fileToEntryRef: Map<string, { refType: string; refId: string }>;
};

const PROJECT_ROOT = /* turbopackIgnore: true */ process.cwd();
const APP_DIR = path.join(PROJECT_ROOT, "app");
const LIB_DIR = path.join(PROJECT_ROOT, "lib");
const PRISMA_SCHEMA_PATH = path.join(PROJECT_ROOT, "prisma", "schema.prisma");

const IGNORED_CODE_DIRS = new Set([
  ".git",
  ".next",
  ".next-e2e",
  ".pytest_cache",
  ".tmp",
  "tmp",
  "node_modules",
  "__tests__",
  "tests",
  "tests-e2e",
]);

const SYSTEM_MODULE_LABELS: Record<string, string> = {
  home: "Plataforma",
  admin: "Administracao",
  api: "APIs",
  ai: "Assistente IA",
  applications: "Aplicacoes",
  "applications-hub": "Aplicacoes",
  "applications-panel": "Aplicacoes",
  assistant: "Assistente IA",
  auth: "Autenticacao",
  automacoes: "Automacoes",
  brain: "Brain",
  chamados: "Chamados",
  chat: "Chat",
  clients: "Clientes",
  companies: "Empresas",
  components: "Componentes compartilhados",
  dashboard: "Dashboard",
  database: "Banco de dados",
  defects: "Defeitos",
  documentos: "Documentos",
  docs: "Documentacao",
  empresas: "Empresas",
  integrations: "Integracoes",
  login: "Acesso",
  metrics: "Metricas",
  notes: "Notas",
  permissions: "Permissoes",
  profile: "Perfil",
  quality: "Qualidade",
  release: "Releases",
  releases: "Releases",
  requests: "Solicitacoes",
  runs: "Runs",
  settings: "Configuracoes",
  support: "Suporte",
  tickets: "Chamados",
  users: "Usuarios",
};

const MODEL_MODULE_HINTS: Record<string, string> = {
  Application: "applications",
  BrainAuditLog: "brain",
  BrainEdge: "brain",
  BrainMemory: "brain",
  BrainNode: "brain",
  Company: "empresas",
  CompanyDocument: "docs",
  CompanyIntegration: "integrations",
  Defect: "defects",
  ManualTestPlan: "runs",
  Membership: "users",
  QualityAlert: "quality",
  Release: "releases",
  ReleaseCase: "releases",
  ReleaseManual: "releases",
  TestRun: "runs",
  Ticket: "support",
  TicketComment: "support",
  TicketEvent: "support",
  User: "users",
  UserNote: "notes",
};

function toPosix(value: string) {
  return value.split(path.sep).join("/");
}

function capitalizeWords(value: string) {
  return value
    .split(/[\s/_-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function normalizeSegment(segment: string) {
  if (segment.startsWith("[") && segment.endsWith("]")) {
    return `:${segment.slice(1, -1)}`;
  }

  return segment.replace(/[-_]/g, " ");
}

function normalizeRouteSegment(segment: string) {
  return segment.startsWith("[") && segment.endsWith("]")
    ? `:${segment.slice(1, -1)}`
    : segment;
}

function stripExtension(filePath: string) {
  return filePath.replace(/\.(tsx|ts)$/, "");
}

function buildModuleLabel(moduleKey: string) {
  return SYSTEM_MODULE_LABELS[moduleKey] ?? capitalizeWords(moduleKey);
}

function buildModuleDescription(moduleKey: string) {
  const label = buildModuleLabel(moduleKey);
  if (moduleKey === "api") return "Agrupa endpoints HTTP internos expostos pela plataforma.";
  if (moduleKey === "brain") return "Agrupa grafo de conhecimento, agentes e sincronizacao semantica.";
  if (moduleKey === "ai" || moduleKey === "assistant") return "Agrupa assistente, ferramentas e contexto conversacional.";
  if (moduleKey === "automacoes") return "Agrupa estudios, execucoes, ferramentas e fluxos de automacao.";
  if (moduleKey === "database") return "Agrupa modelos persistidos no Prisma e suas entidades de negocio.";
  return `Modulo funcional ${label} da plataforma, derivado do codigo e dos dados do sistema.`;
}

function inferModuleKeyFromText(value: string) {
  const lower = value.toLowerCase();
  if (/assistant|assistente|\/api\/assistant|\bai\b/.test(lower)) return "ai";
  if (/brain|mapa neural|neural/.test(lower)) return "brain";
  if (/automacoes|automation|playwright|biometric|base64|api-lab/.test(lower)) return "automacoes";
  if (/permission|permiss|rbac|access/.test(lower)) return "permissions";
  if (/ticket|chamado|support|suporte|kanban/.test(lower)) return "support";
  if (/defect|defeito|bug/.test(lower)) return "defects";
  if (/release|qase|jira/.test(lower)) return "releases";
  if (/run|testrun|execu/.test(lower)) return "runs";
  if (/company|companies|empresa|cliente|client/.test(lower)) return "empresas";
  if (/document|docs|wiki/.test(lower)) return "docs";
  if (/metric|quality|qualidade|dashboard|mttr/.test(lower)) return "dashboard";
  if (/login|auth|session|jwt|password/.test(lower)) return "auth";
  if (/note|nota/.test(lower)) return "notes";
  if (/user|usuario|profile|perfil/.test(lower)) return "users";
  if (/integration|integracao/.test(lower)) return "integrations";
  return "home";
}

function inferModuleKeyFromProjectPath(projectPath: string) {
  const normalized = toPosix(projectPath);
  const parts = normalized.split("/");
  const top = parts[0] ?? "";

  if (top === "app") {
    const first = parts[1] ?? "home";
    if (first === "api") return "api";
    if (first === "components" || first === "hooks" || first === "context") return "components";
    return inferModuleKeyFromText(first);
  }

  if (top === "lib") {
    const second = parts[1] ?? "";
    if (second === "assistant") return "ai";
    if (second === "brain" || normalized === "lib/brain.ts" || normalized === "lib/brain-sync.ts") return "brain";
    if (second === "automations") return "automacoes";
    if (second === "auth" || second === "session" || normalized.includes("jwt") || normalized.includes("password")) return "auth";
    if (second === "rbac" || second === "permissions" || normalized.includes("permission")) return "permissions";
    return inferModuleKeyFromText(normalized);
  }

  if (top === "prisma") return "database";
  return inferModuleKeyFromText(normalized);
}

function routePathFromFile(relativeFilePath: string) {
  const parts = toPosix(relativeFilePath)
    .split("/")
    .filter(Boolean)
    .slice(0, -1)
    .filter((segment) => !segment.startsWith("("))
    .filter((segment) => !segment.startsWith("_"))
    .map(normalizeRouteSegment);

  if (parts.length === 0) return "/";
  return `/${parts.join("/")}`;
}

function routeLabelFromPath(routePath: string, kind: SystemRouteKind) {
  if (routePath === "/") {
    return kind === "api" ? "Endpoint raiz da API" : "Tela inicial da plataforma";
  }

  const humanPath = routePath
    .split("/")
    .filter(Boolean)
    .map((segment) => capitalizeWords(normalizeSegment(segment)))
    .join(" / ");

  return kind === "api" ? `Endpoint ${humanPath}` : `Tela ${humanPath}`;
}

function routeDescription(routePath: string, filePath: string, kind: SystemRouteKind, methods: string[]) {
  if (kind === "api") {
    const methodText = methods.length ? ` Metodos: ${methods.join(", ")}.` : "";
    return `Endpoint interno do sistema em ${routePath}, implementado por ${filePath}.${methodText}`;
  }

  return `Tela navegavel da plataforma em ${routePath}, implementada por ${filePath}. O no representa a experiencia funcional vista pelo usuario.`;
}

function extractHttpMethods(content: string) {
  const methods = new Set<string>();
  const re = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content))) methods.add(match[1]);
  return [...methods];
}

function extractImports(content: string) {
  const imports = new Set<string>();
  const re = /(?:from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content))) {
    const specifier = match[1] ?? match[2];
    if (!specifier) continue;
    if (specifier.startsWith("@/") || specifier.startsWith(".")) imports.add(specifier);
  }
  return [...imports];
}

function normalizeApiPath(value: string) {
  const cleaned = value
    .split("?")[0]
    ?.replace(/\$\{[^}]+\}/g, ":param")
    .replace(/\/$/, "") || value;
  return cleaned === "/api" ? "/api" : cleaned;
}

function extractApiCalls(content: string) {
  const calls = new Set<string>();
  const re = /(?:fetch|fetchApi)\(\s*([`"'])(\/api\/[^`"')\s]+)\1/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content))) calls.add(normalizeApiPath(match[2]));
  return [...calls];
}

function extractPrismaModelRefs(content: string) {
  const refs = new Set<string>();
  const re = /prisma\.([A-Za-z0-9_]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content))) {
    const raw = match[1];
    refs.add(raw.charAt(0).toUpperCase() + raw.slice(1));
  }
  return [...refs];
}

function extractExportNames(content: string) {
  const names = new Set<string>();
  const re = /export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z0-9_]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content))) names.add(match[1]);
  return [...names].slice(0, 12);
}

function contentSignals(content: string) {
  const signals: string[] = [];
  if (content.includes('"use client"') || content.includes("'use client'")) signals.push("client");
  if (/prisma\./.test(content)) signals.push("database");
  if (/fetch\(|fetchApi\(/.test(content)) signals.push("api-calls");
  if (/hasPermissionAccess|usePermissionAccess|can\(/.test(content)) signals.push("permissions");
  if (/syncBrain|upsertNode|connectNodes|brainNode|brainMemory/.test(content)) signals.push("brain");
  if (/playwright|automation|automacao|biometric/i.test(content)) signals.push("automation");
  if (/ticket|chamado|defect|release|testRun/i.test(content)) signals.push("quality-domain");
  return signals;
}

function classifyCodeArtifact(projectPath: string) {
  const normalized = toPosix(projectPath);
  const basename = path.posix.basename(normalized);
  const stem = stripExtension(basename);

  if (normalized.startsWith("lib/assistente/tools/") && !["index", "types", "ticketHelpers"].includes(stem)) {
    return { type: "AssistantTool", labelPrefix: "Ferramenta" };
  }
  if (normalized.startsWith("app/hooks/") || /^use[A-Z]/.test(stem)) return { type: "Hook", labelPrefix: "Hook" };
  if (normalized.startsWith("app/context/") || stem.endsWith("Context")) return { type: "ContextProvider", labelPrefix: "Contexto" };
  if (normalized.includes("/data/") || normalized.toLowerCase().includes("store")) return { type: "Store", labelPrefix: "Store" };
  if (normalized.includes("/types/") || stem.toLowerCase().includes("types")) return { type: "TypeDefinition", labelPrefix: "Tipo" };
  if (normalized.endsWith(".tsx")) return { type: "Component", labelPrefix: "Componente" };
  if (normalized.startsWith("lib/brain") || normalized.includes("/brain/")) return { type: "BrainService", labelPrefix: "Servico Brain" };
  if (normalized.includes("permission") || normalized.includes("/rbac/")) return { type: "PermissionService", labelPrefix: "Servico de permissao" };
  if (normalized.includes("/automations/") || normalized.includes("automation")) return { type: "AutomationService", labelPrefix: "Servico de automacao" };
  return { type: "Service", labelPrefix: "Servico" };
}

async function collectProjectFiles(baseDir: string): Promise<string[]> {
  async function walk(currentDir: string): Promise<string[]> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (IGNORED_CODE_DIRS.has(entry.name)) continue;

      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await walk(absolutePath)));
        continue;
      }

      if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
      if (entry.name.endsWith(".d.ts")) continue;
      files.push(toPosix(path.relative(PROJECT_ROOT, absolutePath)));
    }

    return files;
  }

  return walk(baseDir);
}

function buildRouteEntry(projectPath: string, content: string): CodeGraphEntry | null {
  const normalized = toPosix(projectPath);
  const relativeAppPath = normalized.replace(/^app\//, "");
  const isPage = normalized.endsWith("/page.tsx") || normalized === "app/page.tsx";
  const isApiRoute = normalized.startsWith("app/api/") && normalized.endsWith("/route.ts");

  if (!isPage && !isApiRoute) return null;

  const kind: SystemRouteKind = isApiRoute ? "api" : "page";
  const routePath = routePathFromFile(relativeAppPath);
  const routeSegments = routePath.split("/").filter(Boolean);
  const moduleKey = kind === "api" ? "api" : inferModuleKeyFromText(routeSegments[0] ?? "home");
  const moduleLabel = buildModuleLabel(moduleKey);
  const submoduleSegment = kind === "api" ? routeSegments[1] ?? "root" : routeSegments[1] ?? null;
  const submoduleKey = submoduleSegment ? `${moduleKey}/${submoduleSegment}` : null;
  const submoduleLabel = submoduleSegment ? `${moduleLabel} / ${capitalizeWords(normalizeSegment(submoduleSegment))}` : null;
  const methods = extractHttpMethods(content);
  const imports = extractImports(content);
  const apiCalls = extractApiCalls(content);

  return {
    type: kind === "api" ? "ApiEndpoint" : "Screen",
    refType: "SystemRoute",
    refId: `${kind}:${routePath}`,
    label: routeLabelFromPath(routePath, kind),
    description: routeDescription(routePath, normalized, kind, methods),
    moduleKey,
    moduleLabel,
    submoduleKey,
    submoduleLabel,
    filePath: normalized,
    routePath,
    apiCalls,
    imports,
    modelRefs: extractPrismaModelRefs(content),
    metadata: {
      source: "code",
      codeKind: kind,
      routePath,
      filePath: normalized,
      moduleKey,
      submoduleKey,
      httpMethods: methods,
      dynamicSegments: routeSegments.filter((segment) => segment.startsWith(":")),
      imports: imports.slice(0, 20),
      apiCalls,
      modelRefs: extractPrismaModelRefs(content),
      signals: contentSignals(content),
    },
  };
}

function buildCodeArtifactEntry(projectPath: string, content: string): CodeGraphEntry | null {
  const normalized = toPosix(projectPath);
  if (normalized.endsWith("/page.tsx") || normalized === "app/page.tsx") return null;
  if (normalized.startsWith("app/api/") && normalized.endsWith("/route.ts")) return null;

  const classification = classifyCodeArtifact(normalized);
  const basename = path.posix.basename(normalized);
  const stem = stripExtension(basename);
  const moduleKey = inferModuleKeyFromProjectPath(normalized);
  const moduleLabel = buildModuleLabel(moduleKey);
  const signals = contentSignals(content);
  const exports = extractExportNames(content);
  const apiCalls = extractApiCalls(content);
  const imports = extractImports(content);
  const modelRefs = extractPrismaModelRefs(content);

  return {
    type: classification.type,
    refType: "CodeArtifact",
    refId: `code:${normalized}`,
    label: `${classification.labelPrefix} ${capitalizeWords(stem)}`,
    description: `${classification.labelPrefix} derivado de ${normalized}. Contexto tecnico: ${signals.length ? signals.join(", ") : "codigo de suporte da plataforma"}.`,
    moduleKey,
    moduleLabel,
    submoduleKey: null,
    submoduleLabel: null,
    filePath: normalized,
    apiCalls,
    imports,
    modelRefs,
    metadata: {
      source: "code",
      codeKind: classification.type,
      filePath: normalized,
      moduleKey,
      exports,
      imports: imports.slice(0, 20),
      apiCalls,
      modelRefs,
      signals,
      lineCount: content.split("\n").length,
    },
  };
}

async function collectPrismaModelEntries(): Promise<CodeGraphEntry[]> {
  const schema = await readFile(PRISMA_SCHEMA_PATH, "utf8").catch(() => "");
  if (!schema) return [];

  const entries: CodeGraphEntry[] = [];
  const modelRe = /model\s+([A-Za-z0-9_]+)\s+\{([\s\S]*?)\n\}/g;
  let match: RegExpExecArray | null;

  while ((match = modelRe.exec(schema))) {
    const modelName = match[1];
    const body = match[2];
    const fields = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//") && !line.startsWith("@@"))
      .map((line) => line.split(/\s+/)[0])
      .filter(Boolean)
      .slice(0, 30);
    const moduleKey = MODEL_MODULE_HINTS[modelName] ?? inferModuleKeyFromText(modelName);
    const moduleLabel = buildModuleLabel(moduleKey);

    entries.push({
      type: "DataModel",
      refType: "PrismaModel",
      refId: modelName,
      label: `Modelo ${modelName}`,
      description: `Modelo Prisma ${modelName}. Representa a estrutura persistida usada pelo sistema; campos principais: ${fields.slice(0, 10).join(", ")}.`,
      moduleKey,
      moduleLabel,
      apiCalls: [],
      imports: [],
      modelRefs: [],
      metadata: {
        source: "prisma",
        modelName,
        filePath: "prisma/schema.prisma",
        moduleKey,
        fields,
      },
    });
  }

  return entries;
}

function collectPermissionEntries(): CodeGraphEntry[] {
  return PERMISSION_MODULES.flatMap((permissionModule) => {
    const moduleKey = inferModuleKeyFromText(permissionModule.id);
    const moduleLabel = buildModuleLabel(moduleKey);
    const moduleEntry: CodeGraphEntry = {
      type: "PermissionModule",
      refType: "PermissionModule",
      refId: permissionModule.id,
      label: `Permissao ${permissionModule.label}`,
      description: `${permissionModule.description} Acoes: ${permissionModule.actions.map((action) => ACTION_LABELS[action] ?? action).join(", ")}.`,
      moduleKey,
      moduleLabel,
      apiCalls: [],
      imports: [],
      modelRefs: [],
      metadata: {
        source: "permissionCatalog",
        permissionModuleId: permissionModule.id,
        category: permissionModule.category,
        actions: permissionModule.actions,
      },
    };

    const actionEntries = permissionModule.actions.map((action): CodeGraphEntry => ({
      type: "PermissionAction",
      refType: "PermissionAction",
      refId: `${permissionModule.id}:${action}`,
      label: `${permissionModule.label} / ${ACTION_LABELS[action] ?? action}`,
      description: `Acao de permissao "${ACTION_LABELS[action] ?? action}" dentro do modulo ${permissionModule.label}.`,
      moduleKey,
      moduleLabel,
      apiCalls: [],
      imports: [],
      modelRefs: [],
      metadata: {
        source: "permissionCatalog",
        permissionModuleId: permissionModule.id,
        action,
        actionLabel: ACTION_LABELS[action] ?? action,
      },
    }));

    return [moduleEntry, ...actionEntries];
  });
}

function resolveImportToProjectPath(sourcePath: string, specifier: string, projectFiles: Set<string>) {
  const candidates: string[] = [];

  if (specifier.startsWith("@/backend/")) {
    candidates.push(`lib/${specifier.slice("@/backend/".length)}`);
  } else if (specifier.startsWith("@/components/")) {
    candidates.push(`app/components/${specifier.slice("@/components/".length)}`);
  } else if (specifier.startsWith("@/hooks/")) {
    candidates.push(`app/hooks/${specifier.slice("@/hooks/".length)}`);
  } else if (specifier.startsWith("@/utils/")) {
    candidates.push(`app/utils/${specifier.slice("@/utils/".length)}`);
  } else if (specifier.startsWith("@/types/")) {
    candidates.push(`app/types/${specifier.slice("@/types/".length)}`);
  } else if (specifier.startsWith("@/")) {
    candidates.push(`app/${specifier.slice(2)}`);
  } else if (specifier.startsWith(".")) {
    candidates.push(toPosix(path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), specifier))));
  }

  const withExtensions = candidates.flatMap((candidate) => [
    candidate,
    `${candidate}.ts`,
    `${candidate}.tsx`,
    `${candidate}/index.ts`,
    `${candidate}/index.tsx`,
  ]);

  return withExtensions.find((candidate) => projectFiles.has(candidate)) ?? null;
}

async function collectSystemCodeGraph(): Promise<SystemCodeGraph> {
  const [appFiles, libFiles, prismaModels] = await Promise.all([
    collectProjectFiles(APP_DIR).catch(() => []),
    collectProjectFiles(LIB_DIR).catch(() => []),
    collectPrismaModelEntries(),
  ]);
  const projectFiles = new Set([...appFiles, ...libFiles]);
  const entries: CodeGraphEntry[] = [];
  const importsByEntry = new Map<string, string[]>();
  const apiCallsByEntry = new Map<string, string[]>();
  const fileToEntryRef = new Map<string, { refType: string; refId: string }>();

  for (const projectPath of [...appFiles, ...libFiles]) {
    const absolutePath = path.join(PROJECT_ROOT, projectPath);
    const content = await readFile(absolutePath, "utf8").catch(() => "");
    if (!content) continue;

    const routeEntry = projectPath.startsWith("app/") ? buildRouteEntry(projectPath, content) : null;
    const entry = routeEntry ?? buildCodeArtifactEntry(projectPath, content);
    if (!entry) continue;

    entries.push(entry);
    if (entry.filePath) fileToEntryRef.set(entry.filePath, { refType: entry.refType, refId: entry.refId });
    importsByEntry.set(
      entry.refId,
      entry.imports
        .map((specifier) => resolveImportToProjectPath(entry.filePath ?? projectPath, specifier, projectFiles))
        .filter((target): target is string => Boolean(target)),
    );
    apiCallsByEntry.set(entry.refId, entry.apiCalls);
  }

  for (const entry of [...prismaModels, ...collectPermissionEntries()]) {
    entries.push(entry);
  }

  return { entries, importsByEntry, apiCallsByEntry, fileToEntryRef };
}

async function findNode(refType: string, refId: string) {
  return prisma.brainNode.findFirst({ where: { refType, refId } });
}

async function connectByRef(
  fromRefType: string,
  fromRefId: string,
  toRefType: string,
  toRefId: string,
  edgeType: string,
  meta?: Prisma.InputJsonValue,
) {
  const [from, to] = await Promise.all([findNode(fromRefType, fromRefId), findNode(toRefType, toRefId)]);
  if (!from || !to) return false;
  await connectNodes(from.id, to.id, edgeType, meta).catch(() => undefined);
  return true;
}

function apiPathMatches(callPath: string, routePath: string) {
  if (callPath === routePath) return true;

  const callParts = callPath.split("/").filter(Boolean);
  const routeParts = routePath.split("/").filter(Boolean);
  if (callParts.length !== routeParts.length) return false;

  return routeParts.every((routePart, index) => {
    const callPart = callParts[index];
    return routePart.startsWith(":") || callPart.startsWith(":") || routePart === callPart;
  });
}

function findApiEntryForCall(apiPath: string, routeEntries: CodeGraphEntry[]) {
  return routeEntries.find((entry) => entry.routePath && apiPathMatches(apiPath, entry.routePath)) ?? null;
}

function childEdgeForEntry(entry: CodeGraphEntry) {
  switch (entry.type) {
    case "Screen": return "HAS_SCREEN";
    case "ApiEndpoint": return "HAS_ENDPOINT";
    case "Component": return "HAS_COMPONENT";
    case "AssistantTool": return "HAS_ASSISTANT_TOOL";
    case "DataModel": return "HAS_MODEL";
    case "PermissionModule": return "HAS_PERMISSION";
    case "PermissionAction": return "HAS_ACTION";
    default: return "HAS_CODE";
  }
}

export async function syncSystemMapToBrain(rootRefId = "testing-company-root") {
  const graph = await collectSystemCodeGraph();
  let nodeCount = 0;
  let edgeCount = 0;

  const moduleKeys = new Map<string, string>();
  const submodules = new Map<string, { label: string; moduleKey: string }>();
  for (const entry of graph.entries) {
    moduleKeys.set(entry.moduleKey, entry.moduleLabel);
    if (entry.submoduleKey && entry.submoduleLabel) {
      submodules.set(entry.submoduleKey, { label: entry.submoduleLabel, moduleKey: entry.moduleKey });
    }
  }

  for (const [moduleKey, moduleLabel] of moduleKeys) {
    await upsertNode({
      type: "Module",
      label: moduleLabel,
      refType: "SystemModule",
      refId: moduleKey,
      description: buildModuleDescription(moduleKey),
      metadata: {
        source: "system-map",
        moduleKey,
        label: moduleLabel,
      },
    });
    nodeCount++;
    if (await connectByRef("Platform", rootRefId, "SystemModule", moduleKey, "HAS_MODULE")) edgeCount++;
  }

  for (const [submoduleKey, submodule] of submodules) {
    await upsertNode({
      type: "Submodule",
      label: submodule.label,
      refType: "SystemSubmodule",
      refId: submoduleKey,
      description: `Recorte funcional ${submodule.label} dentro do mapa mental do sistema.`,
      metadata: {
        source: "system-map",
        submoduleKey,
        moduleKey: submodule.moduleKey,
      },
    });
    nodeCount++;
    if (await connectByRef("SystemModule", submodule.moduleKey, "SystemSubmodule", submoduleKey, "HAS_SUBMODULE")) edgeCount++;
    if (await connectByRef("SystemSubmodule", submoduleKey, "SystemModule", submodule.moduleKey, "BELONGS_TO")) edgeCount++;
  }

  for (const entry of graph.entries) {
    await upsertNode({
      type: entry.type,
      label: entry.label,
      refType: entry.refType,
      refId: entry.refId,
      description: entry.description,
      metadata: entry.metadata,
    });
    nodeCount++;

    const parentRefType = entry.submoduleKey ? "SystemSubmodule" : "SystemModule";
    const parentRefId = entry.submoduleKey ?? entry.moduleKey;
    if (await connectByRef(parentRefType, parentRefId, entry.refType, entry.refId, childEdgeForEntry(entry))) edgeCount++;
    if (await connectByRef(entry.refType, entry.refId, "SystemModule", entry.moduleKey, "BELONGS_TO")) edgeCount++;

    for (const modelName of entry.modelRefs) {
      if (await connectByRef(entry.refType, entry.refId, "PrismaModel", modelName, "USES_MODEL")) edgeCount++;
    }
  }

  const apiRouteEntries = graph.entries.filter((entry) => entry.type === "ApiEndpoint" && entry.routePath);

  for (const entry of graph.entries) {
    for (const apiPath of graph.apiCallsByEntry.get(entry.refId) ?? []) {
      const apiEntry = findApiEntryForCall(apiPath, apiRouteEntries);
      if (apiEntry && await connectByRef(entry.refType, entry.refId, apiEntry.refType, apiEntry.refId, "CALLS_API")) edgeCount++;
    }

    for (const targetPath of graph.importsByEntry.get(entry.refId) ?? []) {
      const target = graph.fileToEntryRef.get(targetPath);
      if (target && target.refId !== entry.refId && await connectByRef(entry.refType, entry.refId, target.refType, target.refId, "USES_CODE")) {
        edgeCount++;
      }
    }
  }

  for (const permissionModule of PERMISSION_MODULES) {
    const moduleKey = inferModuleKeyFromText(permissionModule.id);
    if (await connectByRef("SystemModule", moduleKey, "PermissionModule", permissionModule.id, "GOVERNS_ACCESS")) edgeCount++;

    for (const action of permissionModule.actions) {
      if (await connectByRef("PermissionModule", permissionModule.id, "PermissionAction", `${permissionModule.id}:${action}`, "HAS_ACTION")) edgeCount++;
    }
  }

  return { nodeCount, edgeCount };
}

