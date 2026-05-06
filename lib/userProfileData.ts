type InputRecord = Record<string, unknown> | null | undefined;

export type SyncedUserProfileFields = {
  fullName: string | null;
  name: string;
  email: string;
  login: string | null;
  phone: string | null;
  jobTitle: string | null;
  linkedinUrl: string | null;
  avatarUrl: string | null;
};

function asRecord(input: unknown): InputRecord {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : null;
}

function readFirstString(record: InputRecord, keys: string[]) {
  if (!record) return null;
  let firstString: string | null = null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== "string") continue;
    if (firstString === null) firstString = value;
    if (value.trim()) return value;
  }
  return firstString;
}

export function sanitizeUserProfileText(value: unknown, max = 255): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export function normalizeUserProfileEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

export function normalizeUserProfileLogin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

export function readSyncedUserProfileFields(input: unknown): SyncedUserProfileFields {
  const record = asRecord(input);
  const fullName = sanitizeUserProfileText(readFirstString(record, ["full_name", "fullName", "name"]), 160);

  return {
    fullName,
    name: fullName ?? "",
    email: normalizeUserProfileEmail(readFirstString(record, ["email"])) ?? "",
    login: normalizeUserProfileLogin(readFirstString(record, ["user", "username", "login"])),
    phone: sanitizeUserProfileText(readFirstString(record, ["phone"]), 80),
    jobTitle: sanitizeUserProfileText(readFirstString(record, ["job_title", "jobTitle"]), 120),
    linkedinUrl: sanitizeUserProfileText(readFirstString(record, ["linkedin_url", "linkedinUrl", "linkedin"]), 255),
    avatarUrl: sanitizeUserProfileText(readFirstString(record, ["avatar_url", "avatarUrl"]), 2048),
  };
}
