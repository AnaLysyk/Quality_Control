"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiCheck,
  FiChevronRight,
  FiCopy,
  FiFolder,
  FiLogOut,
  FiSettings,
  FiX,
} from "react-icons/fi";
import UserAvatar from "@/components/UserAvatar";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useClientContext } from "@/context/ClientContext";
import { resolveActiveIdentity } from "@/lib/activeIdentity";

type ToastState =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function MenuItem(props: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  autoFocus?: boolean;
  isDarkTheme: boolean;
}) {
  const { icon, label, hint, onClick, autoFocus, isDarkTheme } = props;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        autoFocus={autoFocus}
        className={`group relative flex w-full items-start gap-3 rounded-2xl px-3.5 py-2.5 text-left shadow-[0_10px_26px_rgba(15,23,42,0.06)] transition hover:-translate-y-px ${
          isDarkTheme
            ? "border border-[#29466e] bg-[linear-gradient(180deg,#0d1a35_0%,#112243_100%)] hover:border-[#ff8a9c] hover:bg-[linear-gradient(180deg,#102042_0%,#15294f_100%)]"
            : "border border-[#d8ddea] bg-[linear-gradient(180deg,#ffffff_0%,#fffafb_100%)] hover:border-(--tc-accent) hover:bg-[linear-gradient(180deg,#ffffff_0%,#fff5f7_100%)]"
        }`}
      >
        <span
          className={`mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-[14px] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] transition ${
            isDarkTheme
              ? "border border-[#355483] bg-[linear-gradient(180deg,#12264c_0%,#0d1c38_100%)] text-white group-hover:border-[#ff8a9c] group-hover:text-[#ffd4db]"
              : "border border-[#c8d4ea] bg-[linear-gradient(180deg,#ffffff_0%,#f6f9ff_100%)] text-[#081f4d] group-hover:border-(--tc-accent) group-hover:text-(--tc-accent)"
          }`}
          aria-hidden
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className={`block text-sm font-bold leading-5 ${isDarkTheme ? "text-white" : "text-[#081f4d]"}`}>{label}</span>
          {hint ? (
            <span className={`mt-0.5 block wrap-break-word text-[11px] leading-4.5 font-medium ${isDarkTheme ? "text-[#d2def8]" : "text-[#27457d]"}`}>
              {hint}
            </span>
          ) : null}
        </span>
        <span
          className={`mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-transparent transition ${
            isDarkTheme
              ? "text-[#d2def8] group-hover:border-[#ff8a9c] group-hover:bg-[#4d1220] group-hover:text-white"
              : "text-[#4a6697] group-hover:border-[#f2c8cf] group-hover:bg-rose-50 group-hover:text-(--tc-accent)"
          }`}
        >
          <FiChevronRight aria-hidden size={16} />
        </span>
      </button>
    </li>
  );
}

export default function ProfileButton() {
  const router = useRouter();
  const { user, loading, logout } = useAuthUser();
  const { theme } = useAppSettings();
  const { activeClient, clients } = useClientContext();

  const legacyUser = (user ?? null) as
    | {
        isGlobalAdmin?: boolean;
        roleGlobal?: string;
        companyResources?: unknown;
        company?: { name?: string; slug?: string };
      }
    | null;

  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const isDarkTheme = theme === "dark";

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const normalizedRuntimeRole = (() => {
    const runtimeUser =
      (user ?? null) && typeof (user as Record<string, unknown>) === "object"
        ? (user as Record<string, unknown>)
        : null;
    const permissionRole =
      typeof runtimeUser?.permissionRole === "string" ? runtimeUser.permissionRole.toLowerCase() : "";
    const role = typeof runtimeUser?.role === "string" ? runtimeUser.role.toLowerCase() : "";
    const companyRole = typeof runtimeUser?.companyRole === "string" ? runtimeUser.companyRole.toLowerCase() : "";
    return permissionRole || role || companyRole;
  })();

  const isGlobalProfile = normalizedRuntimeRole === "dev" || normalizedRuntimeRole === "it_dev";
  const isAdmin = Boolean(user?.isGlobalAdmin || legacyUser?.isGlobalAdmin || legacyUser?.roleGlobal === "ADMIN");
  const activeIdentity = resolveActiveIdentity({ user, activeCompany: activeClient });
  const displayName = activeIdentity.displayName;
  const displayEmail = activeIdentity.email ?? "";
  const displayUser = activeIdentity.username ?? "";
  const profileCardValue = activeIdentity.kind === "company" ? displayName : displayEmail;
  const profileCardFallback = activeIdentity.kind === "company" ? "Sem nome da empresa" : "Sem e-mail";
  const copyActionLabel = activeIdentity.kind === "company" ? "nome da empresa" : "e-mail";
  const avatarLoadingPlaceholder = loading && !activeIdentity.avatarUrl;
  const contextBadgeLabel = activeIdentity.kind === "company"
    ? null
    : isGlobalProfile
      ? "Global"
      : isAdmin
        ? "Admin do sistema"
        : activeIdentity.showCompanyTag
          ? activeIdentity.companyTagLabel
          : null;

  const companySlug = (() => {
    if (activeClient?.slug) return activeClient.slug;

    const legacyCompany = legacyUser?.company;
    if (legacyCompany && typeof legacyCompany === "object" && legacyCompany !== null) {
      const slug = (legacyCompany as { slug?: unknown }).slug;
      if (typeof slug === "string" && slug.trim()) return slug;
    }

    const userCompany =
      (user ?? null) && typeof (user as Record<string, unknown>) === "object"
        ? ((user as Record<string, unknown> & { company?: unknown }).company ?? null)
        : null;

    if (userCompany && typeof userCompany === "object") {
      const slug = (userCompany as { slug?: unknown }).slug;
      if (typeof slug === "string" && slug.trim()) return slug;
    }

    return undefined;
  })();

  const companyResources = Array.isArray(legacyUser?.companyResources) ? legacyUser.companyResources : [];
  const companyCount =
    (Array.isArray(clients) ? clients.length : 0) ||
    (Array.isArray(companyResources) ? companyResources.length : 0);
  const hasCompanies = companyCount > 0;
  const docsRoute = hasCompanies
    ? companyCount > 1 || !companySlug
      ? "/documentos"
      : `/empresas/${companySlug}/documentos`
    : "/docs";
  const docsLabel = hasCompanies
    ? companyCount > 1
      ? `${companyCount} empresas disponiveis`
      : "Arquivos da empresa atual"
    : "Central de documentos";

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!open) return;
      const root = containerRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    window.setTimeout(() => setToast({ kind: "idle" }), 2200);
  }

  async function copyProfileCardValue() {
    if (!profileCardValue) return;
    try {
      await navigator.clipboard.writeText(profileCardValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
      showToast("success", `${activeIdentity.kind === "company" ? "Nome da empresa" : "E-mail"} copiado`);
    } catch {
      showToast("error", "Nao foi possivel copiar");
    }
  }

  async function handleLogout() {
    setOpen(false);
    try {
      const prefix = "chat_history_v1:";
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(prefix)) {
          sessionStorage.removeItem(key);
          i = -1;
        }
      }
    } catch {
      // ignore
    }
    await logout();
    router.replace("/login");
  }

  const effectiveAvatarUrl = activeIdentity.avatarUrl;
  const effectiveAvatarName = activeIdentity.displayName;
  const profileAvatarFrameClass = effectiveAvatarUrl
    ? "border border-slate-300 bg-[#f7f9fc] ring-1 ring-white/70 shadow-[0_18px_40px_rgba(15,23,42,0.16)] dark:border-slate-500 dark:bg-[#13213a] dark:ring-white/10"
    : "border-0 bg-linear-to-br from-(--tc-primary) to-[#7a1026] ring-0 shadow-none";

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Abrir menu de perfil: ${displayName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? "profile-menu" : undefined}
        onClick={() => setOpen((value) => !value)}
        className={`relative flex h-12 w-12 items-center justify-center rounded-full text-white shadow-[0_10px_22px_rgba(0,0,0,0.28)] transition focus:outline-none focus:ring-2 focus:ring-(--tc-primary,#4e8df5) focus:ring-offset-2 focus:ring-offset-transparent ${
          effectiveAvatarUrl
            ? "bg-transparent p-0 hover:shadow-[0_12px_26px_rgba(15,23,42,0.24)]"
            : "border border-white/12 bg-(--tc-surface-dark,#0f1828) hover:border-(--tc-primary,#4e8df5) hover:shadow-[0_12px_26px_rgba(78,141,245,0.25)]"
        }`}
      >
        <UserAvatar
          src={effectiveAvatarUrl}
          name={effectiveAvatarName}
          showFallback={!avatarLoadingPlaceholder}
          size="sm"
          className="h-full w-full"
          frameClassName={profileAvatarFrameClass}
          fallbackClassName="text-sm font-semibold tracking-[0.18em] text-white"
        />
      </button>

      {open && (
        <div
          id="profile-menu"
          aria-label="Menu de perfil"
          className={`absolute right-0 mt-2 max-h-[calc(100vh-5rem)] w-[min(396px,calc(100vw-1rem))] overflow-hidden overscroll-contain rounded-[20px] text-[#081f4d] shadow-[0_22px_54px_rgba(15,23,42,0.16)] backdrop-blur-xl ${
            isDarkTheme
              ? "border border-[#24395c] bg-[linear-gradient(180deg,#091226_0%,#0d1a35_46%,#13254a_100%)] text-white"
              : "border border-[#ddd8e4] bg-[linear-gradient(180deg,#fffdfd_0%,#fff6f8_52%,#f8fbff_100%)] text-[#081f4d]"
          }`}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className={`absolute -right-10 -top-8 h-28 w-28 rounded-full ${
                isDarkTheme
                  ? "bg-[radial-gradient(circle,rgba(239,0,1,0.18)_0%,rgba(239,0,1,0)_72%)]"
                  : "bg-[radial-gradient(circle,rgba(239,0,1,0.08)_0%,rgba(239,0,1,0)_72%)]"
              }`}
            />
            <div
              className={`absolute -left-8 top-20 h-36 w-36 rounded-full ${
                isDarkTheme
                  ? "bg-[radial-gradient(circle,rgba(78,141,245,0.18)_0%,rgba(78,141,245,0)_72%)]"
                  : "bg-[radial-gradient(circle,rgba(10,31,82,0.06)_0%,rgba(10,31,82,0)_72%)]"
              }`}
            />
          </div>

          <div className="relative px-3.5 pb-3.5 pt-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <UserAvatar
                  src={effectiveAvatarUrl}
                  name={effectiveAvatarName}
                  showFallback={!avatarLoadingPlaceholder}
                  size="md"
                  className="h-14 w-14 shrink-0"
                  frameClassName={
                    effectiveAvatarUrl
                      ? "border border-slate-300 bg-[#f7f9fc] ring-1 ring-white/70 shadow-[0_18px_40px_rgba(15,23,42,0.16)] dark:border-slate-500 dark:bg-[#13213a] dark:ring-white/10"
                      : "shadow-[0_14px_34px_rgba(15,23,42,0.18)]"
                  }
                  fallbackClassName="text-sm font-semibold tracking-[0.18em] text-white"
                />

                <div className="min-w-0 pt-0.5">
                  <p className={`text-[10px] font-extrabold uppercase tracking-[0.18em] ${isDarkTheme ? "text-[#ff8a9c]" : "text-(--tc-accent)"}`}>
                    {activeIdentity.kind === "company" ? "Empresa" : "Conta"}
                  </p>
                  <div className={`wrap-break-word text-[1.05rem] font-extrabold leading-tight ${isDarkTheme ? "text-white" : "text-[#081f4d]"}`}>
                    {displayName}
                  </div>
                  {activeIdentity.kind === "company" && activeIdentity.accountName !== displayName ? (
                    <div className={`wrap-break-word pt-0.5 text-[12px] font-semibold ${isDarkTheme ? "text-[#d2def8]" : "text-[#22457f]"}`}>
                      Conta: {activeIdentity.accountName}
                    </div>
                  ) : null}
                  {displayUser ? (
                    <div className={`break-all pt-0.5 text-[13px] font-semibold ${isDarkTheme ? "text-[#d2def8]" : "text-[#22457f]"}`}>
                      {activeIdentity.kind === "company" ? `Login @${displayUser}` : `@${displayUser}`}
                    </div>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-[14px] shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition ${
                  isDarkTheme
                    ? "border border-[#355483] bg-[#102042] text-white hover:border-[#ff8a9c] hover:text-[#ffd4db]"
                    : "border border-[#d5dced] bg-white text-[#5e79a8] hover:border-(--tc-accent) hover:text-(--tc-accent)"
                }`}
                aria-label="Fechar menu"
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
              >
                <FiX aria-hidden />
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              <div
                className={`rounded-2xl border p-3 shadow-[0_14px_28px_rgba(15,23,42,0.08)] ${
                  isDarkTheme
                    ? "border-[#2d466f] bg-[linear-gradient(135deg,#0f1d3b_0%,#13264b_60%,#18305e_100%)]"
                    : "border-[#d7ddea] bg-[linear-gradient(135deg,#fff8fa_0%,#ffffff_58%,#f5f8ff_100%)]"
                }`}
              >
                {contextBadgeLabel ? (
                  <div className="flex flex-wrap gap-2">
                    <span className={`tc-status-pill shadow-[0_10px_18px_rgba(0,0,0,0.12)]`} data-tone={isGlobalProfile ? "danger" : "neutral"}>
                      {contextBadgeLabel}
                    </span>
                  </div>
                ) : null}

                <div
                  className={`${contextBadgeLabel ? "mt-2.5 " : ""}flex items-start gap-2 rounded-[14px] border px-3 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ${
                    isDarkTheme ? "border-[#355483] bg-[#0c1831]" : "border-[#d7ddea] bg-white"
                  }`}
                >
                  <span className={`min-w-0 flex-1 break-all font-semibold ${isDarkTheme ? "text-white" : "text-[#081f4d]"}`}>
                    {profileCardValue || profileCardFallback}
                  </span>
                  <button
                    type="button"
                    aria-label={`Copiar ${copyActionLabel}`}
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border text-white shadow-[0_10px_22px_rgba(15,23,42,0.12)] transition hover:bg-(--tc-accent) disabled:opacity-50 ${
                      isDarkTheme
                        ? "border-[#355483] bg-[#16315f] hover:border-[#ff8a9c] hover:text-white"
                        : "border-[#ccd8ee] bg-[#102755] hover:border-(--tc-accent)"
                    }`}
                    onClick={() => void copyProfileCardValue()}
                    disabled={!profileCardValue}
                    title={copied ? "Copiado" : `Copiar ${copyActionLabel}`}
                  >
                    {copied ? <FiCheck aria-hidden /> : <FiCopy aria-hidden />}
                  </button>
                </div>
              </div>
            </div>

            {toast.kind !== "idle" && (
              <div
                className={[
                  "mt-3 rounded-xl border px-3 py-2 text-xs",
                  toast.kind === "success"
                    ? isDarkTheme
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : isDarkTheme
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                      : "border-rose-200 bg-rose-50 text-rose-700",
                ].join(" ")}
                role="status"
                aria-live="polite"
              >
                {toast.message}
              </div>
            )}
          </div>

          <div className={`h-px ${isDarkTheme ? "bg-[linear-gradient(90deg,rgba(255,138,156,0)_0%,rgba(255,138,156,0.16)_18%,rgba(132,170,255,0.24)_50%,rgba(255,138,156,0.16)_82%,rgba(255,138,156,0)_100%)]" : "bg-[linear-gradient(90deg,rgba(239,0,1,0)_0%,rgba(239,0,1,0.10)_18%,rgba(10,31,82,0.14)_50%,rgba(239,0,1,0.10)_82%,rgba(239,0,1,0)_100%)]"}`} />

          <div className="px-3.5 py-3">
            <p className={`text-[10px] font-extrabold uppercase tracking-[0.18em] ${isDarkTheme ? "text-[#ff8a9c]" : "text-(--tc-accent)"}`}>Conta</p>
            <ul aria-label="Opcoes do menu de perfil" className="mt-2 space-y-2">
              <MenuItem
                isDarkTheme={isDarkTheme}
                icon={<FiSettings aria-hidden />}
                label="Meu perfil"
                hint="Dados, preferencias e seguranca"
                onClick={() => {
                  setOpen(false);
                  router.push("/settings/profile");
                }}
                autoFocus
              />
            </ul>
          </div>

          <div className={`h-px ${isDarkTheme ? "bg-[linear-gradient(90deg,rgba(255,138,156,0)_0%,rgba(255,138,156,0.16)_18%,rgba(132,170,255,0.24)_50%,rgba(255,138,156,0.16)_82%,rgba(255,138,156,0)_100%)]" : "bg-[linear-gradient(90deg,rgba(239,0,1,0)_0%,rgba(239,0,1,0.10)_18%,rgba(10,31,82,0.14)_50%,rgba(239,0,1,0.10)_82%,rgba(239,0,1,0)_100%)]"}`} />

          <div className="px-3.5 py-3">
            <p className={`text-[11px] font-extrabold uppercase tracking-[0.2em] ${isDarkTheme ? "text-[#ff8a9c]" : "text-(--tc-accent)"}`}>
              Documentacoes
            </p>
            <ul className="mt-2 space-y-2" aria-label="Materiais">
              <MenuItem
                isDarkTheme={isDarkTheme}
                icon={<FiFolder aria-hidden />}
                label="Documentacoes"
                hint={docsLabel}
                onClick={() => {
                  setOpen(false);
                  router.push(docsRoute);
                }}
              />
            </ul>
          </div>

          <div className={`h-px ${isDarkTheme ? "bg-[linear-gradient(90deg,rgba(255,138,156,0)_0%,rgba(255,138,156,0.16)_18%,rgba(132,170,255,0.24)_50%,rgba(255,138,156,0.16)_82%,rgba(255,138,156,0)_100%)]" : "bg-[linear-gradient(90deg,rgba(239,0,1,0)_0%,rgba(239,0,1,0.10)_18%,rgba(10,31,82,0.14)_50%,rgba(239,0,1,0.10)_82%,rgba(239,0,1,0)_100%)]"}`} />

          <ul aria-label="Sessao" className="p-3.5 pt-2.5">
            <li>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className={`flex w-full items-center gap-2 rounded-[18px] px-4 py-3 text-sm font-semibold shadow-[0_10px_26px_rgba(15,23,42,0.05)] transition ${
                  isDarkTheme
                    ? "border border-[#355483] bg-[#0d1a35] text-[#ffd4db] hover:border-[#ff8a9c] hover:bg-[#4d1220] hover:text-white"
                    : "border border-[#f0b9c3] bg-white text-[#c9485f] hover:border-[#df7a8b] hover:bg-rose-50 hover:text-[#a81f3d]"
                }`}
              >
                <FiLogOut aria-hidden />
                Sair
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
