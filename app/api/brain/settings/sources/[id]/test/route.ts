import { type NextRequest, NextResponse } from "next/server";

import { resolveBrainAccess } from "@/backend/brain/access";
import { isBrainSourceStorageUnavailable, testBrainSource } from "@/backend/brain/sourceSettings";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const { id } = await params;
  try {
    const result = await testBrainSource(accessResult.context, id);
    if (!result) return NextResponse.json({ error: "Fonte nao encontrada" }, { status: 404 });
    return NextResponse.json({ result });
  } catch (error) {
    if (isBrainSourceStorageUnavailable(error)) {
      return NextResponse.json({ requiresMigration: true, error: "Tabelas de configuracao do Brain ainda nao existem." });
    }
    const message = error instanceof Error ? error.message : "Erro ao testar fonte";
    return NextResponse.json({ error: message }, { status: /permissao/i.test(message) ? 403 : 400 });
  }
}
