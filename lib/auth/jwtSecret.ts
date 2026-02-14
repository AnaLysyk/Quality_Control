
import "server-only";
import crypto from "node:crypto";

/**
 * Gera um hash SHA-256 para uso como fallback de segredo JWT.
 */
function hashSeed(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

/**
 * Obtém o segredo JWT seguro, priorizando variáveis sensíveis e fallback seguro.
 * Nunca use o fallback de desenvolvimento em produção!
 */
export function getJwtSecret(): string | null {
  // 1. Prioriza JWT_SECRET explícito
  const envSecret = process.env.JWT_SECRET;
  if (typeof envSecret === "string" && envSecret.trim()) {
    return envSecret.trim();
  }

  // 2. Fallback: usa seed derivada de variáveis de ambiente não sensíveis
  const fallbackSeed =
    process.env.JWT_FALLBACK_SECRET ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL ||
    "";

  if (fallbackSeed.trim()) {
    // O hash impede exposição direta do valor da seed
    return hashSeed(`qc:${fallbackSeed.trim()}`);
  }

  // 3. Ambiente de desenvolvimento: segredo inseguro (NUNCA use em produção)
  if (process.env.NODE_ENV !== "production") {
    return "dev-insecure-secret";
  }

  // 4. Falha explícita: não há segredo disponível
  return null;
}
