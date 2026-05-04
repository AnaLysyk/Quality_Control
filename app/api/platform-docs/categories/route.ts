import { NextResponse, type NextRequest } from "next/server";
import { getAccessContext } from "@/lib/auth/session";
import { readPlatformDocs, writePlatformDocs, newId, nowIso, sanitizeSlug } from "@/data/platformDocsStore";

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
    const body = (await req.json()) as { title?: unknown; description?: unknown; icon?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const description = typeof body.description === "string" ? body.description.trim() : undefined;
    const icon = typeof body.icon === "string" ? body.icon.trim() : undefined;

    const store = await readPlatformDocs();
    const slug = sanitizeSlug(title);
    const maxOrder = store.categories.reduce((m, c) => Math.max(m, c.order), -1);

    const category = {
      id: newId(),
      slug,
      title,
      ...(description ? { description } : {}),
      ...(icon ? { icon } : {}),
      order: maxOrder + 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: access?.userId ?? null,
    };

    store.categories.push(category);
    await writePlatformDocs(store);

    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    console.error("[platform-docs/categories POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
