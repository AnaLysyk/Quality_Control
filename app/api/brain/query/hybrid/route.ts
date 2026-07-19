import { NextResponse } from "next/server";

import { resolveBrainAccess } from "@/backend/brain/access";
import { BrainGraphRagService } from "@/backend/brain/graphRagService";

export async function POST(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  try {
    const body = (await req.json()) as {
      query?: string;
      nodeId?: string;
      depth?: number;
    };

    if (!body.query || !body.query.trim()) {
      return NextResponse.json({ error: "query e obrigatoria" }, { status: 400 });
    }

    const service = new BrainGraphRagService();
    const context = await service.buildHybridContext({
      query: body.query,
      nodeId: body.nodeId,
      depth: body.depth,
      access: accessResult.context,
    });

    return NextResponse.json(context);
  } catch (error) {
    console.error("[brain/query/hybrid] POST error:", error);
    return NextResponse.json({ error: "Erro ao montar contexto hibrido do Brain" }, { status: 500 });
  }
}

