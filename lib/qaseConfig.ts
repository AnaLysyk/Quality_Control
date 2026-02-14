
/**
 * Configuração de integração com Qase para um cliente/projeto.
 */
type QaseSettings = {
  /** Identificador do cliente/projeto (slug) */
  slug: string;
  /** Código do projeto Qase principal */
  projectCode?: string;
  /** Lista de códigos de projetos Qase adicionais */
  projectCodes?: string[];
  /** Token de API Qase */
  token?: string;
  /** URL base da API Qase */
  baseUrl?: string;
};


/**
 * Normaliza o slug para uso em variáveis de ambiente (apenas a-z, 0-9, _).
 */
function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}


/**
 * Lê uma variável de ambiente e retorna o valor trimado, ou null se não definida.
 */
function readEnv(key: string) {
  const value = process.env[key];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}


/**
 * Resolve uma variável de ambiente escopada para o slug (ex: QASE_API_TOKEN_CLIENTE).
 */
function resolveScoped(slug: string, key: string) {
  const suffix = normalizeSlug(slug).toUpperCase();
  return readEnv(`${key}_${suffix}`);
}


/**
 * Obtém as configurações Qase para um cliente/projeto a partir do slug.
 * Busca variáveis de ambiente escopadas e globais, priorizando as mais específicas.
 * @param slug Slug do cliente/projeto
 * @returns Configuração Qase ou null se slug não informado
 */
export async function getClientQaseSettings(slug: string): Promise<QaseSettings | null> {
  if (!slug) return null;
  const token =
    resolveScoped(slug, "QASE_API_TOKEN") ||
    resolveScoped(slug, "QASE_TOKEN") ||
    readEnv("QASE_API_TOKEN") ||
    readEnv("QASE_TOKEN") ||
    undefined;

  const projectCode =
    resolveScoped(slug, "QASE_PROJECT_CODE") ||
    resolveScoped(slug, "QASE_PROJECT") ||
    readEnv("QASE_PROJECT_CODE") ||
    readEnv("QASE_PROJECT") ||
    readEnv("QASE_DEFAULT_PROJECT") ||
    undefined;

  const rawProjects = resolveScoped(slug, "QASE_PROJECT_CODES");
  const projectCodes = rawProjects
    ? rawProjects.split(",").map((value) => value.trim()).filter(Boolean)
    : undefined;

  const baseUrl = readEnv("QASE_BASE_URL") || "https://api.qase.io";

  return {
    slug,
    token: token ?? undefined,
    projectCode: projectCode ?? undefined,
    projectCodes,
    baseUrl,
  };
}
