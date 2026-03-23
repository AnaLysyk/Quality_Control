"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { FiMenu } from "react-icons/fi";
import MainWrapper from "./MainWrapper";
import SidebarVisibility from "./SidebarVisibility";
import ProfileButton from "./ProfileButton";
import dynamic from "next/dynamic";
const NotesButton = dynamic(() => import("./NotesButton"), { ssr: false, loading: () => <div className="w-8" /> });
const NotificationsButton = dynamic(() => import("./NotificationsButton"), { ssr: false, loading: () => <div className="w-8" /> });
import TicketsButton from "./TicketsButton";
import ChatButton from "./ChatButton";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname() || "";
  const isLoginRoute = pathname.startsWith("/login");
  const useMinimalShell = pathname.length === 0 || isLoginRoute;
  const [mobileOpen, setMobileOpen] = useState(false);

  const prevPathRef = useRef(pathname);

  useEffect(() => {
    // Close mobile menu only when the route actually changes.
    if (prevPathRef.current !== pathname) {
      setMobileOpen(false);
      prevPathRef.current = pathname;
    }
  }, [pathname, mobileOpen]);

  if (useMinimalShell) {
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
        className="fixed top-3 left-3 z-50 rounded-lg border border-(--tc-border) bg-(--tc-surface) p-2 text-(--tc-text) shadow-sm transition-colors hover:bg-(--tc-surface-2) sm:top-4 sm:left-4 lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
        aria-expanded={mobileOpen}
      >
        <FiMenu size={20} />
      </button>

      <div className="fixed top-3 right-3 z-40 flex items-center gap-1 sm:top-4 sm:right-4 sm:gap-2">
        <NotificationsButton />
        <TicketsButton />
        <span className="hidden sm:inline-flex"><NotesButton /></span>
        <ProfileButton />
      </div>

      <ChatButton />

      <div className="flex flex-col min-h-screen app-main">
        <div className="flex-1 min-h-screen overflow-y-auto overflow-x-hidden">
          <MainWrapper>{children}</MainWrapper>
        </div>
      </div>
    </div>
  );
}
