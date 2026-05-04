import { NextRequest, NextResponse } from "next/server";

import { getNextId, readKanbanStore, writeKanbanStore } from "../store";
import type { Card, Status } from "../types";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";

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

function asOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asCaseId(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError("JSON invalido", 400);

  const user = await authenticateRequest(request);
  if (!user) return jsonError("Não autorizado", 401);

  const record = body as Record<string, unknown>;
  const project = asProject(record.project);
  const runId = asRunId(record.runId);
  const caseId = asCaseId(record.caseId ?? record.case_id ?? record.id);

  const requestedSlug = asSlug(record.slug);
  let effectiveSlug: string | null = null;
  if (isAdmin(user)) {
    effectiveSlug = requestedSlug ?? user.companySlug ?? null;
  } else {
    const allowed = resolveAllowedSlugs(user);
    if (!allowed.length) return jsonError("slug e obrigatório", 400);
    if (requestedSlug && !allowed.includes(requestedSlug)) return jsonError("Acesso proibido", 403);
    effectiveSlug = requestedSlug ?? user.companySlug ?? allowed[0] ?? null;
  }

  if (!effectiveSlug) return jsonError("slug e obrigatório", 400);
  if (!project || runId === null || caseId === null) {
    return jsonError("Campos obrigatorios: project, runId, caseId", 400);
  }

  const title = record.title !== undefined ? asTitle(record.title) : null;
  const status = record.status !== undefined ? normalizeStatus(record.status) : null;
  if (record.status !== undefined && !status) return jsonError("Status invalido", 400);

  const bug = record.bug !== undefined ? (record.bug === null ? null : asOptionalString(record.bug)) : undefined;
  const link = record.link !== undefined ? (record.link === null ? null : asOptionalString(record.link)) : undefined;

  if (bug === undefined && link === undefined && title === null && status === null) {
    return jsonError("Nenhum campo para atualizar", 400);
  }

  const store = await readKanbanStore();
  const existing = store.items.find(
    (card: Card) =>
      card.project === project && card.run_id === runId && card.case_id === caseId && card.client_slug === effectiveSlug,
  );
  if (existing) {
    if (title) existing.title = title;
    if (status) existing.status = status;
    if (bug !== undefined) existing.bug = bug as string | null;
    if (link !== undefined) existing.link = link as string | null;
    await writeKanbanStore(store);
    return NextResponse.json(existing);
  }

  if (!title || !status) {
    return jsonError("Para criar, informe title e status", 400);
  }

  const created = {
    id: getNextId(store),
    client_slug: effectiveSlug,
    project,
    run_id: runId,
    case_id: caseId,
    title,
    status,
    bug: (bug as string | null | undefined) ?? null,
    link: (link as string | null | undefined) ?? null,
    created_at: new Date().toISOString(),
  };
  store.items.push(created);
  await writeKanbanStore(store);
  return NextResponse.json(created, { status: 201 });
}
