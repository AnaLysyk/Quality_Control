import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { connectNodes } from "@/lib/brain";
import { prisma } from "@/lib/prismaClient";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const nodeId = url.searchParams.get("nodeId");
  const type = url.searchParams.get("type") ?? undefined;
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));

  const where: Record<string, unknown> = {};
  if (nodeId) where.OR = [{ fromId: nodeId }, { toId: nodeId }];
  if (type) where.type = type;

  const edges = await prisma.brainEdge.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ edges });
}

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { fromId, toId, type, metadata } = body;

    if (!fromId || !toId || !type) {
      return NextResponse.json({ error: "fromId, toId e type sao obrigatorios" }, { status: 400 });
    }

    const edge = await connectNodes(fromId, toId, type, metadata, user.id);
    return NextResponse.json({ edge }, { status: 201 });
  } catch (error) {
    console.error("[brain/edges] POST error:", error);
    return NextResponse.json({ error: "Erro ao criar aresta" }, { status: 500 });
  }
}
