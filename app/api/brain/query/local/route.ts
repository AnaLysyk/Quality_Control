import { NextResponse } from "next/server";

import { assertBrainNodeAccess, resolveBrainAccess } from "@/backend/brain/access";
import { BrainGraphRagService } from "@/backend/brain/graphRagService";

export async function POST(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  try {
    const body = (await req.json()) as {
      nodeId?: string;
      depth?: number;
      maxNodes?: number;
      maxMemories?: number;
      maxDocs?: number;
      maxEvents?: number;
    };

    if (!body.nodeId) {
      return NextResponse.json({ error: "nodeId e obrigatorio" }, { status: 400 });
    }

    const nodeAccess = await assertBrainNodeAccess(body.nodeId, accessResult.context);
    if (!nodeAccess.ok) {
      return NextResponse.json({ error: nodeAccess.error }, { status: nodeAccess.status });
    }

    const service = new BrainGraphRagService();
    const context = await service.buildLocalContext({
      nodeId: body.nodeId,
      depth: body.depth,
      maxNodes: body.maxNodes,
      maxMemories: body.maxMemories,
      maxDocs: body.maxDocs,
      maxEvents: body.maxEvents,
      access: accessResult.context,
    });

    return NextResponse.json(context);
  } catch (error) {
    console.error("[brain/query/local] POST error:", error);
    return NextResponse.json({ error: "Erro ao montar contexto local do Brain" }, { status: 500 });
  }
}
