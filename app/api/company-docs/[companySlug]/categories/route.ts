import { NextResponse, type NextRequest } from "next/server";
import { getAccessContext } from "@/lib/auth/session";
import { canEditCompanyWiki } from "@/lib/companyWikiAccess";
import { readCompanyDocs, writeCompanyDocs, newId, nowIso, sanitizeSlug } from "@/data/platformDocsStore";

export async function POST(req: NextRequest, { params }: { params: Promise<{ companySlug: string }> }) {
  try {
    const access = await getAccessContext(req);
    const { companySlug } = await params;
    if (!canEditCompanyWiki(access, companySlug)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = (await req.json()) as { title?: unknown; description?: unknown; icon?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
    const description = typeof body.description === "string" ? body.description.trim() : undefined;
    const icon = typeof body.icon === "string" ? body.icon.trim() : undefined;
    const store = await readCompanyDocs(companySlug);
    const maxOrder = store.categories.reduce((m, c) => Math.max(m, c.order), -1);
    const category = {
      id: newId(), slug: sanitizeSlug(title), title,
      ...(description ? { description } : {}), ...(icon ? { icon } : {}),
      order: maxOrder + 1, createdAt: nowIso(), updatedAt: nowIso(),
      createdBy: access?.userId ?? null,
    };
    store.categories.push(category);
    await writeCompanyDocs(companySlug, store);
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    console.error("[company-docs/categories POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
