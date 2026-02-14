import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAccessContextFromStores } from "@/lib/auth/session";
import { getAppMeta } from "@/lib/appMeta";

type PageProps = {
  params: { slug: string };
};

type CompanyApp = {
  slug: string;
  name: string;
  tag: string;
};

const GLOBAL_APPS: CompanyApp[] = [
  { slug: "smart", name: "SMART", tag: "SMART" },
  { slug: "print", name: "PRINT", tag: "PRINT" },
  { slug: "booking", name: "BOOKING", tag: "BOOKING" },
  { slug: "trust", name: "TRUST", tag: "TRUST" },
  { slug: "cidadao-smart", name: "CIDADAO SMART", tag: "CIDADAO" },
  { slug: "mobile-griaule", name: "GRIAULE MOBILE", tag: "MOBILE" },
];

const COMPANY_APP_MAP: Record<string, CompanyApp[]> = {
  griaule: [
    { slug: "smart", name: "SMART", tag: "SMART" },
    { slug: "trust", name: "TRUST", tag: "TRUST" },
    { slug: "mobile-griaule", name: "GRIAULE MOBILE", tag: "MOBILE" },
  ],
  "testing-company": [
    { slug: "booking", name: "BOOKING", tag: "BOOKING" },
    { slug: "print", name: "PRINT", tag: "PRINT" },
  ],
};

async function loadCompanyApps(companySlug: string): Promise<CompanyApp[]> {
  const scoped = COMPANY_APP_MAP[companySlug];
  if (Array.isArray(scoped) && scoped.length > 0) {
    return scoped;
  }
  return GLOBAL_APPS;
}

export default async function CompanyAppsPage({ params }: PageProps) {
  const companySlug = decodeURIComponent(params.slug);
  const cookieStore = await cookies();
  const access = await getAccessContextFromStores(undefined, cookieStore);
  if (!access) redirect("/login");

  const normalizedSlug = companySlug.toLowerCase();
  const allowedSlugs = access.companySlugs.map((slug) => slug.toLowerCase());
  const isAdmin = access.isGlobalAdmin || access.role === "admin";
  const hasAccess = isAdmin || allowedSlugs.includes(normalizedSlug);
  if (!hasAccess) redirect("/empresas");

  const apps = await loadCompanyApps(normalizedSlug);
  const hasApps = apps.length > 0;

  return (
    <div className="min-h-screen bg-(--page-bg) text-(--page-text) px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl bg-(--tc-surface) p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-(--tc-accent)">Aplicacoes</p>
          <h1 className="mt-2 text-3xl font-extrabold">Aplicacoes da empresa {companySlug}</h1>
          <p className="mt-2 text-sm text-(--tc-text-secondary)">
            Catalogo simplificado das aplicacoes monitoradas pelo Quality Control.
          </p>
        </header>

        {!hasApps && (
          <div className="rounded-3xl border border-(--tc-border) bg-(--tc-surface) p-10 text-center shadow-sm">
            <p className="text-lg font-semibold">Nenhuma aplicacao vinculada ainda.</p>
            <p className="mt-2 text-sm text-(--tc-text-secondary)">
              Vincule aplicacoes no hub principal para que elas apareçam aqui automaticamente.
            </p>
          </div>
        )}

        {hasApps && (
          <div className="grid gap-4 md:grid-cols-2">
            {apps.map((app) => {
              const meta = getAppMeta(app.slug, app.tag);
              return (
                <div
                  key={app.slug}
                  className="rounded-3xl border border-(--tc-border) bg-(--tc-surface) p-6 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.35em] text-(--tc-accent)">
                      {meta.label}
                    </span>
                    <span className="rounded-full bg-(--tc-accent-bg) px-3 py-1 text-[11px] font-semibold text-(--tc-accent)">
                      {app.tag}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold">{app.name}</h2>
                    <p className="text-sm text-(--tc-text-secondary)">
                      {meta.description ?? "Aplicacao monitorada com indicadores dedicados."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-(--tc-text-secondary)">
                    <span className="rounded-full bg-(--tc-surface-2) px-3 py-1">Runs</span>
                    <span className="rounded-full bg-(--tc-surface-2) px-3 py-1">Defeitos</span>
                    <span className="rounded-full bg-(--tc-surface-2) px-3 py-1">Metricas</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
