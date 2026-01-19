import { NextResponse } from "next/server";
import { getReleaseTimeline } from "@/lib/releaseTimeline";

export async function GET(_: Request, context: { params: Promise<{ slug: string; release: string }> }) {
  const { slug: companySlug, release: releaseSlug } = await context.params;
  const events = await getReleaseTimeline(companySlug, releaseSlug);
  return NextResponse.json(events, { status: 200 });
}
