export const endpointsTelaSolicitacoes = {
  listar: "/api/admin/access-requests",
  listarEmpresas: "/api/clients",
  listarUsuarios: "/api/admin/users",
  detalhes: (id: string) => `/api/admin/access-requests/${encodeURIComponent(id)}`,
  comentarios: (id: string) =>
    `/api/admin/access-requests/${encodeURIComponent(id)}/comments`,
  aprovar: (id: string) => `/api/admin/access-requests/${encodeURIComponent(id)}/accept`,
  rejeitar: (id: string) => `/api/admin/access-requests/${encodeURIComponent(id)}/reject`,
  solicitarAjuste: (id: string) =>
    `/api/admin/access-requests/${encodeURIComponent(id)}/request-adjustment`,
} as const;
