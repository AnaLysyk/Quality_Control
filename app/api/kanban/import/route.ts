import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";

import { getNextId, mutateKanbanStore } from "../store";
import type { Status } from "../types";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";
import { rateLimit } from "@/lib/rateLimit";

const MAX_IMPORT_BYTES = 2 * 1024 * 1024; // 2 MB guardrail
const MAX_IMPORT_ITEMS = 500;

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
  return role === "admin" || role === "global_admin" || role === "company" || role === "company_admin";
}

function canImport(user: AuthUser) {
  if (user.isGlobalAdmin) return true;
  const role = normalizeRole(user.role);
  return role === "admin" || role === "global_admin" || role === "company_admin" || role === "it_dev";
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

function sanitizeLink(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed.length > 500 ? trimmed.slice(0, 500) : trimmed;
}

function sanitizeBug(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
}

function buildDedupeKey(input: {
  slug: string | null;
  project: string;
  runId: number | null | undefined;
  caseId: number | null;
  title: string;
}) {
  const slug = input.slug ?? "-";
  const runToken = typeof input.runId === "number" && Number.isFinite(input.runId) ? `run:${input.runId}` : "run:none";
  const caseToken = input.caseId !== null && input.caseId !== undefined ? `case:${input.caseId}` : `title:${input.title.toLowerCase()}`;
  return `${slug}::${input.project}::${runToken}::${caseToken}`;
}

function isCsvRequest(format: string, contentType: string) {
  if (format === "csv") return true;
  if (contentType.includes("text/csv") || contentType.includes("application/csv")) return true;
  return false;
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
  const normalized = csvText.replace(/^\uFEFF/, "");
  const parsed = Papa.parse<Record<string, unknown>>(normalized, {
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
  const requestedFormat = (searchParams.get("format") ?? "").toLowerCase();

  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const rate = await rateLimit(request, `kanban-import:${ip}`);
  if (rate.limited) return rate.response;

  const user = await authenticateRequest(request);
  if (!user) return jsonError("Nao autorizado", 401);
  if (!canImport(user)) return jsonError("Acesso proibido", 403);

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
  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const parsedLength = Number.parseInt(declaredLength, 10);
    if (Number.isFinite(parsedLength) && parsedLength > MAX_IMPORT_BYTES) {
      return jsonError("Payload excede o limite permitido", 413);
    }
  }

  let project: string | null = queryProject;
  let runId: number | null = queryRunId;
  let items: ImportItem[] = [];
  let mode: "csv" | "json" = "json";

  if (isCsvRequest(requestedFormat, contentType)) {
    if (!project || runId === null) {
      return jsonError("project e runId sao obrigatorios para importacao CSV", 400);
    }
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > MAX_IMPORT_BYTES) {
      return jsonError("Payload excede o limite permitido", 413);
    }
    items = parseItemsFromCsv(text);
    mode = "csv";
  } else {
    const textBody = await request.text();
    if (Buffer.byteLength(textBody, "utf8") > MAX_IMPORT_BYTES) {
      return jsonError("Payload excede o limite permitido", 413);
    }
    let body: unknown = null;
    if (textBody.trim().length > 0) {
      try {
        body = JSON.parse(textBody);
      } catch {
        return jsonError("JSON invalido", 400);
      }
    }
    if (!body || typeof body !== "object") return jsonError("JSON invalido", 400);
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
    mode = "json";
  }

  if (!project) {
    return jsonError("project e runId sao obrigatorios", 400);
  }
  if (runId === null) {
    return jsonError("project e runId sao obrigatorios", 400);
  }
  const finalProject = project;
  const finalRunId = runId;
  if (!items.length) {
    return jsonError("Nenhum item valido para importar (verifique title/status)", 400);
  }
  if (items.length > MAX_IMPORT_ITEMS) {
    return jsonError(`Limite de ${MAX_IMPORT_ITEMS} itens por importacao`, 400);
  }

  const normalizedItems = items.map((item) => ({
    ...item,
    bug: sanitizeBug(item.bug ?? null),
    link: sanitizeLink(item.link ?? null),
  }));

  let inserted = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  await mutateKanbanStore((store) => {
    const existingKeys = new Set(
      store.items.map((current) =>
        buildDedupeKey({
          slug: current.client_slug ?? null,
          project: current.project,
          runId: current.run_id,
          caseId: current.case_id ?? null,
          title: current.title ?? "",
        }),
      ),
    );

    for (const item of normalizedItems) {
      const dedupeKey = buildDedupeKey({
        slug: effectiveSlug,
        project: finalProject,
        runId: finalRunId,
        caseId: item.case_id ?? null,
        title: item.title,
      });
      if (existingKeys.has(dedupeKey)) {
        skipped += 1;
        continue;
      }
      existingKeys.add(dedupeKey);
      store.items.push({
        id: getNextId(store),
        client_slug: effectiveSlug,
        project: finalProject,
        run_id: finalRunId,
        case_id: item.case_id ?? null,
        title: item.title,
        status: item.status,
        bug: item.bug ?? null,
        link: item.link ?? null,
        created_at: now,
      });
      inserted += 1;
    }
  });

  if (!inserted) {
    return jsonError("Nenhum item novo para importar", 409);
  }

  return NextResponse.json({ inserted, skipped, mode }, { status: 201 });
}
