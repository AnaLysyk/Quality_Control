import { NextResponse } from "next/server";

import { assertBrainNodeAccess, resolveBrainAccess } from "@/lib/brain/access";
import { buildBrainNodeActions, resolveBrainAction } from "@/lib/brain/actions";

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const url = new URL(req.url);
  const nodeId = url.searchParams.get("nodeId");
  if (!nodeId) return NextResponse.json({ error: "nodeId obrigatorio" }, { status: 400 });

  const nodeAccess = await assertBrainNodeAccess(nodeId, accessResult.context);
  if (!nodeAccess.ok) {
    return NextResponse.json({ error: nodeAccess.error }, { status: nodeAccess.status });
  }

  return NextResponse.json({
    nodeId,
    actions: buildBrainNodeActions(nodeAccess.node).map((action) => ({
      ...action,
      allowed: action.requiredPermissions.length === 0 || accessResult.context.user.isGlobalAdmin ||
        action.requiredPermissions.some((permission) => accessResult.context.userAccess.permissions[permission.moduleId]?.includes(permission.action)),
      missingPermissions: action.requiredPermissions
        .filter((permission) => !accessResult.context.user.isGlobalAdmin && !accessResult.context.userAccess.permissions[permission.moduleId]?.includes(permission.action))
        .map((permission) => `${permission.moduleId}:${permission.action}`),
    })),
  });
}

export async function POST(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const body = (await req.json().catch(() => ({}))) as { nodeId?: string; actionId?: string };
  if (!body.nodeId || !body.actionId) {
    return NextResponse.json({ error: "nodeId e actionId sao obrigatorios" }, { status: 400 });
  }

  const nodeAccess = await assertBrainNodeAccess(body.nodeId, accessResult.context);
  if (!nodeAccess.ok) {
    return NextResponse.json({ error: nodeAccess.error }, { status: nodeAccess.status });
  }

  const resolution = await resolveBrainAction({
    node: nodeAccess.node,
    actionId: body.actionId,
    access: accessResult.context,
    audit: true,
  });

  return NextResponse.json(resolution, { status: resolution.allowed ? 200 : 403 });
}

