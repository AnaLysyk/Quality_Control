import { NextResponse } from "next/server";
import { getReleaseTimeline } from "@/lib/releaseTimeline";

export async function GET(_req: Request, context: { params: Promise<{ slug: string; releaseSlug: string }> }) {
  const { slug, releaseSlug } = await context.params;
  const timeline = await getReleaseTimeline(slug, releaseSlug);
  return NextResponse.json(timeline);
}
