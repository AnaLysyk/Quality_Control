import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/jwtAuth";
import { resolveAutomationAccess, resolveAutomationAllowedCompanySlugs } from "@/lib/automations/access";
import { automationPool, ensureAutomationTables } from "@/lib/automationPool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  assetId: z.string().trim().min(1),
  companySlug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().min(0).max(100),
  h: z.number().min(0).max(100),
  notes: z.string().optional(),
  color: z.string().optional(),
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

// GET /api/automations/regions?assetId=xxx&companySlug=xxx
export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const assetId = url.searchParams.get("assetId") ?? "";
  const companySlug = url.searchParams.get("companySlug") ?? "";
  if (!assetId || !companySlug) return NextResponse.json({ error: "assetId e companySlug obrigatórios" }, { status: 400 });
  if (!assertAccess(user, companySlug)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await ensureAutomationTables();

  const { rows } = await automationPool.query<{
    id: string; name: string; x: number; y: number; w: number; h: number;
    notes: string | null; color: string; created_at: string;
  }>(
    `SELECT id, name, x, y, w, h, notes, color, created_at
     FROM automation_asset_regions
     WHERE asset_id = $1 AND company_slug = $2
     ORDER BY created_at ASC`,
    [assetId, companySlug],
  );

  return NextResponse.json({ regions: rows });
}

// POST /api/automations/regions
export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { assetId, companySlug, name, x, y, w, h, notes, color } = parsed.data;
  if (!assertAccess(user, companySlug)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await ensureAutomationTables();

  const { rows } = await automationPool.query<{ id: string; created_at: string }>(
    `INSERT INTO automation_asset_regions (asset_id, company_slug, name, x, y, w, h, notes, color)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, created_at`,
    [assetId, companySlug, name, x, y, w, h, notes ?? null, color ?? "#ef0001"],
  );

  return NextResponse.json({ region: rows[0] });
}

// DELETE /api/automations/regions
export async function DELETE(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { id, companySlug } = parsed.data;
  if (!assertAccess(user, companySlug)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await ensureAutomationTables();
  await automationPool.query(`DELETE FROM automation_asset_regions WHERE id = $1 AND company_slug = $2`, [id, companySlug]);

  return NextResponse.json({ ok: true });
}
