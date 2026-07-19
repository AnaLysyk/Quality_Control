import "server-only";

import { randomUUID } from "crypto";
import { getRedis, isRedisConfigured } from "@/backend/redis";
import type { QaseResultSyncStatus, TestRunItemStatus, TestRunSource, TestRunStatus, TestRunType } from "@/data/runOperationModel";

const STORE_KEY = "qc:quality_runs:v1";
const USE_REDIS = process.env.QUALITY_RUNS_STORE === "redis" || isRedisConfigured();

type RunStore = {
  runs: QualityRunRecord[];
};

export type QualityRunSummary = {
  totalItems: number;
  notRunCount: number;
  inProgressCount: number;
  passedCount: number;
  failedCount: number;
  blockedCount: number;
  skippedCount: number;
  retestCount: number;
  passRate: number;
  failRate: number;
  blockedRate: number;
  progressPercent: number;
  defectsLinked: number;
  evidenceCount: number;
  estimatedMinutes: number;
  actualMinutes: number;
  varianceMinutes: number;
};

export type QualityRunEvidenceRef = {
  id: string;
  type?: string | null;
  name?: string | null;
  url?: string | null;
  createdAt: string;
};

export type QualityRunItemAttempt = {
  id: string;
  attemptNumber: number;
  status: TestRunItemStatus;
  executorId?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationSeconds?: number | null;
  actualResult?: string | null;
  failureReason?: string | null;
  blockedReason?: string | null;
  skipReason?: string | null;
  evidenceIds: string[];
  defectIds: string[];
  createdAt: string;
};

export type QualityRunItemRecord = {
  id: string;
  runId: string;
  companyId: string;
  projectId: string;
  planId: string;
  caseId: string;
  caseVersion: number;
  caseKey: string;
  caseTitle: string;
  suitePath?: string | null;
  priority?: string | null;
  isRequired: boolean;
  assigneeId?: string | null;
  executorId?: string | null;
  executionType: "manual" | "automated" | "assisted_by_brian";
  status: TestRunItemStatus;
  previousStatus?: TestRunItemStatus | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationSeconds?: number | null;
  estimatedMinutes: number;
  attemptNumber: number;
  lastAttemptId?: string | null;
  blockedReason?: string | null;
  skipReason?: string | null;
  failureReason?: string | null;
  actualResult?: string | null;
  expectedResultSnapshot?: string | null;
  notes?: string | null;
  defectId?: string | null;
  evidenceIds: string[];
  evidences: QualityRunEvidenceRef[];
  automationScriptId?: string | null;
  automationRunId?: string | null;
  qaseResultId?: string | null;
  qaseCaseId?: string | null;
  qaseRunId?: string | null;
  qaseSyncStatus?: QaseResultSyncStatus;
  qaseSyncError?: string | null;
  qaseSyncedAt?: string | null;
  attempts: QualityRunItemAttempt[];
  updatedBy?: string | null;
  updatedAt: string;
};

export type QualityRunRecord = {
  id: string;
  companyId: string;
  projectId: string;
  planId: string;
  planSnapshotId: string;
  title: string;
  description?: string | null;
  runType: TestRunType;
  status: TestRunStatus;
  source: TestRunSource;
  qaseRunId?: string | null;
  qaseProjectCode?: string | null;
  releaseId?: string | null;
  milestoneId?: string | null;
  environment?: string | null;
  buildVersion?: string | null;
  browser?: string | null;
  platform?: string | null;
  device?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationSeconds?: number | null;
  createdBy: string;
  runOwnerId: string;
  closedBy?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
  items: QualityRunItemRecord[];
  summary: QualityRunSummary;
};

export type CreateQualityRunCaseInput = {
  caseId: string;
  caseVersion?: number | null;
  caseKey?: string | null;
  caseTitle?: string | null;
  title?: string | null;
  suitePath?: string | null;
  priority?: string | null;
  isRequired?: boolean | null;
  assigneeId?: string | null;
  estimatedMinutes?: number | null;
  expectedResultSnapshot?: string | null;
  automationScriptId?: string | null;
  qaseCaseId?: string | number | null;
};

export type CreateQualityRunInput = {
  companyId: string;
  projectId: string;
  planId: string;
  planSnapshotId?: string | null;
  title: string;
  description?: string | null;
  runType?: TestRunType | null;
  source?: TestRunSource | null;
  runOwnerId?: string | null;
  actorId: string;
  environment?: string | null;
  buildVersion?: string | null;
  qaseRunId?: string | number | null;
  qaseProjectCode?: string | null;
  cases: CreateQualityRunCaseInput[];
};

export type UpdateRunItemResultInput = {
  runId: string;
  runItemId: string;
  status: TestRunItemStatus;
  actorId: string;
  executorId?: string | null;
  actualResult?: string | null;
  failureReason?: string | null;
  blockedReason?: string | null;
  skipReason?: string | null;
  notes?: string | null;
  evidenceIds?: string[] | null;
  evidences?: Array<Partial<QualityRunEvidenceRef>> | null;
  defectId?: string | null;
  qaseResultId?: string | number | null;
  qaseSyncStatus?: QaseResultSyncStatus | null;
  qaseSyncError?: string | null;
  qaseSyncedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationSeconds?: number | null;
};

let memoryStore: RunStore = { runs: [] };

function now() {
  return new Date().toISOString();
}

function text(value: unknown, max = 400) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function nullableText(value: unknown, max = 400) {
  const normalized = text(value, max);
  return normalized || null;
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => text(value, 120)).filter(Boolean)));
}

function isRunItemStatus(value: unknown): value is TestRunItemStatus {
  return value === "not_run" || value === "in_progress" || value === "passed" || value === "failed" || value === "blocked" || value === "skipped" || value === "retest";
}

function isRunStatus(value: unknown): value is TestRunStatus {
  return value === "draft" || value === "scheduled" || value === "in_progress" || value === "paused" || value === "completed" || value === "cancelled" || value === "aborted";
}

function emptySummary(): QualityRunSummary {
  return {
    totalItems: 0,
    notRunCount: 0,
    inProgressCount: 0,
    passedCount: 0,
    failedCount: 0,
    blockedCount: 0,
    skippedCount: 0,
    retestCount: 0,
    passRate: 0,
    failRate: 0,
    blockedRate: 0,
    progressPercent: 0,
    defectsLinked: 0,
    evidenceCount: 0,
    estimatedMinutes: 0,
    actualMinutes: 0,
    varianceMinutes: 0,
  };
}

function calculateSummary(items: QualityRunItemRecord[]): QualityRunSummary {
  const summary = emptySummary();
  summary.totalItems = items.length;
  for (const item of items) {
    if (item.status === "not_run") summary.notRunCount += 1;
    if (item.status === "in_progress") summary.inProgressCount += 1;
    if (item.status === "passed") summary.passedCount += 1;
    if (item.status === "failed") summary.failedCount += 1;
    if (item.status === "blocked") summary.blockedCount += 1;
    if (item.status === "skipped") summary.skippedCount += 1;
    if (item.status === "retest") summary.retestCount += 1;
    if (item.defectId) summary.defectsLinked += 1;
    summary.evidenceCount += item.evidenceIds.length;
    summary.estimatedMinutes += item.estimatedMinutes || 0;
    summary.actualMinutes += Math.round((item.durationSeconds || 0) / 60);
  }
  const executed = summary.passedCount + summary.failedCount + summary.blockedCount + summary.skippedCount + summary.retestCount;
  summary.passRate = executed ? Math.round((summary.passedCount / executed) * 100) : 0;
  summary.failRate = executed ? Math.round((summary.failedCount / executed) * 100) : 0;
  summary.blockedRate = executed ? Math.round((summary.blockedCount / executed) * 100) : 0;
  summary.progressPercent = summary.totalItems ? Math.round((executed / summary.totalItems) * 100) : 0;
  summary.varianceMinutes = summary.actualMinutes - summary.estimatedMinutes;
  return summary;
}

function normalizeStore(raw: unknown): RunStore {
  if (!raw || typeof raw !== "object") return { runs: [] };
  const record = raw as { runs?: unknown };
  return { runs: Array.isArray(record.runs) ? (record.runs.filter(Boolean) as QualityRunRecord[]) : [] };
}

async function readStore(): Promise<RunStore> {
  if (USE_REDIS) {
    try {
      const raw = await getRedis().get<string>(STORE_KEY);
      return raw ? normalizeStore(JSON.parse(raw)) : { runs: [] };
    } catch {
      return memoryStore;
    }
  }
  return memoryStore;
}

async function writeStore(next: RunStore) {
  memoryStore = next;
  if (USE_REDIS) {
    try {
      await getRedis().set(STORE_KEY, JSON.stringify(next));
    } catch {
      // keep memory fallback
    }
  }
}

function normalizeEvidence(input: Partial<QualityRunEvidenceRef>): QualityRunEvidenceRef {
  return {
    id: text(input.id) || randomUUID(),
    type: nullableText(input.type, 40),
    name: nullableText(input.name, 160),
    url: nullableText(input.url, 1000),
    createdAt: text(input.createdAt) || now(),
  };
}

function buildRunItem(run: Pick<QualityRunRecord, "id" | "companyId" | "projectId" | "planId" | "qaseRunId">, testCase: CreateQualityRunCaseInput, index: number): QualityRunItemRecord {
  const caseId = text(testCase.caseId, 160);
  const caseTitle = text(testCase.caseTitle ?? testCase.title, 300) || `Caso ${caseId || index + 1}`;
  const caseKey = text(testCase.caseKey, 80) || `CASE-${String(index + 1).padStart(3, "0")}`;
  const timestamp = now();
  return {
    id: randomUUID(),
    runId: run.id,
    companyId: run.companyId,
    projectId: run.projectId,
    planId: run.planId,
    caseId,
    caseVersion: Math.max(1, Math.round(normalizeNumber(testCase.caseVersion, 1))),
    caseKey,
    caseTitle,
    suitePath: nullableText(testCase.suitePath, 300),
    priority: nullableText(testCase.priority, 40) ?? "medium",
    isRequired: testCase.isRequired !== false,
    assigneeId: nullableText(testCase.assigneeId, 160),
    executorId: null,
    executionType: "manual",
    status: "not_run",
    previousStatus: null,
    startedAt: null,
    finishedAt: null,
    durationSeconds: null,
    estimatedMinutes: Math.max(0, Math.round(normalizeNumber(testCase.estimatedMinutes, 0))),
    attemptNumber: 0,
    lastAttemptId: null,
    blockedReason: null,
    skipReason: null,
    failureReason: null,
    actualResult: null,
    expectedResultSnapshot: nullableText(testCase.expectedResultSnapshot, 2000),
    notes: null,
    defectId: null,
    evidenceIds: [],
    evidences: [],
    automationScriptId: nullableText(testCase.automationScriptId, 500),
    automationRunId: null,
    qaseResultId: null,
    qaseCaseId: testCase.qaseCaseId == null ? null : String(testCase.qaseCaseId),
    qaseRunId: run.qaseRunId ?? null,
    qaseSyncStatus: "skipped",
    qaseSyncError: null,
    qaseSyncedAt: null,
    attempts: [],
    updatedBy: null,
    updatedAt: timestamp,
  };
}

function validateResultInput(item: QualityRunItemRecord, input: UpdateRunItemResultInput): string | null {
  if (!isRunItemStatus(input.status)) return "Status inválido para item da run.";
  if (input.status === "failed") {
    const hasFailureContext = Boolean(text(input.failureReason, 1000) || text(input.actualResult, 2000) || normalizeStringArray(input.evidenceIds).length || input.evidences?.length);
    if (!hasFailureContext) return "Failed exige motivo, resultado atual ou evidência.";
  }
  if (input.status === "blocked" && !text(input.blockedReason, 1000)) {
    return "Blocked exige motivo do bloqueio.";
  }
  if (input.status === "skipped" && item.isRequired && !text(input.skipReason, 1000)) {
    return "Skipped em item obrigatório exige justificativa.";
  }
  return null;
}

function refreshRun(run: QualityRunRecord): QualityRunRecord {
  return { ...run, summary: calculateSummary(run.items), updatedAt: now() };
}

export async function listQualityRuns(filters?: { companyId?: string | null; projectId?: string | null; planId?: string | null; status?: string | null; limit?: number }) {
  const store = await readStore();
  const limit = Math.max(1, Math.min(200, Math.round(normalizeNumber(filters?.limit, 50))));
  return store.runs
    .filter((run) => !filters?.companyId || run.companyId === filters.companyId)
    .filter((run) => !filters?.projectId || run.projectId === filters.projectId)
    .filter((run) => !filters?.planId || run.planId === filters.planId)
    .filter((run) => !filters?.status || run.status === filters.status)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}

export async function getQualityRun(runId: string) {
  const store = await readStore();
  return store.runs.find((run) => run.id === runId) ?? null;
}

export async function createQualityRun(input: CreateQualityRunInput) {
  const companyId = text(input.companyId, 160);
  const projectId = text(input.projectId, 160);
  const planId = text(input.planId, 160);
  const title = text(input.title, 300);
  const actorId = text(input.actorId, 160) || "system";
  if (!companyId || !projectId || !planId || !title) {
    return { ok: false as const, error: "companyId, projectId, planId e title são obrigatórios." };
  }
  if (!Array.isArray(input.cases) || input.cases.length === 0) {
    return { ok: false as const, error: "Run precisa receber ao menos um caso do snapshot do plano." };
  }
  const createdAt = now();
  const id = randomUUID();
  const run: QualityRunRecord = {
    id,
    companyId,
    projectId,
    planId,
    planSnapshotId: text(input.planSnapshotId, 160) || `snapshot-${planId}-${Date.now()}`,
    title,
    description: nullableText(input.description, 2000),
    runType: input.runType ?? "manual",
    status: "draft",
    source: input.source ?? "local",
    qaseRunId: input.qaseRunId == null ? null : String(input.qaseRunId),
    qaseProjectCode: nullableText(input.qaseProjectCode, 80),
    releaseId: null,
    milestoneId: null,
    environment: nullableText(input.environment, 120),
    buildVersion: nullableText(input.buildVersion, 120),
    browser: null,
    platform: null,
    device: null,
    startedAt: null,
    finishedAt: null,
    durationSeconds: null,
    createdBy: actorId,
    runOwnerId: text(input.runOwnerId, 160) || actorId,
    closedBy: null,
    cancelReason: null,
    createdAt,
    updatedAt: createdAt,
    items: [],
    summary: emptySummary(),
  };
  run.items = input.cases.map((testCase, index) => buildRunItem(run, testCase, index));
  const nextRun = refreshRun(run);
  const store = await readStore();
  await writeStore({ runs: [nextRun, ...store.runs] });
  return { ok: true as const, run: nextRun };
}

export async function updateRunItemResult(input: UpdateRunItemResultInput) {
  const store = await readStore();
  const runIndex = store.runs.findIndex((run) => run.id === input.runId);
  if (runIndex < 0) return { ok: false as const, status: 404, error: "Run não encontrada." };

  const run = store.runs[runIndex];
  const itemIndex = run.items.findIndex((item) => item.id === input.runItemId);
  if (itemIndex < 0) return { ok: false as const, status: 404, error: "Item da run não encontrado." };

  const item = run.items[itemIndex];
  const validation = validateResultInput(item, input);
  if (validation) return { ok: false as const, status: 400, error: validation };

  const timestamp = now();
  const startedAt = text(input.startedAt) || item.startedAt || timestamp;
  const finishedAt = text(input.finishedAt) || (input.status === "in_progress" ? null : timestamp);
  const durationSeconds = input.durationSeconds ?? (finishedAt ? Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000)) : item.durationSeconds ?? null);
  const evidenceRefs = (input.evidences ?? []).map(normalizeEvidence);
  const evidenceIds = Array.from(new Set([...item.evidenceIds, ...normalizeStringArray(input.evidenceIds), ...evidenceRefs.map((evidence) => evidence.id)]));
  const defectId = nullableText(input.defectId, 160) ?? item.defectId ?? null;
  const attemptNumber = item.attemptNumber + 1;
  const attempt: QualityRunItemAttempt = {
    id: randomUUID(),
    attemptNumber,
    status: input.status,
    executorId: nullableText(input.executorId, 160) ?? nullableText(input.actorId, 160),
    startedAt,
    finishedAt,
    durationSeconds,
    actualResult: nullableText(input.actualResult, 2000),
    failureReason: nullableText(input.failureReason, 1000),
    blockedReason: nullableText(input.blockedReason, 1000),
    skipReason: nullableText(input.skipReason, 1000),
    evidenceIds,
    defectIds: defectId ? [defectId] : [],
    createdAt: timestamp,
  };

  const nextItem: QualityRunItemRecord = {
    ...item,
    status: input.status,
    previousStatus: item.status,
    executorId: attempt.executorId,
    startedAt,
    finishedAt,
    durationSeconds,
    actualResult: attempt.actualResult,
    failureReason: attempt.failureReason,
    blockedReason: attempt.blockedReason,
    skipReason: attempt.skipReason,
    notes: nullableText(input.notes, 2000) ?? item.notes ?? null,
    defectId,
    evidenceIds,
    evidences: [...item.evidences, ...evidenceRefs],
    qaseResultId: input.qaseResultId == null ? item.qaseResultId ?? null : String(input.qaseResultId),
    qaseSyncStatus: input.qaseSyncStatus ?? item.qaseSyncStatus ?? "pending",
    qaseSyncError: input.qaseSyncError ?? null,
    qaseSyncedAt: input.qaseSyncedAt ?? item.qaseSyncedAt ?? null,
    attemptNumber,
    lastAttemptId: attempt.id,
    attempts: [...item.attempts, attempt],
    updatedBy: input.actorId,
    updatedAt: timestamp,
  };

  const nextItems = [...run.items];
  nextItems[itemIndex] = nextItem;
  const shouldStartRun = run.status === "draft" || run.status === "scheduled";
  const nextRun = refreshRun({
    ...run,
    status: shouldStartRun ? "in_progress" : run.status,
    startedAt: run.startedAt ?? startedAt,
    items: nextItems,
  });
  const nextRuns = [...store.runs];
  nextRuns[runIndex] = nextRun;
  await writeStore({ runs: nextRuns });
  return { ok: true as const, run: nextRun, item: nextItem, attempt };
}

export async function updateQualityRunStatus(runId: string, status: TestRunStatus, actorId: string, reason?: string | null) {
  if (!isRunStatus(status)) return { ok: false as const, status: 400, error: "Status inválido para run." };
  const store = await readStore();
  const runIndex = store.runs.findIndex((run) => run.id === runId);
  if (runIndex < 0) return { ok: false as const, status: 404, error: "Run não encontrada." };
  const run = store.runs[runIndex];
  if (status === "completed") {
    const hasOpenRequired = run.items.some((item) => item.isRequired && (item.status === "not_run" || item.status === "in_progress"));
    if (hasOpenRequired) return { ok: false as const, status: 400, error: "Run não pode finalizar com item obrigatório aberto." };
  }
  const timestamp = now();
  const nextRun = refreshRun({
    ...run,
    status,
    startedAt: status === "in_progress" ? run.startedAt ?? timestamp : run.startedAt,
    finishedAt: status === "completed" || status === "cancelled" || status === "aborted" ? timestamp : run.finishedAt,
    closedBy: status === "completed" || status === "cancelled" || status === "aborted" ? actorId : run.closedBy,
    cancelReason: status === "cancelled" || status === "aborted" ? nullableText(reason, 1000) : run.cancelReason,
  });
  const nextRuns = [...store.runs];
  nextRuns[runIndex] = nextRun;
  await writeStore({ runs: nextRuns });
  return { ok: true as const, run: nextRun };
}

