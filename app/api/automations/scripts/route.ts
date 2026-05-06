import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/jwtAuth";
import { resolveAutomationAccess, resolveAutomationAllowedCompanySlugs } from "@/lib/automations/access";
import { automationPool, ensureAutomationTables } from "@/lib/automationPool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpsertSchema = z.object({
  companySlug: z.string().trim().min(1),
  path: z.string().trim().min(1),
  content: z.string().default(""),
  status: z.enum(["not_started", "draft", "published"]).default("not_started"),
});

const DeleteSchema = z.object({
  companySlug: z.string().trim().min(1),
  path: z.string().trim().min(1),
});

function assertAccess(user: Awaited<ReturnType<typeof authenticateRequest>>, companySlug: string) {
  if (!user) return false;
  const allowed = resolveAutomationAllowedCompanySlugs(user);
  const access = resolveAutomationAccess(user, allowed.length);
  if (!access.canOpen) return false;
  if (!access.hasGlobalCompanyVisibility && !allowed.includes(companySlug)) return false;
  return true;
}

// ── GET /api/automations/scripts?companySlug=xxx ──────────────────────────────

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const companySlug = url.searchParams.get("companySlug") ?? "";
  if (!companySlug) return NextResponse.json({ error: "companySlug obrigatório" }, { status: 400 });
  if (!assertAccess(user, companySlug)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await ensureAutomationTables();

  const { rows } = await automationPool.query<{
    id: string; path: string; content: string; status: string;
    created_by: string | null; updated_by: string | null;
    created_at: string; updated_at: string;
  }>(
    `SELECT id, path, content, status, created_by, updated_by, created_at, updated_at
     FROM automation_scripts
     WHERE company_slug = $1
     ORDER BY path ASC`,
    [companySlug],
  );

  return NextResponse.json({ scripts: rows });
}

// ── POST /api/automations/scripts — upsert ────────────────────────────────────

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { companySlug, path, content, status } = parsed.data;
  if (!assertAccess(user, companySlug)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await ensureAutomationTables();

  const { rows } = await automationPool.query<{ id: string; updated_at: string }>(
    `INSERT INTO automation_scripts (company_slug, path, content, status, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $5)
     ON CONFLICT (company_slug, path)
     DO UPDATE SET
       content    = EXCLUDED.content,
       status     = EXCLUDED.status,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING id, updated_at`,
    [companySlug, path, content, status, user.id ?? user.email ?? null],
  );

  return NextResponse.json({ script: rows[0] });
}

// ── DELETE /api/automations/scripts ──────────────────────────────────────────

export async function DELETE(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { companySlug, path } = parsed.data;
  if (!assertAccess(user, companySlug)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await ensureAutomationTables();

  await automationPool.query(
    `DELETE FROM automation_scripts WHERE company_slug = $1 AND path = $2`,
    [companySlug, path],
  );

  return NextResponse.json({ ok: true });
}
