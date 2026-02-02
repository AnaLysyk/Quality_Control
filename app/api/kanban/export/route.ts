import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

import store from "../store";
import type { Status } from "../types";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";

type ExportRow = {
  id: number;
  client_slug?: string;
  project: string;
  run_id: number;
  case_id: number | null;
  title: string;
  status: Status;
  bug: string | null;
  link: string | null;
  created_at: string | null;
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

function resolveAllowedSlugs(user: AuthUser): string[] {
  if (Array.isArray(user.companySlugs) && user.companySlugs.length) return user.companySlugs;
  if (user.companySlug) return [user.companySlug];
  return [];
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

function csvEscape(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  if (!/[\n\r,\"]/g.test(s)) return s;
  return `"${s.replace(/\"/g, '""')}"`;
}

function toCsv(rows: ExportRow[]) {
  const header = [
    "id",
    "client_slug",
    "project",
    "run_id",
    "case_id",
    "title",
    "status",
    "bug",
    "link",
    "created_at",
  ].join(",");

  const lines = rows.map((r) =>
    [
      csvEscape(r.id),
      csvEscape(r.client_slug ?? ""),
      csvEscape(r.project),
      csvEscape(r.run_id),
      csvEscape(r.case_id ?? ""),
      csvEscape(r.title),
      csvEscape(r.status),
      csvEscape(r.bug ?? ""),
      csvEscape(r.link ?? ""),
      csvEscape(r.created_at ?? ""),
    ].join(","),
  );

  return `\ufeff${header}\n${lines.join("\n")}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const project = asProject(searchParams.get("project"));
  const runId = asRunId(searchParams.get("runId"));
  const requestedSlug = asSlug(searchParams.get("slug"));
  const format = (searchParams.get("format") || "csv").toLowerCase();

  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0] || request.headers.get("x-real-ip") || "unknown";
  const rate = await rateLimit(request, `kanban-export:${ip}`);
  if (rate.limited) return rate.response;

  if (!project || runId === null) {
    return jsonError("project e runId sao obrigatorios", 400);
  }

  const user = await authenticateRequest(request);
  if (!user) return jsonError("Nao autorizado", 401);

  let effectiveSlug: string | null = null;
  if (isAdmin(user)) {
    effectiveSlug = requestedSlug;
  } else {
    const allowed = resolveAllowedSlugs(user);
    if (!allowed.length) return jsonError("Acesso proibido", 403);
    if (requestedSlug && !allowed.includes(requestedSlug)) return jsonError("Acesso proibido", 403);
    effectiveSlug = requestedSlug ?? user.companySlug ?? allowed[0] ?? null;
  }

  if (!effectiveSlug && !isAdmin(user)) {
    return jsonError("slug e obrigatorio", 400);
  }

  const rows: ExportRow[] = store
    .filter((c) => {
      if (c.project !== project || c.run_id !== runId) return false;
      if (!effectiveSlug) return true;
      return c.client_slug === effectiveSlug;
    })
    .map((c) => ({
      id: c.id,
      client_slug: c.client_slug ?? effectiveSlug ?? undefined,
      project: c.project,
      run_id: c.run_id ?? runId,
      case_id: c.case_id ?? null,
      title: c.title ?? "",
      status: (c.status ?? "NOT_RUN") as Status,
      bug: c.bug ?? null,
      link: c.link ?? null,
      created_at: c.created_at ?? null,
    }));

  if (format === "json") {
    return NextResponse.json({ items: rows });
  }

  const csv = toCsv(rows);
  const filename = `kanban_${project}_${runId}${effectiveSlug ? `_${effectiveSlug}` : ""}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
