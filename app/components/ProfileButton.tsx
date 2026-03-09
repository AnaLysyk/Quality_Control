"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiCheck,
  FiCopy,
  FiEdit2,
  FiFolder,
  FiLogOut,
  FiSettings,
  FiShield,
  FiX,
} from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";
import { AVATAR_OPTIONS, type AvatarKey, isAvatarKey, resolveAvatarEmoji } from "@/lib/avatarCatalog";

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
}) {
  const { icon, label, hint, onClick, autoFocus } = props;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        autoFocus={autoFocus}
        className="group flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-(--tc-primary,#4e8df5)/10 dark:hover:bg-(--tc-primary,#4e8df5)/12"
      >
        <span
          className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-(--tc-primary,#4e8df5)/25 bg-(--tc-primary,#4e8df5)/10 text-(--tc-primary,#4e8df5) group-hover:bg-(--tc-primary,#4e8df5)/16 dark:border-(--tc-primary,#4e8df5)/30"
          aria-hidden
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{label}</span>
          {hint ? (
            <span className="block truncate text-xs text-(--tc-text-muted,#64748b) dark:text-(--tc-text-muted,#cbd5e1)">
              {hint}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

function AvatarSurface(props: {
  avatarUrl?: string | null;
  avatarKey?: string | null;
  fallback: string;
  className?: string;
  textClassName?: string;
}) {
  const { avatarUrl, avatarKey, fallback, className = "", textClassName = "" } = props;
  const emoji = resolveAvatarEmoji(avatarKey);

  return (
    <div
      className={`relative overflow-hidden rounded-full bg-linear-to-br from-(--tc-primary,#4e8df5) to-(--tc-surface-dark,#0f1828) ${className}`}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={`flex h-full w-full items-center justify-center ${textClassName}`} aria-hidden suppressHydrationWarning>
          {emoji ?? fallback}
        </span>
      )}
    </div>
  );
}

export default function ProfileButton() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuthUser();
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
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [toast, setToast] = useState<ToastState>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarOverrideKey, setAvatarOverrideKey] = useState<AvatarKey | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = window.localStorage.getItem("profile_avatar_icon");
    return isAvatarKey(saved) ? saved : null;
  });

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
  const displayName = user?.fullName?.trim() || user?.name || "Usuario";
  const displayEmail = user?.email || "";
  const displayUser = user?.username || user?.user || "";
  const avatarKey = useMemo<AvatarKey>(() => {
    if (avatarOverrideKey && isAvatarKey(avatarOverrideKey)) return avatarOverrideKey;
    return isAvatarKey(user?.avatarKey) ? user.avatarKey : "rocket";
  }, [avatarOverrideKey, user?.avatarKey]);

  const companyName = (() => {
    if (isGlobalProfile) return "Global";
    if (activeClient?.name) return activeClient.name;
    if (isAdmin) return "Admin do sistema";

    const legacyCompany = legacyUser?.company;
    if (legacyCompany && typeof legacyCompany === "object" && legacyCompany !== null) {
      const name = (legacyCompany as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) return name;
    }

    const userCompany =
      (user ?? null) && typeof (user as Record<string, unknown>) === "object"
        ? ((user as Record<string, unknown> & { company?: unknown }).company ?? null)
        : null;

    if (userCompany && typeof userCompany === "object") {
      const name = (userCompany as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) return name;
    }

    return "Empresa";
  })();

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
      ? `Documentacoes (${companyCount} empresas)`
      : "Documentacoes da empresa"
    : "Abrir documentacoes";

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

  async function copyEmail() {
    if (!displayEmail) return;
    try {
      await navigator.clipboard.writeText(displayEmail);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
      showToast("success", "E-mail copiado");
    } catch {
      showToast("error", "Nao foi possivel copiar");
    }
  }

  async function handleLogout() {
    setOpen(false);
    try {
      const prefix = "chat_history_v1:";
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          localStorage.removeItem(key);
          i = -1;
        }
      }
    } catch {
      // ignore
    }
    await logout();
    router.replace("/login");
  }

  async function selectAvatar(key: AvatarKey) {
    setAvatarOverrideKey(key);
    window.localStorage.setItem("profile_avatar_icon", key);
    setAvatarSaving(true);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_key: key }),
      });

      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error || "Nao foi possivel salvar o avatar.");
      }

      await refreshUser();
      showToast("success", "Avatar atualizado");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Nao foi possivel salvar o avatar.");
    } finally {
      setAvatarSaving(false);
      setShowAvatarPicker(false);
    }
  }

  const avatarFallback = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Abrir menu do usuario: ${displayName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? "profile-menu" : undefined}
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-(--tc-surface-dark,#0f1828) text-white shadow-[0_10px_22px_rgba(0,0,0,0.28)] transition hover:border-(--tc-primary,#4e8df5) hover:shadow-[0_12px_26px_rgba(78,141,245,0.25)] focus:outline-none focus:ring-2 focus:ring-(--tc-primary,#4e8df5) focus:ring-offset-2 focus:ring-offset-transparent"
      >
        <AvatarSurface
          avatarUrl={user?.avatarUrl ?? null}
          avatarKey={avatarKey}
          fallback={avatarFallback}
          className="h-full w-full"
          textClassName="text-2xl"
        />
      </button>

      {open && (
        <div
          id="profile-menu"
          aria-label="Menu de perfil"
          className="absolute right-0 mt-2 max-h-[calc(100vh-5rem)] w-[min(380px,calc(100vw-1rem))] overflow-y-auto overscroll-contain rounded-2xl border border-(--tc-border,#e5e7eb)/70 bg-(--tc-surface,#ffffff) text-(--tc-text,#0f172a) shadow-[0_18px_50px_rgba(0,0,0,0.18)] dark:border-white/12 dark:bg-(--tc-surface-dark,#0f1828) dark:text-(--tc-text-inverse,#fff) dark:shadow-[0_18px_50px_rgba(0,0,0,0.4)]"
        >
          <div className="px-4 pb-3 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="relative h-14 w-14 shrink-0">
                  <button
                    type="button"
                    aria-label="Trocar avatar"
                    onClick={() => setShowAvatarPicker((value) => !value)}
                    className="group relative flex h-14 w-14 items-center justify-center overflow-visible rounded-full border border-(--tc-primary,#4e8df5)/28 bg-(--tc-primary,#4e8df5)/12 shadow-[0_0_18px_rgba(78,142,245,0.30)] focus:outline-none focus:ring-2 focus:ring-(--tc-primary,#4e8df5) dark:border-(--tc-primary,#4e8df5)/25 dark:bg-black/20"
                  >
                    <AvatarSurface
                      avatarUrl={user?.avatarUrl ?? null}
                      avatarKey={avatarKey}
                      fallback={avatarFallback}
                      className="h-14 w-14"
                      textClassName="text-2xl"
                    />
                    <span
                      className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-(--tc-primary,#4e8df5)/50 bg-(--tc-primary,#4e8df5) text-[11px] text-white shadow-[0_4px_10px_rgba(0,0,0,0.25)]"
                      aria-hidden
                    >
                      <FiEdit2 />
                    </span>
                  </button>

                  {showAvatarPicker && (
                    <div className="absolute left-14 top-0 z-10 w-56 rounded-xl border border-slate-200 bg-white/90 p-3 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.25)] backdrop-blur-xl dark:border-white/15 dark:bg-slate-900/80 dark:text-white">
                      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-(--tc-text-muted,#cbd5e1)">
                        <span>Escolher avatar</span>
                        <span className="text-[10px] lowercase">{avatarSaving ? "salvando..." : "emoji"}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {AVATAR_OPTIONS.map((option) => {
                          const active = option.key === avatarKey;
                          return (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => void selectAvatar(option.key)}
                              className={`flex h-10 items-center justify-center rounded-lg border text-lg transition-colors ${
                                active
                                  ? "border-(--tc-primary,#4e8df5) bg-(--tc-primary,#4e8df5)/15 text-(--tc-primary,#4e8df5) shadow-[0_6px_20px_rgba(78,141,245,0.45)]"
                                  : "border-slate-200 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-100 dark:border-white/15 dark:bg-slate-900/60 dark:text-white dark:hover:border-white/30 dark:hover:bg-slate-800"
                              }`}
                            >
                              <span aria-hidden>{option.emoji}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-(--tc-text-muted,#64748b) dark:text-(--tc-text-muted,#cbd5e1)">
                    Conta
                  </p>
                  <div className="truncate text-sm font-medium leading-tight text-(--tc-text,#0f172a) dark:text-(--tc-text-inverse,#fff)">
                    {displayName}
                  </div>
                  {displayUser ? (
                    <div className="truncate text-xs text-(--tc-text-muted,#64748b) dark:text-(--tc-text-muted,#cbd5e1)">
                      @{displayUser}
                    </div>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                className="rounded-lg border border-transparent p-2 transition-colors hover:border-(--tc-border)/60 hover:bg-(--tc-accent-soft)"
                aria-label="Fechar menu"
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
              >
                <FiX aria-hidden />
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <div className="flex w-full items-center gap-2 rounded-lg border border-(--tc-primary,#4e8df5)/25 bg-(--tc-primary,#4e8df5)/6 px-3 py-2 text-sm leading-tight text-(--tc-text,#0f172a) shadow-[0_8px_18px_rgba(0,0,0,0.16)] dark:border-(--tc-primary,#4e8df5)/22 dark:bg-(--tc-primary,#4e8df5)/10 dark:text-(--tc-text-inverse,#fff)">
                <span className="flex-1 truncate whitespace-nowrap text-(--tc-text-muted,#64748b) dark:text-(--tc-text-muted,#cbd5e1)">
                  {displayEmail || "-"}
                </span>
                <button
                  type="button"
                  aria-label="Copiar e-mail"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-(--tc-primary,#4e8df5)/30 bg-(--tc-primary,#4e8df5)/14 text-base text-(--tc-primary,#4e8df5) hover:bg-(--tc-primary,#4e8df5)/18 disabled:opacity-50 dark:border-(--tc-primary,#4e8df5)/28 dark:bg-(--tc-primary,#4e8df5)/18 dark:text-white dark:hover:bg-(--tc-primary,#4e8df5)/24"
                  onClick={() => void copyEmail()}
                  disabled={!displayEmail}
                  title={copied ? "Copiado" : "Copiar e-mail"}
                >
                  {copied ? <FiCheck aria-hidden /> : <FiCopy aria-hidden />}
                </button>
              </div>

              <div className="flex flex-col gap-1 text-xs">
                <span className="inline-flex max-w-full w-fit items-center rounded-full border border-(--tc-accent,#ef0001)/55 bg-(--tc-accent,#ef0001) px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] text-white shadow-[0_10px_22px_rgba(239,0,1,0.22)]">
                  <span className="max-w-70 truncate" title={companyName}>
                    {companyName}
                  </span>
                </span>
              </div>
            </div>

            {toast.kind !== "idle" && (
              <div
                className={[
                  "mt-3 rounded-xl border px-3 py-2 text-xs",
                  toast.kind === "success"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                    : "border-red-500/20 bg-red-500/10 text-red-200",
                ].join(" ")}
                role="status"
                aria-live="polite"
              >
                {toast.message}
              </div>
            )}
          </div>

          <div className="h-px bg-(--tc-border,#e5e7eb)/70 dark:bg-white/10" />

          <ul aria-label="Opcoes do menu de perfil" className="py-2">
            <MenuItem
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

          <div className="h-px bg-(--tc-border,#e5e7eb)/70 dark:bg-white/10" />

          <div className="px-4 pb-3 pt-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-(--tc-text-muted,#64748b) dark:text-(--tc-text-muted,#cbd5e1)">
              Documentacoes
            </p>
            <ul className="mt-2 space-y-2" aria-label="Materiais">
              <li>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg border border-(--tc-primary,#4e8df5)/22 bg-(--tc-primary,#4e8df5)/8 px-3 py-2 text-sm text-(--tc-text,#0f172a) transition-colors hover:bg-(--tc-primary,#4e8df5)/12 dark:border-(--tc-primary,#4e8df5)/20 dark:bg-(--tc-primary,#4e8df5)/10 dark:text-(--tc-text-inverse,#fff) dark:hover:bg-(--tc-primary,#4e8df5)/14"
                  onClick={() => {
                    setOpen(false);
                    router.push(docsRoute);
                  }}
                >
                  <FiFolder aria-hidden />
                  <span className="truncate">{docsLabel}</span>
                </button>
              </li>
            </ul>
          </div>

          {isAdmin && (
            <>
              <div className="h-px bg-(--tc-border,#e5e7eb)/70 dark:bg-white/10" />
              <ul aria-label="Admin" className="py-2">
                <MenuItem
                  icon={<FiShield aria-hidden />}
                  label="Administracao"
                  hint={activeClient?.name ? `Cliente: ${activeClient.name}` : "Sem empresa selecionada"}
                  onClick={() => {
                    setOpen(false);
                    router.push("/admin/home");
                  }}
                />
              </ul>
            </>
          )}

          <div className="h-px bg-(--tc-border,#e5e7eb)/70 dark:bg-white/10" />

          <ul aria-label="Sessao" className="p-2">
            <li>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex w-full items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm text-red-600 transition-colors hover:border-red-500/20 hover:bg-red-500/10 dark:text-red-300"
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
