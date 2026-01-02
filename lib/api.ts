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
  const { supabase } = await import("@/lib/supabase/client");
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
