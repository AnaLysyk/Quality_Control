export const dynamic = "force-dynamic";

import DocsWikiClient from "../../../docs/DocsWikiClient";

export default async function CompanyDocsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-3 pt-2 sm:px-4 lg:px-5">
      <DocsWikiClient basePath={`/api/company-docs/${slug}`} />
    </div>
  );
}
