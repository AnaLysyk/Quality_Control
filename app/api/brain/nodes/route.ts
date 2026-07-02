import { NextResponse } from "next/server";

import { searchNodes, upsertNode } from "@/lib/brain";
import { isBrainNodeVisible, resolveBrainAccess } from "@/lib/brain/access";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? undefined;
  const label = url.searchParams.get("label") ?? undefined;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

  const nodes = (await searchNodes({ type, label, limit })).filter((node) =>
    isBrainNodeVisible(node, accessResult.context),
  );
  return NextResponse.json({ nodes });
}

export async function POST(req: Request) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autorizado" : "Sem permissao" }, { status });
  }

  try {
    const body = await req.json();
    const { type, label, refType, refId, description, metadata, companySlug, source } = body;

    if (!type || !label) {
      return NextResponse.json({ error: "type e label sao obrigatorios" }, { status: 400 });
    }

    const node = await upsertNode({
      type,
      label,
      refType,
      refId,
      description,
      metadata: {
        ...(metadata ?? {}),
        companySlug: companySlug ?? metadata?.companySlug,
        source: source ?? metadata?.source ?? "manual_node.create",
        createdBy: admin.id,
      },
      userId: admin.id,
      enforceOntology: true,
    });

    return NextResponse.json({ node }, { status: 201 });
  } catch (error) {
    console.error("[brain/nodes] POST error:", error);
    return NextResponse.json({ error: "Erro ao criar no" }, { status: 500 });
  }
}

