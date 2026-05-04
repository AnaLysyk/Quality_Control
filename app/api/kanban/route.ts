import { NextRequest, NextResponse } from "next/server";

import { getNextId, readKanbanStore, writeKanbanStore } from "./store";
import type { Status } from "./types";
import { getAuthContext } from "@/lib/rbac";
import type { AuthUser } from "@/lib/jwtAuth";

export const revalidate = 0;

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function normalizeRole(role?: string | null) {
  return (role ?? "").trim().toLowerCase();
}

function isAdmin(user: AuthUser) {
  if (user.isGlobalAdmin) return true;
  const role = normalizeRole(user.role);
  return role === "leader_tc" || role === "technical_support" || role === "empresa";
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const project = asProject(searchParams.get("project"));
  const runId = asRunId(searchParams.get("runId"));
  const requestedSlug = asSlug(searchParams.get("slug"));

  if (!project || runId === null) {
    return jsonError("project e runId sao obrigatorios", 400);
  }

  const auth = await getAuthContext(request);
  if (!auth) return jsonError("Não autorizado", 401);

  let effectiveSlug: string | null = null;
  if (requestedSlug) {
    if (!auth.companySlugs.includes(requestedSlug)) return jsonError("Acesso proibido", 403);
    effectiveSlug = requestedSlug;
  } else {
    effectiveSlug = auth.companySlugs[0] ?? null;
  }

  const { items: allItems } = await readKanbanStore();
  const items = allItems
    .filter((c) => {
      if (c.project !== project || c.run_id !== runId) return false;
      if (!effectiveSlug) return true;
      return c.client_slug === effectiveSlug;
    })
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return ta - tb;
    });

  if (!items.length) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError("JSON invalido", 400);

  const auth = await getAuthContext(request);
  if (!auth) return jsonError("Não autorizado", 401);

  const record = body as Record<string, unknown>;
  const project = asProject(record.project);
  const runId = asRunId(record.runId);
  const title = asTitle(record.title);
  const status = normalizeStatus(record.status);

  const requestedSlug = asSlug(record.slug);
  let effectiveSlug: string | null = null;
  if (requestedSlug) {
    if (!auth.companySlugs.includes(requestedSlug)) return jsonError("Acesso proibido", 403);
    effectiveSlug = requestedSlug;
  } else {
    effectiveSlug = auth.companySlugs[0] ?? null;
  }

  if (!effectiveSlug) return jsonError("slug e obrigatório", 400);
  if (!project || runId === null || !title || !status) {
    return jsonError("Campos obrigatorios: project, runId, title, status válido", 400);
  }

  const caseId = asOptionalCaseId(record.case_id ?? record.caseId ?? record.id);
  const bug = asOptionalString(record.bug);
  const link = asOptionalString(record.link);

  const store = await readKanbanStore();
  const card = {
    id: getNextId(store),
    client_slug: effectiveSlug,
    project,
    run_id: runId,
    case_id: caseId,
    title,
    status,
    bug,
    link,
    created_at: new Date().toISOString(),
  };
  store.items.push(card);
  await writeKanbanStore(store);
  return NextResponse.json(card, { status: 201 });
}
