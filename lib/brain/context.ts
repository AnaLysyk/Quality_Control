import "server-only";

export type BrainScreenContext = {
  route?: string | null;
  pathname?: string | null;
  module?: string | null;
  companySlug?: string | null;
  recordId?: string | null;
  modal?: string | null;
  drawer?: string | null;
  tab?: string | null;
  selectedItem?: string | null;
  filter?: string | null;
  pagination?: { page?: number; pageSize?: number } | null;
  allowedActions?: string[];
  permissions?: string[];
  userId?: string | null;
  userName?: string | null;
};

export function summarizeBrainScreenContext(context: BrainScreenContext) {
  return [
    context.pathname ? `rota: ${context.pathname}` : null,
    context.module ? `modulo: ${context.module}` : null,
    context.companySlug ? `empresa: ${context.companySlug}` : null,
    context.recordId ? `registro: ${context.recordId}` : null,
    context.modal ? `modal: ${context.modal}` : null,
    context.drawer ? `drawer: ${context.drawer}` : null,
    context.tab ? `aba: ${context.tab}` : null,
    context.selectedItem ? `selecionado: ${context.selectedItem}` : null,
    context.filter ? `filtro: ${context.filter}` : null,
    context.pagination ? `pagina: ${context.pagination.page ?? 1}/${context.pagination.pageSize ?? 0}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}


