export function shouldUseSecureCookies(req: Request): boolean {
  // Sempre retorna false exceto produÃ§Ã£o explÃ­cita
  if (process.env.NODE_ENV === "production") {
    const override = process.env.AUTH_COOKIE_SECURE;
    if (override === "true") return true;
    if (override === "false") return false;
    const forwardedProto = req.headers.get("x-forwarded-proto");
    if (forwardedProto) {
      const proto = forwardedProto.split(",")[0]?.trim().toLowerCase();
      return proto === "https";
    }
    try {
      return new URL(req.url).protocol === "https:";
    } catch {
      return true;
    }
  }
  // Nunca secure em dev/local
  return false;
}

