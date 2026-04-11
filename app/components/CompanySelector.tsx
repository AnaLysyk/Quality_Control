"use client";

import Link from "next/link";
import { useMemo } from "react";
import { FiArrowRight } from "react-icons/fi";
import { useClientContext } from "@/context/ClientContext";
import { ClientSkeleton } from "./ClientSkeleton";

export type CompanySelectorItem = {
  clientId: string;
  clientName: string;
  clientSlug: string;
  clientActive: boolean;
  role: "ADMIN" | "USER";
  linkActive: boolean;
  createdAt?: string | null;
};

type CompanySelectorProps = {
  title: string;
  description?: string;
  buildHref: (company: CompanySelectorItem) => string;
  ctaLabel?: string | ((company: CompanySelectorItem) => string);
  emptyMessage?: string;
  accent?: "light" | "dark";
};

const defaultCta = (company: CompanySelectorItem) =>
  company.role === "ADMIN" ? "Administrar" : "Acessar";

export function CompanySelector({
  title,
  description,
  buildHref,
  ctaLabel,
  emptyMessage = "Nenhuma empresa vinculada encontrada.",
  accent = "light",
}: CompanySelectorProps) {
  const { clients, activeClientSlug, loading, error, setActiveClientSlug, refreshClients } = useClientContext();

  const companies = useMemo<CompanySelectorItem[]>(
    () =>
      clients.map((client) => ({
        clientId: client.id,
        clientName: client.name,
        clientSlug: client.slug,
        clientActive: client.active,
        role: client.role,
        linkActive: client.linkActive,
        createdAt: client.createdAt ?? null,
      })),
    [clients]
  );

  const cta = useMemo(() => {
    if (!ctaLabel) return defaultCta;
    if (typeof ctaLabel === "string") {
      return () => ctaLabel;
    }
    return ctaLabel;
  }, [ctaLabel]);

  // Prefer semantic class for text color
  const tone = accent === "dark" ? "text-(--tc-text-inverse)" : "text-text";
  const hasCompanies = companies.length > 0;

  return (
    <div data-testid="company-selector" className={`space-y-6 ${tone}`}>
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold">{title}</h1>
        {description && <p className="text-sm text-(--tc-text-secondary,#4b5563)">{description}</p>}
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index}>
              <ClientSkeleton message="Carregando empresa" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="text-sm font-semibold">{error}</p>
          <button
            type="button"
            onClick={refreshClients}
            className="tc-button mt-3 inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
            data-variant="danger"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && !hasCompanies && (
        <p className="text-sm text-muted">{emptyMessage}</p>
      )}

      {!loading && !error && hasCompanies && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => {
            const isActive = company.clientSlug === activeClientSlug;
            const isDisabled = !company.linkActive;
            const createdAtLabel =
              company.createdAt && !Number.isNaN(Date.parse(company.createdAt))
                ? new Date(company.createdAt).toLocaleDateString("pt-BR")
                : null;

            return (
            <Link
              data-testid={`company-item-${company.clientSlug}`}
              data-disabled={isDisabled ? "true" : undefined}
              key={`${company.clientId}-${company.clientSlug}`}
              href={buildHref(company)}
              aria-disabled={isDisabled}
              tabIndex={isDisabled ? -1 : undefined}
              onClick={(event) => {
                if (isDisabled) {
                  event.preventDefault();
                  return;
                }
                setActiveClientSlug(company.clientSlug);
              }}
              className={`group relative tc-section rounded-2xl p-5 shadow-sm transition ${
                isDisabled
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_18px_38px_rgba(15,23,42,0.12)]"
              } ${isActive ? "border-accent/70 ring-2 ring-accent/30" : ""}`}
            >
                {isActive && (
                  <span className="absolute right-4 top-4 inline-flex items-center rounded-full bg-(--tc-accent,#ef0001)/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">
                    Atual
                  </span>
                )}
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted">
                    {company.role === "ADMIN" ? "Admin" : "Usuario"}
                    {!company.clientActive && (
                      <span className="rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-semibold text-muted">
                        Inativo
                      </span>
                    )}
                    {!company.linkActive && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                        Bloqueado
                      </span>
                    )}
                  </span>
                  <h2 className="text-lg font-semibold text-text">{company.clientName}</h2>
                  <p className="text-xs text-muted">/{company.clientSlug}</p>
                  {createdAtLabel && (
                    <p className="text-xs text-muted">
                      Inicio do projeto: {createdAtLabel}
                    </p>
                  )}
                </div>

                <span
                  className={`mt-6 inline-flex items-center gap-2 text-sm font-semibold transition group-hover:gap-3 ${
                    isDisabled ? "text-muted" : "text-accent"
                  }`}
                >
                  {cta(company)} <FiArrowRight size={16} />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
