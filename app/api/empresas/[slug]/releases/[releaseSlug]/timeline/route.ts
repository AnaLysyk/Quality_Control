import { NextResponse } from "next/server";
import { getReleaseTimeline } from "@/backend/releaseTimeline";
import { requirePermission } from "@/backend/rbac/requirePermission";

export async function GET(req: Request, context: { params: Promise<{ slug: string; releaseSlug: string }> }) {
  const guard = await requirePermission(req, "releases", "view");
  if (!guard.ok) return guard.response;

  const { slug, releaseSlug } = await context.params;
  const timeline = await getReleaseTimeline(slug, releaseSlug);
  return NextResponse.json(timeline);
}
