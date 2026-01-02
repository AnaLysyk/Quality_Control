"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type RunItem = { slug: string; title: string; app?: string; project?: string; summary?: string; clientName?: string | null };
type ClientItem = { id: string; name: string; website?: string | null; status?: string | null; slug?: string | null };

export default function EmpresaHomePage() {
  const params = useParams();
  const slug = (params?.slug as string) || "empresa";
  const companyName =
    slug === "griaule"
      ? "Griaule"
      : slug
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");

  const [query, setQuery] = useState("");
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [slideIndex, setSlideIndex] = useState(0);

  const filteredRuns = useMemo(
    () =>
      runs.filter((r) =>
        (r.title + " " + r.slug + " " + (r.clientName ?? "")).toLowerCase().includes(query.toLowerCase()),
      ),
    [runs, query],
  );
  const filteredClients = useMemo(
    () =>
      clients
        .filter((c) => !c.slug || c.slug === slug)
        .filter((c) => (c.name + " " + (c.website ?? "")).toLowerCase().includes(query.toLowerCase())),
    [clients, query, slug],
  );

  const slides = [
    {
      title: "Qualidade em escala",
      subtitle: `Acompanhe a saude das runs e a performance de qualidade da ${companyName}.`,
      cta: "Ver runs",
      link: `/empresas/${slug}/runs`,
    },
    {
      title: "Visao operacional",
      subtitle: "Indicadores de aprovacao, falhas e estabilidade desta empresa.",
      cta: "Dashboard",
      link: `/empresas/${slug}/dashboard`,
    },
    {
      title: "Gestao centralizada",
      subtitle: "Aplicacoes, usuarios e runs sob controle e rastreabilidade.",
      cta: "Aplicacoes",
      link: `/empresas/${slug}/aplicacoes`,
    },
  ];

  useEffect(() => {
    const id = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(id);
  }, [slides.length]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [runRes, cliRes] = await Promise.all([
          fetch("/api/releases", { cache: "no-store" }),
          fetch("/api/clients", { cache: "no-store" }),
        ]);
        const runJson = await runRes.json().catch(() => ({ releases: [] }));
        const cliJson = await cliRes.json().catch(() => ({ items: [] }));
        setRuns(Array.isArray(runJson.releases) ? runJson.releases : []);
        setClients(Array.isArray(cliJson.items) ? cliJson.items : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--page-bg,#ffffff)] text-[var(--page-text,#0b1a3c)] p-6 md:p-10 space-y-8">
      <div className="rounded-3xl border border-[var(--tc-border,#e5e7eb)] bg-gradient-to-r from-white via-[#f5f7fb] to-white shadow-sm p-6 md:p-8 relative overflow-hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-3">
            <p className="text-xs uppercase tracking-[0.38em] text-[var(--tc-accent,#ef0001)]">{companyName}</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--tc-text-primary,#0b1a3c)]">
              {slides[slideIndex].title}
            </h1>
            <p className="text-[var(--tc-text-secondary,#4B5563)] max-w-2xl">{slides[slideIndex].subtitle}</p>
            <div className="flex items-center gap-3">
              <a
                href={slides[slideIndex].link}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--tc-accent,#ef0001)] px-4 py-2 text-white font-semibold shadow hover:brightness-110"
              >
                {slides[slideIndex].cta}
              </a>
              <div className="flex items-center gap-2">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSlideIndex(idx)}
                    className={`h-2 w-6 rounded-full transition ${
                      idx === slideIndex ? "bg-[var(--tc-accent,#ef0001)]" : "bg-gray-300"
                    }`}
                    aria-label={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="hidden md:flex w-64 h-40 rounded-2xl bg-white border border-[var(--tc-border,#e5e7eb)] shadow-inner items-center justify-center text-sm text-[var(--tc-text-secondary,#4B5563)]">
            Visao da {companyName}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--tc-text-primary,#0b1a3c)]">Metricas globais da empresa</h2>
            <p className="text-sm text-[var(--tc-text-secondary,#4B5563)]">Visao agregada de qualidade</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {[7, 30, 90].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p as 7 | 30 | 90)}
                className={`rounded-lg px-3 py-1 border ${
                  period === p
                    ? "border-[var(--tc-accent,#ef0001)] text-[var(--tc-accent,#ef0001)]"
                    : "border-[var(--tc-border,#e5e7eb)] text-[var(--tc-text-secondary,#4B5563)]"
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard label="Aprovadas" value={120} color="text-emerald-600" />
          <MetricCard label="Falhas" value={30} color="text-red-500" />
          <MetricCard label="Neutras / Em andamento" value={15} color="text-amber-500" />
          <MetricCard label="Qualidade media" value={74} suffix="%" color="text-[var(--tc-accent,#ef0001)]" />
        </div>
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading && <p className="text-sm text-[var(--tc-text-muted,#6B7280)]">Carregando...</p>}

      {!loading && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Runs">
            {filteredRuns.length === 0 ? (
              <Empty label="Nenhuma run encontrada" />
            ) : (
              <div className="space-y-3">
                {filteredRuns.slice(0, 6).map((r) => (
                  <div key={r.slug} className="rounded-xl border border-[var(--tc-border,#e5e7eb)] bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-[var(--tc-text-primary,#0b1a3c)]">{r.title}</div>
                      <span className="text-xs text-[var(--tc-text-muted,#6B7280)]">{r.app ?? r.project ?? "APP"}</span>
                    </div>
                    {r.summary && <p className="text-xs text-[var(--tc-text-secondary,#4B5563)] mt-1">{r.summary}</p>}
                    <a
                      href={`/empresas/${slug}/runs/${r.slug}`}
                      className="mt-2 inline-flex text-xs text-[var(--tc-accent,#ef0001)] font-semibold hover:underline"
                    >
                      Abrir run
                    </a>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Aplicacoes">
            {filteredClients.length === 0 ? (
              <Empty label="Nenhuma aplicacao encontrada" />
            ) : (
              <div className="space-y-3">
                {filteredClients.slice(0, 3).map((c) => (
                  <div key={c.id} className="rounded-xl border border-[var(--tc-border,#e5e7eb)] bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-[var(--tc-text-primary,#0b1a3c)]">{c.name}</div>
                      <span className="text-xs text-emerald-600">ativo</span>
                    </div>
                    {c.website && (
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[var(--tc-accent,#ef0001)] hover:underline"
                      >
                        {c.website}
                      </a>
                    )}
                    <div className="flex gap-2 mt-2 items-center">
                      <div className="h-1.5 w-16 rounded-full bg-emerald-100">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: "82%" }} />
                      </div>
                      <a
                        href={`/empresas/${slug}/aplicacoes`}
                        className="text-xs text-[var(--tc-accent,#ef0001)] font-semibold hover:underline"
                      >
                        Abrir aplicacoes
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-[var(--tc-text-primary,#0b1a3c)]">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--tc-border,#e5e7eb)] bg-white p-4 text-sm text-[var(--tc-text-muted,#6B7280)]">
      {label}
    </div>
  );
}

function MetricCard({ label, value, suffix, color }: { label: string; value: number; suffix?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white p-5 shadow-sm">
      <p className="text-sm text-[var(--tc-text-muted,#6B7280)]">{label}</p>
      <p className={`text-3xl font-bold ${color ?? "text-[var(--tc-text-primary,#0b1a3c)]"}`}>
        {value}
        {suffix}
      </p>
    </div>
  );
}
