import { ReleasePageContent } from "@/release/ReleaseTemplate";

type PageParams = {
  params: { slug: string; releaseSlug: string };
};

export default async function EmpresaReleaseDetailPage({ params }: PageParams) {
  const slug = params.releaseSlug || "";
  const company = params.slug || "";
  const content = await ReleasePageContent({ slug });

  return (
    <div className="min-h-screen bg-[var(--page-bg,#ffffff)] text-[var(--page-text,#0b1a3c)] p-6 md:p-10 space-y-4">
      <nav className="text-xs text-[var(--tc-text-muted,#6B7280)]">
        <span>Empresas</span> <span className="mx-1">/</span>
        <span className="font-semibold text-[var(--tc-text-primary,#0b1a3c)] uppercase">{company}</span>{" "}
        <span className="mx-1">/</span>
        <a href={`/empresas/${company}/runs`} className="text-[var(--tc-accent,#ef0001)] hover:underline">
          Runs
        </a>
        <span className="mx-1">/</span>
        <span>{slug}</span>
      </nav>
      {content}
    </div>
  );
}
