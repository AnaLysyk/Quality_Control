import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/jwtAuth";
import { resolveAutomationAccess, resolveAutomationAllowedCompanySlugs } from "@/lib/automations/access";
import { automationPool, ensureAutomationTables } from "@/lib/automationPool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SaveSchema = z.object({
  companySlug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  kind: z.string().trim().min(1),
  sizeBytes: z.number().int().min(0),
  base64Data: z.string().min(1),
  source: z.enum(["upload", "library"]),
  sourceAssetId: z.string().optional(),
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

// GET /api/automations/base64?companySlug=xxx
//   → list without base64_data (for history listing)
// GET /api/automations/base64?companySlug=xxx&id=xxx
//   → single record WITH base64_data
export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const companySlug = url.searchParams.get("companySlug") ?? "";
  const id = url.searchParams.get("id") ?? "";

  if (!companySlug) return NextResponse.json({ error: "companySlug obrigatório" }, { status: 400 });
  if (!assertAccess(user, companySlug)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await ensureAutomationTables();

  if (id) {
    const { rows } = await automationPool.query<{
      id: string; name: string; kind: string; size_bytes: number;
      base64_data: string; source: string; source_asset_id: string | null; created_at: string;
    }>(
      `SELECT id, name, kind, size_bytes, base64_data, source, source_asset_id, created_at
       FROM automation_base64_history
       WHERE id = $1 AND company_slug = $2`,
      [id, companySlug],
    );
    if (!rows[0]) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json({ entry: rows[0] });
  }

  const { rows } = await automationPool.query<{
    id: string; name: string; kind: string; size_bytes: number;
    source: string; source_asset_id: string | null; created_at: string;
  }>(
    `SELECT id, name, kind, size_bytes, source, source_asset_id, created_at
     FROM automation_base64_history
     WHERE company_slug = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [companySlug],
  );

  return NextResponse.json({ entries: rows });
}

// POST /api/automations/base64  → save conversion to history
export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { companySlug, name, kind, sizeBytes, base64Data, source, sourceAssetId } = parsed.data;
  if (!assertAccess(user, companySlug)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await ensureAutomationTables();

  const { rows } = await automationPool.query<{ id: string; created_at: string }>(
    `INSERT INTO automation_base64_history
       (company_slug, name, kind, size_bytes, base64_data, source, source_asset_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, created_at`,
    [companySlug, name, kind, sizeBytes, base64Data, source, sourceAssetId ?? null],
  );

  return NextResponse.json({ entry: rows[0] });
}

// DELETE /api/automations/base64
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
    `DELETE FROM automation_base64_history WHERE id = $1 AND company_slug = $2`,
    [id, companySlug],
  );

  return NextResponse.json({ ok: true });
}
