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
    description: "Define um nÃ³ como foco principal de investigaÃ§Ã£o.",
    requiredPermission: "brain:read",
    parameters: [{ name: "entity", type: "string", required: true, description: "ID/chave da entidade" }],
    example: "/focar TC-1042",
    risk: "low",
    requiresConfirmation: false,
    allowedScopes: ["entity", "company", "project"],
  },
  {
    command: "/expandir",
    description: "Expande vizinhanÃ§a de um nÃ³ no grafo.",
    requiredPermission: "brain:read",
    parameters: [
      { name: "entity", type: "string", required: true, description: "ID/chave da entidade" },
      { name: "depth", type: "number", description: "Profundidade da expansÃ£o (1-4)" },
    ],
    example: "/expandir TC-1042 depth=2",
    risk: "low",
    requiresConfirmation: false,
    allowedScopes: ["entity", "company", "project"],
  },
  {
    command: "/explicar-relacao",
    description: "Explica caminho ou relaÃ§Ã£o entre duas entidades.",
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
    description: "Abre investigaÃ§Ã£o guiada para uma entidade.",
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
    description: "Cria memÃ³ria operacional no Brain.",
    requiredPermission: "brain:write",
    parameters: [{ name: "texto", type: "string", required: true, description: "ConteÃºdo da memÃ³ria" }],
    example: "/memorizar decisao",
    risk: "medium",
    requiresConfirmation: false,
    allowedScopes: ["entity", "company", "project"],
  },
  {
    command: "/arquivar-memoria",
    description: "Arquiva memÃ³ria existente no Brain.",
    requiredPermission: "brain:write",
    parameters: [{ name: "memoryId", type: "string", required: true, description: "ID da memÃ³ria" }],
    example: "/arquivar memoria mem_123",
    risk: "medium",
    requiresConfirmation: true,
    allowedScopes: ["entity", "company", "project"],
  },
  {
    command: "/mesclar-nos",
    description: "Solicita mesclagem de nÃ³s duplicados.",
    requiredPermission: "brain:write",
    parameters: [
      { name: "nodeA", type: "string", required: true, description: "NÃ³ principal" },
      { name: "nodeB", type: "string", required: true, description: "NÃ³ secundÃ¡rio" },
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
    description: "Mostra casos sem vÃ­nculo de automaÃ§Ã£o.",
    requiredPermission: "brain:read",
    parameters: [],
    example: "/mostrar casos sem automacao",
    risk: "low",
    requiresConfirmation: false,
    allowedScopes: ["company", "project", "global"],
  },
  {
    command: "/mostrar-usuarios-sem-empresa",
    description: "Mostra usuÃ¡rios sem vÃ­nculo de empresa.",
    requiredPermission: "brain:read-sensitive",
    parameters: [],
    example: "/mostrar usuarios sem empresa",
    risk: "medium",
    requiresConfirmation: false,
    allowedScopes: ["global"],
  },
  {
    command: "/mostrar-defeitos-sem-run",
    description: "Mostra defeitos sem vÃ­nculo de run.",
    requiredPermission: "brain:read",
    parameters: [],
    example: "/mostrar defeitos sem run",
    risk: "low",
    requiresConfirmation: false,
    allowedScopes: ["company", "project", "global"],
  },
  {
    command: "/gerar-relatorio-brain",
    description: "Gera relatÃ³rio operacional do Brain.",
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

