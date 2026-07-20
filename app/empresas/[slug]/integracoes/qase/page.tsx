import CompanyIntegrationsClient from "../CompanyIntegrationsClient";

export const dynamic = "force-dynamic";

type CompanyIntegrationPageProps = Readonly<{ params: Promise<{ slug: string }> }>;

export default async function CompanyQaseIntegrationPage({ params }: CompanyIntegrationPageProps) {
  const { slug } = await params;
  return <CompanyIntegrationsClient companySlug={slug} provider="qase" />;
}
