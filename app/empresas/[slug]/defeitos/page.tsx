"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type DefectItem = {
  id: string;
  runSlug: string;
  title: string;
  app: string;
  status: string;
  severity: string;
  link?: string;
};

export default function DefeitosEmpresaPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "empresa";
  const companyName =
    slug === "griaule"
      ? "Griaule"
      : slug
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");

  const [defects, setDefects] = useState<DefectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/empresas/${slug}/defeitos`, { cache: "no-store" });
        const json = await res.json();
        setDefects(Array.isArray(json.defects) ? json.defects : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar defeitos");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  return (
    <div className="min-h-screen bg-[var(--page-bg,#f7f9fb)] text-[var(--page-text,#0b1a3c)] p-6 md:p-10 space-y-6">
      <nav className="text-xs text-[var(--tc-text-muted,#6B7280)] flex items-center gap-1">
        <Link href="/empresas" className="hover:underline">
          Empresas
        </Link>
        <span>/</span>
        <Link href={`/empresas/${slug}/dashboard`} className="font-semibold text-[var(--tc-text-primary,#0b1a3c)] uppercase hover:underline">
          {companyName}
        </Link>
        <span>/</span>
        <span className="text-[var(--tc-text-secondary,#4B5563)]">Defeitos</span>
      </nav>

      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.32em] text-[var(--tc-accent,#ef0001)]">Defeitos</p>
        <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--tc-text-primary,#0b1a3c)]">
          Falhas das runs da {companyName}
        </h1>
        <p className="text-sm text-[var(--tc-text-secondary,#4B5563)]">
          Agrupamento das execucoes com status de falha. Link direto para investigar.
        </p>
      </header>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading && <p className="text-sm text-[var(--tc-text-muted,#6B7280)]">Carregando defeitos...</p>}

      {!loading && (
        <section className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[var(--tc-text-primary,#0b1a3c)]">Lista de defeitos</h2>
          </div>
          {defects.length === 0 ? (
            <p className="text-sm text-[var(--tc-text-muted,#6B7280)]">Nenhum defeito encontrado.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {defects.map((d) => (
                <div
                  key={d.id}
                  className="rounded-xl border border-[var(--tc-border,#e5e7eb)] bg-white p-4 shadow-sm space-y-2 hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-[var(--tc-text-primary,#0b1a3c)]">{d.title}</div>
                    <span className="text-xs text-red-600">falha</span>
                  </div>
                  <p className="text-xs text-[var(--tc-text-secondary,#4B5563)]">Run: {d.runSlug}</p>
                  <p className="text-xs text-[var(--tc-text-secondary,#4B5563)]">App: {d.app}</p>
                  <p className="text-xs text-[var(--tc-text-secondary,#4B5563)]">Severidade: {d.severity}</p>
                  {d.link && d.link !== "#" && (
                    <a
                      href={d.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-[var(--tc-accent,#ef0001)] hover:underline"
                    >
                      Abrir no Qase
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
