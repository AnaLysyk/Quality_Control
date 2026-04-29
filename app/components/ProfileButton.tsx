"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
import LanguageSelector from "@/components/LanguageSelector";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useClientContext } from "@/context/ClientContext";
import { resolveActiveIdentity } from "@/lib/activeIdentity";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { buildCompanyPathForAccess, resolveCompanyRouteAccessInput } from "@/lib/companyRoutes";
import { useI18n } from "@/hooks/useI18n";

type ToastState =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function humanizePathSegment(value: string) {
  const normalized = decodeURIComponent(value || "")
    .replace(/[-_]+/g, " ")
    .trim();

  if (!normalized) return "Quality Control";
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

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

type ProfileButtonProps = {
  defaultOpen?: boolean;
};

export default function ProfileButton({ defaultOpen = false }: ProfileButtonProps) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const { user, loading, logout, normalizedUser } = useAuthUser();
  const { resolvedTheme } = useAppSettings();
  const { activeClient, clients } = useClientContext();
  const { t } = useI18n();

  const legacyUser = (user ?? null) as
    | {
        isGlobalAdmin?: boolean;
        roleGlobal?: string;
        companyResources?: unknown;
        company?: { name?: string; slug?: string };
      }
    | null;

  const [open, setOpen] = useState(defaultOpen);
  const [toast, setToast] = useState<ToastState>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const isDarkTheme = resolvedTheme === "dark";

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const normalizedRuntimeRole = (() => {
    const runtimeUser =
      (user ?? null) && typeof (user as Record<string, unknown>) === "object"
        ? (user as Record<string, unknown>)
        : null;
    const permissionRole = typeof runtimeUser?.permissionRole === "string" ? runtimeUser.permissionRole : null;
    const role = typeof runtimeUser?.role === "string" ? runtimeUser.role : null;
    const companyRole = typeof runtimeUser?.companyRole === "string" ? runtimeUser.companyRole : null;
    return normalizeLegacyRole(permissionRole) ?? normalizeLegacyRole(role) ?? normalizeLegacyRole(companyRole);
  })();

  const isTechnicalSupportProfile = normalizedRuntimeRole === SYSTEM_ROLES.TECHNICAL_SUPPORT;
  const isInstitutionalAdminProfile = normalizedRuntimeRole === SYSTEM_ROLES.LEADER_TC;
  const isAdmin = Boolean(user?.isGlobalAdmin || legacyUser?.isGlobalAdmin || normalizedRuntimeRole === SYSTEM_ROLES.LEADER_TC);
  const activeIdentity = resolveActiveIdentity({ user, activeCompany: activeClient });
  const displayName = activeIdentity.displayName;
  const displayEmail = activeIdentity.email ?? "";
  const displayUser = activeIdentity.username ?? "";
  const routeCompanySlug = (() => {
    const match = pathname.match(/^\/empresas\/([^/]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  })();
  const routeCompanyName = (() => {
    if (!routeCompanySlug) return null;

    const normalizedRouteSlug = routeCompanySlug.trim().toLowerCase();
    const matchedClient =
      clients.find((client) => client.slug.trim().toLowerCase() === normalizedRouteSlug) ??
      (activeClient?.slug?.trim().toLowerCase() === normalizedRouteSlug ? activeClient : null);

    return matchedClient?.name?.trim() || humanizePathSegment(routeCompanySlug);
  })();
  const shouldShowCompanyContext =
    activeIdentity.kind !== "company" &&
    Boolean(routeCompanyName) &&
    routeCompanyName !== displayName;
  const profileCardValue = activeIdentity.kind === "company" ? displayName : displayEmail;
  const profileCardFallback = activeIdentity.kind === "company" ? t("profile.noCompanyName") : t("profile.noEmail");
  const copyActionLabel = activeIdentity.kind === "company" ? t("profile.companyName") : t("profile.email");
  const avatarLoadingPlaceholder = loading && !activeIdentity.avatarUrl;
  const contextBadgeLabel = activeIdentity.kind === "company"
    ? null
    : isTechnicalSupportProfile
      ? t("roles.technicalSupport")
      : isInstitutionalAdminProfile || isAdmin
        ? t("roles.systemAdmin")
        : activeIdentity.showCompanyTag
          ? activeIdentity.companyTagLabel
          : null;

  const companySlug = activeClient?.slug ?? normalizedUser.primaryCompanySlug ?? normalizedUser.defaultCompanySlug ?? undefined;

  const companyResources = Array.isArray(legacyUser?.companyResources) ? legacyUser.companyResources : [];
  const companyCount =
    (Array.isArray(clients) ? clients.length : 0) ||
    (Array.isArray(companyResources) ? companyResources.length : 0);
  const hasCompanies = companyCount > 0;
  const docsRoute = hasCompanies
    ? companyCount > 1 || !companySlug
      ? "/documentos"
      : buildCompanyPathForAccess(
          companySlug,
          "documentos",
          resolveCompanyRouteAccessInput({
            user,
            normalizedUser,
            companyCount,
            clientSlug: companySlug,
          }),
        )
    : "/docs";
  const docsLabel = hasCompanies
    ? companyCount > 1
      ? t("profile.documentsHint").replace("{count}", String(companyCount))
      : t("profile.companyFilesHint")
    : t("profile.docsHubHint");

  useEffect(() => {
    if (!open) return undefined;

    function onMouseDown(e: MouseEvent) {
      const root = containerRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    function onKeyDown(e: KeyboardEvent) {
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
      showToast("success", activeIdentity.kind === "company" ? t("profile.companyCopied") : t("profile.emailCopied"));
    } catch {
      showToast("error", t("profile.copyFailed"));
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
    ? "border border-border bg-surface2 ring-1 ring-border/40 shadow-[0_18px_40px_rgba(15,23,42,0.16)]"
    : "border-0 bg-linear-to-br from-(--tc-primary) to-[#7a1026] ring-0 shadow-none";

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${t("profile.openMenu")}: ${displayName}`}
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
          aria-label={t("profile.openMenu")}
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
                      ? "border border-border bg-surface2 ring-1 ring-border/40 shadow-[0_18px_40px_rgba(15,23,42,0.16)]"
                      : "shadow-[0_14px_34px_rgba(15,23,42,0.18)]"
                  }
                  fallbackClassName="text-sm font-semibold tracking-[0.18em] text-white"
                />

                <div className="min-w-0 pt-0.5">
                  <p className={`text-[10px] font-extrabold uppercase tracking-[0.18em] ${isDarkTheme ? "text-[#ff8a9c]" : "text-(--tc-accent)"}`}>
                    {activeIdentity.kind === "company" ? t("profile.companyLabel") : t("profile.accountLabel")}
                  </p>
                  <div className={`wrap-break-word text-[1.05rem] font-extrabold leading-tight ${isDarkTheme ? "text-white" : "text-[#081f4d]"}`}>
                    {displayName}
                  </div>
                  {shouldShowCompanyContext ? (
                    <div className={`wrap-break-word pt-0.5 text-[12px] font-semibold ${isDarkTheme ? "text-[#d2def8]" : "text-[#22457f]"}`}>
                      {t("settings.companyContext")}: {routeCompanyName}
                    </div>
                  ) : null}
                  {activeIdentity.kind === "company" && activeIdentity.accountName !== displayName ? (
                    <div className={`wrap-break-word pt-0.5 text-[12px] font-semibold ${isDarkTheme ? "text-[#d2def8]" : "text-[#22457f]"}`}>
                      {t("profile.accountPrefix")}: {activeIdentity.accountName}
                    </div>
                  ) : null}
                  {displayUser ? (
                    <div className={`break-all pt-0.5 text-[13px] font-semibold ${isDarkTheme ? "text-[#d2def8]" : "text-[#22457f]"}`}>
                      {activeIdentity.kind === "company" ? `${t("profile.loginPrefix")} @${displayUser}` : `@${displayUser}`}
                    </div>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-[14px] shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition ${
                  isDarkTheme
                    ? "border border-[#355483] bg-[#102042] text-white hover:border-[#ff8a9c] hover:text-[#ffd4db]"
                    : "border border-border bg-surface text-(--tc-text-secondary,#5e79a8) hover:border-(--tc-accent) hover:text-(--tc-accent)"
                }`}
                aria-label={t("profile.closeMenu")}
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
                    <span className={`tc-status-pill shadow-[0_10px_18px_rgba(0,0,0,0.12)]`} data-tone={isTechnicalSupportProfile ? "danger" : "neutral"}>
                      {contextBadgeLabel}
                    </span>
                  </div>
                ) : null}

                <div
                  className={`${contextBadgeLabel ? "mt-2.5 " : ""}flex items-start gap-2 rounded-[14px] border px-3 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ${
                    isDarkTheme ? "border-[#355483] bg-[#0c1831]" : "border-border bg-surface"
                  }`}
                >
                  <span className={`min-w-0 flex-1 break-all font-semibold ${isDarkTheme ? "text-white" : "text-[#081f4d]"}`}>
                    {profileCardValue || profileCardFallback}
                  </span>
                  <button
                    type="button"
                    aria-label={`${t("profile.copy")} ${copyActionLabel}`}
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border text-white shadow-[0_10px_22px_rgba(15,23,42,0.12)] transition hover:bg-(--tc-accent) disabled:opacity-50 ${
                      isDarkTheme
                        ? "border-[#355483] bg-[#16315f] hover:border-[#ff8a9c] hover:text-white"
                        : "border-[#ccd8ee] bg-[#102755] hover:border-(--tc-accent)"
                    }`}
                    onClick={() => void copyProfileCardValue()}
                    disabled={!profileCardValue}
                    title={copied ? t("profile.copied") : `${t("profile.copy")} ${copyActionLabel}`}
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
            <p className={`text-[10px] font-extrabold uppercase tracking-[0.18em] ${isDarkTheme ? "text-[#ff8a9c]" : "text-(--tc-accent)"}`}>{t("profile.accountSection")}</p>
            <ul aria-label={t("profile.menuOptions")} className="mt-2 space-y-2">
              <MenuItem
                isDarkTheme={isDarkTheme}
                icon={<FiSettings aria-hidden />}
                label={t("profile.myProfile")}
                hint={t("profile.profileHint")}
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
              {t("profile.documentations")}
            </p>
            <ul className="mt-2 space-y-2" aria-label={t("profile.materials")}>
              <MenuItem
                isDarkTheme={isDarkTheme}
                icon={<FiFolder aria-hidden />}
                label={t("profile.documentations")}
                hint={docsLabel}
                onClick={() => {
                  setOpen(false);
                  router.push(docsRoute);
                }}
              />
            </ul>
          </div>

          <div className={`h-px ${isDarkTheme ? "bg-[linear-gradient(90deg,rgba(255,138,156,0)_0%,rgba(255,138,156,0.16)_18%,rgba(132,170,255,0.24)_50%,rgba(255,138,156,0.16)_82%,rgba(255,138,156,0)_100%)]" : "bg-[linear-gradient(90deg,rgba(239,0,1,0)_0%,rgba(239,0,1,0.10)_18%,rgba(10,31,82,0.14)_50%,rgba(239,0,1,0.10)_82%,rgba(239,0,1,0)_100%)]"}`} />

          <div className="px-3.5 py-3">
            <p className={`text-[11px] font-extrabold uppercase tracking-[0.2em] ${isDarkTheme ? "text-[#ff8a9c]" : "text-(--tc-accent)"}`}>
              {t("profileMenu.language")}
            </p>
            <div className="mt-2">
              <LanguageSelector variant="full" />
            </div>
          </div>

          <div className={`h-px ${isDarkTheme ? "bg-[linear-gradient(90deg,rgba(255,138,156,0)_0%,rgba(255,138,156,0.16)_18%,rgba(132,170,255,0.24)_50%,rgba(255,138,156,0.16)_82%,rgba(255,138,156,0)_100%)]" : "bg-[linear-gradient(90deg,rgba(239,0,1,0)_0%,rgba(239,0,1,0.10)_18%,rgba(10,31,82,0.14)_50%,rgba(239,0,1,0.10)_82%,rgba(239,0,1,0)_100%)]"}`} />

          <ul aria-label={t("profile.session")} className="p-3.5 pt-2.5">
            <li>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className={`flex w-full items-center gap-2 rounded-[18px] px-4 py-3 text-sm font-semibold shadow-[0_10px_26px_rgba(15,23,42,0.05)] transition ${
                  isDarkTheme
                    ? "border border-[#355483] bg-[#0d1a35] text-[#ffd4db] hover:border-[#ff8a9c] hover:bg-[#4d1220] hover:text-white"
                    : "border border-danger/35 bg-surface text-danger hover:border-danger hover:bg-danger/12 hover:text-danger"
                }`}
              >
                <FiLogOut aria-hidden />
                {t("profile.logout")}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
