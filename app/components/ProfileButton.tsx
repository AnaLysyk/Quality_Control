"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiLogOut, FiUser } from "react-icons/fi";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";

function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "US";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase() || "US";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfileButton() {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { user, loading, refreshUser } = useAuthUser();

  const displayName = user?.name || "Usuario";
  const displayEmail = user?.email || "";
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem("auth_ok");
      document.cookie = "auth=; Max-Age=0; path=/;";
    } catch {
      /* ignore */
    } finally {
      router.replace("/login");
    }
  };

  async function handleAvatarUpload(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await fetch("/api/me/avatar", { method: "POST", body: form });
      await refreshUser();
    } catch {
      /* ignore upload errors silently */
    } finally {
      setUploading(false);
      setOpen(false);
    }
  }

  const firstName = displayName.split(" ")[0] || displayName;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label="Menu do usuario"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center h-10 w-10 rounded-full transition shadow-[0_8px_20px_rgba(0,0,0,0.25)] bg-[var(--tc-surface-dark,#0f1828)] border border-white/12 hover:border-[var(--tc-primary,#4e8df5)] hover:shadow-[0_10px_24px_rgba(78,141,245,0.25)]"
      >
        <FiUser size={18} className="text-white" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-xl border border-[var(--tc-border,#e5e7eb)]/40 bg-[var(--tc-surface-dark,#0f1828)] text-[var(--tc-text-inverse,#fff)] shadow-lg"
        >
          <div className="px-4 py-3">
            <div className="font-semibold leading-tight">{displayName}</div>
            <div className="text-xs text-[var(--tc-text-muted,#cbd5e1)] truncate">{displayEmail}</div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-2 text-xs text-[var(--tc-primary,#4f46e5)] hover:underline"
              disabled={uploading}
            >
              {uploading ? "Atualizando foto..." : "Editar perfil"}
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

          <ul className="py-2">
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  router.push("/settings");
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--tc-surface-hover,#111a2a)]"
              >
                <span>⚙️</span> Configuracoes
              </button>
            </li>
            {user?.isGlobalAdmin && (
              <li>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    router.push("/admin");
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--tc-surface-hover,#111a2a)]"
                >
                  <span>🛠️</span> Administracao
                </button>
              </li>
            )}
          </ul>

          <div className="border-t border-[var(--tc-border,#e5e7eb)]/40" />

          <button
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
          >
            <FiLogOut size={16} />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
