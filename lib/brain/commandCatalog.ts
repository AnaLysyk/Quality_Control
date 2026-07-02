export type BrainCommandRisk = "low" | "medium" | "high";

export type BrainCommandDefinition = {
  command: string;
  description: string;
  requiredPermission: string;
  parameters: Array<{
    name: string;
    type: "string" | "number" | "boolean";
    required?: boolean;
    description: string;
  }>;
  example: string;
  risk: BrainCommandRisk;
  requiresConfirmation: boolean;
  allowedScopes?: Array<"company" | "project" | "entity" | "global">;
};

export const BRAIN_COMMAND_CATALOG: BrainCommandDefinition[] = [
  {
    command: "/focar",
    description: "Define um nó como foco principal de investigação.",
    requiredPermission: "brain:read",
    parameters: [{ name: "entity", type: "string", required: true, description: "ID/chave da entidade" }],
    example: "/focar TC-1042",
    risk: "low",
    requiresConfirmation: false,
    allowedScopes: ["entity", "company", "project"],
  },
  {
    command: "/expandir",
    description: "Expande vizinhança de um nó no grafo.",
    requiredPermission: "brain:read",
    parameters: [
      { name: "entity", type: "string", required: true, description: "ID/chave da entidade" },
      { name: "depth", type: "number", description: "Profundidade da expansão (1-4)" },
    ],
    example: "/expandir TC-1042 depth=2",
    risk: "low",
    requiresConfirmation: false,
    allowedScopes: ["entity", "company", "project"],
  },
  {
    command: "/explicar-relacao",
    description: "Explica caminho ou relação entre duas entidades.",
    requiredPermission: "brain:read",
    parameters: [
      { name: "from", type: "string", required: true, description: "Entidade origem" },
      { name: "to", type: "string", required: true, description: "Entidade destino" },
    ],
    example: "/explicar-relacao TC-1042 RUN-009",
    risk: "low",
    requiresConfirmation: false,
    allowedScopes: ["entity", "company", "project"],
  },
  {
    command: "/investigar",
    description: "Abre investigação guiada para uma entidade.",
    requiredPermission: "brain:read",
    parameters: [{ name: "entity", type: "string", required: true, description: "Entidade alvo" }],
    example: "/investigar RUN-009",
    risk: "low",
    requiresConfirmation: false,
    allowedScopes: ["entity", "company", "project"],
  },
  {
    command: "/impacto",
    description: "Calcula impacto em cadeia da entidade no grafo.",
    requiredPermission: "brain:read",
    parameters: [{ name: "entity", type: "string", required: true, description: "Entidade alvo" }],
    example: "/impacto TC-1042",
    risk: "medium",
    requiresConfirmation: false,
    allowedScopes: ["entity", "company", "project"],
  },
  {
    command: "/lacunas",
    description: "Lista lacunas operacionais e de rastreabilidade.",
    requiredPermission: "brain:read",
    parameters: [{ name: "company", type: "string", description: "Slug da empresa" }],
    example: "/lacunas griaule",
    risk: "low",
    requiresConfirmation: false,
    allowedScopes: ["company", "project"],
  },
  {
    command: "/reindexar",
    description: "Reindexa empresa, projeto ou entidade no Brain.",
    requiredPermission: "brain:reindex",
    parameters: [{ name: "scope", type: "string", required: true, description: "company|project|entity" }],
    example: "/reindexar projeto griaule-cidadao-smart",
    risk: "high",
    requiresConfirmation: true,
    allowedScopes: ["company", "project", "entity"],
  },
  {
    command: "/memorizar",
    description: "Cria memória operacional no Brain.",
    requiredPermission: "brain:write",
    parameters: [{ name: "texto", type: "string", required: true, description: "Conteúdo da memória" }],
    example: "/memorizar decisao",
    risk: "medium",
    requiresConfirmation: false,
    allowedScopes: ["entity", "company", "project"],
  },
  {
    command: "/arquivar-memoria",
    description: "Arquiva memória existente no Brain.",
    requiredPermission: "brain:write",
    parameters: [{ name: "memoryId", type: "string", required: true, description: "ID da memória" }],
    example: "/arquivar memoria mem_123",
    risk: "medium",
    requiresConfirmation: true,
    allowedScopes: ["entity", "company", "project"],
  },
  {
    command: "/mesclar-nos",
    description: "Solicita mesclagem de nós duplicados.",
    requiredPermission: "brain:write",
    parameters: [
      { name: "nodeA", type: "string", required: true, description: "Nó principal" },
      { name: "nodeB", type: "string", required: true, description: "Nó secundário" },
    ],
    example: "/mesclar-nos NODE_A NODE_B",
    risk: "high",
    requiresConfirmation: true,
    allowedScopes: ["entity", "company", "project"],
  },
  {
    command: "/mostrar-scripts-quebrados",
    description: "Mostra scripts com status quebrado/flaky.",
    requiredPermission: "brain:read",
    parameters: [],
    example: "/mostrar scripts quebrados",
    risk: "low",
    requiresConfirmation: false,
    allowedScopes: ["company", "project", "global"],
  },
  {
    command: "/mostrar-casos-sem-automacao",
    description: "Mostra casos sem vínculo de automação.",
    requiredPermission: "brain:read",
    parameters: [],
    example: "/mostrar casos sem automacao",
    risk: "low",
    requiresConfirmation: false,
    allowedScopes: ["company", "project", "global"],
  },
  {
    command: "/mostrar-usuarios-sem-empresa",
    description: "Mostra usuários sem vínculo de empresa.",
    requiredPermission: "brain:read-sensitive",
    parameters: [],
    example: "/mostrar usuarios sem empresa",
    risk: "medium",
    requiresConfirmation: false,
    allowedScopes: ["global"],
  },
  {
    command: "/mostrar-defeitos-sem-run",
    description: "Mostra defeitos sem vínculo de run.",
    requiredPermission: "brain:read",
    parameters: [],
    example: "/mostrar defeitos sem run",
    risk: "low",
    requiresConfirmation: false,
    allowedScopes: ["company", "project", "global"],
  },
  {
    command: "/gerar-relatorio-brain",
    description: "Gera relatório operacional do Brain.",
    requiredPermission: "brain:read",
    parameters: [{ name: "company", type: "string", description: "Slug da empresa" }],
    example: "/gerar-relatorio brain",
    risk: "medium",
    requiresConfirmation: false,
    allowedScopes: ["company", "project", "global"],
  },
];

export function getBrainCommandDefinition(command: string) {
  return BRAIN_COMMAND_CATALOG.find((item) => item.command === command);
}

