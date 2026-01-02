"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

interface SidebarVisibilityProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function SidebarVisibility({ mobileOpen = false, onClose }: SidebarVisibilityProps) {
  const pathname = usePathname() || "";

  if (pathname.startsWith("/login")) {
    return null;
  }

  return <Sidebar mobileOpen={mobileOpen} onClose={onClose} />;
}
