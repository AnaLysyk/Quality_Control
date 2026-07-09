import TestCaseRepositoryClient from "../../../casos-de-teste/TestCaseRepositoryClient";

export const dynamic = "force-dynamic";

type CompanyTestCasesPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CompanyTestCasesPage({ params }: CompanyTestCasesPageProps) {
  const { slug } = await params;
  return <TestCaseRepositoryClient initialCompanySlug={slug} lockCompanyScope />;
}
