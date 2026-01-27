function sanitizeEnvValue(value: string | undefined) {
  if (!value) return "";
  let raw = value.trim();
  if ((raw.startsWith("\"") && raw.endsWith("\"")) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim();
  }
  return raw;
}

const RAW_BACKEND_URL =
  sanitizeEnvValue(process.env.BACKEND_API_URL) ||
  sanitizeEnvValue(process.env.NEST_API_URL) ||
  sanitizeEnvValue(process.env.BACKEND_URL) ||
  "";

const BACKEND_URL = RAW_BACKEND_URL.endsWith("/") ? RAW_BACKEND_URL.slice(0, -1) : RAW_BACKEND_URL;
const BACKEND_STRICT = sanitizeEnvValue(process.env.BACKEND_STRICT).toLowerCase() === "true";

function joinUrl(base: string, path: string) {
  if (!path) return base;
  if (path.startsWith("/")) return `${base}${path}`;
  return `${base}/${path}`;
}

function readCookieValue(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split("=");
    if (key === name) {
      return rest.join("=").trim();
    }
  }
  return null;
}

function extractAuthToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice("bearer ".length).trim();
    return token.length ? token : null;
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const authCookieName = (process.env.AUTH_COOKIE_NAME ?? "auth_token").trim() || "auth_token";
  return (
    readCookieValue(cookieHeader, "sb-access-token") ||
    readCookieValue(cookieHeader, "access_token") ||
    readCookieValue(cookieHeader, "auth_token") ||
    (authCookieName ? readCookieValue(cookieHeader, authCookieName) : null) ||
    null
  );
}

export function isBackendConfigured(): boolean {
  return Boolean(BACKEND_URL);
}

function backendErrorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function isBackendStrict(): boolean {
  return BACKEND_STRICT;
}

export async function fetchBackend(
  req: Request,
  path: string,
  init?: {
    method?: string;
    body?: BodyInit | null;
    headers?: HeadersInit;
  },
): Promise<Response | null> {
  if (!BACKEND_URL) {
    if (BACKEND_STRICT) {
      return backendErrorResponse("Backend nao configurado", 500);
    }
    return null;
  }

  const method = init?.method ?? req.method;
  const headers = new Headers(init?.headers);

  const contentType = req.headers.get("content-type");
  if (contentType && !headers.has("content-type")) {
    headers.set("content-type", contentType);
  }

  if (!headers.has("accept")) {
    const accept = req.headers.get("accept");
    if (accept) headers.set("accept", accept);
  }

  const authHeader = headers.get("authorization") ?? req.headers.get("authorization");
  if (authHeader) {
    headers.set("authorization", authHeader);
  } else {
    const token = extractAuthToken(req);
    if (token) headers.set("authorization", `Bearer ${token}`);
  }

  try {
    const url = joinUrl(BACKEND_URL, path);
    return await fetch(url, {
      method,
      headers,
      body: init?.body ?? null,
    });
  } catch {
    if (BACKEND_STRICT) {
      return backendErrorResponse("Backend indisponivel", 502);
    }
    return null;
  }
}
