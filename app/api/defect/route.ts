import { NextRequest, NextResponse } from "next/server";

import { createDefect, listDefects } from "@/data/defectsStore";

export const runtime = "nodejs";

// POST: Cria um defeito local (persistido em JSON).
export async function POST(req: NextRequest) {
  const data = await req.json().catch(() => ({}));
  const defect = await createDefect({
    title: (data as { title?: unknown }).title,
    description: (data as { description?: unknown }).description,
    companyId: (data as { companyId?: unknown }).companyId,
    releaseManualId: (data as { releaseManualId?: unknown }).releaseManualId,
  });

  if (!defect) {
    return NextResponse.json({ error: "title e companyId sao obrigatorios" }, { status: 400 });
  }

  return NextResponse.json(defect, { status: 201 });
}

// GET: Lista defeitos locais por empresa (e opcionalmente por release manual).
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  const releaseManualId = req.nextUrl.searchParams.get("releaseManualId");

  if (!companyId) {
    return NextResponse.json({ error: "companyId e obrigatorio" }, { status: 400 });
  }

  const defects = await listDefects({ companyId, releaseManualId });
  return NextResponse.json(defects, { status: 200 });
}
