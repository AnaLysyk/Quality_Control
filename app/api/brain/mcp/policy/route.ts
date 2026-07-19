import { NextResponse } from "next/server";

import { resolveBrainAccess } from "@/backend/brain/access";
import { resolveMcpPoliciesForUser } from "@/backend/brain/mcpPolicy";

export async function GET(req: Request) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  return NextResponse.json(resolveMcpPoliciesForUser(accessResult.context.user));
}

