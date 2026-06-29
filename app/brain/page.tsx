import { BrainDashboard } from "./_components/BrainDashboard";
import { registerScreen } from "@/lib/brain/registry";

export const dynamic = "force-dynamic";

registerScreen({
  id: "brain-dashboard",
  title: "Brain",
  description: "Mapa de conhecimento e acoes do Quality Control com recorte de Solicitacoes de acesso.",
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
  workflows: ["access-request-graph", "brain-dashboard", "knowledge-gap-review"],
  documentation: ["docs/brain/brain-knowledge-platform-prd.md"],
  examples: [
    "Tem no para todas as solicitacoes?",
    "O que falta mapear?",
    "Mostrar logs das solicitacoes.",
  ],
});

export const metadata = {
  title: "Brain",
  description: "Mapa de conhecimento e acoes do Quality Control",
};

export default function BrainPage() {
  return <BrainDashboard />;
}
