export type ExternalServiceResult<T> =
  | { ok: true; data: T; warning?: string }
  | { ok: false; data?: T; warning: string };

export function externalSuccess<T>(data: T, warning?: string): ExternalServiceResult<T> {
  return { ok: true, data, warning };
}

export function externalFailure<T>(warning: string, data?: T): ExternalServiceResult<T> {
  return { ok: false, warning, data };
}
