"use client";

import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import { FiMenu } from "react-icons/fi";
import MainWrapper from "./MainWrapper";
import SidebarVisibility from "./SidebarVisibility";
import ProfileButton from "./ProfileButton";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname() || "";
  const isLogin = pathname.startsWith("/login");
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLogin) {
    return (
      <div className="min-h-screen w-full overflow-y-auto bg-(--page-bg) text-(--page-text)">
        {children}
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-(--page-bg) text-(--page-text) overflow-hidden">
      <SidebarVisibility mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <button
        type="button"
        className="fixed top-4 left-4 z-50 rounded-lg border border-(--tc-border) bg-(--tc-surface) p-2 text-(--tc-text) shadow-sm transition-colors hover:bg-(--tc-surface-2) lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
      >
        <FiMenu size={20} />
      </button>

      <div className="fixed top-4 right-4 z-40">
        <ProfileButton />
      </div>

      <div className="flex flex-col h-full lg:ml-18">
        <div className="flex-1 h-full overflow-y-auto">
          <MainWrapper>{children}</MainWrapper>
        </div>
      </div>
    </div>
  );
}
