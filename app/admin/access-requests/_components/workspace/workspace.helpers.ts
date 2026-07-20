import type { AccessRequestProfilePreview } from "../../_types/accessRequests.types";

export function safeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return date.toLocaleString("pt-BR");
}

export function statusLabel(status: string) {
  if (status === "closed") return "Aprovada";
  if (status === "rejected") return "Rejeitada";
  if (status === "in_progress") return "Aguardando ajuste";
  return "Aberta";
}

export function statusTone(status: string) {
  if (status === "closed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "in_progress") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export function initials(value: string | null | undefined) {
  const cleaned = (value ?? "").trim();
  if (!cleaned) return "QC";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts.at(-1)?.[0] ?? "" : parts[0]?.[1] ?? "";
  return `${first}${last}`.toUpperCase();
}

export function displayName(profile: Pick<AccessRequestProfilePreview, "fullName" | "name" | "email">) {
  return profile.fullName || profile.name || profile.email || "(sem nome)";
}

export function profileAvatar(profile: AccessRequestProfilePreview, fallbackEmoji: string) {
  return profile.visualProfile?.avatarValue || fallbackEmoji || initials(displayName(profile));
}

export function buildPreviewProfile(
  selected: AccessRequestProfilePreview,
  draft: Partial<AccessRequestProfilePreview>,
): AccessRequestProfilePreview {
  return {
    ...selected,
    email: String(draft.email ?? selected.email ?? ""),
    fullName: String(draft.fullName ?? selected.fullName ?? ""),
    name: String(draft.name ?? selected.name ?? ""),
    username: typeof draft.username === "string" ? draft.username : selected.username,
    phone: String(draft.phone ?? selected.phone ?? ""),
    jobRole: String(draft.jobRole ?? selected.jobRole ?? ""),
    accessType: String(draft.accessType ?? selected.accessType ?? ""),
    company: String(draft.company ?? selected.company ?? ""),
    clientId: typeof draft.clientId === "string" ? draft.clientId : selected.clientId,
    title: String(draft.title ?? selected.title ?? ""),
    description: String(draft.description ?? selected.description ?? ""),
    notes: String(draft.notes ?? selected.notes ?? ""),
    adminNotes: typeof draft.adminNotes === "string" ? draft.adminNotes : selected.adminNotes,
    passwordProvided: draft.passwordProvided ?? selected.passwordProvided,
  };
}
