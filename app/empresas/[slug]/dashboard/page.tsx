import { notFound } from "next/navigation";
import CompanyIntelligenceDashboardClient from "./CompanyIntelligenceDashboardClient";
import { loadCompanyDashboardData } from "./companyDashboardData";
import { applyProjectDashboardScope } from "./projectDashboardScope";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    projectSlug?: string;
    projectCode?: string;
    project?: string;
    qaseProjectCode?: string;
  }>;
};

export default async function CompanyDashboardPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const data = await loadCompanyDashboardData(slug);

  if (!data) {
    notFound();
  }

  const scopedData = applyProjectDashboardScope(data, {
    projectSlug: query.projectSlug ?? query.project ?? null,
    projectCode: query.projectCode ?? query.qaseProjectCode ?? null,
  });

  return <CompanyIntelligenceDashboardClient {...scopedData} />;
}
