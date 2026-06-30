import TestCaseRepositoryClient from "./TestCaseRepositoryClient";
import TestCaseRepositoryImportExportPanel from "./TestCaseRepositoryImportExportPanel";

export const dynamic = "force-dynamic";

export default function CasosDeTestePage() {
  return (
    <>
      <TestCaseRepositoryImportExportPanel />
      <TestCaseRepositoryClient />
    </>
  );
}
