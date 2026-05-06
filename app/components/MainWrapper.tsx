"use client";

import { ReactNode } from "react";
import { getCompanyRouteSection } from "@/lib/companyRoutes";

interface MainWrapperProps {
  pathname: string;
  beforeContent?: ReactNode;
  children: ReactNode;
}

export default function MainWrapper({ pathname, beforeContent, children }: MainWrapperProps) {
  const isAdminClientsRoute = pathname.startsWith("/admin/clients");
  const isAccessRequestsRoute = pathname.startsWith("/admin/access-requests");
  const isUsersManagementRoute = pathname.startsWith("/admin/users");
  const isUsersPermissionsRoute = pathname.startsWith("/admin/users/permissions");
  const companySection = getCompanyRouteSection(pathname);
  const isDocumentosRoute = pathname.startsWith("/documentos");
  const isDocsRoute = pathname.startsWith("/docs") || companySection === "docs";

  // Left padding grows with viewport; right padding uses --content-pr to always
  // clear the fixed floating action strip regardless of breakpoint.
  const leftPx = isDocumentosRoute || isDocsRoute
    ? "px-0"
    : isUsersPermissionsRoute
    ? "px-2 sm:px-2.5 lg:px-3 xl:px-4 2xl:px-5"
    : isUsersManagementRoute
    ? "px-2.5 sm:px-3 lg:px-4 xl:px-5 2xl:px-6"
    : isAccessRequestsRoute || isAdminClientsRoute
    ? "px-2 sm:px-3 lg:px-4 xl:px-5 2xl:px-6"
    : "px-2.5 sm:px-4 lg:px-5 xl:px-6 2xl:px-8";

  const bottomPb = isDocumentosRoute || isDocsRoute
    ? "pb-0"
    : isUsersPermissionsRoute
    ? "pb-4 sm:pb-5"
    : isUsersManagementRoute || isAccessRequestsRoute
    ? "pb-4 sm:pb-5 lg:pb-6"
    : "pb-8";
  const beforeTopGap = isDocumentosRoute ? "mt-3 sm:mt-4 lg:mt-5" : isDocsRoute ? "mt-2 sm:mt-3" : "";
  const beforeBottomGap = isDocumentosRoute || isDocsRoute ? "mb-0" : "mb-6 sm:mb-7 lg:mb-8";
  const beforeHorizontalPad = isDocsRoute ? "px-3 sm:px-4 lg:px-5" : "";

  return (
    <main
      className={`flex-1 w-full min-w-0 pt-(--topbar-h) pr-(--content-pr) ${leftPx} ${bottomPb} ${isDocsRoute ? "h-screen overflow-hidden flex flex-col" : "min-h-full overflow-x-hidden"}`}
    >
      {beforeContent ? <div className={`shrink-0 ${beforeTopGap} ${beforeBottomGap} ${beforeHorizontalPad}`}>{beforeContent}</div> : null}
      {children}
    </main>
  );
}
