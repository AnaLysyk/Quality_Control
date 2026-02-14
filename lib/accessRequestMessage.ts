
// Utilitários para parsing e normalização de pedidos de acesso
import "server-only";

/**
 * Tipos de acesso possíveis em pedidos de acesso.
 */
export type AccessType = "user" | "admin" | "company";

/**
 * Labels legíveis para tipos de acesso.
 */
export type AccessTypeLabel = "Usuário da empresa" | "Admin da empresa" | "Admin do sistema";

/**
 * Estrutura de um pedido de acesso parseado.
 */
export type ParsedAccessRequest = {
  /** Email do solicitante */
  email: string;
  /** Nome do solicitante */
  name: string;
  /** Cargo do solicitante */
  jobRole: string;
  /** Empresa */
  company: string;
  /** ID do cliente (opcional) */
  clientId: string | null;
  /** Tipo de acesso solicitado */
  accessType: AccessType;
  /** Observações */
  notes: string;
};


/**
 * Normaliza texto para comparação (trim + lower).
 */
function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Converte tipo de acesso em label legível.
 */
export function toAccessTypeLabel(accessType: AccessType): AccessTypeLabel {
  if (accessType === "admin") return "Admin do sistema";
  if (accessType === "company") return "Admin da empresa";
  return "Usuário da empresa";
}

/**
 * Normaliza string para tipo de acesso canônico.
 */
export function normalizeAccessType(value: string | null | undefined): AccessType | null {
  if (!value) return null;
  const v = normalizeText(value);
  if (
    v === "usuario da empresa" ||
    v === "usuário da empresa" ||
    v === "usuÃ¡rio da empresa" ||
    v === "usuario" ||
    v === "user" ||
    v === "common"
  ) {
    return "user";
  }
  if (v === "admin do sistema" || v === "administrador do sistema" || v === "administrador" || v === "admin") {
    return "admin";
  }
  if (v === "admin da empresa" || v === "administrador da empresa" || v === "empresa" || v === "company") {
    return "company";
  }
  return null;
}

/**
 * Extrai observações administrativas de uma mensagem de acesso.
 */
export function extractAdminNotes(message: string): string | null {
  const line = message.split("\n").find((l) => l.startsWith("ADMIN_NOTES:"));
  if (!line) return null;
  const notes = line.slice("ADMIN_NOTES:".length).trim();
  return notes || null;
}

/**
 * Faz o parsing de uma mensagem de pedido de acesso, extraindo campos estruturados.
 */
export function parseAccessRequestMessage(message: string, fallbackEmail: string): ParsedAccessRequest {
  const prefix = "ACCESS_REQUEST_V1 ";
  const line = message.split("\n").find((l) => l.startsWith(prefix));
  if (line) {
    try {
      const json = JSON.parse(line.slice(prefix.length)) as Record<string, unknown>;
      return {
        email: typeof json.email === "string" ? json.email : fallbackEmail,
        name: typeof json.name === "string" ? json.name : "",
        jobRole: typeof json.jobRole === "string" ? json.jobRole : "",
        company: typeof json.company === "string" ? json.company : "",
        clientId: typeof json.clientId === "string" ? json.clientId : null,
        accessType: normalizeAccessType(typeof json.accessType === "string" ? json.accessType : "") ?? "user",
        notes: typeof json.notes === "string" ? json.notes : "",
      };
    } catch {
      // fallthrough
    }
  }

  const lines = message.split("\n").map((l) => l.trim());
  const find = (label: string) => {
    const hit = lines.find((l) => normalizeText(l).startsWith(normalizeText(label) + ":"));
    return hit ? hit.slice(label.length + 1).trim() : "";
  };

  return {
    email: fallbackEmail,
    name: find("Nome"),
    jobRole: find("Cargo"),
    company: find("Empresa"),
    clientId: null,
    accessType: "user",
    notes: find("Observacoes") || find("Mensagem"),
  };
}
