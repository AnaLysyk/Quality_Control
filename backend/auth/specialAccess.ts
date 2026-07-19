import "server-only";

type UserIdentity = {
  id?: string | null;
  email?: string | null;
  user?: string | null;
  username?: string | null;
};

export function normalizeIdentifier(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Acesso privilegiado deve ser definido exclusivamente pelos perfis,
 * permissões e vínculos persistidos. Identidade, nome, e-mail ou username
 * nunca podem conceder acesso especial.
 */
export function hasForcedGlobalAccessForUser(_identity: UserIdentity) {
  return false;
}
