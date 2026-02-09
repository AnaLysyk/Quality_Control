import type { DataSource, AuthLoginInput, AuthLoginResult, AuthMeResult, CompanyCreateInput } from "./DataSource";

function canAttemptRefresh(input: RequestInfo | URL): boolean {
  if (typeof input !== "string") return false;
  if (!input.startsWith("/api/")) return false;
  if (input.startsWith("/api/auth/login")) return false;
  if (input.startsWith("/api/auth/refresh")) return false;
  if (input.startsWith("/api/auth/logout")) return false;
  return true;
}

async function json<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let res = await fetch(input, init);
  if (res.status === 401 && canAttemptRefresh(input)) {
    try {
      const refreshed = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      if (refreshed.ok) {
        res = await fetch(input, init);
      }
    } catch {
      /* ignore */
    }
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const message =
      (typeof err?.error === "string" && err.error) ||
      (typeof err?.message === "string" && err.message) ||
      "Request failed";
    throw new Error(message);
  }
  return res.json();
}

export const JsonDataSource: DataSource = {
  auth: {
    login: async (input: AuthLoginInput): Promise<AuthLoginResult> =>
      json<AuthLoginResult>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    me: async (): Promise<AuthMeResult> => json<AuthMeResult>("/api/me", { cache: "no-store" }),
    logout: async (): Promise<void> => {
      await json("/api/auth/logout", { method: "POST" });
    },
  },
  companies: {
    list: async () => {
      const payload = await json<{ items: Array<Record<string, unknown>> }>("/api/clients");
      return payload.items ?? [];
    },
    create: async (input: CompanyCreateInput) =>
      json("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
  },
  users: {
    list: async (clientId?: string | null) => {
      const url = clientId ? `/api/admin/users?client_id=${encodeURIComponent(clientId)}` : "/api/admin/users";
      const payload = await json<{ items: Array<Record<string, unknown>> }>(url);
      return payload.items ?? [];
    },
  },
};
