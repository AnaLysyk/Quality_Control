import TestCaseRepositoryClient from "./TestCaseRepositoryClient";
import styles from "./repository-clean.module.css";

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
    return (
      <main className={styles.repositoryPage}>
        <TestCaseRepositoryClient initialCompanySlug={companySlug} lockCompanyScope />
      </main>
    );
  }

  return (
    <main className={styles.repositoryPage}>
      <TestCaseRepositoryClient />
    </main>
  );
}
