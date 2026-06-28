export const dynamic = "force-dynamic";

import BrainPageClient from "@/admin/brain/BrainPageClient";
import { registerScreen } from "@/lib/brain/registry";

registerScreen({
  id: "brain-graph",
  title: "Brain",
  description: "Grafo de conhecimento, agentes e contexto operacional do sistema.",
  module: "brain",
  entity: "graph",
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
  title: "Brain - Cerebro do QA",
};

export default function BrainPage() {
  return <BrainPageClient />;
}
