import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/jwtAuth";
import { resolveAutomationAccess, resolveAutomationAllowedCompanySlugs } from "@/lib/automations/access";
import { automationPool, ensureAutomationTables } from "@/lib/automationPool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  companySlug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  kind: z.enum(["image", "video", "document", "other"]).default("other"),
  sizeBytes: z.number().int().min(0).default(0),
  url: z.string().min(1),
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

// ── GET /api/automations/assets?companySlug=xxx ───────────────────────────────

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const companySlug = url.searchParams.get("companySlug") ?? "";
  if (!companySlug) return NextResponse.json({ error: "companySlug obrigatório" }, { status: 400 });
  if (!assertAccess(user, companySlug)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await ensureAutomationTables();

  const { rows } = await automationPool.query<{
    id: string; name: string; kind: string; size_bytes: number;
    url: string; uploaded_by: string | null; created_at: string;
  }>(
    `SELECT id, name, kind, size_bytes, url, uploaded_by, created_at
     FROM automation_assets
     WHERE company_slug = $1
     ORDER BY created_at DESC`,
    [companySlug],
  );

  return NextResponse.json({ assets: rows });
}

// ── POST /api/automations/assets ──────────────────────────────────────────────

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { companySlug, name, kind, sizeBytes, url: assetUrl } = parsed.data;
  if (!assertAccess(user, companySlug)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await ensureAutomationTables();

  const { rows } = await automationPool.query<{ id: string; created_at: string }>(
    `INSERT INTO automation_assets (company_slug, name, kind, size_bytes, url, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, created_at`,
    [companySlug, name, kind, sizeBytes, assetUrl, user.id ?? user.email ?? null],
  );

  return NextResponse.json({ asset: rows[0] });
}

// ── DELETE /api/automations/assets ───────────────────────────────────────────

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
    `DELETE FROM automation_assets WHERE id = $1 AND company_slug = $2`,
    [id, companySlug],
  );

  return NextResponse.json({ ok: true });
}
