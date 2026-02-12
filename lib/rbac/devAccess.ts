export function isDevRole(role?: string | null | undefined) {
  const value = (role ?? "").toLowerCase();
  return ["admin", "global_admin", "it_dev", "developer", "dev"].includes(value);
}
