/**
 * safeFetchJson - fetch wrapper que só retorna JSON válido e nunca deixa escapar HTML/erro bruto para a UI.
 *
 * Uso:
 *   const data = await safeFetchJson('/api/empresas');
 *   // ou
 *   const { data, error } = await safeFetchJson('/api/empresas', { method: 'POST', ... });
 */

export async function safeFetchJson<T = any>(
  input: RequestInfo,
  init?: RequestInit
): Promise<{ data?: T; error?: string; status: number }> {
  try {
    const res = await fetch(input, init);
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      return { error: `Erro HTTP ${res.status}`, status: res.status };
    }
    if (!ct.includes("application/json")) {
      return { error: "Resposta inesperada (não é JSON)", status: res.status };
    }
    const data = (await res.json()) as T;
    return { data, status: res.status };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido", status: -1 };
  }
}
