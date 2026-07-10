import { type NextRequest, NextResponse } from "next/server";

import { resolveBrainAccess } from "@/lib/brain/access";
import {
  createBehaviorProfile,
  isBrainBehaviorProfileStorageUnavailable,
  listBehaviorProfiles,
} from "@/lib/brain/behaviorProfiles";

function migrationResponse() {
  return NextResponse.json({
    profiles: [],
    requiresMigration: true,
    error: "Tabelas de perfis de comportamento do Brain ainda nao existem. Aplique a migration 20260710120000_add_brain_behavior_profiles.",
  });
}

export async function GET(req: NextRequest) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  try {
    const profiles = await listBehaviorProfiles(accessResult.context);
    return NextResponse.json({ profiles });
  } catch (error) {
    if (isBrainBehaviorProfileStorageUnavailable(error)) return migrationResponse();
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao listar perfis de comportamento" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const profile = await createBehaviorProfile(accessResult.context, body);
    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    if (isBrainBehaviorProfileStorageUnavailable(error)) return migrationResponse();
    const message = error instanceof Error ? error.message : "Erro ao criar perfil de comportamento";
    const status = /permissao|escopo/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
