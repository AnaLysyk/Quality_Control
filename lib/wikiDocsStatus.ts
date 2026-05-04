import type { DocStatus, WikiCategory, WikiDoc } from "@/data/platformDocsStore";

type WikiDocVisibilityInput = Pick<WikiDoc, "status" | "createdBy" | "updatedBy" | "categoryId">;

export function normalizeWikiDocStatus(value: unknown): DocStatus {
  return value === "draft" || value === "published" || value === "outdated"
    ? value
    : "draft";
}

export function getWikiDocOwnerId(doc: Pick<WikiDoc, "createdBy" | "updatedBy">): string | null {
  const createdBy = typeof doc.createdBy === "string" ? doc.createdBy.trim() : "";
  if (createdBy) return createdBy;
  const updatedBy = typeof doc.updatedBy === "string" ? doc.updatedBy.trim() : "";
  return updatedBy || null;
}

export function canUserViewWikiDoc(
  doc: Pick<WikiDoc, "status" | "createdBy" | "updatedBy">,
  userId?: string | null,
  options?: { includeDisabledForOwner?: boolean },
) {
  if (doc.status === "published") return true;

  const ownerId = getWikiDocOwnerId(doc);
  if (!userId || !ownerId || userId !== ownerId) return false;

  if (doc.status === "draft") return true;
  if (doc.status === "outdated") return options?.includeDisabledForOwner === true;
  return false;
}

export function filterWikiDocsForUser<T extends WikiDocVisibilityInput>(
  docs: T[],
  userId?: string | null,
  options?: { includeDisabledForOwner?: boolean },
) {
  return docs.filter((doc) => canUserViewWikiDoc(doc, userId, options));
}

export function filterWikiCategoriesForDocs<T extends Pick<WikiCategory, "id">>(
  categories: T[],
  docs: Array<Pick<WikiDoc, "categoryId">>,
  keepEmpty = false,
) {
  if (keepEmpty) return categories;
  const categoryIds = new Set(docs.map((doc) => doc.categoryId));
  return categories.filter((category) => categoryIds.has(category.id));
}

export function shouldNotifyWikiDocPublished(previousStatus: DocStatus | null | undefined, nextStatus: DocStatus) {
  return nextStatus === "published" && previousStatus !== "published";
}