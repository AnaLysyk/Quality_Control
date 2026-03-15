"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";

import CreateSupportTicketButton from "@/components/CreateSupportTicketButton";
import { useI18n } from "@/hooks/useI18n";

type Props = {
  activeClientName?: string | null;
  onEditCompany?: () => void;
  onOpenTeam?: () => void;
};

export default function UserProfileMenu({ activeClientName, onEditCompany, onOpenTeam }: Props) {
  const { user, loading, refreshUser, logout } = useAuthUser();
  const { t } = useI18n();
  const legacyUser = (user ?? null) as unknown as { is_global_admin?: boolean } | null;
  const isAdmin = !!user?.isGlobalAdmin || legacyUser?.is_global_admin === true;
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

  async function handleLogout() {
    setOpen(false);
    await logout();
    router.replace("/login");
  }

  const displayName = loading ? t("profileMenu.loading") : user?.name || t("profileMenu.userFallback");

  // Universal session fallback: redireciona para login se não há usuário e não está carregando
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (!loading && !user) return null;

  return (
      <div className="relative" ref={boxRef}>
      <button
        type="button"
        aria-label="Menu do usuario"
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-center h-12 w-12 rounded-full border-2 border-(--tc-accent,#ef0001) bg-[#0f172a] text-white shadow-[0_8px_20px_rgba(0,0,0,0.22)] hover:border-(--tc-accent-dark,#c20000) hover:bg-[#111a2a] transition-all"
      >
        <span className="sr-only">{displayName}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          className="h-6 w-6"
        >
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2.2" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="2.2" />
        </svg>
      </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-full sm:w-[20rem] max-w-xs sm:max-w-sm md:max-w-md min-w-0 rounded-2xl border-2 border-(--tc-accent,#ef0001) bg-[#0f172a] text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)]"
          >
          <div className="px-6 py-5 space-y-2">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-(--tc-accent,#ef0001) text-white flex items-center justify-center h-12 w-12 font-bold text-xl uppercase">
                {user?.name?.[0] ?? "U"}
              </div>
              <div>
                <div className="font-bold text-lg leading-tight text-white">{user?.name ?? t("profileMenu.userFallback")}</div>
                {user?.email ? (
                  <div className="text-xs text-blue-100 truncate">{user.email}</div>
                ) : (
                  <div className="text-xs text-blue-200">{t("profileMenu.notAuthenticated")}</div>
                )}
                {user?.role && (
                  <div className="text-xs mt-1 px-2 py-0.5 rounded bg-(--tc-accent,#ef0001)/10 text-(--tc-accent,#ef0001) inline-block font-semibold uppercase tracking-wider">{user.role}</div>
                )}
              </div>
            </div>
            {activeClientName && (
              <div className="text-sm mt-2">
                {isAdmin && onEditCompany ? (
                  <button className="text-(--tc-accent,#ef0001) underline font-semibold" onClick={onEditCompany}>
                    {activeClientName}
                  </button>
                ) : (
                  <span className="text-white font-semibold">{activeClientName}</span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-2 text-xs text-(--tc-accent,#ef0001) hover:underline font-semibold"
              disabled={uploading || !user}
            >
              {uploading ? t("profileMenu.uploadingPhoto") : t("profileMenu.editPhoto")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label={t("profileMenu.editPhoto")}
              title={t("profileMenu.editPhoto")}
              onChange={(e) => handleAvatarUpload(e.target.files?.[0])}
            />
          </div>

          <div className="border-t border-(--tc-border,#e5e7eb)/40" />

          <div className="py-2">
            {onOpenTeam && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenTeam();
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-white hover:bg-blue-900"
              >
                {t("profileMenu.team")}
              </button>
            )}
              {/* Universal support ticket button */}
              <div className="my-2">
                <CreateSupportTicketButton />
              </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/settings/profile");
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-white hover:bg-blue-900"
            >
              Meu perfil
            </button>
          </div>

          <div className="border-t border-(--tc-border,#e5e7eb)/40" />

          <button
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
          >
            {t("profileMenu.logout")}
          </button>
        </div>
      )}
    </div>
  );
}



