import { type NextRequest, NextResponse } from "next/server";

import { resolveBrainAccess } from "@/backend/brain/access";
import {
  isBrainBehaviorProfileStorageUnavailable,
  resolveEffectiveBehaviorProfile,
  setBehaviorAssignment,
  type BehaviorSurface,
} from "@/backend/brain/behaviorProfiles";

const SURFACES = new Set(["home", "chat", "summary", "report", "audio"]);

export async function GET(req: NextRequest) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const surfaceParam = url.searchParams.get("surface") ?? "chat";
  const surface = (SURFACES.has(surfaceParam) ? surfaceParam : "chat") as BehaviorSurface;

  try {
    const profile = await resolveEffectiveBehaviorProfile(accessResult.context, surface);
    return NextResponse.json({ surface, profile });
  } catch (error) {
    if (isBrainBehaviorProfileStorageUnavailable(error)) {
      return NextResponse.json({ surface, profile: null, requiresMigration: true });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao resolver perfil de comportamento" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const saved = await setBehaviorAssignment(accessResult.context, body);
    return NextResponse.json({ assignment: saved });
  } catch (error) {
    if (isBrainBehaviorProfileStorageUnavailable(error)) {
      return NextResponse.json({ error: "Tabelas de perfis de comportamento ainda nao existem." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Erro ao aplicar perfil de comportamento";
    const status = /permissao|escopo/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
