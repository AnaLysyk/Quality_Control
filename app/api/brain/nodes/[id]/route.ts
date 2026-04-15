import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getNodeWithContext, getNodeMemories, traceImpact, getSubgraph } from "@/lib/brain";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const url = new URL(req.url);
  const include = url.searchParams.get("include") ?? "context";
  const depth = Math.min(5, Math.max(1, Number(url.searchParams.get("depth") ?? 2)));

  try {
    const result: Record<string, unknown> = {};

    if (include.includes("context") || include === "all") {
      result.context = await getNodeWithContext(id, depth);
    }
    if (include.includes("memories") || include === "all") {
      result.memories = await getNodeMemories(id);
    }
    if (include.includes("impact") || include === "all") {
      result.impact = await traceImpact(id, depth);
    }
    if (include.includes("subgraph") || include === "all") {
      result.subgraph = await getSubgraph(id, depth);
    }

    if (!result.context && !result.memories && !result.impact && !result.subgraph) {
      result.context = await getNodeWithContext(id, depth);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[brain/nodes/id] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar no" }, { status: 500 });
  }
}
