import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/jwtAuth";
import { resolveAutomationAccess, resolveAutomationAllowedCompanySlugs } from "@/lib/automations/access";
import { automationPool, ensureAutomationTables } from "@/lib/automationPool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpsertSchema = z.object({
  id: z.string().optional(),
  companySlug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  payload: z.record(z.unknown()),
});

const DeleteSchema = z.object({
  id: z.string().trim().min(1),
  companySlug: z.string().trim().min(1),
});

function assertAccess(user: Awaited<ReturnType<typeof authenticateRequest>>, companySlug: string) {
  if (!user) return false;
  const allowed = resolveAutomationAllowedCompanySlugs(user);
  const access = resolveAutomationAccess(user, allowed.length);
  if (!access.canOpen) return false;
  if (!access.hasGlobalCompanyVisibility && !allowed.includes(companySlug)) return false;
  return true;
}

// ── GET /api/automations/collections?companySlug=xxx ─────────────────────────

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const companySlug = url.searchParams.get("companySlug") ?? "";
  if (!companySlug) return NextResponse.json({ error: "companySlug obrigatório" }, { status: 400 });
  if (!assertAccess(user, companySlug)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await ensureAutomationTables();

  const { rows } = await automationPool.query<{ id: string; name: string; payload: unknown }>(
    `SELECT id, name, payload
     FROM automation_api_requests
     WHERE company_slug = $1
     ORDER BY created_at DESC`,
    [companySlug],
  );

  return NextResponse.json({ requests: rows.map((r) => ({ id: r.id, ...(r.payload as object) })) });
}

// ── POST /api/automations/collections — upsert ───────────────────────────────

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { id, companySlug, name, payload } = parsed.data;
  if (!assertAccess(user, companySlug)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await ensureAutomationTables();

  if (id) {
    // Upsert with client-provided ID
    await automationPool.query(
      `INSERT INTO automation_api_requests (id, company_slug, name, payload)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name=$3, payload=$4, updated_at=NOW()`,
      [id, companySlug, name, JSON.stringify(payload)],
    );
    return NextResponse.json({ id });
  }

  const { rows } = await automationPool.query<{ id: string }>(
    `INSERT INTO automation_api_requests (company_slug, name, payload)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [companySlug, name, JSON.stringify(payload)],
  );

  return NextResponse.json({ id: rows[0]?.id });
}

// ── DELETE /api/automations/collections ──────────────────────────────────────

export async function DELETE(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { id, companySlug } = parsed.data;
  if (!assertAccess(user, companySlug)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await ensureAutomationTables();

  await automationPool.query(
    `DELETE FROM automation_api_requests WHERE id = $1 AND company_slug = $2`,
    [id, companySlug],
  );

  return NextResponse.json({ ok: true });
}
