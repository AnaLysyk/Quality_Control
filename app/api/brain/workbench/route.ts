import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { resolveBrainAccess } from "@/lib/brain/access";
import { prisma } from "@/lib/prismaClient";

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const companySlug = url.searchParams.get("companySlug")?.trim().toLowerCase();

  const items = await prisma.brainWorkspace.findMany({
    where: {
      userId: accessResult.context.user.id,
      ...(companySlug ? { companySlug } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      nodes: { take: 200, orderBy: { updatedAt: "desc" } },
      edges: { take: 400, orderBy: { createdAt: "desc" } },
      savedViews: { take: 20, orderBy: { updatedAt: "desc" } },
    },
    take: 20,
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    companySlug?: string;
    nodes?: Array<{ brainNodeId?: string; label?: string; type?: string; metadata?: Record<string, unknown> }>;
    edges?: Array<{ fromNodeId: string; toNodeId: string; type: string; metadata?: Record<string, unknown> }>;
  };

  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Nome do workspace Ã© obrigatÃ³rio" }, { status: 400 });
  }

  const workspace = await prisma.brainWorkspace.create({
    data: {
      userId: accessResult.context.user.id,
      companySlug: body.companySlug?.trim().toLowerCase() || null,
      name,
      description: body.description?.trim() || null,
      nodes: {
        create: (body.nodes ?? []).map((node) => ({
          brainNodeId: node.brainNodeId || null,
          label: node.label || node.brainNodeId || "Node",
          type: node.type || "Unknown",
          metadata: (node.metadata ?? {}) as Prisma.InputJsonValue,
        })),
      },
      edges: {
        create: (body.edges ?? []).map((edge) => ({
          fromNodeId: edge.fromNodeId,
          toNodeId: edge.toNodeId,
          type: edge.type,
          metadata: (edge.metadata ?? {}) as Prisma.InputJsonValue,
        })),
      },
    },
    include: {
      nodes: true,
      edges: true,
      savedViews: true,
    },
  });

  return NextResponse.json({ workspace }, { status: 201 });
}

export async function PATCH(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    workspaceId?: string;
    action?: "archive" | "save-view";
    name?: string;
    description?: string;
    mode?: string;
    filters?: Record<string, unknown>;
    layout?: Record<string, unknown>;
    isShared?: boolean;
  };

  const workspaceId = String(body.workspaceId ?? "").trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId Ã© obrigatÃ³rio" }, { status: 400 });
  }

  const existing = await prisma.brainWorkspace.findFirst({
    where: { id: workspaceId, userId: accessResult.context.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Workspace nÃ£o encontrado" }, { status: 404 });
  }

  if (body.action === "archive") {
    const workspace = await prisma.brainWorkspace.update({
      where: { id: workspaceId },
      data: { status: "archived" },
    });
    return NextResponse.json({ workspace });
  }

  if (body.action === "save-view") {
    const savedView = await prisma.brainSavedView.create({
      data: {
        workspaceId,
        name: body.name?.trim() || "VisÃ£o sem nome",
        description: body.description?.trim() || null,
        mode: body.mode?.trim() || "graph",
        filters: (body.filters ?? {}) as Prisma.InputJsonValue,
        layout: (body.layout ?? {}) as Prisma.InputJsonValue,
        isShared: body.isShared === true,
      },
    });
    return NextResponse.json({ savedView }, { status: 201 });
  }

  return NextResponse.json({ error: "AÃ§Ã£o invÃ¡lida" }, { status: 400 });
}

