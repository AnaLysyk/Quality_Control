export type ApiEnvelopeMeta = {
  requestId?: string;
  timestamp?: string;
};

type AnyRecord = Record<string, any>;

function asRecord(value: unknown): AnyRecord | null {
  if (!value || typeof value !== "object") return null;
  return value as AnyRecord;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function extractRequestIdFromJson(json: unknown): string | null {
  const rec = asRecord(json);
  const meta = asRecord(rec?.meta);
  return readString(meta?.requestId) || null;
}

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

export function formatMessageWithRequestId(message: string, requestId?: string | null) {
  const rid = requestId?.trim();
  if (!rid) return message;
  return `${message} (id: ${rid})`;
}

export async function readApiJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

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

export function unwrapEnvelopeData<T>(json: unknown): T | null {
  const rec = asRecord(json);
  if (rec && typeof rec.success === "boolean" && "data" in rec) {
    return (rec.data ?? null) as T | null;
  }
  return (json ?? null) as T | null;
}
