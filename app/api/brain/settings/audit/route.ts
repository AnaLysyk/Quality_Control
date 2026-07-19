import { type NextRequest, NextResponse } from "next/server";

import { resolveBrainAccess } from "@/backend/brain/access";
import { isBrainSourceStorageUnavailable, listBrainSourceAudit } from "@/backend/brain/sourceSettings";

export async function GET(req: NextRequest) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const limit = Math.min(300, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
  try {
    const audit = await listBrainSourceAudit(accessResult.context, limit);
    return NextResponse.json({ audit });
  } catch (error) {
    if (isBrainSourceStorageUnavailable(error)) {
      return NextResponse.json({ audit: [], requiresMigration: true, error: "Tabelas de configuracao do Brain ainda nao existem." });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao buscar auditoria" }, { status: 500 });
  }
}
