"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type TeamMemberRow = {
  id: string;
  role: "ADMIN" | "USER";
  active: boolean;
  name: string;
  email: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeItems(payload: unknown): TeamMemberRow[] {
  const rec = asRecord(payload);
  const items = Array.isArray(rec?.items) ? (rec?.items as unknown[]) : [];

  const mapRole = (value: unknown): TeamMemberRow["role"] => {
    if (typeof value !== "string") return "USER";
    const role = value.toLowerCase();
    // Any client-admin-like role is treated as ADMIN in the UI.
    if (role === "admin" || role === "global_admin") return "ADMIN";
    if (role === "client_admin" || role === "client_owner" || role === "client_manager") return "ADMIN";
    return "USER";
  };

  return items
    .map((row) => {
      const r = asRecord(row) ?? {};
      const role: TeamMemberRow["role"] = mapRole(r.role);
      return {
        id: typeof r.id === "string" ? r.id : "",
        role,
        active: r.active === true,
        name: typeof r.name === "string" ? r.name : "",
        email: typeof r.email === "string" ? r.email : "",
      };
    })
    .filter((row) => row.id && row.email);
}

async function authHeaders(): Promise<HeadersInit> {
  try {
    const { getAccessToken } = await import("@/lib/api");
    const token = await getAccessToken();
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  } catch {
    return new Headers();
  }
}

export default function CompanyTeamManager({ clientId, canManage }: { clientId: string; canManage: boolean }) {
  const [items, setItems] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER">("USER");

  const admins = useMemo(() => items.filter((i) => i.role === "ADMIN"), [items]);
  const users = useMemo(() => items.filter((i) => i.role === "USER"), [items]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const url = canManage
        ? `/api/clients/${encodeURIComponent(clientId)}/users?all=true`
        : `/api/clients/${encodeURIComponent(clientId)}/users`;
      const res = await fetch(url, { credentials: "include", cache: "no-store", headers });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const msg = typeof json?.message === "string" ? json.message : "Erro ao carregar equipe";
        setError(msg);
        setItems([]);
        return;
      }
      const json = await res.json().catch(() => ({}));
      setItems(normalizeItems(json));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar equipe";
      setError(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, canManage]);

  useEffect(() => {
    load();
  }, [load]);

  async function addMember() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error("Informe um email");
      return;
    }

    try {
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/users`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ email: trimmed, role }),
      });

      if (res.status === 409) {
        const json = await res.json().catch(() => ({}));
        toast.error(typeof json?.message === "string" ? json.message : "Usuário já vinculado");
        return;
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(typeof json?.message === "string" ? json.message : "Erro ao vincular usuário");
        return;
      }

      toast.success("Usuário vinculado");
      setEmail("");
      setRole("USER");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao vincular usuário";
      toast.error(msg);
    }
  }

  async function updateMember(member: TeamMemberRow, patch: { active?: boolean; role?: "ADMIN" | "USER" }) {
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/users`, {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify({ userId: member.id, ...patch }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(typeof json?.message === "string" ? json.message : "Erro ao atualizar vínculo");
        return;
      }
      toast.success("Vínculo atualizado");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar vínculo";
      toast.error(msg);
    }
  }

  const tableRow = (m: TeamMemberRow) => (
    <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-white truncate" title={m.name || m.email}>
            {m.name || "(Sem nome)"}
          </div>
          <div className="text-xs text-(--tc-text-muted) truncate" title={m.email}>
            {m.email}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-semibold rounded-full px-2 py-1 border ${
              m.role === "ADMIN"
                ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                : "border-sky-400/40 bg-sky-500/15 text-sky-200"
            }`}
          >
            {m.role}
          </span>
          <span
            className={`text-[11px] font-semibold rounded-full px-2 py-1 border ${
              m.active ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" : "border-rose-400/40 bg-rose-500/15 text-rose-200"
            }`}
          >
            {m.active ? "ATIVO" : "INATIVO"}
          </span>
        </div>
      </div>

      {canManage && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => updateMember(m, { active: !m.active })}
            className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/15 transition"
          >
            {m.active ? "Inativar" : "Ativar"}
          </button>

          <button
            onClick={() => updateMember(m, { role: m.role === "ADMIN" ? "USER" : "ADMIN" })}
            className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/15 transition"
          >
            {m.role === "ADMIN" ? "Tornar USER" : "Tornar ADMIN"}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div>
            <div className="text-sm font-semibold text-white">Adicionar membro</div>
            <div className="text-xs text-(--tc-text-muted)">Somente admins conseguem vincular usuários.</div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@empresa.com"
              className="flex-1 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/40"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value === "ADMIN" ? "ADMIN" : "USER")}
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white focus:outline-none"
              aria-label="Função do novo membro"
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <button
              onClick={addMember}
              className="rounded-lg bg-(--tc-accent) px-4 py-2 text-sm font-semibold text-white hover:brightness-110 transition"
            >
              Vincular
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-(--tc-text-muted)">
          {loading ? "Carregando equipe..." : `${items.length} membro(s)`}
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/15 transition"
          disabled={loading}
        >
          Atualizar
        </button>
      </div>

      {error && <p className="text-sm text-rose-200">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-(--tc-text-muted)">Nenhum membro encontrado.</p>
      )}

      {admins.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.35em] text-(--tc-text-muted)">Admins</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{admins.map(tableRow)}</div>
        </div>
      )}

      {users.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.35em] text-(--tc-text-muted)">Usuários</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{users.map(tableRow)}</div>
        </div>
      )}
    </div>
  );
}
