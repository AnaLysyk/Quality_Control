export type ClientOption = { id: string; name: string };

export type RawSupportRequest = {
  id: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
  admin_notes?: string | null;
};

export type AccessTypeLabel = "Usuario da empresa" | "Admin da empresa" | "Admin do sistema";

export type AccessRequestItem = {
  id: string;
  createdAt: string;
  status: string;
  email: string;
  name: string;
  jobRole: string;
  accessType: AccessTypeLabel;
  clientId: string | null;
  company: string;
  notes: string;
  rawMessage: string;
  adminNotes: string | null;
};

export function parseAccessType(accessType: unknown): AccessTypeLabel {
  if (accessType === "admin") return "Admin do sistema";
  if (accessType === "company") return "Admin da empresa";
  return "Usuario da empresa";
}

export function parseFromMessage(message: string, fallbackEmail: string): Partial<AccessRequestItem> {
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
        accessType: parseAccessType(json.accessType),
        notes: typeof json.notes === "string" ? json.notes : "",
      };
    } catch {
      /* ignore malformed JSON */
    }
  }

  const lines = message.split("\n").map((l) => l.trim());
  const find = (label: string) => {
    const hit = lines.find((l) => l.toLowerCase().startsWith(label.toLowerCase() + ":"));
    return hit ? hit.slice(label.length + 1).trim() : "";
  };

  return {
    email: fallbackEmail,
    name: find("Nome"),
    jobRole: find("Cargo"),
    company: find("Empresa"),
    accessType: "Usuario da empresa",
    notes: find("Observacoes") || find("Mensagem"),
    clientId: null,
  };
}
