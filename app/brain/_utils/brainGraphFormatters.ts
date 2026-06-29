import type { BrainNodeStatus, BrainNodeType } from "../_types/brain.types";

export function normalizeBrainText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function statusLabel(status: string) {
  if (status === "closed") return "Aprovada";
  if (status === "rejected") return "Rejeitada";
  if (status === "in_progress") return "Aguardando ajuste";
  if (status === "open") return "Aberta";
  return status || "Nao informado";
}

export function nodeTypeLabel(type: BrainNodeType) {
  const labels: Record<BrainNodeType, string> = {
    module: "Modulo",
    company: "Empresa",
    project: "Projeto",
    screen: "Tela",
    entity: "Entidade",
    person: "Pessoa",
    access_request: "Solicitacao",
    requester: "Solicitante",
    profile: "Perfil",
    status: "Status",
    action: "Acao",
    event: "Evento",
    permission: "Permissao",
    log: "Log",
    email: "E-mail",
    comment: "Comentario",
    document: "Documento",
    defect: "Defeito",
    automation: "Automacao",
    test_case: "Caso de teste",
    execution: "Execucao",
    pdf: "PDF",
    adjustment: "Ajuste",
    decision: "Decisao",
  };
  return labels[type] ?? type;
}

export function nodeStatusLabel(status?: BrainNodeStatus) {
  if (status === "ok") return "ok";
  if (status === "warning") return "atencao";
  if (status === "missing") return "nao encontrado";
  if (status === "pending") return "pendente";
  if (status === "error") return "erro";
  if (status === "orphan") return "orfao";
  return "ok";
}

export function formatCounter(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Nao informado";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

export function makeStableId(prefix: string, value: string) {
  return `${prefix}:${normalizeBrainText(value || "nao-informado")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "nao-informado"}`;
}
