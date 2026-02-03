import type { Release } from "@/types/release";

export type ManualReleaseKind = "run" | "defect";

export function resolveManualReleaseKind(release: Release): ManualReleaseKind {
  const raw = typeof (release as { kind?: unknown }).kind === "string" ? (release as { kind?: string }).kind : null;
  if (raw === "run" || raw === "defect") {
    return raw;
  }

  const label = `${release.name ?? ""} ${release.slug ?? ""}`.toLowerCase();
  if (label.includes("defeito") || label.includes("erro")) {
    return "defect";
  }

  return "run";
}
