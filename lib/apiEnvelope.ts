
/**
 * Metadados opcionais para envelope de resposta de API.
 */
export type ApiEnvelopeMeta = {
  requestId?: string;
  timestamp?: string;
};


/**
 * Alias para objeto genérico.
 */
type AnyRecord = Record<string, unknown>;


/**
 * Tenta converter valor em objeto (Record) ou retorna null.
 */
function asRecord(value: unknown): AnyRecord | null {
  if (!value || typeof value !== "object") return null;
  return value as AnyRecord;
}


/**
 * Lê string não vazia de valor desconhecido.
 */
function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Extrai requestId de um JSON de envelope de API.
 */
export function extractRequestIdFromJson(json: unknown): string | null {
  const rec = asRecord(json);
  const meta = asRecord(rec?.meta);
  return readString(meta?.requestId) || null;
}

/**
 * Extrai mensagem de erro de um JSON de envelope de API.
 */
export function extractMessageFromJson(json: unknown): string | null {
  const rec = asRecord(json);
  const direct = readString(rec?.message);
  if (direct) return direct;

  const err = asRecord(rec?.error);
  const errMessage = readString(err?.message);
  if (errMessage) return errMessage;

  const legacyError = readString(rec?.error);
  if (legacyError) return legacyError;

  return null;
}

/**
 * Formata mensagem incluindo requestId, se disponível.
 */
export function formatMessageWithRequestId(message: string, requestId?: string | null): string {
  const rid = requestId?.trim();
  if (!rid) return message;
  return `${message} (id: ${rid})`;
}


/**
 * Lê e faz parse do JSON de uma resposta de API.
 */
export async function readApiJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}


/**
 * Lê erro de resposta de API, extraindo mensagem e requestId.
 */
export async function readApiError(res: Response, fallbackMessage: string) {
  const json = await readApiJson(res);
  const message = extractMessageFromJson(json) || fallbackMessage;
  const requestId = extractRequestIdFromJson(json) || res.headers.get("x-request-id") || null;

  return {
    message,
    requestId,
    displayMessage: formatMessageWithRequestId(message, requestId),
    json,
  };
}


/**
 * Extrai o campo data de um envelope de API, se presente.
 */
export function unwrapEnvelopeData<T>(json: unknown): T | null {
  const rec = asRecord(json);
  if (rec && typeof rec.success === "boolean" && "data" in rec) {
    return (rec.data ?? null) as T | null;
  }
  return (json ?? null) as T | null;
}
