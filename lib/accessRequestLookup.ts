import type { ParsedAccessRequest } from "@/lib/accessRequestMessage";

function normalizeCandidateList(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeAccessRequestLookup(value);
    if (normalized) seen.add(normalized);
  }
  return seen;
}

export function normalizeAccessRequestLookup(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function matchesAccessRequestLookup(params: {
  lookupEmail: string;
  lookupName: string;
  parsed: ParsedAccessRequest;
  storedEmail?: string | null;
}) {
  const lookupEmail = normalizeAccessRequestLookup(params.lookupEmail);
  const lookupName = normalizeAccessRequestLookup(params.lookupName);
  if (!lookupEmail || !lookupName) return false;

  const emailCandidates = normalizeCandidateList([
    params.storedEmail,
    params.parsed.email,
    params.parsed.originalRequest?.email,
  ]);
  const nameCandidates = normalizeCandidateList([
    params.parsed.fullName,
    params.parsed.name,
    params.parsed.originalRequest?.fullName,
    params.parsed.originalRequest?.name,
  ]);

  return emailCandidates.has(lookupEmail) && nameCandidates.has(lookupName);
}
