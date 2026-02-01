const TOKEN_COOKIE_NAMES = ["auth_token"];

function readCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split(";")
    .map((segment) => segment.trim())
    .find((segment) => segment.startsWith(`${name}=`));
  if (!cookie) return null;
  return decodeURIComponent(cookie.split("=").slice(1).join("="));
}

export function getClientAuthToken(): string | null {
  for (const name of TOKEN_COOKIE_NAMES) {
    const value = readCookieValue(name);
    if (value) return value;
  }
  return null;
}
