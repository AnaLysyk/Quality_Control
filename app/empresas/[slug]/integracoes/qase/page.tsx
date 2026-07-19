import CompanyIntegrationsClient from "../CompanyIntegrationsClient";

export const dynamic = "force-dynamic";

export default async function CompanyQaseIntegrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CompanyIntegrationsClient companySlug={slug} provider="qase" />;
}
