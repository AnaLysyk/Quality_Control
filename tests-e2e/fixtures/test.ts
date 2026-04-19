import fs from "node:fs/promises";
import path from "node:path";
import { test as base, expect, type TestInfo, type TestStatus } from "@playwright/test";
import { createQaseClient, QaseError } from "../../lib/qaseSdk";
import { slugifyRelease } from "@/lib/slugifyRelease";
import type { Release } from "@/app/types/release";
import type { TestPlanCase } from "@/lib/testPlanCases";

type QaseStatus = "passed" | "failed" | "blocked" | "skipped" | "invalid" | "untested";

const logPrefix = "[QASE][PW]";
const qaseToken = process.env.QASE_API_TOKEN || process.env.QASE_TOKEN || "";
const qaseProjectCode =
  process.env.QASE_PROJECT_CODE ||
  process.env.QASE_PROJECT ||
  process.env.QASE_DEFAULT_PROJECT ||
  "";
const runIdRaw = process.env.QASE_RUN_ID || "";
const runIdParsed = Number.parseInt(runIdRaw, 10);
const qaseRunId = Number.isFinite(runIdParsed) && runIdParsed > 0 ? runIdParsed : null;
const qaseDisabled = ["1", "true", "yes", "on"].includes((process.env.QASE_DISABLED || "").toLowerCase());
const qaseEnabled = !qaseDisabled && Boolean(qaseToken && qaseProjectCode && qaseRunId);
const internalRunSyncEnabled = ["1", "true", "yes", "on"].includes(
  (process.env.PLAYWRIGHT_INTERNAL_RUN_SYNC || process.env.PLAYWRIGHT_MOCK || "").toLowerCase(),
);
const internalRunCompany = process.env.PLAYWRIGHT_INTERNAL_RUN_COMPANY || "testing-company";
const internalRunApp = process.env.PLAYWRIGHT_INTERNAL_RUN_APP || "automation-workspace";
const internalPlanId = process.env.PLAYWRIGHT_INTERNAL_PLAN_ID || "plan_tc_auto_playwright";
const internalPlanName =
  process.env.PLAYWRIGHT_INTERNAL_PLAN_NAME || "Testing Company - Regressão automatizada Playwright";
const INTERNAL_CASE_ID_REGEX = /@(?:case|tc-case|manualcase|internalcase)[:=#-]?([A-Z0-9_-]+)/gi;

const qaseClient = createQaseClient({
  token: qaseToken,
});

let internalRunSlugPromise: Promise<string | null> | null = null;

let loggedMissingConfig = false;
const loggedMissingCaseIds = new Set<string>();
const repoRoot = process.cwd();
const e2eStoreDir = path.join(repoRoot, ".tmp", "e2e");
const releasesStorePath = path.join(e2eStoreDir, "releases-manual.json");
const releaseCasesStorePath = path.join(e2eStoreDir, "releases-manual-cases.json");
const manualPlansStorePath = path.join(repoRoot, "data", "manual-test-plans.json");

// Link cases by adding @qase=123 to the title or a "qase" annotation.
const QASE_ID_REGEX = /@?qase(?:id)?[:=#-]?(\d+)/gi;

function mapStatus(status: TestStatus): QaseStatus {
  switch (status) {
    case "passed":
      return "passed";
    case "failed":
    case "timedOut":
      return "failed";
    case "interrupted":
      return "blocked";
    case "skipped":
      return "skipped";
    default:
      return "failed";
  }
}

function collectIdsFromText(text: string, ids: Set<number>) {
  if (!text) return;
  let match: RegExpExecArray | null = null;
  while ((match = QASE_ID_REGEX.exec(text)) !== null) {
    const id = Number.parseInt(match[1], 10);
    if (Number.isFinite(id)) ids.add(id);
  }
  QASE_ID_REGEX.lastIndex = 0;
}

function collectInternalCaseIdsFromText(text: string, ids: Set<string>) {
  if (!text) return;
  let match: RegExpExecArray | null = null;
  while ((match = INTERNAL_CASE_ID_REGEX.exec(text)) !== null) {
    const id = String(match[1] ?? "").trim();
    if (id) ids.add(id.toUpperCase());
  }
  INTERNAL_CASE_ID_REGEX.lastIndex = 0;
}

function extractCaseIds(testInfo: TestInfo): number[] {
  const ids = new Set<number>();
  collectIdsFromText(testInfo.title, ids);

  collectIdsFromText(testInfo.titlePath.join(" "), ids);

  for (const annotation of testInfo.annotations ?? []) {
    const annotationText = `${annotation.type} ${annotation.description ?? ""}`.trim();
    collectIdsFromText(annotationText, ids);
  }

  return Array.from(ids);
}

function extractInternalCaseIds(testInfo: TestInfo): string[] {
  const ids = new Set<string>();
  collectInternalCaseIdsFromText(testInfo.title, ids);
  collectInternalCaseIdsFromText(testInfo.titlePath.join(" "), ids);

  for (const annotation of testInfo.annotations ?? []) {
    const annotationText = `${annotation.type} ${annotation.description ?? ""}`.trim();
    collectInternalCaseIdsFromText(annotationText, ids);
  }

  return Array.from(ids);
}

function mapInternalStatus(status: TestStatus): "APROVADO" | "FALHA" | "BLOQUEADO" | "NAO_EXECUTADO" {
  switch (status) {
    case "passed":
      return "APROVADO";
    case "failed":
    case "timedOut":
      return "FALHA";
    case "interrupted":
      return "BLOQUEADO";
    default:
      return "NAO_EXECUTADO";
  }
}

function stripAnnotations(title: string) {
  return title
    .replace(/@(?:smoke|case|tc-case|manualcase|internalcase)[:=#-]?[A-Z0-9_-]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function ensureJsonFile(filePath: string, initial: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, initial, "utf8");
  }
}

async function readJsonFile<T>(filePath: string, fallback: T, initial: string): Promise<T> {
  try {
    await ensureJsonFile(filePath, initial);
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

async function writeJsonFile<T>(filePath: string, value: T, initial: string) {
  await ensureJsonFile(filePath, initial);
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

type ManualCaseItem = {
  id: string;
  title?: string;
  link?: string;
  status?: string;
  bug?: string | null;
  fromApi?: boolean;
};

async function readManualReleasesLocal() {
  const items = await readJsonFile<Release[]>(releasesStorePath, [], "[]");
  return Array.isArray(items) ? items : [];
}

async function writeManualReleasesLocal(releases: Release[]) {
  await writeJsonFile(releasesStorePath, releases, "[]");
}

async function readManualReleaseCasesLocal() {
  const items = await readJsonFile<Record<string, ManualCaseItem[]>>(releaseCasesStorePath, {}, "{}");
  return items && typeof items === "object" ? items : {};
}

async function writeManualReleaseCasesLocal(cases: Record<string, ManualCaseItem[]>) {
  await writeJsonFile(releaseCasesStorePath, cases, "{}");
}

async function getManualPlanCases(companySlug: string, planId: string): Promise<TestPlanCase[]> {
  const plans = await readJsonFile<
    Array<{
      id: string;
      companySlug: string;
      cases?: TestPlanCase[];
    }>
  >(manualPlansStorePath, [], "[]");
  const selectedPlan = plans.find(
    (plan) => plan.id === planId && String(plan.companySlug).trim().toLowerCase() === companySlug.trim().toLowerCase(),
  );
  return Array.isArray(selectedPlan?.cases) ? selectedPlan.cases : [];
}

async function ensureInternalRunSlug() {
  if (!internalRunSyncEnabled) return null;
  if (!internalRunSlugPromise) {
    internalRunSlugPromise = (async () => {
      const createdAt = new Date().toISOString();
      const generatedSlug = slugifyRelease(
        `playwright-${internalRunCompany}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      );
      const releases = await readManualReleasesLocal();
      const existing = releases.find((release) => release.slug === generatedSlug);
      if (!existing) {
        const planCases = await getManualPlanCases(internalRunCompany, internalPlanId);
        const seededCases = planCases.map((testCase) => ({
          id: testCase.id,
          title: testCase.title ?? `Caso ${testCase.id}`,
          link: testCase.link ?? undefined,
          status: "NAO_EXECUTADO",
          bug: null,
          fromApi: false,
        }));

        const nextRelease: Release = {
          id: generatedSlug,
          slug: generatedSlug,
          name: `${internalPlanName} - ${createdAt.slice(0, 16).replace("T", " ")}`,
          app: internalRunApp,
          qaseProject: null as unknown as string,
          kind: "run",
          environments: ["playwright", "testing-company"],
          source: "MANUAL",
          status: "ACTIVE",
          stats: {
            pass: 0,
            fail: 0,
            blocked: 0,
            notRun: seededCases.length,
          },
          observations: "Run criada automaticamente pelo fixture Playwright.",
          clientSlug: internalRunCompany,
          testPlanId: internalPlanId,
          testPlanName: internalPlanName,
          testPlanSource: "manual",
          testPlanProjectCode: null,
          createdAt,
          updatedAt: createdAt,
        };

        await writeManualReleasesLocal([nextRelease, ...releases.filter((release) => release.slug !== generatedSlug)]);
        const casesStore = await readManualReleaseCasesLocal();
        casesStore[generatedSlug] = seededCases;
        await writeManualReleaseCasesLocal(casesStore);
      }
      return generatedSlug;
    })();
  }
  return internalRunSlugPromise;
}

async function syncInternalRunResult(testInfo: TestInfo) {
  if (!internalRunSyncEnabled) return;

  const caseIds = extractInternalCaseIds(testInfo);
  if (!caseIds.length) return;

  const runSlug = await ensureInternalRunSlug();
  if (!runSlug) return;

  const casesStore = await readManualReleaseCasesLocal();
  const runCases = Array.isArray(casesStore[runSlug]) ? [...casesStore[runSlug]] : [];
  const status = mapInternalStatus(testInfo.status ?? "failed");
  const title = stripAnnotations(testInfo.title);

  for (const caseId of caseIds) {
    const index = runCases.findIndex((item) => String(item.id).toUpperCase() === caseId);
    const nextItem = {
      id: caseId,
      title: runCases[index]?.title || title || `Caso ${caseId}`,
      link: runCases[index]?.link,
      status,
      bug: runCases[index]?.bug ?? null,
      fromApi: false,
    };
    if (index >= 0) {
      runCases[index] = { ...runCases[index], ...nextItem };
    } else {
      runCases.push(nextItem);
    }
  }

  casesStore[runSlug] = runCases;
  await writeManualReleaseCasesLocal(casesStore);

  const stats = runCases.reduce(
    (accumulator, item) => {
      switch (item.status) {
        case "APROVADO":
          accumulator.pass += 1;
          break;
        case "FALHA":
          accumulator.fail += 1;
          break;
        case "BLOQUEADO":
          accumulator.blocked += 1;
          break;
        default:
          accumulator.notRun += 1;
          break;
      }
      return accumulator;
    },
    { pass: 0, fail: 0, blocked: 0, notRun: 0 },
  );

  const releases = await readManualReleasesLocal();
  const index = releases.findIndex((release) => release.slug === runSlug);
  if (index < 0) return;

  const current = releases[index];
  releases[index] = {
    ...current,
    status: stats.notRun === 0 ? "done" : "ACTIVE",
    stats,
    observations: `Última atualização automática: ${stripAnnotations(testInfo.title)} -> ${status}.`,
    updatedAt: new Date().toISOString(),
  };
  await writeManualReleasesLocal(releases);
}

type SimpleError = { message?: string; stack?: string };

function getErrors(testInfo: TestInfo): SimpleError[] {
  const errors = testInfo.errors?.length ? testInfo.errors : testInfo.error ? [testInfo.error] : [];
  return errors.map((err) => ({
    message: err?.message ? String(err.message) : String(err),
    stack: err?.stack ? String(err.stack) : "",
  }));
}

function buildComment(testInfo: TestInfo, status: QaseStatus) {
  const duration = Math.max(0, Math.round(testInfo.duration));
  const lines = [
    `Playwright test: ${testInfo.title}`,
    `Project: ${testInfo.project.name}`,
    `File: ${testInfo.file}`,
    `Status: ${status}`,
    `Duration: ${duration}ms`,
  ];

  const errors = getErrors(testInfo);
  if (errors.length) {
    lines.push("Errors:");
    lines.push(...errors.map((err) => err.message || "Unknown error"));
  }

  return lines.join("\n");
}

function buildStacktrace(testInfo: TestInfo) {
  const errors = getErrors(testInfo);
  const stacks = errors.map((err) => err.stack).filter(Boolean);
  return stacks.length ? stacks.join("\n\n") : undefined;
}

function logMissingConfigOnce() {
  if (loggedMissingConfig) return;
  loggedMissingConfig = true;

  const missing: string[] = [];
  if (!qaseToken) missing.push("QASE_API_TOKEN/QASE_TOKEN");
  if (!qaseProjectCode) missing.push("QASE_PROJECT_CODE");
  if (!qaseRunId) missing.push("QASE_RUN_ID");

  console.warn(`${logPrefix} disabled: missing ${missing.join(", ")}`);
}

function logMissingCaseOnce(testInfo: TestInfo) {
  if (loggedMissingCaseIds.has(testInfo.title)) return;
  loggedMissingCaseIds.add(testInfo.title);
  console.warn(`${logPrefix} no case id for "${testInfo.title}"`);
}

const test = base;

test.afterEach(async ({}, testInfo) => {
  await syncInternalRunResult(testInfo);

  if (!qaseEnabled) {
    logMissingConfigOnce();
    return;
  }

  const caseIds = extractCaseIds(testInfo);
  if (!caseIds.length) {
    logMissingCaseOnce(testInfo);
    return;
  }

  const status = mapStatus(testInfo.status ?? "failed");
  const comment = buildComment(testInfo, status);
  const stacktrace = buildStacktrace(testInfo);
  const duration = Math.max(0, Math.round(testInfo.duration));

  for (const caseId of caseIds) {
    try {
      await qaseClient.createResult(qaseProjectCode, qaseRunId!, {
        case_id: caseId,
        status,
        comment,
        stacktrace,
        time_ms: duration,
      });
    } catch (err) {
      const statusCode = err instanceof QaseError ? err.status : 0;
      console.warn(`${logPrefix} send failed`, {
        caseId,
        status: statusCode,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
});

export { test, expect };
