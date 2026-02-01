import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";

import store, { nextId } from "../store";
import type { Status } from "../types";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";

type ImportItem = {
  title: string;
  status: Status;
  case_id?: number | null;
  bug?: string | null;
  link?: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function normalizeRole(role?: string | null) {
  return (role ?? "").trim().toLowerCase();
}

function isAdmin(user: AuthUser) {
  if (user.isGlobalAdmin) return true;
  const role = normalizeRole(user.role);
  return role === "admin" || role === "global_admin";
}

function resolveAllowedSlugs(user: AuthUser): string[] {
  if (Array.isArray(user.companySlugs) && user.companySlugs.length) return user.companySlugs;
  if (user.companySlug) return [user.companySlug];
  return [];
}

function normalizeStatus(value: unknown): Status | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (["PASS", "FAIL", "BLOCKED", "NOT_RUN"].includes(upper)) return upper as Status;

  const lower = raw.toLowerCase();
  if (lower === "pass" || lower === "passed") return "PASS";
  if (lower === "fail" || lower === "failed") return "FAIL";
  if (lower === "blocked") return "BLOCKED";
  if (lower === "notrun" || lower === "not_run" || lower === "not run" || lower === "untested") return "NOT_RUN";
  return null;
}

function asSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asProject(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function asRunId(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asOptionalCaseId(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseItemsFromJson(body: unknown) {
  if (!body || typeof body !== "object") {
    return { project: null as string | null, runId: null as number | null, slug: null as string | null, items: [] as ImportItem[] };
  }
  const record = body as Record<string, unknown>;
  const project = asProject(record.project);
  const runId = asRunId(record.runId);
  const slug = asSlug(record.slug);

  const rawItems = (record.items ?? record.cards) as unknown;
  if (!Array.isArray(rawItems)) return { project, runId, slug, items: [] };

  const items: ImportItem[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const title = asTitle(r.title);
    const status = normalizeStatus(r.status);
    if (!title || !status) continue;

    const case_id = asOptionalCaseId(r.case_id ?? r.caseId ?? r.id);
    const bug = asOptionalString(r.bug);
    const link = asOptionalString(r.link);
    items.push({ title, status, case_id, bug, link });
  }
  return { project, runId, slug, items };
}

function parseItemsFromCsv(csvText: string): ImportItem[] {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const items: ImportItem[] = [];
  for (const row of parsed.data ?? []) {
    const title = asTitle(row.title);
    const status = normalizeStatus(row.status);
    if (!title || !status) continue;

    const case_id = asOptionalCaseId(row.case_id ?? row.caseId ?? row.id);
    const bug = asOptionalString(row.bug);
    const link = asOptionalString(row.link);
    items.push({ title, status, case_id, bug, link });
  }
  return items;
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryProject = asProject(searchParams.get("project"));
  const queryRunId = asRunId(searchParams.get("runId"));
  const requestedSlug = asSlug(searchParams.get("slug"));

  const user = await authenticateRequest(request);
  if (!user) return jsonError("Nao autorizado", 401);

  let effectiveSlug: string | null = null;
  if (isAdmin(user)) {
    effectiveSlug = requestedSlug ?? user.companySlug ?? null;
  } else {
    const allowed = resolveAllowedSlugs(user);
    if (!allowed.length) return jsonError("Acesso proibido", 403);
    if (requestedSlug && !allowed.includes(requestedSlug)) return jsonError("Acesso proibido", 403);
    effectiveSlug = requestedSlug ?? user.companySlug ?? allowed[0] ?? null;
  }

  if (!effectiveSlug) return jsonError("slug e obrigatorio", 400);

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  let project: string | null = queryProject;
  let runId: number | null = queryRunId;
  let items: ImportItem[] = [];

  if (contentType.includes("text/csv") || contentType.includes("application/csv")) {
    if (!project || runId === null) {
      return jsonError("project e runId sao obrigatorios para importacao CSV", 400);
    }
    const text = await request.text();
    items = parseItemsFromCsv(text);
  } else {
    const body = await request.json().catch(() => null);
    if (!body) return jsonError("JSON invalido", 400);
    const parsed = parseItemsFromJson(body);
    project = parsed.project ?? project;
    runId = parsed.runId ?? runId;

    const bodySlug = parsed.slug;
    if (bodySlug) {
      if (isAdmin(user)) {
        effectiveSlug = bodySlug;
      } else {
        const allowed = resolveAllowedSlugs(user);
        if (!allowed.includes(bodySlug)) return jsonError("Acesso proibido", 403);
        if (requestedSlug && bodySlug !== requestedSlug) return jsonError("Acesso proibido", 403);
        effectiveSlug = bodySlug;
      }
    }

    items = parsed.items;
  }

  if (!project || runId === null) {
    return jsonError("project e runId sao obrigatorios", 400);
  }
  if (!items.length) {
    return jsonError("Nenhum item valido para importar (verifique title/status)", 400);
  }

  for (const item of items) {
    store.push({
      id: nextId(),
      client_slug: effectiveSlug,
      project,
      run_id: runId,
      case_id: item.case_id ?? null,
      title: item.title,
      status: item.status,
      bug: item.bug ?? null,
      link: item.link ?? null,
      created_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ inserted: items.length, mode: "memory" }, { status: 201 });
}
