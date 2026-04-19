import { NextResponse, type NextRequest } from "next/server";
import { getAccessContext } from "@/lib/auth/session";
import { notifyPlatformWikiDocPublished } from "@/lib/notificationService";
import { readPlatformDocs, writePlatformDocs, newId, nowIso, sanitizeSlug, type DocBlock } from "@/data/platformDocsStore";
import { normalizeWikiDocStatus, shouldNotifyWikiDocPublished } from "@/lib/wikiDocsStatus";

function canEditWiki(access: Awaited<ReturnType<typeof getAccessContext>> | null): boolean {
  if (!access) return false;
  if (access.isGlobalAdmin) return true;
  const role = access.role?.toLowerCase() ?? "";
  const globalRole = access.globalRole?.toLowerCase() ?? "";
  return role === "leader_tc" || role === "technical_support" || globalRole === "leader_tc" || globalRole === "technical_support";
}

export async function POST(req: NextRequest) {
  try {
    const access = await getAccessContext(req);
    if (!canEditWiki(access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = (await req.json()) as {
      title?: unknown;
      categoryId?: unknown;
      description?: unknown;
      status?: unknown;
    };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
    if (!categoryId) return NextResponse.json({ error: "categoryId is required" }, { status: 400 });

    const store = await readPlatformDocs();
    const cat = store.categories.find((c) => c.id === categoryId);
    if (!cat) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    const description = typeof body.description === "string" ? body.description.trim() : undefined;
    const status = normalizeWikiDocStatus(body.status);
    const maxOrder = store.docs.filter((d) => d.categoryId === categoryId).reduce((m, d) => Math.max(m, d.order), -1);

    const doc = {
      id: newId(),
      categoryId,
      slug: sanitizeSlug(title),
      title,
      ...(description ? { description } : {}),
      status,
      order: maxOrder + 1,
      blocks: [] as DocBlock[],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: access?.userId ?? null,
      updatedBy: access?.userId ?? null,
    };

    store.docs.push(doc);
    await writePlatformDocs(store);
    if (shouldNotifyWikiDocPublished(null, status)) {
      void notifyPlatformWikiDocPublished({ doc, event: "created" }).catch((notificationError) => {
        console.error("[platform-docs/docs POST notify]", notificationError);
      });
    }

    return NextResponse.json({ doc }, { status: 201 });
  } catch (err) {
    console.error("[platform-docs/docs POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
