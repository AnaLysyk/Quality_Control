import DashboardPage from "@/dashboard/page";

export default async function EmpresaDashboardPage({ params }: { params: { slug: string } }) {
  const slug = params?.slug || "empresa";
  const companyName =
    slug === "griaule"
      ? "Griaule"
      : slug
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");

  return (
    <div className="min-h-screen bg-[var(--page-bg,#ffffff)] text-[var(--page-text,#0b1a3c)]">
      <div className="px-6 pt-6 md:px-10 md:pt-10 space-y-2">
        <nav className="text-xs text-[var(--tc-text-muted,#6B7280)]">
          <span>Empresas</span>
          <span className="mx-1">/</span>
          <span className="font-semibold text-[var(--tc-text-primary,#0b1a3c)] uppercase">{companyName}</span>
          <span className="mx-1">/</span>
          <span className="text-[var(--tc-text-secondary,#4B5563)]">Dashboard</span>
        </nav>
        <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--tc-text-primary,#0b1a3c)]">
          Dashboard da empresa
        </h1>
        <p className="text-sm text-[var(--tc-text-secondary,#4B5563)]">
          Visao principal com graficos de runs e metricas ajustada diretamente na plataforma.
        </p>
      </div>
      <div className="mt-4">
        <DashboardPage showHeader={false} />
      </div>
    </div>
  );
}
