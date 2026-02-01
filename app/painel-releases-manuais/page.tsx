import ReleaseManualList from "../components/ReleaseManualList";
import DefectList from "../components/DefectList";

// Substitua pelo companyId real e, se desejar, pelo releaseManualId real
const COMPANY_ID = "ID_DA_EMPRESA_AQUI";
const RELEASE_MANUAL_ID = undefined; // ou "ID_DO_RELEASE_MANUAL"

export default function PainelReleasesManuais() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold mb-6">Painel de Releases Manuais e Defeitos</h1>
      <ReleaseManualList companyId={COMPANY_ID} />
      <DefectList companyId={COMPANY_ID} releaseManualId={RELEASE_MANUAL_ID} />
    </div>
  );
}
