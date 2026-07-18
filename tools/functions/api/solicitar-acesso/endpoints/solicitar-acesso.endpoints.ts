export const endpointsSolicitarAcesso = {
  criarPublica: "/api/access-requests/public",
  listarAdministrativo: "/api/admin/access-requests",
  consultarPorChave: (chave: string) =>
    `/api/access-requests/by-key/${encodeURIComponent(chave)}`,
  aprovar: (id: string) => `/api/admin/access-requests/${encodeURIComponent(id)}/accept`,
  rejeitar: (id: string) => `/api/admin/access-requests/${encodeURIComponent(id)}/reject`,
  solicitarAjuste: (id: string) =>
    `/api/admin/access-requests/${encodeURIComponent(id)}/request-adjustment`,
  reenviarConsulta: "/api/support/access-request/lookup",
} as const;

export const endpointsAutenticacao = {
  login: "/api/auth/login",
  usuarioAtual: "/api/me",
  esqueciSenha: "/api/auth/forgot-password",
  validarRedefinicao: "/api/auth/reset-password/validate",
  confirmarRedefinicao: "/api/auth/reset-password/confirm",
} as const;

