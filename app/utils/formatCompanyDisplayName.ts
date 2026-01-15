export function formatCompanyDisplayName(slug: string): string {
  const raw = (slug ?? "").trim();
  if (!raw) return "";

  const lower = raw.toLowerCase();
  const specialCases: Record<string, string> = {
    griaule: "Griaule",
  };

  const special = specialCases[lower];
  if (special) return special;

  const parts = raw
    .replace(/[\s_-]+/g, " ")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  const titled = parts.map((part) => {
    if (part.length <= 2) return part.toUpperCase();
    return `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`;
  });

  return titled.join(" ");
}
