"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { useAuthUser } from "@/hooks/useAuthUser";

type LinkedCompany = {
  client_id: string;
  client_name: string;
  client_slug: string;
  client_active: boolean;
  role: "ADMIN" | "USER";
  link_active: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeCompanies(payload: unknown): LinkedCompany[] {
  const rec = asRecord(payload);
  const items = Array.isArray(rec?.items) ? (rec?.items as unknown[]) : [];

  return items
    .map((row) => {
      const r = asRecord(row) ?? {};
      const role: LinkedCompany["role"] = r.role === "ADMIN" ? "ADMIN" : "USER";
      return {
        client_id: typeof r.client_id === "string" ? r.client_id : "",
        client_name: typeof r.client_name === "string" ? r.client_name : "",
        client_slug: typeof r.client_slug === "string" ? r.client_slug : "",
        client_active: r.client_active === true,
        role,
        link_active: r.link_active === true,
      };
    })
    .filter((c) => c.client_id && c.client_name && c.client_slug);
}

export default function ProfilePage() {
  const { user, loading } = useAuthUser();
  const [companies, setCompanies] = useState<LinkedCompany[]>([]);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const name = (typeof asRecord(user)?.name === "string" ? String(asRecord(user)?.name) : "") || "Usuário";
  const email = (typeof asRecord(user)?.email === "string" ? String(asRecord(user)?.email) : "") || "";
  const role = (typeof asRecord(user)?.role === "string" ? String(asRecord(user)?.role) : "") || "";
  const currentClientSlug = (typeof asRecord(user)?.clientSlug === "string" ? String(asRecord(user)?.clientSlug) : null) ?? null;

  const uniqueCompanies = useMemo(() => {
    const map = new Map<string, LinkedCompany>();
    for (const c of companies) {
      map.set(c.client_id, c);
    }
    return Array.from(map.values());
  }, [companies]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCompaniesError(null);
      try {
        const res = await fetch("/api/me/clients", { credentials: "include", cache: "no-store" });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          const message = typeof json?.message === "string" ? json.message : "Não foi possível carregar empresas vinculadas.";
          if (!cancelled) setCompaniesError(message);
          return;
        }
        const json = await res.json().catch(() => ({}));
        if (!cancelled) setCompanies(normalizeCompanies(json));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Não foi possível carregar empresas vinculadas.";
        if (!cancelled) setCompaniesError(msg);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword.trim() || !newPassword.trim()) {
      setPasswordError("Informe a senha atual e a nova senha");
      return;
    }
    if (newPassword.trim().length < 8) {
      setPasswordError("A nova senha precisa ter pelo menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("As novas senhas não conferem");
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError("A nova senha deve ser diferente da atual");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = typeof json?.error === "string" ? json.error : "Não foi possível atualizar a senha.";
        setPasswordError(message);
        return;
      }
      setPasswordSuccess("Senha atualizada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível atualizar a senha.";
      setPasswordError(message);
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-(--page-bg) text-(--page-text)">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <Breadcrumb items={[{ label: "Configurações", href: "/settings" }, { label: "Perfil" }]} />

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-(--tc-text-muted)">Configurações</p>
          <h1 className="text-3xl font-extrabold">Perfil do Usuário</h1>
          <p className="text-sm text-(--tc-text-secondary)">Veja seu usuário e as empresas vinculadas.</p>
        </div>

        <div className="rounded-2xl bg-(--tc-surface) shadow-[0_10px_26px_rgba(0,0,0,0.06)] border border-(--tc-border) p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-(--tc-text-muted)">Nome</p>
              <p className="text-base font-semibold text-(--tc-text)">{loading ? "Carregando..." : name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-(--tc-text-muted)">Email</p>
              <p className="text-base font-semibold text-(--tc-text)">{loading ? "Carregando..." : email || "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-(--tc-text-muted)">Role</p>
              <p className="text-base font-semibold text-(--tc-text)">{loading ? "Carregando..." : role || "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-(--tc-text-muted)">Empresa atual</p>
              {currentClientSlug ? (
                <Link
                  href={`/empresas/${encodeURIComponent(currentClientSlug)}/home`}
                  className="text-base font-semibold text-(--tc-accent) hover:brightness-110 transition"
                >
                  {currentClientSlug}
                </Link>
              ) : (
                <p className="text-base font-semibold text-(--tc-text)">-</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-(--tc-surface) shadow-[0_10px_26px_rgba(0,0,0,0.06)] border border-(--tc-border) p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-(--tc-text)">Trocar senha</h2>
            <p className="text-sm text-(--tc-text-secondary)">Atualize sua senha de acesso sempre que precisar.</p>
          </div>

          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handlePasswordSubmit}>
            <label className="flex flex-col text-sm">
              Senha atual
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label className="flex flex-col text-sm">
              Nova senha
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <label className="flex flex-col text-sm sm:col-span-2">
              Confirmar nova senha
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            {passwordError && <p className="text-sm text-red-600 sm:col-span-2">{passwordError}</p>}
            {passwordSuccess && <p className="text-sm text-green-600 sm:col-span-2">{passwordSuccess}</p>}

            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={passwordLoading}
              >
                {passwordLoading ? "Atualizando..." : "Atualizar senha"}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl bg-(--tc-surface) shadow-[0_10px_26px_rgba(0,0,0,0.06)] border border-(--tc-border) p-6 space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-(--tc-text)">Empresas vinculadas</h2>
            <p className="text-sm text-(--tc-text-secondary)">Vínculos do seu usuário (por role).</p>
          </div>

          {companiesError && <p className="text-sm text-red-600">{companiesError}</p>}

          {!companiesError && uniqueCompanies.length === 0 && (
            <p className="text-sm text-(--tc-text-secondary)">Nenhuma empresa vinculada encontrada.</p>
          )}

          {uniqueCompanies.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {uniqueCompanies.map((c) => (
                <div key={c.client_id} className="rounded-xl border border-(--tc-border) bg-(--tc-surface-2) p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-(--tc-text) truncate" title={c.client_name}>
                        {c.client_name}
                      </div>
                      <div className="text-xs text-(--tc-text-muted) truncate">{c.client_slug}</div>
                    </div>
                    <div className="text-xs font-semibold text-(--tc-text-muted)">{c.role}</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-(--tc-text-muted)">
                      {c.link_active ? "Vínculo ativo" : "Vínculo inativo"}
                    </span>
                    <Link
                      href={`/empresas/${encodeURIComponent(c.client_slug)}/home`}
                      className="text-xs font-semibold text-(--tc-accent) hover:brightness-110 transition"
                    >
                      Abrir
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
