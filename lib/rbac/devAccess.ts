
/**
 * Verifica se o papel informado é considerado de desenvolvedor ou admin técnico.
 * Aceita: admin, global_admin, it_dev, developer, dev (case-insensitive).
 */
export function isDevRole(role?: string | null | undefined): boolean {
  const value = (role ?? "").toLowerCase();
  return ["admin", "global_admin", "it_dev", "developer", "dev"].includes(value);
}
