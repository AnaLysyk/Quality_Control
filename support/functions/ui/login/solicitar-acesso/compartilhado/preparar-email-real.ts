export type PerfilEmailRealSolicitacao = {
  label: string;
  value: string;
  needsExistingCompany: boolean;
};

export const perfisEmailRealSolicitacao: PerfilEmailRealSolicitacao[] = [
  {
    label: "Usuário da empresa",
    value: "company_user",
    needsExistingCompany: true,
  },
  {
    label: "Usuário TC",
    value: "testing_company_user",
    needsExistingCompany: false,
  },
  {
    label: "Líder TC",
    value: "leader_tc",
    needsExistingCompany: false,
  },
  {
    label: "Suporte Técnico",
    value: "technical_support",
    needsExistingCompany: false,
  },
];

export function criarEmailRealUnico(profileValue: string, unique: number, realEmail: string) {
  const [user, domain] = realEmail.split("@");
  return `${user}+${profileValue}.${unique}@${domain}`;
}
