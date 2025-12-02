"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

interface MainWrapperProps {
  children: ReactNode;
}

export default function MainWrapper({ children }: MainWrapperProps) {
  const pathname = usePathname() || "";
  const isLogin = pathname.startsWith("/login");

  const padding = isLogin ? "" : "pl-16 lg:pl-64";

  return (
    <main
      className={`flex-1 min-h-screen overflow-hidden bg-black text-white transition-[padding] duration-300 ease-in-out ${padding}`}
    >
      {children}
    </main>
  );
}
