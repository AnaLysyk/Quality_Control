"use client";

import { useParams } from "next/navigation";
import { ReleasePageContent } from "@/release/ReleaseTemplate";

export default function EmpresaRunDetailPage() {
  const params = useParams();
  const slug = (params?.releaseSlug as string) || "";
  const company = (params?.slug as string) || "";

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
      {ReleasePageContent({ slug })}
    </div>
  );
}
