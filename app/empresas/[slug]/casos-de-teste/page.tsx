import CompanyTestCasesRepositoryClient from "../../../components/CompanyTestCasesRepositoryClient";

export const dynamic = "force-dynamic";

type CompanyTestCasesPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CompanyTestCasesPage({ params }: CompanyTestCasesPageProps) {
  const { slug } = await params;
  return <CompanyTestCasesRepositoryClient initialCompanySlug={slug} />;
}
