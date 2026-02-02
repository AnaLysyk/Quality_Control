import type { DataSource, AuthLoginInput, AuthLoginResult, AuthMeResult, CompanyCreateInput } from "./DataSource";

async function json<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error((err?.error as string) || (err?.message as string) || "Request failed");
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
      const payload = await json<{ items: any[] }>("/api/clients");
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
      const payload = await json<{ items: any[] }>(url);
      return payload.items ?? [];
    },
  },
};
