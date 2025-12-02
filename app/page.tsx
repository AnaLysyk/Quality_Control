"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { releaseOrder, releasesData } from "@/release/data";

const applications = [
  { name: "SMART", slug: "smart", description: "Releases monitoradas com gráficos e detalhamento." },
  { name: "PRINT", slug: "print", description: "Releases específicas do PRINT sob observação." },
  { name: "BOOKING", slug: "booking", description: "Planejamentos de validação para o BOOKING." },
  { name: "TRUST", slug: "trust", description: "Releases de segurança e estabilidade do TRUST." },
  { name: "CIDADÃO SMART", slug: "cidadao-smart", description: "Experiências do cidadão SMART sendo acompanhadas." },
  { name: "MOBILE GRIAULE", slug: "mobile-griaule", description: "Releases mobile do ecossistema Griaule." },
];

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");

  const releaseList = useMemo(
    () =>
      releaseOrder.map((id) => ({
        id,
        title: releasesData[id].title,
        summary: releasesData[id].summary,
      })),
    []
  );

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = query.trim().toLowerCase();
    if (!target) {
      setFeedback("Informe o nome de uma aplicação ou release.");
      return;
    }

    const foundApp = applications.find(
      (app) =>
        app.slug === target ||
        app.name.toLowerCase() === target ||
        app.name.toLowerCase().includes(target)
    );

    if (foundApp) {
      router.push(`/applications/${foundApp.slug}`);
      return;
    }

    const sanitizedTarget = target.replace(/[^a-z0-9]/g, "");
    const foundRelease = releaseList.find((rel) => {
      const slugClean = rel.id.replace(/[^a-z0-9]/g, "");
      return (
        rel.id.toLowerCase() === target ||
        slugClean === sanitizedTarget ||
        rel.title.toLowerCase().includes(target)
      );
    });

    if (foundRelease) {
      router.push(`/release/${foundRelease.id}`);
      return;
    }

    setFeedback("Nenhuma rota encontrada. Tente o nome exato da aplicação ou da release.");
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.5em] text-[#7CD343]">Painel QA</p>
          <h1 className="text-4xl md:text-5xl font-extrabold">Painel QA • Monitoramento, releases e indicadores</h1>
          <p className="text-gray-300 max-w-3xl">
            O painel centraliza o status das execuções do Qase, gráficos e kanbans das releases críticas do SMART e das
            aplicações monitoradas pelo centro de qualidade.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col gap-3 md:flex-row">
          <input
            type="search"
            placeholder="Busque por aplicação (ex: SMART) ou release (ex: v1_8_0_reg)"
            value={query}
            onChange={(event) => {
              setFeedback("");
              setQuery(event.target.value);
            }}
            className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white focus:border-[#7CD343] focus:outline-none transition"
          />
          <button
            type="submit"
            className="rounded-xl bg-[#7CD343] px-6 py-3 font-semibold text-[#0b1305] shadow-lg shadow-[#7CD343]/30 transition hover:brightness-110"
          >
            Buscar
          </button>
        </form>
        {feedback && <p className="text-sm text-red-400">{feedback}</p>}

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-6 shadow-lg shadow-black/60">
            <p className="text-sm uppercase tracking-[0.4em] text-[#7CD343]">Aplicações</p>
            <h2 className="text-xl font-bold mt-2">Monitoradas</h2>
            <p className="text-sm text-gray-300 mt-2">
              SMART, PRINT, BOOKING, TRUST, CIDADÃO SMART e MOBILE GRIAULE estão no radar do Painel QA.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-6 shadow-lg shadow-black/60">
            <p className="text-sm uppercase tracking-[0.4em] text-[#7CD343]">Releases</p>
            <h2 className="text-xl font-bold mt-2">Pontos de observação</h2>
            <p className="text-sm text-gray-300 mt-2">
              Visualize execuções críticas como regressões e aceitações do SMART.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-6 shadow-lg shadow-black/60">
            <p className="text-sm uppercase tracking-[0.4em] text-[#7CD343]">Indicadores</p>
            <h2 className="text-xl font-bold mt-2">Estatísticas em tempo real</h2>
            <p className="text-sm text-gray-300 mt-2">
              Gráficos de status, kanban e descrição das runs são carregados diretamente do Qase.
            </p>
          </div>
        </div>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-[#7CD343]">Aplicações</p>
              <h2 className="text-2xl font-bold">Acesse cada aplicação</h2>
            </div>
            <Link href="/deskboard" className="text-sm text-[#7CD343] font-semibold">
              Ver deskboard →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {applications.map((app) => (
              <Link
                key={app.slug}
                href={`/applications/${app.slug}`}
                className="rounded-2xl border border-white/10 bg-[#0f1527] p-5 shadow-lg shadow-black/50 transition hover:border-[#7CD343]/60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-300">{app.slug}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{app.name}</span>
                </div>
                <p className="text-sm text-gray-200 mt-3">{app.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-[#7CD343]">Releases destacadas</p>
              <h2 className="text-2xl font-bold">SMART</h2>
            </div>
            <Link href="/release" className="text-sm text-[#7CD343] font-semibold">
              Lista completa →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {releaseList.slice(0, 4).map((rel) => (
              <Link
                key={rel.id}
                href={`/release/${rel.id}`}
                className="group rounded-2xl border border-white/10 bg-gradient-to-br from-[#11131e] to-[#0c101a] p-5 shadow-lg shadow-black/60 transition hover:border-[#7CD343]/60"
              >
                <p className="text-xs uppercase tracking-[0.4em] text-[#7CD343]">{rel.id.replace(/_/g, " ")}</p>
                <h3 className="text-xl font-semibold mt-2">{rel.title}</h3>
                <p className="text-sm text-gray-300 mt-2">{rel.summary}</p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#7CD343]">
                  Ver release
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
