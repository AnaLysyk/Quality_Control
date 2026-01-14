import { test as base, expect, type TestInfo, type TestStatus } from "@playwright/test";
import { createQaseClient, QaseError } from "../../lib/qaseSdk";

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

const qaseClient = createQaseClient({
  token: qaseToken,
});

let loggedMissingConfig = false;
const loggedMissingCaseIds = new Set<string>();

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

function extractCaseIds(testInfo: TestInfo): number[] {
  const ids = new Set<number>();
  collectIdsFromText(testInfo.title, ids);

  if (typeof testInfo.titlePath === "function") {
    collectIdsFromText(testInfo.titlePath().join(" "), ids);
  }

  for (const annotation of testInfo.annotations ?? []) {
    const annotationText = `${annotation.type} ${annotation.description ?? ""}`.trim();
    collectIdsFromText(annotationText, ids);
  }

  return Array.from(ids);
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
  if (!qaseEnabled) {
    logMissingConfigOnce();
    return;
  }

  const caseIds = extractCaseIds(testInfo);
  if (!caseIds.length) {
    logMissingCaseOnce(testInfo);
    return;
  }

  const status = mapStatus(testInfo.status);
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
