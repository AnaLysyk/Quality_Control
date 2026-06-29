export const dynamic = "force-dynamic";

import { registerScreen } from "@/lib/brain/registry";
import { BrainDashboard } from "../../brain/_components/BrainDashboard";

registerScreen({
  id: "admin-brain",
  title: "Brain",
  description: "Central operacional do grafo, agentes e contexto do sistema.",
  module: "admin",
  entity: "brain",
  permissions: ["brain:read"],
  actions: [
    {
      id: "open-agent-panel",
      label: "Abrir agente",
      description: "Abre a experiencia de agente sobre o no selecionado.",
      kind: "open-modal",
    },
  ],
  workflows: ["graph-exploration", "agent-analysis", "memory-review"],
  documentation: [
    "docs/brian/brain-architecture-roadmap.md",
    "docs/brain/brain-knowledge-platform-prd.md",
  ],
  examples: [
    "Analise o no selecionado e sugira proximos passos.",
    "Explique o contexto da tela atual.",
  ],
});

export const metadata = {
  title: "Brain — Cérebro do QA",
};

export default function BrainPage() {
  return <BrainDashboard />;
}
