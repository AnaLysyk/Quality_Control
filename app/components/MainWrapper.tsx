"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

interface MainWrapperProps {
  children: ReactNode;
}

export default function MainWrapper({ children }: MainWrapperProps) {
  const pathname = usePathname() || "";
  const isUsersManagementRoute = pathname.startsWith("/admin/users");
  const isUsersPermissionsRoute = pathname.startsWith("/admin/users/permissions");

  return (
    <main
      className={`flex-1 w-full min-h-full min-w-0 overflow-x-hidden pt-16 ${
        isUsersPermissionsRoute
          ? "px-2 pb-4 sm:px-2.5 sm:pb-5 lg:px-3 lg:pr-24 xl:px-4 xl:pr-28 2xl:px-5 2xl:pr-32"
          : isUsersManagementRoute
          ? "px-2.5 pb-4 sm:px-3 sm:pb-5 lg:px-4 lg:pr-28 xl:px-5 xl:pr-32 2xl:px-6 2xl:pr-36"
          : "px-4 pb-10 pr-28 sm:px-6 sm:pr-24 lg:px-10 lg:pr-56"
      }`}
    >
      {children}
    </main>
  );
}
