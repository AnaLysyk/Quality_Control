import { type NextRequest, NextResponse } from "next/server";

import { resolveBrainAccess } from "@/lib/brain/access";
import {
  createBrainSource,
  isBrainSourceStorageUnavailable,
  listBrainSources,
} from "@/lib/brain/sourceSettings";

function migrationResponse() {
  return NextResponse.json({
    sources: [],
    requiresMigration: true,
    error: "Tabelas de configuracao do Brain ainda nao existem. Aplique a migration 20260708100000_add_brain_source_settings.",
  });
}

export async function GET(req: NextRequest) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  try {
    const sources = await listBrainSources(accessResult.context, {
      status: url.searchParams.get("status"),
      sourceType: url.searchParams.get("sourceType"),
    });
    return NextResponse.json({ sources });
  } catch (error) {
    if (isBrainSourceStorageUnavailable(error)) return migrationResponse();
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao listar fontes do Brain" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const source = await createBrainSource(accessResult.context, body);
    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    if (isBrainSourceStorageUnavailable(error)) return migrationResponse();
    const message = error instanceof Error ? error.message : "Erro ao criar fonte do Brain";
    const status = /permissao|escopo/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
