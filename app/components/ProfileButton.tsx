"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiLogOut,
  FiSettings,
  FiShield,
  FiCopy,
  FiCheck,
  FiX,
  FiEdit2,
  FiFolder,
} from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";

type ToastState =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

type AvatarKey = "rocket" | "ninja" | "robot" | "lab" | "hacker";

// GIF/emoji fixos (substituíveis depois por assets reais em /public/avatars/*.gif)
const AVATAR_OPTIONS: { key: AvatarKey; label: string; emoji: string }[] = [
  { key: "rocket", label: "Rocket", emoji: "\u{1F680}" }, // 🚀
  { key: "ninja", label: "Ninja", emoji: "\u{1F977}" }, // 🥷
  { key: "robot", label: "Bot", emoji: "\u{1F916}" }, // 🤖
  { key: "lab", label: "Lab", emoji: "\u{1F9EA}" }, // 🧪
  { key: "hacker", label: "Hacker", emoji: "\u{1F576}" }, // 🕶
];

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
            <span className="block text-xs text-(--tc-text-muted,#64748b) dark:text-(--tc-text-muted,#cbd5e1) truncate">
              {hint}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

export default function ProfileButton() {
  const router = useRouter();
  const { user, logout } = useAuthUser();
  const { activeClient } = useClientContext();

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
  const [avatarOverrideKey, setAvatarOverrideKey] = useState<AvatarKey | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = window.localStorage.getItem("profile_avatar_icon");
    if (typeof saved === "string" && AVATAR_OPTIONS.some((a) => a.key === saved)) return saved as AvatarKey;
    return null;
  });
  const [avatarError, setAvatarError] = useState(false);
  const hasMounted = typeof window !== "undefined";

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdmin = Boolean(user?.isGlobalAdmin || legacyUser?.isGlobalAdmin || legacyUser?.roleGlobal === "ADMIN");
  const displayName = user?.name || "Usuario";
  const displayEmail = user?.email || "";
  const companyName = (() => {
    if (activeClient?.name) return activeClient.name;
    if (isAdmin) return "Admin do sistema";

    const legacyCompany = legacyUser?.company;
    if (legacyCompany && typeof legacyCompany === "object" && legacyCompany !== null) {
      const name = (legacyCompany as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) return name;
    }

    const userCompany = (user ?? null) && typeof (user as Record<string, unknown>) === "object"
      ? (user as Record<string, unknown> & { company?: unknown }).company
      : null;

    if (userCompany && typeof userCompany === "object" && userCompany !== null) {
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

    const userCompany = (user ?? null) && typeof (user as Record<string, unknown>) === "object"
      ? (user as Record<string, unknown> & { company?: unknown }).company
      : null;

    if (userCompany && typeof userCompany === "object" && userCompany !== null) {
      const slug = (userCompany as { slug?: unknown }).slug;
      if (typeof slug === "string" && slug.trim()) return slug;
    }

    return undefined;
  })();
  const companyResources = Array.isArray(legacyUser?.companyResources) ? legacyUser.companyResources : [];

  const avatarKey: AvatarKey = useMemo(() => {
    if (avatarOverrideKey) return avatarOverrideKey;
    const candidate = user?.avatarKey;
    if (typeof candidate === "string" && AVATAR_OPTIONS.some((a) => a.key === candidate)) return candidate as AvatarKey;
    return "rocket";
  }, [avatarOverrideKey, user?.avatarKey]);

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

  const avatarIcon = useMemo(() => {
    const found = AVATAR_OPTIONS.find((a) => a.key === avatarKey);
    return found?.emoji || "\u{1F680}";
  }, [avatarKey]);
  const avatarDisplay = avatarError
    ? displayName.slice(0, 2).toUpperCase()
    : hasMounted
      ? avatarIcon
      : "\u{1F680}";


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
      showToast("success", "Email copiado");
    } catch {
      showToast("error", "Nao foi possivel copiar");
    }
  }

  async function handleLogout() {
    setOpen(false);
    await logout();
    router.replace("/login");
  }

  function selectAvatar(key: AvatarKey) {
    setAvatarOverrideKey(key);
    setAvatarError(false);
    window.localStorage.setItem("profile_avatar_icon", key);
    setShowAvatarPicker(false);
    // TODO: opcional - chamar /api/me/avatar para persistir
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Abrir menu do usuario: ${displayName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? "profile-menu" : undefined}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-(--tc-surface-dark,#0f1828) text-white shadow-[0_10px_22px_rgba(0,0,0,0.28)] transition hover:border-(--tc-primary,#4e8df5) hover:shadow-[0_12px_26px_rgba(78,141,245,0.25)] focus:outline-none focus:ring-2 focus:ring-(--tc-primary,#4e8df5) focus:ring-offset-2 focus:ring-offset-transparent"
      >
        <div className="relative h-full w-full overflow-hidden rounded-full bg-linear-to-br from-(--tc-primary,#4e8df5) to-(--tc-surface-dark,#0f1828)">
          <span className="flex h-full w-full items-center justify-center text-2xl" aria-hidden>
            {avatarDisplay}
          </span>
        </div>
      </button>

      {open && (
        <div
          id="profile-menu"
          aria-label="Menu de perfil"
          ref={menuRef}
          className="absolute right-0 mt-2 w-[min(380px,calc(100vw-1rem))] max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-(--tc-border,#e5e7eb)/70 bg-(--tc-surface,#ffffff) text-(--tc-text,#0f172a) shadow-[0_18px_50px_rgba(0,0,0,0.18)] dark:border-white/12 dark:bg-(--tc-surface-dark,#0f1828) dark:text-(--tc-text-inverse,#fff) dark:shadow-[0_18px_50px_rgba(0,0,0,0.4)]"
        >
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="relative h-14 w-14 shrink-0">
                  <button
                    type="button"
                    aria-label="Trocar avatar"
                    onClick={() => setShowAvatarPicker((v) => !v)}
                    className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-(--tc-primary,#4e8df5)/28 bg-(--tc-primary,#4e8df5)/12 text-2xl shadow-[0_0_18px_rgba(78,142,245,0.30)] focus:outline-none focus:ring-2 focus:ring-(--tc-primary,#4e8df5) overflow-visible dark:border-(--tc-primary,#4e8df5)/25 dark:bg-black/20"
                  >
                    <span className="text-2xl" aria-hidden>
                      {avatarDisplay}
                    </span>
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
                        <span className="text-[10px] lowercase">gif/emoji</span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {AVATAR_OPTIONS.map((opt) => {
                          const active = opt.key === avatarKey;
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => selectAvatar(opt.key)}
                              className={`flex h-10 items-center justify-center rounded-lg border text-lg transition-colors ${
                                active
                                  ? "border-(--tc-primary,#4e8df5) bg-(--tc-primary,#4e8df5)/15 text-(--tc-primary,#4e8df5) shadow-[0_6px_20px_rgba(78,141,245,0.45)]"
                                  : "border-slate-200 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-100 dark:border-white/15 dark:bg-slate-900/60 dark:text-white dark:hover:border-white/30 dark:hover:bg-slate-800"
                              }`}
                            >
                              <span aria-hidden>{opt.emoji}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-(--tc-text-muted,#64748b) dark:text-(--tc-text-muted,#cbd5e1)">Conta</p>
                  <div className="truncate text-sm font-medium leading-tight text-(--tc-text,#0f172a) dark:text-(--tc-text-inverse,#fff)">
                    {displayName}
                  </div>
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
                <span className="flex-1 whitespace-nowrap truncate text-(--tc-text-muted,#64748b) dark:text-(--tc-text-muted,#cbd5e1)">{displayEmail || "-"}</span>
                <button
                  type="button"
                  aria-label="Copiar email"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-(--tc-primary,#4e8df5)/30 bg-(--tc-primary,#4e8df5)/14 text-base text-(--tc-primary,#4e8df5) hover:bg-(--tc-primary,#4e8df5)/18 disabled:opacity-50 dark:border-(--tc-primary,#4e8df5)/28 dark:bg-(--tc-primary,#4e8df5)/18 dark:text-white dark:hover:bg-(--tc-primary,#4e8df5)/24"
                  onClick={copyEmail}
                  disabled={!displayEmail}
                  title={copied ? "Copiado" : "Copiar email"}
                >
                  {copied ? <FiCheck aria-hidden /> : <FiCopy aria-hidden />}
                </button>
              </div>

              <div className="flex flex-col gap-1 text-xs">
                <span className="inline-flex max-w-full w-fit items-center rounded-full border border-(--tc-accent,#ef0001)/55 bg-(--tc-accent,#ef0001) px-3 py-1.5 font-semibold text-[11px] tracking-[0.08em] text-white shadow-[0_10px_22px_rgba(239,0,1,0.22)]">
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

          <ul aria-label="Opções do menu de perfil" className="py-2">
            <MenuItem
              icon={<FiSettings aria-hidden />}
              label="Meu perfil"
              hint="Dados e preferências"
              onClick={() => {
                setOpen(false);
                router.push("/settings/profile");
              }}
              autoFocus
            />
            <MenuItem
              icon={<FiSettings aria-hidden />}
              label="Configurações"
              hint="Conta, segurança, aparência"
              onClick={() => {
                setOpen(false);
                router.push("/settings");
              }}
            />
          </ul>

          <div className="h-px bg-(--tc-border,#e5e7eb)/70 dark:bg-white/10" />

          <div className="px-4 pt-4 pb-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-(--tc-text-muted,#64748b) dark:text-(--tc-text-muted,#cbd5e1)">
              Documentações
            </p>
            <ul className="mt-2 space-y-2" aria-label="Materiais">
              <li>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg border border-(--tc-primary,#4e8df5)/22 bg-(--tc-primary,#4e8df5)/8 px-3 py-2 text-sm text-(--tc-text,#0f172a) transition-colors hover:bg-(--tc-primary,#4e8df5)/12 dark:text-(--tc-text-inverse,#fff) dark:border-(--tc-primary,#4e8df5)/20 dark:bg-(--tc-primary,#4e8df5)/10 dark:hover:bg-(--tc-primary,#4e8df5)/14"
                  onClick={() => {
                    setOpen(false);
                    router.push(companySlug ? `/empresas/${companySlug}/documentos` : "/docs");
                  }}
                >
                  <FiFolder aria-hidden />
                  <span className="truncate">
                    {companyResources.length ? `${companyResources.length} documentações` : "Abrir documentações"}
                  </span>
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
                  label="Administração"
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

          <ul aria-label="Sessão" className="p-2">
            <li>
              <button
                type="button"
                onClick={handleLogout}
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
