import { NextResponse, type NextRequest } from "next/server";
import { getAccessContext } from "@/lib/auth/session";
import { readPlatformDocs, writePlatformDocs, nowIso } from "@/data/platformDocsStore";

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
    const idx = store.categories.findIndex((c) => c.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const body = (await req.json()) as { title?: unknown; description?: unknown; icon?: unknown; order?: unknown };
    const category = { ...store.categories[idx] };

    if (typeof body.title === "string" && body.title.trim()) {
      category.title = body.title.trim();
    }
    if (typeof body.description === "string") {
      category.description = body.description.trim() || undefined;
    }
    if (typeof body.icon === "string") {
      category.icon = body.icon.trim() || undefined;
    }
    if (typeof body.order === "number" && Number.isFinite(body.order)) {
      category.order = body.order;
    }
    category.updatedAt = nowIso();

    store.categories[idx] = category;
    await writePlatformDocs(store);

    return NextResponse.json({ category });
  } catch (err) {
    console.error("[platform-docs/categories/[id] PATCH]", err);
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
    const catIdx = store.categories.findIndex((c) => c.id === id);
    if (catIdx === -1) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Cascade delete all docs in this category
    store.docs = store.docs.filter((d) => d.categoryId !== id);
    store.categories.splice(catIdx, 1);
    await writePlatformDocs(store);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[platform-docs/categories/[id] DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
