"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Component, useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import type { IconType } from "react-icons";
import { FiBell, FiEdit3, FiMessageSquare, FiMoon, FiSun } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import NotificationsButton from "@/components/NotificationsButton";
import UserAvatar from "@/components/UserAvatar";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useClientContext } from "@/context/ClientContext";
import { useI18n } from "@/hooks/useI18n";
import { resolveActiveIdentity } from "@/lib/activeIdentity";
import { fetchApi } from "@/lib/api";

type ToolComponentProps = {
  defaultOpen?: boolean;
  defaultPanelMode?: "compact" | "side" | "expanded";
};

type NotificationsToolComponentProps = ToolComponentProps & {
  initialUnreadCount?: number;
};

type ToolbarGhostButtonProps = {
  ariaLabel: string;
  icon: IconType;
  loadingLabel: string;
  mounted: boolean;
  onOpen: () => void;
  onPrime: () => void;
  wrapperClassName?: string;
};

const noop = () => {};

function ToolbarLoadingBubble({ icon: Icon, ariaLabel }: { icon: IconType; ariaLabel: string }) {
  return (
    <button type="button" aria-label={ariaLabel} aria-busy="true" disabled className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[var(--tc-border,#e5e7eb)]/70 bg-[var(--tc-surface,#ffffff)] text-[var(--tc-text,#0f172a)] shadow-[0_8px_20px_rgba(15,23,42,0.12)] opacity-75">
      <Icon size={18} className="animate-pulse" />
    </button>
  );
}

function ChatLoadingBubble() {
  return (
    <div className="qc-brain-launcher fixed bottom-6 right-6 z-50">
      <button type="button" aria-label="Carregando assistente da plataforma" aria-busy="true" disabled className="group relative flex h-14 w-14 items-center justify-center rounded-full shadow-[0_18px_35px_rgba(1,24,72,0.22)] opacity-90">
        <div className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#011848_0%,#6b0000_55%,#ef0001_100%)] shadow-[0_8px_24px_rgba(1,24,72,0.4)]" />
        <div className="absolute inset-0.75 rounded-full overflow-hidden flex items-center justify-center">
          <div className="relative h-full w-full">
            <Image src="/images/tc.png" alt="Assistente Testing Company" fill sizes="56px" className="select-none pointer-events-none object-contain animate-pulse" />
          </div>
        </div>
      </button>
    </div>
  );
}

const LazyNotesButtonInner = dynamic<ToolComponentProps>(() => import("./NotesButton"), { ssr: false, loading: () => <ToolbarLoadingBubble icon={FiEdit3} ariaLabel="Carregando bloco de notas" /> });
const LazyTicketsButtonInner = dynamic<ToolComponentProps>(() => import("./TicketsButton"), { ssr: false, loading: () => <ToolbarLoadingBubble icon={FiMessageSquare} ariaLabel="Carregando chamados" /> });
const LazyChatButtonInner = dynamic<ToolComponentProps>(() => import("./ChatButton"), { ssr: false, loading: () => <ChatLoadingBubble /> });

let profileButtonModulePromise: Promise<ComponentType<ToolComponentProps>> | null = null;
function loadProfileButtonModule() {
  if (!profileButtonModulePromise) {
    profileButtonModulePromise = import("./ProfileButton").then((module) => module.default).catch((error) => { profileButtonModulePromise = null; throw error; });
  }
  return profileButtonModulePromise;
}

function ToolbarGhostButton({ ariaLabel, icon: Icon, loadingLabel, mounted, onOpen, onPrime, wrapperClassName }: ToolbarGhostButtonProps) {
  const button = (
    <button type="button" onClick={onOpen} onMouseEnter={onPrime} onFocus={onPrime} onTouchStart={onPrime} aria-label={mounted ? loadingLabel : ariaLabel} className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[var(--tc-border,#e5e7eb)]/70 bg-[var(--tc-surface,#ffffff)] text-[var(--tc-text,#0f172a)] shadow-[0_8px_20px_rgba(15,23,42,0.12)] transition hover:border-[var(--tc-accent,#ef0001)]/60 hover:text-[var(--tc-accent,#ef0001)] disabled:cursor-progress disabled:opacity-75" disabled={mounted}>
      <Icon size={18} className={mounted ? "animate-pulse" : undefined} />
    </button>
  );
  if (!wrapperClassName) return button;
  return <span className={wrapperClassName}>{button}</span>;
}

class ChunkErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { if (this.state.failed) return null; return this.props.children; }
}

function useDeferredShellTool() {
  const [mounted, setMounted] = useState(false);
  const [defaultOpen, setDefaultOpen] = useState(false);
  const prime = useCallback(() => { setMounted(true); }, []);
  const open = useCallback(() => { setMounted(true); setDefaultOpen(true); }, []);
  return { mounted, defaultOpen, prime, open };
}

const NOTIFICATIONS_COUNT_TTL_MS = 15_000;
const notificationsCountCache: { userId: string | null; unreadCount: number; fetchedAt: number } = { userId: null, unreadCount: 0, fetchedAt: 0 };

export function DeferredNotificationsButton() {
  const { user, loading } = useAuthUser();
  const { mounted, defaultOpen, prime, open } = useDeferredShellTool();
  const [unreadCount, setUnreadCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  useEffect(() => {
    if (!user || loading || mounted) return;
    let alive = true;
    const userId = user.id;
    async function loadUnreadCount(force = false) {
      const sameUser = notificationsCountCache.userId === userId;
      const fresh = notificationsCountCache.fetchedAt > Date.now() - NOTIFICATIONS_COUNT_TTL_MS;
      if (!force && sameUser && fresh) { setUnreadCount(notificationsCountCache.unreadCount); return; }
      try {
        const response = await fetchApi("/api/notifications?summary=count", { credentials: "include", cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as { unreadCount?: number };
        if (!alive) return;
        const nextCount = response.ok && typeof payload.unreadCount === "number" ? payload.unreadCount : 0;
        notificationsCountCache.userId = userId; notificationsCountCache.unreadCount = nextCount; notificationsCountCache.fetchedAt = Date.now(); setUnreadCount(nextCount);
      } catch { if (alive) setUnreadCount(0); }
    }
    void loadUnreadCount();
    function handleFocus() { void loadUnreadCount(); }
    window.addEventListener("focus", handleFocus);
    return () => { alive = false; window.removeEventListener("focus", handleFocus); };
  }, [loading, mounted, user]);
  if (!hydrated) return <span className="relative shrink-0"><ToolbarGhostButton ariaLabel="Abrir notificações" icon={FiBell} loadingLabel="Carregando notificações" mounted onOpen={() => {}} onPrime={() => {}} /></span>;
  if (!user) return null;
  if (mounted) return <NotificationsButton defaultOpen={defaultOpen} initialUnreadCount={unreadCount} />;
  return <span className="relative shrink-0"><ToolbarGhostButton ariaLabel="Abrir notificações" icon={FiBell} loadingLabel="Carregando notificações" mounted={mounted} onOpen={open} onPrime={prime} />{unreadCount > 0 ? <span className="pointer-events-none absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--tc-accent,#ef0001)] px-1.5 py-0.5 text-center text-[10px] font-semibold text-white shadow-[0_6px_16px_rgba(239,0,1,0.35)]">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}</span>;
}

export function DeferredTicketsButton() {
  const { user } = useAuthUser();
  const { mounted, defaultOpen, prime, open } = useDeferredShellTool();
  const hasUser = Boolean(user);
  if (mounted && hasUser) return <LazyTicketsButtonInner defaultOpen={defaultOpen} />;
  return <ToolbarGhostButton ariaLabel="Abrir chamados" icon={FiMessageSquare} loadingLabel="Carregando chamados" mounted={mounted} onOpen={hasUser ? open : noop} onPrime={hasUser ? prime : noop} />;
}

export function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useAppSettings();
  const { t } = useI18n();
  const resolvedDark = resolvedTheme === "dark";
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const nextTheme = resolvedDark ? "light" : "dark";
  const ariaLabel = mounted ? (resolvedDark ? t("themeToggle.switchToLight") : t("themeToggle.switchToDark")) : t("themeToggle.toggle");
  const Icon = mounted ? (resolvedDark ? FiSun : FiMoon) : FiSun;
  const handleToggle = useCallback(() => { setTheme(nextTheme); }, [nextTheme, setTheme]);
  return <button type="button" onClick={handleToggle} aria-label={ariaLabel} title={ariaLabel} className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--tc-border,#e5e7eb)]/70 bg-[var(--tc-surface,#ffffff)] text-[var(--tc-text,#0f172a)] shadow-[0_8px_20px_rgba(15,23,42,0.12)] transition hover:border-[var(--tc-accent,#ef0001)]/60 hover:text-[var(--tc-accent,#ef0001)] disabled:cursor-progress disabled:opacity-75"><Icon size={18} /></button>;
}

export function DeferredNotesButton({ className }: { className?: string }) {
  const { user } = useAuthUser();
  const { mounted, defaultOpen, prime, open } = useDeferredShellTool();
  if (!user) return null;
  if (mounted) return <span className={className}><LazyNotesButtonInner defaultOpen={defaultOpen} /></span>;
  return <ToolbarGhostButton ariaLabel="Abrir bloco de notas" icon={FiEdit3} loadingLabel="Carregando bloco de notas" mounted={mounted} onOpen={open} onPrime={prime} wrapperClassName={className} />;
}

export function DeferredChatButton() {
  const { user, can } = usePermissionAccess();
  const { mounted, defaultOpen, prime, open } = useDeferredShellTool();
  const pathname = usePathname() || "/";
  const assistantEnabled = process.env.NEXT_PUBLIC_AI_ASSISTANT_ENABLED !== "false";
  const isBrainAskRoute = pathname === "/brain/perguntar";
  const isAdminHomeRoute = pathname === "/admin/home";
  const canUseBrain = Boolean(user) && can("ai", "view") && can("ai", "use") && can("brain", "view");
  useEffect(() => { if (!isBrainAskRoute || mounted || !canUseBrain || isAdminHomeRoute) return; open(); }, [canUseBrain, isAdminHomeRoute, isBrainAskRoute, mounted, open]);
  if (!assistantEnabled || !user || !canUseBrain || isAdminHomeRoute) return null;
  if (mounted) return <ChunkErrorBoundary><LazyChatButtonInner defaultOpen={defaultOpen || isBrainAskRoute} defaultPanelMode={isBrainAskRoute ? "side" : undefined} /></ChunkErrorBoundary>;
  return (
    <div className="qc-brain-launcher fixed bottom-6 right-6 z-50">
      <button type="button" onClick={open} onMouseEnter={prime} onFocus={prime} onTouchStart={prime} aria-label="Abrir Brain" title="Brain" className="group relative flex h-14 w-14 items-center justify-center rounded-full shadow-[0_18px_35px_rgba(1,24,72,0.22)] transition hover:scale-105 disabled:cursor-progress" disabled={mounted}>
        <div className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#011848_0%,#6b0000_55%,#ef0001_100%)] shadow-[0_8px_24px_rgba(1,24,72,0.4)]" />
        <div className="absolute inset-0.75 rounded-full overflow-hidden flex items-center justify-center"><div className="relative h-full w-full"><Image src="/images/tc.png" alt="Brain" fill sizes="56px" className={`select-none pointer-events-none object-contain ${mounted ? "animate-pulse" : "animate-spin-slower"}`} /></div></div>
        <span className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] right-0 whitespace-nowrap rounded-xl bg-[#011848] px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">Brain<span className="absolute -bottom-1.25 right-5 h-2.5 w-2.5 rotate-45 bg-[#011848]" /></span>
      </button>
    </div>
  );
}

export function DeferredProfileButton() {
  const { user, loading } = useAuthUser();
  const { resolvedTheme } = useAppSettings();
  const { activeClient } = useClientContext();
  const [mounted, setMounted] = useState(false);
  const [defaultOpen, setDefaultOpen] = useState(false);
  const [ProfileButtonComponent, setProfileButtonComponent] = useState<ComponentType<ToolComponentProps> | null>(null);
  const activeIdentity = useMemo(() => resolveActiveIdentity({ user, activeCompany: activeClient }), [activeClient, user]);
  useEffect(() => {
    if (!mounted || ProfileButtonComponent) return undefined;
    let cancelled = false;
    void loadProfileButtonModule().then((Component) => { if (!cancelled) setProfileButtonComponent(() => Component); }).catch(() => {});
    return () => { cancelled = true; };
  }, [mounted, ProfileButtonComponent]);
  const prime = useCallback(() => { void loadProfileButtonModule().catch(() => {}); }, []);
  const open = useCallback(() => { setMounted(true); setDefaultOpen(true); }, []);
  if (loading || !user) return null;
  if (mounted && ProfileButtonComponent) return <ProfileButtonComponent defaultOpen={defaultOpen} />;
  return (
    <button type="button" aria-label="Abrir perfil" title="Perfil" onMouseEnter={prime} onFocus={prime} onTouchStart={prime} onClick={open} className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--tc-border,#e5e7eb)]/70 bg-[var(--tc-surface,#ffffff)] text-[var(--tc-text,#0f172a)] shadow-[0_8px_20px_rgba(15,23,42,0.12)] transition hover:border-[var(--tc-accent,#ef0001)]/60 hover:text-[var(--tc-accent,#ef0001)] overflow-hidden">
      <UserAvatar src={activeIdentity.avatarUrl} name={activeIdentity.displayName || user.name || user.email || "Usuário"} size="sm" className="h-11 w-11 border-0 shadow-none" />
    </button>
  );
}
