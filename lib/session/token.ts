
// Utilitários para leitura de token de autenticação do lado do cliente
const TOKEN_COOKIE_NAMES = ["access_token", "auth_token"];


/**
 * Lê o valor de um cookie pelo nome no contexto do browser.
 */
function readCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split(";")
    .map((segment) => segment.trim())
    .find((segment) => segment.startsWith(`${name}=`));
  if (!cookie) return null;
  return decodeURIComponent(cookie.split("=").slice(1).join("="));
}


/**
 * Retorna o token de autenticação do cliente (browser), se disponível.
 */
export function getClientAuthToken(): string | null {
  for (const name of TOKEN_COOKIE_NAMES) {
    const value = readCookieValue(name);
    if (value) return value;
  }
  return null;
}
