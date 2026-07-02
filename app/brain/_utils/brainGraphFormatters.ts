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
  return status || "NÃ£o informado";
}

export function nodeTypeLabel(type: BrainNodeType) {
  const labels: Record<BrainNodeType, string> = {
    module: "MÃ³dulo",
    company: "Empresa",
    project: "Projeto",
    screen: "Tela",
    entity: "Entidade",
    person: "Pessoa",
    access_request: "SolicitaÃ§Ã£o",
    requester: "Solicitante",
    profile: "Perfil",
    status: "Status",
    action: "AÃ§Ã£o",
    integration: "IntegraÃ§Ã£o",
    event: "Evento",
    permission: "PermissÃ£o",
    log: "Log",
    email: "E-mail",
    comment: "ComentÃ¡rio",
    document: "Documento",
    defect: "Defeito",
    automation: "AutomaÃ§Ã£o",
    test_case: "Caso de teste",
    execution: "ExecuÃ§Ã£o",
    pdf: "PDF",
    adjustment: "Ajuste",
    decision: "DecisÃ£o",
  };
  return labels[type] ?? type;
}

export function nodeStatusLabel(status?: BrainNodeStatus) {
  if (status === "ok") return "ok";
  if (status === "warning") return "atenÃ§Ã£o";
  if (status === "missing") return "nÃ£o encontrado";
  if (status === "pending") return "pendente";
  if (status === "error") return "erro";
  if (status === "orphan") return "Ã³rfÃ£o";
  return "ok";
}

export function formatCounter(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "NÃ£o informado";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

export function makeStableId(prefix: string, value: string) {
  return `${prefix}:${normalizeBrainText(value || "nao-informado")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "nao-informado"}`;
}

