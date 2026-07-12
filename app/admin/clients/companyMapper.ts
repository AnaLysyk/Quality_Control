// Módulo puro (sem React/Next) para o mapeamento de GET /api/companies -> Client
// usado por app/admin/clients/page.tsx. Extraído para ser testável sem montar
// a tela inteira.
export type Client = {
  id: string;
  name: string;
  slug?: string | null;
  taxId?: string | null;
  address?: string | null;
  description?: string | null;
  website?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  docsLink?: string | null;
  linkedinUrl?: string | null;
  notes?: string | null;
  integrationMode?: "qase" | "manual" | null;
  qaseProjectCode?: string | null;
  qaseProjectCodes?: string[] | null;
  qaseToken?: string | null;
  hasQaseToken?: boolean;
  jiraBaseUrl?: string | null;
  jiraEmail?: string | null;
  jiraApiToken?: string | null;
  hasJiraToken?: boolean;
  notificationsFanoutEnabled?: boolean;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

// A API (GET /api/companies) nunca devolve o valor do token, só um booleano
// de presença (hasQaseToken/hasJiraToken). qaseToken/jiraApiToken só existem
// no estado do front quando o próprio usuário os digita no formulário de
// edição — nunca vêm da API.
export function hasQaseTokenConfigured(client?: Partial<Client> | null) {
  if (!client) return false;
  if (typeof client.qaseToken === "string") return client.qaseToken.trim().length > 0;
  return client.hasQaseToken === true;
}

export function hasJiraTokenConfigured(client?: Partial<Client> | null) {
  if (!client) return false;
  if (typeof client.jiraApiToken === "string") return client.jiraApiToken.trim().length > 0;
  return client.hasJiraToken === true;
}

export function mapClient(row: Record<string, unknown>): Client {
  const name =
    typeof row.name === "string"
      ? row.name
      : typeof row.company_name === "string"
        ? row.company_name
        : "";

  const id = typeof row.id === "string" ? row.id : String(row.id ?? "");

  const readNullableString = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);
  const readBoolean = (value: unknown) => (typeof value === "boolean" ? value : false);
  const readProjectCodes = (value: unknown): string[] | null => {
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value as string[];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const arr = trimmed
        .split(/[\s,;|]+/g)
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean);
      return arr.length ? Array.from(new Set(arr)) : null;
    }
    return null;
  };

  return {
    id,
    name,
    slug: readNullableString(row.slug),
    taxId: readNullableString(row.tax_id),
    address: readNullableString(row.address),
    description: readNullableString(row.description),
    website: readNullableString(row.website),
    phone: readNullableString(row.phone),
    logoUrl: readNullableString(row.logo_url),
    docsLink: readNullableString(row.docs_link),
    linkedinUrl: readNullableString(row.linkedin_url) ?? readNullableString(row.docs_link),
    notes: readNullableString(row.notes),
    integrationMode: readNullableString(row.integration_mode) as "qase" | "manual" | null,
    qaseProjectCode: readNullableString(row.qase_project_code),
    qaseProjectCodes: readProjectCodes(row.qase_project_codes),
    // A API (GET /api/companies) não devolve mais tokens crus nem o array
    // integrations[] completo (redigidos no backend). qaseToken/jiraApiToken
    // ficam sempre null aqui — só existem quando o próprio usuário os digita
    // no formulário de edição. Presença de integração vem só como booleano.
    qaseToken: null,
    hasQaseToken: readBoolean(row.hasQaseToken),
    jiraBaseUrl: readNullableString(row.jira_base_url),
    jiraEmail: readNullableString(row.jira_email),
    jiraApiToken: null,
    hasJiraToken: readBoolean(row.hasJiraToken),
    notificationsFanoutEnabled: typeof row.notifications_fanout_enabled === "boolean" ? row.notifications_fanout_enabled : true,
    active: readBoolean(row.active),
    createdAt: readNullableString(row.created_at),
    updatedAt: readNullableString(row.updated_at),
  };
}
