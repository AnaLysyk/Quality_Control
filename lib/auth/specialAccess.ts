import "server-only";

type UserIdentity = {
  id?: string | null;
  email?: string | null;
  user?: string | null;
  username?: string | null;
};

const FORCED_GLOBAL_ACCESS_KEYS = new Set<string>([
  "anapaula",
  "anapaulalysyk",
  "lysyk",
  "analysyk",
]);

export function normalizeIdentifier(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function collectIdentityTokens(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return [] as string[];

  const segments = raw
    .split(/[,;\s]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const candidates = new Set<string>(segments);

  for (const segment of segments) {
    const at = segment.indexOf("@");
    if (at > 0) {
      candidates.add(segment.slice(0, at));
    }
  }

  return Array.from(candidates)
    .map((candidate) => normalizeIdentifier(candidate))
    .filter((candidate) => candidate.length > 0);
}

export function hasForcedGlobalAccessForUser(identity: UserIdentity) {
  const normalizedCandidates = [
    ...collectIdentityTokens(identity.id),
    ...collectIdentityTokens(identity.email),
    ...collectIdentityTokens(identity.user),
    ...collectIdentityTokens(identity.username),
  ];

  return normalizedCandidates.some((candidate) => FORCED_GLOBAL_ACCESS_KEYS.has(candidate));
}
