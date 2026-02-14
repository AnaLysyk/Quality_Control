/**
 * Decide se cookies devem ser marcados como 'secure' com base no ambiente e headers.
 * - Permite override via AUTH_COOKIE_SECURE.
 * - Em dev, nunca usa secure.
 * - Em produção, verifica x-forwarded-proto ou protocolo da URL.
 * - Fallback seguro: retorna true se não conseguir determinar.
 */
export function shouldUseSecureCookies(req: Request): boolean {
  // 1. Override explícito por env
  const override = process.env.AUTH_COOKIE_SECURE;
  if (override === "true") return true;
  if (override === "false") return false;

  // 2. Ambiente de desenvolvimento nunca usa secure
  if (process.env.NODE_ENV !== "production") return false;

  // 3. Checa header x-forwarded-proto (proxy/reverse proxy)
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    const proto = forwardedProto.split(",")[0]?.trim().toLowerCase();
    return proto === "https";
  }

  // 4. Checa protocolo da URL
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    // 5. Fallback seguro: assume secure se não conseguir determinar
    return true;
  }
}
