import { NextResponse } from "next/server";

import { addMemory, getNodeMemories } from "@/lib/brain";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export async function GET(req: Request) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autorizado" : "Sem permissão" }, { status });
  }

  const url = new URL(req.url);
  const nodeId = url.searchParams.get("nodeId");

  if (!nodeId) {
    return NextResponse.json({ error: "nodeId e obrigatorio" }, { status: 400 });
  }

  const memories = await getNodeMemories(nodeId);
  return NextResponse.json({ memories });
}

export async function POST(req: Request) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autorizado" : "Sem permissão" }, { status });
  }

  try {
    const body = await req.json();
    const { title, summary, memoryType, importance, relatedNodeIds, sourceType, sourceId } = body;

    if (!title || !summary || !memoryType) {
      return NextResponse.json({ error: "title, summary e memoryType sao obrigatorios" }, { status: 400 });
    }

    const validTypes = ["DECISION", "RULE", "PATTERN", "CONTEXT", "EXCEPTION", "TECHNICAL_NOTE"];
    if (!validTypes.includes(memoryType)) {
      return NextResponse.json({ error: `memoryType invalido. Use: ${validTypes.join(", ")}` }, { status: 400 });
    }

    const memory = await addMemory({
      title,
      summary,
      memoryType,
      importance: importance ?? 1,
      relatedNodeIds: relatedNodeIds ?? [],
      sourceType,
      sourceId,
      userId: admin.id,
    });

    return NextResponse.json({ memory }, { status: 201 });
  } catch (error) {
    console.error("[brain/memories] POST error:", error);
    return NextResponse.json({ error: "Erro ao criar memoria" }, { status: 500 });
  }
}
