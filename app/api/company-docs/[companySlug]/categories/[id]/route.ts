import { NextResponse, type NextRequest } from "next/server";
import { getAccessContext } from "@/lib/auth/session";
import { canEditCompanyWiki } from "@/lib/companyWikiAccess";
import { readCompanyDocs, writeCompanyDocs, nowIso } from "@/data/platformDocsStore";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ companySlug: string; id: string }> }) {
  try {
    const access = await getAccessContext(req);
    const { companySlug, id } = await params;
    if (!canEditCompanyWiki(access, companySlug)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const store = await readCompanyDocs(companySlug);
    const idx = store.categories.findIndex((c) => c.id === id);
    if (idx === -1) return NextResponse.json({ error: "Category not found" }, { status: 404 });
    const body = (await req.json()) as { title?: unknown; description?: unknown; icon?: unknown; order?: unknown };
    const category = { ...store.categories[idx] };
    if (typeof body.title === "string" && body.title.trim()) category.title = body.title.trim();
    if (typeof body.description === "string") category.description = body.description.trim() || undefined;
    if (typeof body.icon === "string") category.icon = body.icon.trim() || undefined;
    if (typeof body.order === "number" && Number.isFinite(body.order)) category.order = body.order;
    category.updatedAt = nowIso();
    store.categories[idx] = category;
    await writeCompanyDocs(companySlug, store);
    return NextResponse.json({ category });
  } catch (err) {
    console.error("[company-docs/categories/[id] PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ companySlug: string; id: string }> }) {
  try {
    const access = await getAccessContext(req);
    const { companySlug, id } = await params;
    if (!canEditCompanyWiki(access, companySlug)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const store = await readCompanyDocs(companySlug);
    const catIdx = store.categories.findIndex((c) => c.id === id);
    if (catIdx === -1) return NextResponse.json({ error: "Category not found" }, { status: 404 });
    store.docs = store.docs.filter((d) => d.categoryId !== id);
    store.categories.splice(catIdx, 1);
    await writeCompanyDocs(companySlug, store);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[company-docs/categories/[id] DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
