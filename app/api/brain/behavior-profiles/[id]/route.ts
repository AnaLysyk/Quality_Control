import { type NextRequest, NextResponse } from "next/server";

import { resolveBrainAccess } from "@/backend/brain/access";
import {
  deleteBehaviorProfile,
  isBrainBehaviorProfileStorageUnavailable,
  updateBehaviorProfile,
} from "@/backend/brain/behaviorProfiles";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const profile = await updateBehaviorProfile(accessResult.context, id, body);
    if (!profile) return NextResponse.json({ error: "Perfil de comportamento nao encontrado" }, { status: 404 });
    return NextResponse.json({ profile });
  } catch (error) {
    if (isBrainBehaviorProfileStorageUnavailable(error)) {
      return NextResponse.json({ error: "Tabelas de perfis de comportamento ainda nao existem." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Erro ao atualizar perfil de comportamento";
    const status = /permissao/i.test(message) ? 403 : 400;
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
    const removed = await deleteBehaviorProfile(accessResult.context, id);
    if (!removed) return NextResponse.json({ error: "Perfil de comportamento nao encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isBrainBehaviorProfileStorageUnavailable(error)) {
      return NextResponse.json({ error: "Tabelas de perfis de comportamento ainda nao existem." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Erro ao excluir perfil de comportamento";
    const status = /permissao/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
