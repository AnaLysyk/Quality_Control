"use client";

import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useClientContext, type ClientAccess } from "@/context/ClientContext";
import type { AuthUser } from "@/contracts/auth";
import { CompanySelector } from "@/components/CompanySelector";

const cards = [
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

function resolveCompanySlug(user: AuthUser | null, clients: ClientAccess[], activeClientSlug: string | null) {
  if (activeClientSlug) return activeClientSlug;
  if (clients.length) return clients[0].slug;
  if (typeof user?.clientSlug === "string" && user.clientSlug.trim()) return user.clientSlug;
  if (typeof user?.defaultClientSlug === "string" && user.defaultClientSlug.trim())
    return user.defaultClientSlug;
  return null;
}

function decideLandingRoute(user: AuthUser | null, clients: ClientAccess[], activeClientSlug: string | null) {
  if (!user) return null;
  const role = (user.role ?? "").toLowerCase();
  if (role === "admin") return "/admin";
  if (role === "company") {
    const slug = resolveCompanySlug(user, clients, activeClientSlug);
    return slug ? `/empresas/${encodeURIComponent(slug)}/home` : "/empresas";
  }
  return "/user/home";
}

export default function HomeContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { clients, activeClientSlug, loading: clientsLoading } = useClientContext();

  useEffect(() => {
    if (authLoading || clientsLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if ((!clients || clients.length === 0) && (user.role ?? "").toLowerCase() !== "admin") {
      router.replace("/empresas");
      return;
    }
    const nextRoute = decideLandingRoute(user, clients, activeClientSlug);
    if (!nextRoute) {
      router.replace("/empresas");
      return;
    }
    if (pathname !== nextRoute) {
      router.replace(nextRoute);
    }
  }, [user, clients, activeClientSlug, authLoading, clientsLoading, router, pathname]);

  if (authLoading || clientsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xl text-(--tc-text-muted,#6b7280)">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-(--page-bg,#f8f8fb) to-(--page-bg,#f0f4ff)">
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-10">
        <header className="rounded-[28px] bg-white/80 p-8 shadow-xl text-center">
          <div className="text-sm uppercase tracking-[0.6em] text-(--tc-accent,#ef0001) flex items-center justify-center gap-2">
            <span>Testing Company</span>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold text-(--page-text,#0b1a3c)">Quality Control</h1>
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
