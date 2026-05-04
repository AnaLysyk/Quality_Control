import { NextResponse, type NextRequest } from "next/server";
import { getAccessContext } from "@/lib/auth/session";
import { readPlatformDocs } from "@/data/platformDocsStore";
import { filterWikiCategoriesForDocs, filterWikiDocsForUser } from "@/lib/wikiDocsStatus";

function canEditWiki(access: Awaited<ReturnType<typeof getAccessContext>> | null): boolean {
  if (!access) return false;
  if (access.isGlobalAdmin) return true;
  const role = access.role?.toLowerCase() ?? "";
  const globalRole = access.globalRole?.toLowerCase() ?? "";
  return role === "leader_tc" || role === "technical_support" || globalRole === "leader_tc" || globalRole === "technical_support";
}

export async function GET(req: NextRequest) {
  try {
    const access = await getAccessContext(req);
    // Any authenticated user can read; only admins/support can edit
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const store = await readPlatformDocs();
    const canEdit = canEditWiki(access);
    const docs = filterWikiDocsForUser(store.docs, access.userId, {
      includeDisabledForOwner: canEdit,
    });
    const categories = filterWikiCategoriesForDocs(store.categories, docs, canEdit);
    return NextResponse.json({
      categories: categories.slice().sort((a, b) => a.order - b.order),
      docs: docs.slice().sort((a, b) => a.order - b.order),
      canEdit,
    });
  } catch (err) {
    console.error("[platform-docs GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
