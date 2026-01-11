"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  FiLogOut,
  FiSettings,
  FiHelpCircle,
  FiShield,
  FiCopy,
  FiCheck,
  FiX,
  FiEdit2,
  FiFolder,
} from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";

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
        className="group flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-white/5"
      >
        <span
          className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 group-hover:bg-white/10"
          aria-hidden
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{label}</span>
          {hint ? (
            <span className="block text-xs text-(--tc-text-muted,#cbd5e1) truncate">{hint}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

export default function ProfileButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthUser();

  const [open, setOpen] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [toast, setToast] = useState<ToastState>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const [avatarKey, setAvatarKey] = useState<AvatarKey>("rocket");
  const [avatarError, setAvatarError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdmin = Boolean((user as any)?.isGlobalAdmin || user?.roleGlobal === "ADMIN");
  const displayName = user?.name || "Usuario";
  const displayEmail = user?.email || "";
  const companyName = isAdmin ? "Testing Company" : user?.company?.name ?? "Empresa";
  const companySlug = user?.company?.slug;
  const companyResources = (user as any)?.companyResources || [];
  const companyRole = user?.company?.roleAtCompany || user?.role || "-";

  useEffect(() => {
    const saved = window.localStorage.getItem("profile_avatar_icon") as AvatarKey | null;
    if (saved && AVATAR_OPTIONS.find((a) => a.key === saved)) {
      setAvatarKey(saved);
    } else if (user?.avatarKey && AVATAR_OPTIONS.find((a) => a.key === (user.avatarKey as AvatarKey))) {
      setAvatarKey(user.avatarKey as AvatarKey);
    }
  }, [user?.avatarKey]);

  useEffect(() => {
    setOpen(false);
    setShowAvatarPicker(false);
  }, [pathname]);

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

  function handleLogout() {
    try {
      fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      localStorage.removeItem("auth_ok");
      document.cookie = "auth=; Max-Age=0; path=/;";
    } catch {
      /* ignore */
    } finally {
      setOpen(false);
      router.replace("/login");
    }
  }

  function selectAvatar(key: AvatarKey) {
    setAvatarKey(key);
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
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-(--tc-surface-dark,#0f1828) text-white shadow-[0_10px_22px_rgba(0,0,0,0.28)] transition hover:border-(--tc-primary,#4e8df5) hover:shadow-[0_12px_26px_rgba(78,141,245,0.25)] focus:outline-none focus:ring-2 focus:ring-(--tc-primary,#4e8df5) focus:ring-offset-2 focus:ring-offset-transparent"
      >
        <div className="relative h-full w-full overflow-hidden rounded-full bg-linear-to-br from-(--tc-primary,#4e8df5) to-(--tc-surface-dark,#0f1828)">
          <span className="flex h-full w-full items-center justify-center text-xl" aria-hidden>
            {avatarError ? displayName.slice(0, 2).toUpperCase() : avatarIcon}
          </span>
        </div>
      </button>

      {open && (
        <div
          id="profile-menu"
          aria-label="Menu de perfil"
          ref={menuRef}
          className="absolute right-0 mt-2 w-[380px] max-h-[80vh] overflow-y-auto rounded-2xl border border-(--tc-border,#e5e7eb)/40 bg-(--tc-surface-dark,#0f1828) text-(--tc-text-inverse,#fff) shadow-[0_18px_50px_rgba(0,0,0,0.4)]"
        >
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-start gap-3">
              <div className="relative h-12 w-12 shrink-0">
                <button
                  type="button"
                  aria-label="Trocar avatar"
                  onClick={() => setShowAvatarPicker((v) => !v)}
                  className="group relative flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-black/20 text-xl shadow-[0_0_18px_rgba(78,142,245,0.35)] focus:outline-none focus:ring-2 focus:ring-(--tc-primary,#4e8df5) overflow-visible"
                >
                  <span className="text-xl" aria-hidden>
                    {avatarError ? displayName.slice(0, 2).toUpperCase() : avatarIcon}
                  </span>
                  <span
                    className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/60 bg-white text-[10px] text-(--tc-surface-dark,#0f1828) shadow-[0_4px_10px_rgba(0,0,0,0.25)] group-hover:bg-(--tc-primary,#4e8df5) group-hover:text-white"
                    aria-hidden
                  >
                    <FiEdit2 />
                  </span>
                </button>

                {showAvatarPicker && (
                  <div className="absolute left-14 top-0 z-10 w-56 rounded-xl border border-white/10 bg-(--tc-surface-dark,#0f1828) p-3 shadow-xl">
                    <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-(--tc-text-muted,#cbd5e1)">
                      <span>Escolher avatar</span>
                      <span className="text-[10px] lowercase">gif/emoji</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {AVATAR_OPTIONS.map((opt) => {
                        const active = opt.key === avatarKey;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => selectAvatar(opt.key)}
                            className={`flex h-10 items-center justify-center rounded-lg border text-lg ${
                              active
                                ? "border-(--tc-primary,#4e8df5) bg-(--tc-primary,#4e8df5)/15 text-(--tc-primary,#4e8df5)"
                                : "border-white/10 bg-white/5 text-white hover:border-white/30 hover:bg-white/10"
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
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-(--tc-text-muted,#cbd5e1)">Conta</p>
                    <div className="truncate text-sm font-medium leading-tight text-(--tc-text-inverse,#fff)">
                      {displayName}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border border-transparent p-2 hover:border-white/10 hover:bg-white/10"
                    aria-label="Fechar menu"
                    onClick={() => {
                      setOpen(false);
                      buttonRef.current?.focus();
                    }}
                  >
                    <FiX aria-hidden />
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex w-full items-center gap-2 rounded-lg border border-(--tc-border,#e5e7eb)/60 bg-(--tc-surface,#ffffff)/95 px-3 py-2 text-sm leading-tight text-(--tc-text,#0f172a) shadow-[0_8px_18px_rgba(0,0,0,0.20)] dark:border-white/15 dark:bg-white/10 dark:text-(--tc-text-inverse,#fff)">
                    <span className="flex-1 whitespace-nowrap truncate">{displayEmail || "-"}</span>
                    <button
                      type="button"
                      aria-label="Copiar email"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-(--tc-border,#e5e7eb)/60 bg-(--tc-surface,#ffffff)/80 text-base text-(--tc-text,#0f172a) hover:bg-white/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/15 dark:text-(--tc-text-inverse,#fff)"
                      onClick={copyEmail}
                      disabled={!displayEmail}
                      title={copied ? "Copiado" : "Copiar email"}
                    >
                      {copied ? <FiCheck aria-hidden /> : <FiCopy aria-hidden />}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="inline-flex w-fit items-center rounded-full border border-(--tc-primary,#4e8df5) bg-(--tc-primary,#4e8df5)/18 px-2.5 py-1 font-mono text-[11px] tracking-tight text-(--tc-primary,#4e8df5) shadow-[0_0_18px_rgba(78,142,245,0.55)] dark:text-(--tc-primary,#9cc4ff)">
                      {companyName}
                    </span>
                  </div>
                </div>
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

          <div className="h-px bg-white/10" />

          <ul aria-label="Opcões do menu de perfil" className="py-2">
            <MenuItem
              icon={<FiSettings aria-hidden />}
              label="Meu perfil"
              hint="Dados e preferencias"
              onClick={() => {
                setOpen(false);
                router.push("/settings/profile");
              }}
              autoFocus
            />
            <MenuItem
              icon={<FiSettings aria-hidden />}
              label="Configuracoes"
              hint="Conta, segurança, aparencia"
              onClick={() => {
                setOpen(false);
                router.push("/settings");
              }}
            />
          </ul>

          <div className="h-px bg-white/10" />

          <div className="px-4 pt-4 pb-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-(--tc-text-muted,#cbd5e1)">
              Documentacoes
            </p>
            <ul className="mt-2 space-y-2" aria-label="Materiais">
              <li>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:border-white/30 hover:bg-white/10"
                  onClick={() => {
                    if (!companySlug) return;
                    setOpen(false);
                    router.push(`/empresas/${companySlug}/documentos`);
                  }}
                >
                  <FiFolder aria-hidden />
                  <span className="truncate">
                    {companyResources.length ? `${companyResources.length} documentacoes` : "Abrir documentacoes"}
                  </span>
                </button>
              </li>
            </ul>
          </div>

          {isAdmin && (
            <>
              <div className="h-px bg-white/10" />
              <ul aria-label="Admin" className="py-2">
                <MenuItem
                  icon={<FiShield aria-hidden />}
                  label="Administracao"
                  hint={`Cliente: ${companyName}`}
                  onClick={() => {
                    setOpen(false);
                    router.push("/admin");
                  }}
                />
              </ul>
            </>
          )}

          <div className="h-px bg-white/10" />

          <ul aria-label="Sessao" className="p-2">
            <li>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm text-red-300 hover:border-red-500/20 hover:bg-red-500/10"
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
