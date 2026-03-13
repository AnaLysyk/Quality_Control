import { NextResponse } from "next/server";
import { listApplications, createApplication } from "../../../lib/applicationsStore";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const companySlug = url.searchParams.get("companySlug") || undefined;
  const items = listApplications(companySlug ? { companySlug } : undefined);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const created = createApplication({
      name: String(body.name),
      slug: body.slug ? String(body.slug) : undefined,
      description: body.description ?? null,
      qaseProjectCode: typeof body.qaseProjectCode === "string" ? body.qaseProjectCode : null,
      source: typeof body.source === "string" ? body.source : null,
      companySlug: body.companySlug ?? body.companyId ?? undefined,
      companyId: body.companyId ?? body.companySlug ?? undefined,
      active: body.active ?? true,
    });
    return NextResponse.json({ item: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
}
// Duplicate block removed — this route already exports a GET/POST above
