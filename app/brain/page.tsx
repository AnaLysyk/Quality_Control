import { BrainDashboard } from "./_components/BrainDashboard";
import { BrainUtilitiesPanel } from "./_components/BrainUtilitiesPanel";
import { registerScreen } from "@/lib/brain/registry";

export const dynamic = "force-dynamic";

registerScreen({
  id: "brain-dashboard",
  title: "Brain",
  description: "Mapa de conhecimento, acoes e utilitarios do Quality Control com recorte de Solicitacoes de acesso.",
  module: "brain",
  entity: "graph",
  permissions: ["brain:read", "brain:use"],
  actions: [
    {
      id: "open-access-requests",
      label: "Abrir Solicitacoes de acesso",
      description: "Navega para a central administrativa de solicitacoes de acesso.",
      kind: "navigate",
      route: "/admin/access-requests",
    },
  ],
  workflows: ["access-request-graph", "brain-dashboard", "knowledge-gap-review", "brain-utilities"],
  documentation: ["docs/brain/brain-knowledge-platform-prd.md"],
  examples: [
    "Tem no para todas as solicitacoes?",
    "O que falta mapear?",
    "Mostrar logs das solicitacoes.",
    "Contar caracteres desta nota executiva.",
    "Converter este anexo para PDF.",
  ],
});

export const metadata = {
  title: "Brain",
  description: "Mapa de conhecimento, acoes e utilitarios do Quality Control",
};

export default function BrainPage() {
  return (
    <div className="space-y-5">
      <BrainUtilitiesPanel />
      <BrainDashboard />
    </div>
  );
}
