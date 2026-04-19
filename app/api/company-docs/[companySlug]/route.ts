import { NextResponse, type NextRequest } from "next/server";
import { getAccessContext } from "@/lib/auth/session";
import { canEditCompanyWiki, canReadCompanyWiki } from "@/lib/companyWikiAccess";
import { readCompanyDocs } from "@/data/platformDocsStore";
import { filterWikiCategoriesForDocs, filterWikiDocsForUser } from "@/lib/wikiDocsStatus";

export async function GET(req: NextRequest, { params }: { params: Promise<{ companySlug: string }> }) {
  try {
    const access = await getAccessContext(req);
    const { companySlug } = await params;
    if (!canReadCompanyWiki(access, companySlug)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const store = await readCompanyDocs(companySlug);
    const canEdit = canEditCompanyWiki(access, companySlug);
    const docs = filterWikiDocsForUser(store.docs, access?.userId ?? null, {
      includeDisabledForOwner: canEdit,
    });
    const categories = filterWikiCategoriesForDocs(store.categories, docs, canEdit);
    return NextResponse.json({
      categories: categories.slice().sort((a, b) => a.order - b.order),
      docs: docs.slice().sort((a, b) => a.order - b.order),
      canEdit,
    });
  } catch (err) {
    console.error("[company-docs GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
