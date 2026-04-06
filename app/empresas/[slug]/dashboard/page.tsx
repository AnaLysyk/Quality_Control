import { notFound } from "next/navigation";
import CompanyIntelligenceDashboardClient from "./CompanyIntelligenceDashboardClient";
import { loadCompanyDashboardData } from "./companyDashboardData";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CompanyDashboardPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadCompanyDashboardData(slug);

  if (!data) {
    notFound();
  }

  return <CompanyIntelligenceDashboardClient {...data} />;
}
