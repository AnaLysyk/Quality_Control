"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function SidebarVisibility() {
  const pathname = usePathname() || "";

  if (pathname.startsWith("/login")) {
    return null;
  }

  return <Sidebar />;
}
