
/**
 * Resultado padronizado para integrações com serviços externos.
 * - ok: true  => sucesso, data obrigatória, warning opcional
 * - ok: false => falha, warning obrigatório, data opcional
 */
export type ExternalServiceResult<T> =
  | { ok: true; data: T; warning?: string }
  | { ok: false; data?: T; warning: string };


/**
 * Cria resultado de sucesso para integração externa.
 * @param data Dados retornados
 * @param warning Aviso opcional
 */
export function externalSuccess<T>(data: T, warning?: string): ExternalServiceResult<T> {
  return { ok: true, data, warning };
}


/**
 * Cria resultado de falha para integração externa.
 * @param warning Mensagem obrigatória de erro/aviso
 * @param data Dados parciais (opcional)
 */
export function externalFailure<T>(warning: string, data?: T): ExternalServiceResult<T> {
  return { ok: false, warning, data };
}
