"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname() || "";
  const isLogin = pathname.startsWith("/login");
  const padding = isLogin ? "" : "pl-16 lg:pl-64";

  return (
    <>
      {!isLogin && <Sidebar />}
      <main
        className={`relative flex-1 min-h-screen overflow-hidden bg-[#05070d] text-white transition-[padding] duration-300 ease-in-out ${padding}`}
      >
        <div className="relative z-10">{children}</div>
      </main>
    </>
  );
}
