import { notFound } from "next/navigation";
import CompanyRunsHomeClient from "../home/CompanyRunsHomeClient";
import { loadCompanyDashboardData } from "../dashboard/companyDashboardData";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CompanyMetricsPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadCompanyDashboardData(slug);

  if (!data) {
    notFound();
  }

  return (
    <CompanyRunsHomeClient
      companySlug={data.companySlug}
      companyName={data.companyName}
      companyInitials={data.companyInitials}
      subtitle={data.subtitle}
      companyStatus={data.companyStatus}
      integrationStatus={data.integrationStatus}
      heroStats={data.heroStats}
      runs={data.runs}
      variant="metrics"
    />
  );
}
