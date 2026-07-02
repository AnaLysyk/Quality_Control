const DEFAULT_ACCESS_REQUEST_LOOKUP_CODE_TTL_MINUTES = 15;

function readPositiveNumber(value: string | undefined) {
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return parsed;
}

export function getAccessRequestLookupCodeTtlMinutes() {
  return (
    readPositiveNumber(process.env.ACCESS_REQUEST_LOOKUP_CODE_TTL_MINUTES) ??
    readPositiveNumber(process.env.ACCESS_REQUEST_ACCESS_KEY_TTL_MINUTES) ??
    DEFAULT_ACCESS_REQUEST_LOOKUP_CODE_TTL_MINUTES
  );
}

export function createAccessRequestLookupCodeExpiresAt(now = new Date()) {
  const ttlMinutes = getAccessRequestLookupCodeTtlMinutes();
  return new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();
}

export function isAccessRequestLookupCodeExpired(
  expiresAt?: string | null,
  now = new Date(),
) {
  if (!expiresAt) return false;

  const expiresAtTime = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtTime)) return false;

  return expiresAtTime <= now.getTime();
}

