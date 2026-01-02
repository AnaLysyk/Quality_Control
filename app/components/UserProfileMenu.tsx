"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";

type Props = {
  activeClientName?: string | null;
  onEditCompany?: () => void;
  onOpenTeam?: () => void;
  onOpenSettings?: () => void;
};

export default function UserProfileMenu({ activeClientName, onEditCompany, onOpenTeam, onOpenSettings }: Props) {
  const { user, loading, refreshUser } = useAuthUser();
  const isAdmin = !!user?.isGlobalAdmin || (user as any)?.is_global_admin === true;
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  async function handleAvatarUpload(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await fetch("/api/me/avatar", { method: "POST", body: form, credentials: "include" });
      await refreshUser();
    } catch {
      /* ignore */
    } finally {
      setUploading(false);
      setOpen(false);
    }
  }

  function handleLogout() {
    try {
      localStorage.removeItem("auth_ok");
      document.cookie = "auth=; Max-Age=0; path=/;";
      document.cookie = "auth_token=; Max-Age=0; path=/;";
    } catch {
      /* ignore */
    } finally {
      router.replace("/login");
    }
  }

  const displayName = loading ? "Carregando..." : user?.name || "Usuario";

  // Se nao ha usuario e nao esta carregando, mostre um botao de login simples
  if (!loading && !user) {
    return (
      <button
        type="button"
        className="rounded-full border border-[var(--tc-border,#e5e7eb)] bg-[var(--tc-surface-dark,#0f1828)] px-3 py-2 text-sm text-white hover:bg-[var(--tc-surface-hover,#111a2a)]"
        onClick={() => router.push("/login")}
      >
        Entrar
      </button>
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        aria-label="Menu do usuario"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center h-11 w-11 rounded-full border border-[var(--tc-border,#e5e7eb)]/70 bg-[var(--tc-surface-dark,#0f1828)] text-white shadow-[0_8px_20px_rgba(0,0,0,0.2)] hover:border-[var(--tc-primary,#4e8df5)] hover:bg-[var(--tc-surface-hover,#111a2a)] transition-all"
      >
        {/* Apenas ícone de perfil */}
        <span className="sr-only">{displayName}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 12c2.485 0 4.5-2.015 4.5-4.5S14.485 3 12 3 7.5 5.015 7.5 7.5 9.515 12 12 12z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.75 19.5a7.25 7.25 0 0114.5 0"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-xl border border-[var(--tc-border,#e5e7eb)]/40 bg-[var(--tc-surface-dark,#0f1828)] text-[var(--tc-text-inverse,#fff)] shadow-[0_12px_30px_rgba(0,0,0,0.22)]"
        >
          <div className="px-4 py-3 space-y-1">
            <div className="font-semibold leading-tight">{user?.name ?? "Usuario"}</div>
            {user?.email ? (
              <div className="text-xs text-[var(--tc-text-muted,#cbd5e1)] truncate">{user.email}</div>
            ) : (
              <div className="text-xs text-[var(--tc-text-muted,#cbd5e1)]">Nao autenticado</div>
            )}
            {activeClientName && (
              <div className="text-sm">
                {isAdmin && onEditCompany ? (
                  <button className="text-[var(--tc-accent,#4f46e5)] underline" onClick={onEditCompany}>
                    {activeClientName}
                  </button>
                ) : (
                  <span className="text-[var(--tc-text-muted,#cbd5e1)]">{activeClientName}</span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-2 text-xs text-[var(--tc-primary,#4f46e5)] hover:underline"
              disabled={uploading || !user}
            >
              {uploading ? "Atualizando foto..." : "Editar foto"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleAvatarUpload(e.target.files?.[0])}
            />
          </div>

          <div className="border-t border-[var(--tc-border,#e5e7eb)]/40" />

          <div className="py-2">
            {onOpenTeam && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenTeam();
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--tc-surface-hover,#111a2a)]"
              >
                Equipe
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenSettings ? onOpenSettings() : router.push("/settings");
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--tc-surface-hover,#111a2a)]"
            >
              Configuracoes
            </button>
          </div>

          <div className="border-t border-[var(--tc-border,#e5e7eb)]/40" />

          <button
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
