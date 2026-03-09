"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useAppSettings, type Language, type Theme } from "@/context/AppSettingsContext";

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
  const items = Array.isArray(rec?.items) ? (rec.items as unknown[]) : [];

  return items
    .map((row) => {
      const current = asRecord(row) ?? {};
      const role: LinkedCompany["role"] = current.role === "ADMIN" ? "ADMIN" : "USER";
      return {
        client_id: typeof current.client_id === "string" ? current.client_id : "",
        client_name: typeof current.client_name === "string" ? current.client_name : "",
        client_slug: typeof current.client_slug === "string" ? current.client_slug : "",
        client_active: current.client_active === true,
        role,
        link_active: current.link_active === true,
      };
    })
    .filter((company) => company.client_id && company.client_name && company.client_slug);
}

function normalizeUiRole(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "it_dev" || normalized === "dev" || normalized === "developer") return "global";
  if (normalized === "admin" || normalized === "global_admin") return "admin";
  if (normalized === "company" || normalized === "company_admin" || normalized === "client_admin") return "empresa";
  return "usuario";
}

function roleLabel(value?: string | null) {
  const normalized = normalizeUiRole(value);
  if (normalized === "global") return "Global";
  if (normalized === "admin") return "Admin";
  if (normalized === "empresa") return "Empresa";
  return "Usuario";
}

export default function ProfilePage() {
  const { user, loading, refreshUser } = useAuthUser();
  const { theme, language, setTheme, setLanguage, saveSettings, loading: settingsLoading } = useAppSettings();
  const [companies, setCompanies] = useState<LinkedCompany[]>([]);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileFullName, setProfileFullName] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);
  const [deleteUserSuccess, setDeleteUserSuccess] = useState<string | null>(null);

  const userRecord = asRecord(user);
  const fullName =
    (typeof userRecord?.fullName === "string" ? userRecord.fullName : "") ||
    (typeof userRecord?.full_name === "string" ? String(userRecord.full_name) : "");
  const name = (typeof userRecord?.name === "string" ? userRecord.name : "") || "";
  const email = (typeof userRecord?.email === "string" ? userRecord.email : "") || "";
  const username =
    (typeof userRecord?.username === "string" ? userRecord.username : "") ||
    (typeof userRecord?.user === "string" ? String(userRecord.user) : "") ||
    email;
  const phone = (typeof userRecord?.phone === "string" ? userRecord.phone : "") || "";
  const roleValue =
    (typeof userRecord?.permissionRole === "string" ? userRecord.permissionRole : "") ||
    (typeof userRecord?.role === "string" ? userRecord.role : "") ||
    (typeof userRecord?.companyRole === "string" ? String(userRecord.companyRole) : "");
  const currentClientSlug = (typeof userRecord?.clientSlug === "string" ? userRecord.clientSlug : null) ?? null;
  const isGlobalProfile = normalizeUiRole(roleValue) === "global";
  const isAdminProfile = normalizeUiRole(roleValue) === "admin";
  const hasCompanyContext = !isGlobalProfile && !isAdminProfile;
  const uiRoleLabel = roleLabel(roleValue);
  const isPrivilegedProfile =
    isGlobalProfile ||
    isAdminProfile ||
    user?.isGlobalAdmin === true;

  const uniqueCompanies = useMemo(() => {
    const map = new Map<string, LinkedCompany>();
    for (const company of companies) {
      map.set(company.client_id, company);
    }
    return Array.from(map.values());
  }, [companies]);

  useEffect(() => {
    let cancelled = false;

    if (!hasCompanyContext) {
      setCompanies([]);
      setCompaniesError(null);
      return () => {
        cancelled = true;
      };
    }

    async function loadCompanies() {
      setCompaniesError(null);
      try {
        const res = await fetch("/api/me/clients", { credentials: "include", cache: "no-store" });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          const message =
            typeof json?.message === "string"
              ? json.message
              : "Nao foi possivel carregar empresas vinculadas.";
          if (!cancelled) setCompaniesError(message);
          return;
        }
        const json = await res.json().catch(() => ({}));
        if (!cancelled) setCompanies(normalizeCompanies(json));
      } catch (error) {
        if (!cancelled) {
          setCompaniesError(error instanceof Error ? error.message : "Nao foi possivel carregar empresas vinculadas.");
        }
      }
    }

    void loadCompanies();

    return () => {
      cancelled = true;
    };
  }, [hasCompanyContext]);

  useEffect(() => {
    setProfileFullName(fullName || "");
    setProfileName(name || "");
    setProfileEmail(email || "");
    setProfilePhone(phone || "");
  }, [email, fullName, name, phone]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    const nextFullName = profileFullName.trim();
    const nextName = profileName.trim();
    const nextEmail = profileEmail.trim();
    const nextPhone = profilePhone.trim();

    if (!nextFullName) {
      setProfileError("Informe nome completo");
      return;
    }
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
          full_name: nextFullName,
          name: nextName,
          email: nextEmail,
          phone: nextPhone,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = typeof json?.error === "string" ? json.error : "Nao foi possivel atualizar os dados.";
        setProfileError(message);
        return;
      }
      const settingsResult = await saveSettings({ theme, language });
      if (!settingsResult.ok) {
        setProfileError("Nao foi possivel salvar as preferencias.");
        return;
      }
      await refreshUser();
      setProfileSuccess("Dados e preferencias atualizados com sucesso.");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Nao foi possivel atualizar os dados.");
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      setPasswordError("As novas senhas nao conferem");
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
        const message = typeof json?.error === "string" ? json.error : "Nao foi possivel atualizar a senha.";
        setPasswordError(message);
        return;
      }
      setPasswordSuccess("Senha atualizada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Nao foi possivel atualizar a senha.");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleDeleteUser() {
    setDeleteUserError(null);
    setDeleteUserSuccess(null);
    if (!window.confirm("Tem certeza que deseja deletar seu usuario? Esta acao nao pode ser desfeita.")) return;

    setDeleteUserLoading(true);
    try {
      const res = await fetch("/api/user", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setDeleteUserError(typeof json?.error === "string" ? json.error : "Erro ao deletar usuario.");
        return;
      }

      setDeleteUserSuccess("Usuario deletado com sucesso. Saindo...");
      window.setTimeout(() => {
        window.location.href = "/login";
      }, 1800);
    } catch (error) {
      setDeleteUserError(error instanceof Error ? error.message : "Erro ao deletar usuario.");
    } finally {
      setDeleteUserLoading(false);
    }
  }

  async function handleDeleteCompany(clientSlug: string) {
    if (!window.confirm("Tem certeza que deseja deletar esta empresa? Esta acao nao pode ser desfeita.")) return;
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(clientSlug)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        alert("Erro ao deletar empresa.");
        return;
      }
      setCompanies((current) => current.filter((company) => company.client_slug !== clientSlug));
    } catch {
      alert("Erro ao deletar empresa.");
    }
  }

  return (
    <div className="min-h-screen bg-(--page-bg) text-(--page-text)">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Breadcrumb items={[{ label: "Meu perfil" }]} />

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-(--tc-text-muted)">Conta</p>
          <h1 className="text-3xl font-extrabold">Meu perfil</h1>
          <p className="text-sm text-(--tc-text-secondary)">
            {!hasCompanyContext
              ? `Dados do perfil ${uiRoleLabel}, preferencias e troca de senha.`
              : "Dados do usuario, preferencias, seguranca de acesso e empresas vinculadas."}
          </p>
        </div>

        <div className="rounded-2xl border border-(--tc-border) bg-(--tc-surface) p-6 shadow-[0_10px_26px_rgba(0,0,0,0.06)]">
          <form className="space-y-5" onSubmit={handleProfileSubmit}>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-(--tc-text)">Dados do perfil</h2>
              <p className="text-sm text-(--tc-text-secondary)">
                {!hasCompanyContext
                  ? `Perfil ${uiRoleLabel} sem empresa vinculada. O login usa usuario e senha proprios.`
                  : "Atualize nome, contato e a base do seu perfil."}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-(--tc-text)">
                Nome completo
                <input
                  className="form-control-user w-full rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={profileFullName}
                  onChange={(event) => setProfileFullName(event.target.value)}
                  disabled={profileLoading || loading}
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-(--tc-text)">
                Nome
                <input
                  className="form-control-user w-full rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  disabled={profileLoading || loading}
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-(--tc-text)">
                Usuario
                <input
                  className="form-control-user w-full rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-sm text-(--tc-text-muted)"
                  value={username}
                  readOnly
                  disabled
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-(--tc-text)">
                E-mail
                <input
                  type="email"
                  className="form-control-user w-full rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={profileEmail}
                  onChange={(event) => setProfileEmail(event.target.value)}
                  disabled={profileLoading || loading}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-(--tc-text)">
                Telefone
                <input
                  className="form-control-user w-full rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={profilePhone}
                  onChange={(event) => setProfilePhone(event.target.value)}
                  disabled={profileLoading || loading}
                  placeholder="+55 11 99999-9999"
                />
              </label>

              <div className="space-y-2">
                <p className="text-sm text-(--tc-text-muted)">Role</p>
                <span className="inline-flex items-center rounded-full border border-(--tc-accent)/30 bg-(--tc-accent)/10 px-3 py-1 text-sm font-semibold text-(--tc-accent)">
                  {loading ? "Carregando..." : uiRoleLabel}
                </span>
              </div>

              {hasCompanyContext ? (
                <div className="space-y-1">
                  <p className="text-sm text-(--tc-text-muted)">Empresa atual</p>
                  {currentClientSlug ? (
                    <Link
                      href={`/empresas/${encodeURIComponent(currentClientSlug)}/home`}
                      className="text-base font-semibold text-(--tc-accent) transition hover:brightness-110"
                    >
                      {currentClientSlug}
                    </Link>
                  ) : (
                    <p className="text-base font-semibold text-(--tc-text)">-</p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-(--tc-border) bg-(--tc-surface-2) px-4 py-3 text-sm text-(--tc-text-secondary)">
                  Perfil Global nao possui empresa atual nem empresas vinculadas.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-(--tc-text)">Preferencias</h2>
                <p className="text-sm text-(--tc-text-secondary)">
                  Aparencia e idioma agora fazem parte do Meu perfil.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-(--tc-text)">
                  Tema
                  <select
                    className="form-control-user w-full rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    value={theme}
                    onChange={(event) => setTheme(event.target.value as Theme)}
                    disabled={profileLoading || settingsLoading}
                  >
                    <option value="system">Automatico (sistema)</option>
                    <option value="light">Claro</option>
                    <option value="dark">Escuro</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-sm text-(--tc-text)">
                  Idioma
                  <select
                    className="form-control-user w-full rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as Language)}
                    disabled={profileLoading || settingsLoading}
                  >
                    <option value="pt-BR">Portugues (Brasil)</option>
                    <option value="en-US">English (US)</option>
                  </select>
                </label>
              </div>
            </div>

            {profileError && <p className="text-sm text-red-600">{profileError}</p>}
            {profileSuccess && <p className="text-sm text-green-600">{profileSuccess}</p>}

            <div className="flex flex-col items-end gap-2">
              <button
                type="submit"
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={profileLoading || loading || settingsLoading}
              >
                {profileLoading ? "Salvando..." : "Salvar perfil"}
              </button>
              <button
                type="button"
                className="mt-2 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={deleteUserLoading}
                onClick={handleDeleteUser}
              >
                {deleteUserLoading ? "Deletando..." : "Deletar usuario"}
              </button>
              {deleteUserError && <p className="mt-1 text-sm text-red-600">{deleteUserError}</p>}
              {deleteUserSuccess && <p className="mt-1 text-sm text-green-600">{deleteUserSuccess}</p>}
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-(--tc-border) bg-(--tc-surface) p-6 shadow-[0_10px_26px_rgba(0,0,0,0.06)]">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-(--tc-text)">Trocar senha</h2>
            <p className="text-sm text-(--tc-text-secondary)">Atualize sua senha de acesso sempre que precisar.</p>
          </div>

          <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handlePasswordSubmit}>
            <label className="flex flex-col text-sm">
              Senha atual
              <input
                type="password"
                className="form-control-user mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
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
                onChange={(event) => setNewPassword(event.target.value)}
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
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            {passwordError && <p className="text-sm text-red-600 sm:col-span-2">{passwordError}</p>}
            {passwordSuccess && <p className="text-sm text-green-600 sm:col-span-2">{passwordSuccess}</p>}

            <div className="flex justify-end sm:col-span-2">
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

        {hasCompanyContext ? (
          <div className="rounded-2xl border border-(--tc-border) bg-(--tc-surface) p-6 shadow-[0_10px_26px_rgba(0,0,0,0.06)]">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-(--tc-text)">Empresas vinculadas</h2>
              <p className="text-sm text-(--tc-text-secondary)">Vinculos atuais do seu usuario por empresa.</p>
            </div>

            <div className="mt-4 space-y-3">
              {companiesError && <p className="text-sm text-red-600">{companiesError}</p>}

              {!companiesError && uniqueCompanies.length === 0 && (
                <p className="text-sm text-(--tc-text-secondary)">Nenhuma empresa vinculada encontrada.</p>
              )}

              {uniqueCompanies.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {uniqueCompanies.map((company) => (
                    <div key={company.client_id} className="rounded-xl border border-(--tc-border) bg-(--tc-surface-2) p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-(--tc-text)" title={company.client_name}>
                            {company.client_name}
                          </div>
                          <div className="truncate text-xs text-(--tc-text-muted)">{company.client_slug}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="text-xs font-semibold text-(--tc-text-muted)">{company.role}</div>
                          {isPrivilegedProfile ? (
                            <button
                              className="mt-1 rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white"
                              onClick={() => void handleDeleteCompany(company.client_slug)}
                            >
                              Deletar empresa
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-(--tc-text-muted)">
                          {company.link_active ? "Vinculo ativo" : "Vinculo inativo"}
                        </span>
                        <Link
                          href={`/empresas/${encodeURIComponent(company.client_slug)}/home`}
                          className="text-xs font-semibold text-(--tc-accent) transition hover:brightness-110"
                        >
                          Abrir
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
