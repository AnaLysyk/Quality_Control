"use client";

import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";

import { CompanySelector } from "./components/CompanySelector";

const cards = [
  {
    title: "Perfil pessoal",
    description:
      "Identidade, cargo, empresa ativa e contexto de trabalho. Não administra o sistema, só mostra quem você é.",
    href: "/profile",
    badge: "Identidade",
  },
  {
    title: "Empresa ativa",
    description: "Entenda onde você está trabalhando agora e acesse o hub da empresa.",
    href: "/empresas",
    badge: "Empresa",
  },
  {
    title: "Meus defeitos",
    description: "Selecione uma empresa para ver e criar defeitos no contexto certo.",
    href: "/empresas",
    badge: "Trabalho",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-(--page-bg,#f8f8fb) to-(--page-bg,#f0f4ff)">
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-10">
        <header className="rounded-[28px] bg-white/80 p-8 shadow-xl text-center">
          <Link
            href="/profile"
            className="text-sm uppercase tracking-[0.6em] text-(--tc-accent,#ef0001) hover:text-(--tc-accent,#f44336) flex items-center justify-center gap-2"
          >
            <span>Testing Company</span>
            <FiArrowRight size={14} />
          </Link>
          <h1 className="mt-4 text-4xl font-extrabold text-(--page-text,#0b1a3c)">Testing Metric</h1>
          <p className="mt-3 text-sm text-(--tc-text-secondary,#4b5563) max-w-3xl mx-auto">
            Esta tela não administra o sistema. Ela mostra quem você é, onde está e no que está trabalhando agora.
          </p>
        </header>

        <section className="rounded-[28px] bg-white/90 p-8 shadow-xl">
          <CompanySelector
            title="Empresas vinculadas"
            description="Selecione a empresa para ver dashboards, relatórios e executar ações específicas."
            buildHref={(company) => `/empresas/${encodeURIComponent(company.clientSlug)}/home`}
            ctaLabel={(company) => (company.role === "ADMIN" ? "Entrar como admin" : "Acessar hub")}
          />
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="group flex flex-col gap-4 rounded-3xl border border-(--tc-border) bg-white/90 p-6 shadow-xl transition hover:-translate-y-1 hover:shadow-[0_30px_60px_rgba(15,23,42,0.25)]"
            >
              <span className="text-xs uppercase tracking-[0.4em] text-(--tc-text-muted,#6b7280)">{card.badge}</span>
              <h2 className="text-xl font-semibold text-(--page-text,#0b1a3c)">{card.title}</h2>
              <p className="text-sm text-(--tc-text-secondary,#4b5563)">{card.description}</p>
              <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.4em] text-(--tc-accent,#ef0001)">
                Ir para
                <FiArrowRight size={14} />
              </span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
