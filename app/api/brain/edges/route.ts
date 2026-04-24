import { NextResponse } from "next/server";

import { connectNodes } from "@/lib/brain";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export async function GET(req: Request) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json(
      { error: status === 401 ? "N\u00e3o autorizado" : "Sem permiss\u00e3o" },
      { status },
    );
  }

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
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json(
      { error: status === 401 ? "N\u00e3o autorizado" : "Sem permiss\u00e3o" },
      { status },
    );
  }

  try {
    const body = await req.json();
    const { fromId, toId, type, metadata } = body;

    if (!fromId || !toId || !type) {
      return NextResponse.json(
        { error: "Origem, destino e tipo da conex\u00e3o s\u00e3o obrigat\u00f3rios" },
        { status: 400 },
      );
    }

    const edge = await connectNodes(fromId, toId, type, metadata, admin.id);
    return NextResponse.json({ edge }, { status: 201 });
  } catch (error) {
    console.error("[brain/edges] POST error:", error);
    return NextResponse.json({ error: "Erro ao criar conex\u00e3o" }, { status: 500 });
  }
}
