import CompanyTestCasesRepositoryClient from "../components/CompanyTestCasesRepositoryClient";
import TestCaseRepositoryClient from "./TestCaseRepositoryClient";
import TestCaseRepositoryImportExportPanel from "./TestCaseRepositoryImportExportPanel";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CasosDeTestePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const companySlug = firstParam(resolvedSearchParams?.companySlug)?.trim();

  if (companySlug) {
    return <CompanyTestCasesRepositoryClient initialCompanySlug={companySlug} />;
  }

  return (
    <>
      <TestCaseRepositoryImportExportPanel />
      <TestCaseRepositoryClient />
    </>
  );
}
