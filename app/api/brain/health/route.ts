import { NextResponse } from "next/server";

import { resolveBrainAccess } from "@/backend/brain/access";
import { getBrainHealth } from "@/backend/brain/health";

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({
      ok: false,
      nodes: 0,
      edges: 0,
      sources: [],
      generatedAt: new Date().toISOString(),
      error: accessResult.error,
    }, { status: accessResult.status });
  }

  const health = await getBrainHealth(accessResult.context);
  return NextResponse.json(health);
}

