export const perfisAutorizadosSolicitacoes = [
  {
    label: "Líder TC",
    role: "leader_tc",
    email: "e2e-leader-tc@testingcompany.local",
    name: "E2E Líder TC",
  },
  {
    label: "Suporte Técnico",
    role: "technical_support",
    email: "e2e-suporte@testingcompany.local",
    name: "E2E Suporte Técnico",
  },
  {
    label: "Empresa",
    role: "company",
    email: "e2e-empresa@empresa.local",
    name: "E2E Empresa",
  },
] as const;

export const perfisNegadosSolicitacoes = [
  {
    label: "Usuário Testing Company",
    role: "user",
    email: "e2e-user-tc@testingcompany.local",
    name: "E2E Usuário TC",
  },
  {
    label: "Usuário da empresa",
    role: "user",
    email: "e2e-company-user@empresa.local",
    name: "E2E Usuário Empresa",
  },
] as const;

export const rotaSolicitacoes = "/admin/access-requests";
export const rotaSolicitacoesRemovida = "/admin/requests";
