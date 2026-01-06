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
      <div className="min-h-screen w-full overflow-y-auto bg-white text-slate-900 dark:bg-[#0b1a3c] dark:text-slate-100">
        {children}
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-white text-slate-900 dark:bg-[#0b1a3c] dark:text-slate-100 overflow-hidden">
      <SidebarVisibility mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <button
        type="button"
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white text-slate-900 border border-slate-200 shadow-sm hover:bg-slate-100 lg:hidden dark:bg-[#0d1117] dark:text-white dark:border-white/10 dark:hover:bg-[#131a24]"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
      >
        <FiMenu size={20} />
      </button>

      <div className="fixed top-4 right-4 z-40">
        <ProfileButton />
      </div>

      <div className="flex flex-col h-full lg:ml-[72px]">
        <div className="flex-1 h-full overflow-y-auto">
          <MainWrapper>{children}</MainWrapper>
        </div>
      </div>
    </div>
  );
}
