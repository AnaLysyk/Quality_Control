import { NextResponse, type NextRequest } from "next/server";
import { getAccessContext } from "@/lib/auth/session";
import { notifyPlatformWikiDocPublished } from "@/lib/notificationService";
import { readPlatformDocs, writePlatformDocs, nowIso, type DocBlock } from "@/data/platformDocsStore";
import { shouldNotifyWikiDocPublished } from "@/lib/wikiDocsStatus";

function canEditWiki(access: Awaited<ReturnType<typeof getAccessContext>> | null): boolean {
  if (!access) return false;
  if (access.isGlobalAdmin) return true;
  const role = access.role?.toLowerCase() ?? "";
  const globalRole = access.globalRole?.toLowerCase() ?? "";
  return role === "leader_tc" || role === "technical_support" || globalRole === "leader_tc" || globalRole === "technical_support";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getAccessContext(req);
    if (!canEditWiki(access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const store = await readPlatformDocs();
    const idx = store.docs.findIndex((d) => d.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Doc not found" }, { status: 404 });
    }

    const body = (await req.json()) as {
      title?: unknown;
      description?: unknown;
      status?: unknown;
      categoryId?: unknown;
      order?: unknown;
      blocks?: unknown;
    };

    const current = store.docs[idx];
    const previousStatus = current.status;
    const doc = { ...current };

    if (typeof body.title === "string" && body.title.trim()) {
      doc.title = body.title.trim();
    }
    if (typeof body.description === "string") {
      doc.description = body.description.trim() || undefined;
    }
    if (body.status === "draft" || body.status === "published" || body.status === "outdated") {
      doc.status = body.status;
    }
    if (typeof body.categoryId === "string" && body.categoryId.trim()) {
      const cat = store.categories.find((c) => c.id === body.categoryId);
      if (!cat) return NextResponse.json({ error: "Category not found" }, { status: 404 });
      doc.categoryId = body.categoryId.trim();
    }
    if (typeof body.order === "number" && Number.isFinite(body.order)) {
      doc.order = body.order;
    }
    if (Array.isArray(body.blocks)) {
      doc.blocks = body.blocks as DocBlock[];
    }

    doc.updatedAt = nowIso();
    doc.updatedBy = access?.userId ?? null;

    store.docs[idx] = doc;
    await writePlatformDocs(store);
    if (shouldNotifyWikiDocPublished(previousStatus, doc.status)) {
      void notifyPlatformWikiDocPublished({ doc, event: "published" }).catch((notificationError) => {
        console.error("[platform-docs/docs/[id] PATCH notify]", notificationError);
      });
    }

    return NextResponse.json({ doc });
  } catch (err) {
    console.error("[platform-docs/docs/[id] PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getAccessContext(req);
    if (!canEditWiki(access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const store = await readPlatformDocs();
    const idx = store.docs.findIndex((d) => d.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Doc not found" }, { status: 404 });
    }

    store.docs.splice(idx, 1);
    await writePlatformDocs(store);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[platform-docs/docs/[id] DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
