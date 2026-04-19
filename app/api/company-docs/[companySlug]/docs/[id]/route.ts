import { NextResponse, type NextRequest } from "next/server";
import { getAccessContext } from "@/lib/auth/session";
import { canEditCompanyWiki } from "@/lib/companyWikiAccess";
import { notifyCompanyWikiDocPublished } from "@/lib/notificationService";
import { readCompanyDocs, writeCompanyDocs, nowIso, sanitizeSlug, type DocBlock } from "@/data/platformDocsStore";
import { shouldNotifyWikiDocPublished } from "@/lib/wikiDocsStatus";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ companySlug: string; id: string }> }) {
  try {
    const access = await getAccessContext(req);
    const { companySlug, id } = await params;
    if (!canEditCompanyWiki(access, companySlug)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const store = await readCompanyDocs(companySlug);
    const idx = store.docs.findIndex((d) => d.id === id);
    if (idx === -1) return NextResponse.json({ error: "Doc not found" }, { status: 404 });
    const body = (await req.json()) as { title?: unknown; description?: unknown; status?: unknown; categoryId?: unknown; blocks?: unknown };
    const current = store.docs[idx];
    const previousStatus = current.status;
    const doc = { ...current };
    if (typeof body.title === "string" && body.title.trim()) { doc.title = body.title.trim(); doc.slug = sanitizeSlug(doc.title); }
    if (typeof body.description === "string") doc.description = body.description.trim() || undefined;
    if (body.status === "draft" || body.status === "published" || body.status === "outdated") doc.status = body.status;
    if (typeof body.categoryId === "string" && body.categoryId.trim()) {
      const cat = store.categories.find((c) => c.id === body.categoryId);
      if (cat) doc.categoryId = cat.id;
    }
    if (Array.isArray(body.blocks)) doc.blocks = body.blocks as DocBlock[];
    doc.updatedAt = nowIso();
    doc.updatedBy = access?.userId ?? null;
    store.docs[idx] = doc;
    await writeCompanyDocs(companySlug, store);
    if (shouldNotifyWikiDocPublished(previousStatus, doc.status)) {
      void notifyCompanyWikiDocPublished({ companySlug, doc, event: "published" }).catch((notificationError) => {
        console.error("[company-docs/docs/[id] PATCH notify]", notificationError);
      });
    }
    return NextResponse.json({ doc });
  } catch (err) {
    console.error("[company-docs/docs/[id] PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ companySlug: string; id: string }> }) {
  try {
    const access = await getAccessContext(req);
    const { companySlug, id } = await params;
    if (!canEditCompanyWiki(access, companySlug)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const store = await readCompanyDocs(companySlug);
    const docIdx = store.docs.findIndex((d) => d.id === id);
    if (docIdx === -1) return NextResponse.json({ error: "Doc not found" }, { status: 404 });
    store.docs.splice(docIdx, 1);
    await writeCompanyDocs(companySlug, store);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[company-docs/docs/[id] DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
