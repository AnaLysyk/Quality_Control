import { NextRequest, NextResponse } from "next/server";
import { getQaseRunKanban } from "@/integrations/qase";
import { resolveNormalizedCompanySlugs, resolvePrimaryCompanySlug } from "@/lib/auth/normalizeAuthenticatedUser";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function normalizeRole(role?: string | null) {
  return (role ?? "").trim().toLowerCase();
}

function isPrivileged(user: AuthUser) {
  if (user.isGlobalAdmin) return true;
  const role = normalizeRole(user.role);
  return role === "leader_tc" || role === "technical_support";
}

function asProject(value: string | null) {
  const trimmed = (value ?? "").trim().toUpperCase();
  return trimmed || null;
}

function asRunId(value: string | null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asSlug(value: string | null) {
  const trimmed = (value ?? "").trim().toLowerCase();
  return trimmed || null;
}

export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) return jsonError("Não autorizado", 401);

  const { searchParams } = new URL(request.url);
  const project = asProject(searchParams.get("project"));
  const runId = asRunId(searchParams.get("runId"));
  const requestedSlug = asSlug(searchParams.get("companySlug") ?? searchParams.get("slug"));

  if (!project || runId === null) {
    return jsonError("project e runId são obrigatórios", 400);
  }

  const allowedSlugs = resolveNormalizedCompanySlugs(user);
  const preferredSlug = resolvePrimaryCompanySlug(user);

  let effectiveSlug: string | null = null;
  if (isPrivileged(user)) {
    effectiveSlug = requestedSlug ?? preferredSlug ?? null;
  } else {
    if (!allowedSlugs.length) return jsonError("Acesso proibido", 403);
    if (requestedSlug && !allowedSlugs.includes(requestedSlug)) return jsonError("Acesso proibido", 403);
    effectiveSlug = requestedSlug ?? preferredSlug ?? allowedSlugs[0] ?? null;
  }

  try {
    const data = await getQaseRunKanban(project, runId, effectiveSlug ?? undefined);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Falha ao carregar kanban integrado da run", error);
    return jsonError("Não foi possível carregar o kanban da run", 500);
  }
}
