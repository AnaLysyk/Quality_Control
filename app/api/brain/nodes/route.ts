import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { searchNodes, upsertNode } from "@/lib/brain";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? undefined;
  const label = url.searchParams.get("label") ?? undefined;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

  const nodes = await searchNodes({ type, label, limit });
  return NextResponse.json({ nodes });
}

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

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
      userId: user.id,
    });

    return NextResponse.json({ node }, { status: 201 });
  } catch (error) {
    console.error("[brain/nodes] POST error:", error);
    return NextResponse.json({ error: "Erro ao criar no" }, { status: 500 });
  }
}
