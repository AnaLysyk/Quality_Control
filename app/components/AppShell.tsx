"use client";

import { ReactNode, useEffect, useState, memo } from "react";
import { usePathname } from "next/navigation";
import { FiMenu } from "react-icons/fi";
import MainWrapper from "./MainWrapper";
import SidebarVisibility from "./SidebarVisibility";
import ProfileButton from "./ProfileButton";
import NotesButton from "./NotesButton";
import NotificationsButton from "./NotificationsButton";
import TicketsButton from "./TicketsButton";
import ChatButton from "./ChatButton";

const GlobalActions = memo(function GlobalActions() {
  return (
    <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
      <NotificationsButton />
      <TicketsButton />
      <NotesButton />
      <ProfileButton />
    </div>
  );
});

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname() || "";
  const isLogin = pathname.startsWith("/login");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // Only close mobile menu when it is open to avoid redundant state updates.
    if (!mobileOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
    // Intentionally depend only on pathname so menu closes when route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (isLogin) {
    return (
      <div className="min-h-screen w-full overflow-y-auto bg-(--page-bg) text-(--page-text)">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-(--page-bg) text-(--page-text) app-shell">
      <SidebarVisibility mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <button
        type="button"
        className="fixed top-4 left-4 z-50 rounded-lg border border-(--tc-border) bg-(--tc-surface) p-2 text-(--tc-text) shadow-sm transition-colors hover:bg-(--tc-surface-2) lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
        aria-expanded={mobileOpen}
      >
        <FiMenu size={20} />
      </button>

      <GlobalActions />

      <ChatButton />

      <div className="flex flex-col min-h-screen app-main">
        <div className="flex-1 min-h-screen overflow-y-auto overflow-x-hidden">
          <MainWrapper>{children}</MainWrapper>
        </div>
      </div>
    </div>
  );
}
