import "server-only";

export type AccessType = "user" | "admin" | "company";
export type AccessTypeLabel = "Usuário da empresa" | "Admin da empresa" | "Admin do sistema";

export type ParsedAccessRequest = {
  email: string;
  name: string;
  jobRole: string;
  company: string;
  clientId: string | null;
  accessType: AccessType;
  notes: string;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function toAccessTypeLabel(accessType: AccessType): AccessTypeLabel {
  if (accessType === "admin") return "Admin do sistema";
  if (accessType === "company") return "Admin da empresa";
  return "Usuário da empresa";
}

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

export function extractAdminNotes(message: string): string | null {
  const line = message.split("\n").find((l) => l.startsWith("ADMIN_NOTES:"));
  if (!line) return null;
  const notes = line.slice("ADMIN_NOTES:".length).trim();
  return notes || null;
}

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
