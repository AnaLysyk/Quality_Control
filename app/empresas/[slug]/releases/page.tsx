import Link from "next/link";
import { getAllReleases } from "@/release/data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CompanyReleasesPage({ params }: PageProps) {
  const { slug } = await params;
  const releases = await getAllReleases();
  const sorted = [...releases].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

  return (
    <div className="min-h-screen bg-(--page-bg,#f5f6fa) text-(--page-text,#0b1a3c) px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-(--tc-accent,#ef0001)">Releases</p>
          <h1 className="mt-2 text-3xl font-extrabold">Releases disponiveis</h1>
          <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
            Lista de releases para acompanhamento e exportacao de relatorios.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((release) => (
            <div key={release.slug} className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-5 shadow-sm">
              <Link
                href={`/empresas/${encodeURIComponent(slug)}/releases/${encodeURIComponent(release.slug)}`}
                className="text-base font-semibold text-(--tc-accent,#ef0001)"
              >
                {release.title}
              </Link>
              <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">{release.summary}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
