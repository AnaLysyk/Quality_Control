export function slugifyRelease(value: string | null | undefined): string {
  const safe = (value ?? "").toString();
  if (!safe) return "";
  return safe
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}
