import { NextResponse } from "next/server";

import {
  deleteNode,
  findSimilarNodes,
  getNodeAncestors,
  getNodeDescendants,
  getNodeInfluence,
  getNodeMemories,
  getNodeStats,
  getNodeWithContext,
  getRelatedMemories,
  getSubgraph,
  suggestConnections,
  traceImpact,
} from "@/lib/brain";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json(
      { error: status === 401 ? "N\u00e3o autorizado" : "Sem permiss\u00e3o" },
      { status },
    );
  }

  const { id } = await params;
  const url = new URL(req.url);
  const include = url.searchParams.get("include") ?? "context";
  const depth = Math.min(5, Math.max(1, Number(url.searchParams.get("depth") ?? 2)));
  const includeSet = new Set(include.split(",").map((value) => value.trim()).filter(Boolean));
  const wants = (key: string) => include === "all" || includeSet.has(key);

  try {
    const result: Record<string, unknown> = {};

    if (wants("context")) {
      result.context = await getNodeWithContext(id, depth);
    }
    if (wants("memories")) {
      result.memories = await getNodeMemories(id);
    }
    if (wants("impact")) {
      result.impact = await traceImpact(id, depth);
    }
    if (wants("subgraph")) {
      result.subgraph = await getSubgraph(id, depth);
    }
    if (wants("stats")) {
      result.stats = await getNodeStats(id);
    }
    if (wants("influence")) {
      result.influence = await getNodeInfluence(id);
    }
    if (wants("relatedMemories")) {
      result.relatedMemories = await getRelatedMemories(id, depth);
    }
    if (wants("ancestors")) {
      result.ancestors = await getNodeAncestors(id);
    }
    if (wants("descendants")) {
      result.descendants = await getNodeDescendants(id);
    }
    if (wants("suggestions")) {
      result.suggestions = await suggestConnections(id, 6);
    }
    if (wants("similar")) {
      result.similarNodes = await findSimilarNodes(id, 6);
    }

    if (
      !result.context &&
      !result.memories &&
      !result.impact &&
      !result.subgraph &&
      !result.stats &&
      !result.influence &&
      !result.relatedMemories &&
      !result.ancestors &&
      !result.descendants &&
      !result.suggestions &&
      !result.similarNodes
    ) {
      result.context = await getNodeWithContext(id, depth);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[brain/nodes/id] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar n\u00f3" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json(
      { error: status === 401 ? "N\u00e3o autorizado" : "Sem permiss\u00e3o" },
      { status },
    );
  }

  try {
    const { id } = await params;
    const result = await deleteNode(id, admin.id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[brain/nodes/id] DELETE error:", error);
    return NextResponse.json({ error: "Erro ao excluir n\u00f3" }, { status: 500 });
  }
}
