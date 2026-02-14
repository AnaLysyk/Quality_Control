
// Importa o cliente Qase e erro customizado
import { QaseError, createQaseClient } from "@/lib/qaseSdk";


/**
 * Representa um run (execução) Qase simplificado.
 */
type QaseRun = {
  id: number;
  name?: string;
  slug?: string;
  status?: string;
  createdAt?: string;
};


/**
 * Resultado da listagem de runs Qase.
 * ok: true => sucesso, ok: false => erro ou warning.
 */
type ListRunsResult =
  | { ok: true; data: QaseRun[] }
  | { ok: false; data: QaseRun[]; warning?: string };


/**
 * Estrutura bruta de run retornada pela API Qase.
 */
type RawRun = {
  id?: number;
  name?: string;
  title?: string;
  slug?: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
};


/**
 * Normaliza um objeto RawRun da API Qase para o formato QaseRun.
 * Retorna null se o id não for válido.
 */
function normalizeRun(run: RawRun): QaseRun | null {
  const id = Number(run.id ?? 0);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id,
    name: run.name ?? run.title,
    slug: run.slug,
    status: run.status,
    createdAt: run.created_at ?? run.createdAt,
  };
}


/**
 * Lista os runs (execuções) de um projeto Qase.
 * @param projectCode Código do projeto Qase
 * @param token Token de API Qase
 * @returns Lista de runs ou warning de erro
 */
export async function listQaseRuns(projectCode: string, token: string): Promise<ListRunsResult> {
  if (!token || !projectCode) {
    return { ok: false, data: [], warning: "Qase nao configurado (token/projeto ausente)" };
  }

  const client = createQaseClient({ token });
  try {
    const { data } = await client.getWithStatus<{ result?: { entities?: RawRun[] } }>(`/run/${projectCode}`);
    const entities = data?.result?.entities ?? [];
    const runs = entities.map(normalizeRun).filter(Boolean) as QaseRun[];
    return { ok: true, data: runs };
  } catch (err) {
    const status = err instanceof QaseError ? err.status : 0;
    const warning =
      status === 401 || status === 403
        ? "Qase unauthorized"
        : status === 404
          ? "Qase project not found"
          : "Qase request failed";
    return { ok: false, data: [], warning };
  }
}
