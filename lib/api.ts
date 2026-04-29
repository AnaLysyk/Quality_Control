import { getClientAuthToken } from "@/lib/session/token";

const RAW_API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const API_BASE = RAW_API_BASE.endsWith("/")
  ? RAW_API_BASE.slice(0, -1)
  : RAW_API_BASE;

export function apiUrl(path: string): string {
  if (!path) return API_BASE;
  if (API_BASE) {
    return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  }
  return path.startsWith("/") ? path : `/${path}`;
}

export async function getAccessToken() {
  return getClientAuthToken();
}

let clientRefreshPromise: Promise<boolean> | null = null;

export async function refreshClientSession() {
  if (typeof window === "undefined") return false;
  if (!clientRefreshPromise) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10_000);
    clientRefreshPromise = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        window.clearTimeout(timeoutId);
        clientRefreshPromise = null;
      });
  }
  return clientRefreshPromise;
}

async function getServerAccessToken() {
  try {
    const { cookies }: typeof import("next/headers") = await import("next/headers");
    const store = await cookies();
    return store.get("access_token")?.value || store.get("auth_token")?.value || null;
  } catch {
    return null;
  }
}

// fetch helper que adiciona Authorization: Bearer <jwt> quando disponível
export async function fetchApi(path: string, init: RequestInit = {}) {
  const url = apiUrl(path);
  const buildHeaders = async () => {
    const headers = new Headers(init.headers as HeadersInit | undefined);
    const token =
      typeof window === "undefined" ? await getServerAccessToken() : await getAccessToken();

    if (token && !headers.has("authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  };

  const doFetch = async () =>
    fetch(url, {
      ...init,
      headers: await buildHeaders(),
      credentials: init.credentials ?? "include",
      cache: init.cache ?? "no-store",
    });

  let res = await doFetch();

  // Client-side only: attempt a single refresh + retry for same-origin API calls.
  if (
    typeof window !== "undefined" &&
    res.status === 401 &&
    !API_BASE &&
    path.startsWith("/api/") &&
    !path.startsWith("/api/auth/")
  ) {
    const refreshed = await refreshClientSession();
    if (refreshed) {
      res = await doFetch();
    }
  }

  return res;
}
