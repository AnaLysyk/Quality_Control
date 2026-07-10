import TestCaseRepositoryClientV2 from "../../../casos-de-teste/TestCaseRepositoryClientV2";
import styles from "../../../casos-de-teste/repository-clean.module.css";

export const dynamic = "force-dynamic";

type CompanyTestCasesPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CompanyTestCasesPage({ params }: CompanyTestCasesPageProps) {
  const { slug } = await params;

  return (
    <main className={styles.repositoryPage}>
      <TestCaseRepositoryClientV2 initialCompanySlug={slug} lockCompanyScope />
    </main>
  );
}
