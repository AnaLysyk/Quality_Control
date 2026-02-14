
// Utilitário para classificar o tipo de release manual
import type { Release } from "@/types/release";


/**
 * Tipos possíveis de release manual.
 * - run: release de execução
 * - defect: release de defeito
 */
export type ManualReleaseKind = "run" | "defect";


/**
 * Determina o tipo de release manual a partir do objeto Release.
 * - Se o campo kind for "run" ou "defect", retorna diretamente.
 * - Se o nome ou slug contiver "defeito" ou "erro", retorna "defect".
 * - Caso contrário, assume "run".
 * @param release Release
 * @returns ManualReleaseKind
 */
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
