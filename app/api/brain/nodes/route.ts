import { NextResponse } from "next/server";

import { searchNodes, upsertNode } from "@/lib/brain";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export async function GET(req: Request) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autorizado" : "Sem permissão" }, { status });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? undefined;
  const label = url.searchParams.get("label") ?? undefined;
  const query = url.searchParams.get("query") ?? undefined;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

  const nodes = await searchNodes({ type, label, query, limit });
  return NextResponse.json({ nodes });
}

export async function POST(req: Request) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autorizado" : "Sem permissão" }, { status });
  }

  try {
    const body = await req.json();
    const { type, label, refType, refId, description, metadata } = body;

    if (!type || !label) {
      return NextResponse.json({ error: "type e label sao obrigatorios" }, { status: 400 });
    }

    const node = await upsertNode({
      type,
      label,
      refType,
      refId,
      description,
      metadata,
      userId: admin.id,
    });

    return NextResponse.json({ node }, { status: 201 });
  } catch (error) {
    console.error("[brain/nodes] POST error:", error);
    return NextResponse.json({ error: "Erro ao criar no" }, { status: 500 });
  }
}
