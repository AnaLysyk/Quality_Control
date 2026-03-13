export function replaceReleaseTerms(value?: string | null) {
  if (typeof value !== "string") return "";

  return value
    .replace(/\bReleases\b/g, "Runs")
    .replace(/\breleases\b/g, "runs")
    .replace(/\bRelease\b/g, "Run")
    .replace(/\brelease\b/g, "run");
}

export function stripRunPrefix(value?: string | null) {
  const normalized = replaceReleaseTerms(value ?? "").trim();
  return normalized.replace(/^run\b[\s:._-]*/i, "").trim();
}

export function formatRunTitle(value?: string | null, fallback = "Run") {
  const stripped = stripRunPrefix(value);
  return stripped || fallback;
}

export function formatRunText(value?: string | null, fallback = "") {
  const normalized = replaceReleaseTerms(value ?? "").trim();
  return normalized || fallback;
}
