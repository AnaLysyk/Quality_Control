export const dynamic = "force-dynamic";

import DocsWikiClient from "../DocsWikiClient";

export default function PlatformDocsPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-3 sm:px-4 lg:px-5 pt-2 pb-2">
      <DocsWikiClient basePath="/api/platform-docs" />
    </div>
  );
}
