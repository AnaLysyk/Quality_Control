import { type NextRequest, NextResponse } from "next/server";

import { resolveBrainAccess } from "@/lib/brain/access";
import { isBrainSourceStorageUnavailable, setBrainSourceStatus } from "@/lib/brain/sourceSettings";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const { id } = await params;
  try {
    const source = await setBrainSourceStatus(accessResult.context, id, "active");
    if (!source) return NextResponse.json({ error: "Fonte nao encontrada" }, { status: 404 });
    return NextResponse.json({ source });
  } catch (error) {
    if (isBrainSourceStorageUnavailable(error)) {
      return NextResponse.json({ requiresMigration: true, error: "Tabelas de configuracao do Brain ainda nao existem." });
    }
    const message = error instanceof Error ? error.message : "Erro ao ativar fonte";
    return NextResponse.json({ error: message }, { status: /permissao/i.test(message) ? 403 : 400 });
  }
}
