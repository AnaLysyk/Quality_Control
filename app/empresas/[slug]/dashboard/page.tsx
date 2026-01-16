import DashboardPage from "@/dashboard/page";
import Breadcrumb from "@/components/Breadcrumb";

export default async function EmpresaDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "empresa";
  const companyName =
    slug === "griaule"
      ? "Griaule"
      : slug
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-10">
        <div className="space-y-2">
          <Breadcrumb
            items={[
              { label: "Empresas", href: "/empresas" },
              {
                label: companyName,
                href: `/empresas/${encodeURIComponent(slug)}/home`,
                title: companyName,
              },
              { label: "Dashboard" },
            ]}
          />

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-(--tc-text-primary,#0b1a3c)">
            Dashboard da empresa
          </h1>
          <p className="text-sm sm:text-base text-(--tc-text-secondary,#4b5563)">
            Visão principal com gráficos de runs e métricas ajustada diretamente na plataforma.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-4 w-full max-w-7xl px-4 sm:mt-6 sm:px-6 lg:px-10">
        <DashboardPage />
      </div>
    </div>
  );
}
