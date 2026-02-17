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
  const { user, loading, refreshUser } = useAuthUser();
  const [companies, setCompanies] = useState<LinkedCompany[]>([]);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);
  const [deleteUserSuccess, setDeleteUserSuccess] = useState<string | null>(null);
  async function handleDeleteUser() {
    setDeleteUserError(null);
    setDeleteUserSuccess(null);
    if (!window.confirm("Tem certeza que deseja deletar seu usuário? Esta ação não pode ser desfeita.")) return;
    setDeleteUserLoading(true);
    try {
      const res = await fetch("/api/user", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setDeleteUserError(json?.error || "Erro ao deletar usuário.");
        return;
      }
      setDeleteUserSuccess("Usuário deletado com sucesso. Saindo...");
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    } catch (err) {
      setDeleteUserError(err instanceof Error ? err.message : "Erro ao deletar usuário.");
    } finally {
      setDeleteUserLoading(false);
    }
  }

  const name = (typeof asRecord(user)?.name === "string" ? String(asRecord(user)?.name) : "") || "usuario";
  const email = (typeof asRecord(user)?.email === "string" ? String(asRecord(user)?.email) : "") || "";
  const phone = (typeof asRecord(user)?.phone === "string" ? String(asRecord(user)?.phone) : "") || "";
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

  useEffect(() => {
    setProfileName(name || "");
    setProfileEmail(email || "");
    setProfilePhone(phone || "");
  }, [name, email, phone]);

  async function handleProfileSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    const nextName = profileName.trim();
    const nextEmail = profileEmail.trim();
    const nextPhone = profilePhone.trim();

    if (!nextName) {
      setProfileError("Informe nome");
      return;
    }

    setProfileLoading(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: nextName,
          email: nextEmail,
          phone: nextPhone,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = typeof json?.error === "string" ? json.error : "NÃ£o foi possÃ­vel atualizar os dados.";
        setProfileError(message);
        return;
      }
      await refreshUser();
      setProfileSuccess("Dados atualizados com sucesso.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "NÃ£o foi possÃ­vel atualizar os dados.";
      setProfileError(message);
    } finally {
      setProfileLoading(false);
    }
  }

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

  // Função para deletar empresa vinculada (apenas admin/dev)
  async function handleDeleteCompany(client_slug: string) {
    if (!window.confirm("Tem certeza que deseja deletar esta empresa? Esta ação não pode ser desfeita.")) return;
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(client_slug)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        alert("Erro ao deletar empresa.");
        return;
      }
      setCompanies((prev) => prev.filter((c) => c.client_slug !== client_slug));
    } catch (err) {
      alert("Erro ao deletar empresa.");
    }
  }

  return (
    <div className="min-h-screen bg-(--page-bg) text-(--page-text)">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <Breadcrumb items={[{ label: "Configuracoes", href: "/settings" }, { label: "Perfil" }]} />

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-(--tc-text-muted)">Configuracoes</p>
          <h1 className="text-3xl font-extrabold">Perfil do usuario</h1>
          <p className="text-sm text-(--tc-text-secondary)">Veja seu usuario e as empresas vinculadas.</p>
        </div>

        <div className="rounded-2xl bg-(--tc-surface) shadow-[0_10px_26px_rgba(0,0,0,0.06)] border border-(--tc-border) p-6 space-y-4">
          <form className="space-y-4" onSubmit={handleProfileSubmit}>
            <div>
              <h2 className="text-lg font-semibold text-(--tc-text)">Dados do perfil</h2>
              <p className="text-sm text-(--tc-text-secondary)">Atualize nome, usuario e telefone.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm text-(--tc-text) flex flex-col gap-1">
                Nome
                <input
                  className="form-control-user w-full rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  disabled={profileLoading || loading}
                  required
                />
              </label>
              <label className="text-sm text-(--tc-text) flex flex-col gap-1">
                Usuario
                <input
                  className="form-control-user w-full rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  disabled={profileLoading || loading}
                />
              </label>
              <label className="text-sm text-(--tc-text) flex flex-col gap-1">
                Telefone
                <input
                  className="form-control-user w-full rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  disabled={profileLoading || loading}
                  placeholder="+55 11 99999-9999"
                />
              </label>
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

            {profileError && <p className="text-sm text-red-600">{profileError}</p>}
            {profileSuccess && <p className="text-sm text-green-600">{profileSuccess}</p>}

            <div className="flex flex-col gap-2 items-end">
              <button
                type="submit"
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={profileLoading || loading}
              >
                {profileLoading ? "Salvando..." : "Salvar dados"}
              </button>
              <button
                type="button"
                className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 mt-2"
                disabled={deleteUserLoading}
                onClick={handleDeleteUser}
              >
                {deleteUserLoading ? "Deletando..." : "Deletar usuário"}
              </button>
              {deleteUserError && <p className="text-sm text-red-600 mt-1">{deleteUserError}</p>}
              {deleteUserSuccess && <p className="text-sm text-green-600 mt-1">{deleteUserSuccess}</p>}
            </div>
          </form>
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
                className="form-control-user mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
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
                className="form-control-user mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
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
                className="form-control-user mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
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
            <p className="text-sm text-(--tc-text-secondary)">Vinculos do seu usuario (por role).</p>
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
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-xs font-semibold text-(--tc-text-muted)">{c.role}</div>
                      {(role === "ADMIN" || role === "DEV" || user?.isGlobalAdmin) && (
                        <button
                          className="rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white mt-1"
                          onClick={() => handleDeleteCompany(c.client_slug)}
                        >
                          Deletar empresa
                        </button>
                      )}
                    </div>
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
