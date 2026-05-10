import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getJsonStorePath } from "@/data/jsonStorePath";
import type { AutomationAgentRun, AutomationDraft, AutomationDraftStatus, TestCaseAutomationStatus } from "./types";

type DraftStoreRecord = {
  drafts: AutomationDraft[];
  runs: AutomationAgentRun[];
};

const STORE_PATH = getJsonStorePath("test-case-automation-drafts.json");

async function ensureStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify({ drafts: [], runs: [] }, null, 2), "utf8");
  }
}

async function readStore(): Promise<DraftStoreRecord> {
  await ensureStore();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<DraftStoreRecord>;
    return {
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
    };
  } catch {
    return { drafts: [], runs: [] };
  }
}

async function writeStore(store: DraftStoreRecord) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullable(value: unknown) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function deriveMaturityStatus(status: AutomationDraftStatus): TestCaseAutomationStatus {
  if (status === "approved") return "approved";
  if (status === "linked") return "linked";
  if (status === "discarded") return "disabled";
  return "ai_generated";
}

export async function listAutomationDrafts(testCaseId: string) {
  const store = await readStore();
  return store.drafts
    .filter((draft) => draft.testCaseId === testCaseId)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

export async function listAutomationAgentRuns(testCaseId: string) {
  const store = await readStore();
  return store.runs
    .filter((run) => run.testCaseId === testCaseId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export async function createAutomationDraft(
  testCaseId: string,
  actorId: string,
  input: Partial<AutomationDraft> & { status?: AutomationDraftStatus },
) {
  const now = new Date().toISOString();
  const draft: AutomationDraft = {
    id: input.id ?? `draft-${randomUUID()}`,
    testCaseId,
    generatedBy: input.generatedBy === "user" ? "user" : "ai",
    status: input.status ?? "draft",
    maturityStatus: input.maturityStatus ?? deriveMaturityStatus(input.status ?? "draft"),
    approvalState: input.approvalState ?? "awaiting_qa_review",
    qualityScore: input.qualityScore ?? null,
    linkedTestCaseVersion: input.linkedTestCaseVersion ?? null,
    linkedAutomationVersion: input.linkedAutomationVersion ?? null,
    isOutdated: input.isOutdated ?? false,
    specFile: normalizeNullable(input.specFile),
    specCode: normalizeNullable(input.specCode),
    pomPath: normalizeNullable(input.pomPath),
    pomCode: normalizeNullable(input.pomCode),
    fixturePath: normalizeNullable(input.fixturePath),
    fixtureCode: normalizeNullable(input.fixtureCode),
    command: normalizeNullable(input.command),
    reviewNotes: normalizeNullable(input.reviewNotes),
    githubPublication: input.githubPublication ?? null,
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
  };

  const store = await readStore();
  store.drafts = [draft, ...store.drafts.filter((item) => item.id !== draft.id)];
  await writeStore(store);
  return draft;
}

export async function updateAutomationDraftStatus(
  testCaseId: string,
  draftId: string,
  status: AutomationDraftStatus,
) {
  const store = await readStore();
  const index = store.drafts.findIndex((draft) => draft.id === draftId && draft.testCaseId === testCaseId);
  if (index < 0) return null;

  const current = store.drafts[index];
  const updated: AutomationDraft = {
    ...current,
    status,
    updatedAt: new Date().toISOString(),
  };
  store.drafts[index] = updated;
  await writeStore(store);
  return updated;
}

export async function getAutomationDraft(testCaseId: string, draftId: string) {
  const store = await readStore();
  return store.drafts.find((draft) => draft.id === draftId && draft.testCaseId === testCaseId) ?? null;
}

export async function updateAutomationDraft(
  testCaseId: string,
  draftId: string,
  patch: Partial<AutomationDraft>,
) {
  const store = await readStore();
  const index = store.drafts.findIndex((draft) => draft.id === draftId && draft.testCaseId === testCaseId);
  if (index < 0) return null;

  const current = store.drafts[index];
  const updated: AutomationDraft = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  store.drafts[index] = updated;
  await writeStore(store);
  return updated;
}

export async function recordAutomationAgentRun(
  testCaseId: string,
  actorId: string,
  agentName: string,
  inputContext: unknown,
  output: unknown,
  status: "completed" | "failed",
  errorMessage?: string,
) {
  const run: AutomationAgentRun = {
    id: `agent-run-${randomUUID()}`,
    testCaseId,
    agentName,
    inputContext,
    output,
    status,
    errorMessage: errorMessage ? errorMessage.trim() : null,
    createdBy: actorId,
    createdAt: new Date().toISOString(),
  };

  const store = await readStore();
  store.runs = [run, ...store.runs];
  await writeStore(store);
  return run;
}