"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

interface MainWrapperProps {
  children: ReactNode;
}

export default function MainWrapper({ children }: MainWrapperProps) {
  const pathname = usePathname() || "";
  const isAdminClientsRoute = pathname.startsWith("/admin/clients");
  const isAccessRequestsRoute = pathname.startsWith("/admin/access-requests");
  const isUsersManagementRoute = pathname.startsWith("/admin/users");
  const isUsersPermissionsRoute = pathname.startsWith("/admin/users/permissions");

  // Left padding grows with viewport; right padding uses --content-pr to always
  // clear the fixed floating action strip regardless of breakpoint.
  const leftPx = isUsersPermissionsRoute
    ? "px-2 sm:px-2.5 lg:px-3 xl:px-4 2xl:px-5"
    : isUsersManagementRoute
    ? "px-2.5 sm:px-3 lg:px-4 xl:px-5 2xl:px-6"
    : isAccessRequestsRoute || isAdminClientsRoute
    ? "px-2 sm:px-3 lg:px-4 xl:px-5 2xl:px-6"
    : "px-2.5 sm:px-4 lg:px-5 xl:px-6 2xl:px-8";

  const bottomPb = isUsersPermissionsRoute
    ? "pb-4 sm:pb-5"
    : isUsersManagementRoute || isAccessRequestsRoute
    ? "pb-4 sm:pb-5 lg:pb-6"
    : "pb-8";

  return (
    <main
      className={`flex-1 w-full min-h-full min-w-0 overflow-x-hidden pt-(--topbar-h) pr-(--content-pr) ${leftPx} ${bottomPb}`}
    >
      {children}
    </main>
  );
}
