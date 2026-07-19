import { type NextRequest, NextResponse } from "next/server";

import { resolveBrainAccess } from "@/backend/brain/access";
import {
  deleteBrainSource,
  isBrainSourceStorageUnavailable,
  updateBrainSource,
} from "@/backend/brain/sourceSettings";

function migrationResponse() {
  return NextResponse.json({
    requiresMigration: true,
    error: "Tabelas de configuracao do Brain ainda nao existem. Aplique a migration 20260708100000_add_brain_source_settings.",
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const source = await updateBrainSource(accessResult.context, id, body);
    if (!source) return NextResponse.json({ error: "Fonte nao encontrada" }, { status: 404 });
    return NextResponse.json({ source });
  } catch (error) {
    if (isBrainSourceStorageUnavailable(error)) return migrationResponse();
    const message = error instanceof Error ? error.message : "Erro ao atualizar fonte";
    const status = /permissao|escopo/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const { id } = await params;
  try {
    const deleted = await deleteBrainSource(accessResult.context, id);
    if (!deleted) return NextResponse.json({ error: "Fonte nao encontrada" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isBrainSourceStorageUnavailable(error)) return migrationResponse();
    const message = error instanceof Error ? error.message : "Erro ao excluir fonte";
    const status = /permissao|escopo/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
