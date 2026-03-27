export function maskStoredSecret(value?: string | null) {
  const token = (value ?? "").trim();
  if (!token) return null;
  const suffix = token.slice(-4);
  return `********${suffix}`;
}

export function maskQaseToken(value?: string | null) {
  return maskStoredSecret(value);
}
