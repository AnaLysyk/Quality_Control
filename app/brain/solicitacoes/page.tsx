import { BrainAccessRequestFlowPanel } from "../_components/BrainAccessRequestFlowPanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Brain - Solicitações",
  description: "Trilha de solicitações públicas no Brain",
};

export default function BrainSolicitacoesPage() {
  return (
    <main className="space-y-5">
      <BrainAccessRequestFlowPanel />
    </main>
  );
}
