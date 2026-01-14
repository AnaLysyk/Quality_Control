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

// Helper para obter o token de acesso do Supabase (client-side)
export async function getAccessToken() {
  // importa dinamicamente para evitar SSR
  const { getSupabaseClient } = await import("@/lib/supabase/client");
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function getServerAccessToken() {
  try {
    const { cookies }: typeof import("next/headers") = await import("next/headers");
    const store = await cookies();
    return (
      store.get("sb-access-token")?.value ||
      store.get("access_token")?.value ||
      store.get("auth_token")?.value ||
      null
    );
  } catch {
    return null;
  }
}

// fetch helper que adiciona Authorization: Bearer <jwt> quando disponível
export async function fetchApi(path: string, init: RequestInit = {}) {
  const url = apiUrl(path);
  const headers = new Headers(init.headers as HeadersInit | undefined);
  const token =
    typeof window === "undefined" ? await getServerAccessToken() : await getAccessToken();

  if (token && !headers.has("authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
    cache: init.cache ?? "no-store",
  });
}
