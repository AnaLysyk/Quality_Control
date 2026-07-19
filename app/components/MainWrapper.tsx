"use client";

import { ReactNode } from "react";
import { getCompanyRouteSection } from "@/backend/companyRoutes";

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
  const isBrainRoute = pathname.startsWith("/brain") || pathname.startsWith("/admin/brain");
  const isBrainScrollRoute =
    pathname === "/admin/brain/memories" ||
    pathname.startsWith("/admin/brain/memories/") ||
    pathname === "/admin/brain/settings" ||
    pathname.startsWith("/admin/brain/settings/") ||
    pathname === "/admin/brain/behavior-profiles" ||
    pathname.startsWith("/admin/brain/behavior-profiles/") ||
    pathname === "/brain/settings" ||
    pathname.startsWith("/brain/settings/");
  const isBrainFullscreenRoute = isBrainRoute && !isBrainScrollRoute;
  const isChatRoute = pathname.startsWith("/chat");
  const isPlaywrightWorkspaceRoute =
    /^\/automacoes\/playwright(?:\/|$)/.test(pathname) ||
    /\/automacao\/playwright(?:\/|$)/.test(pathname);

  // Left padding grows with viewport; right padding uses --content-pr to always
  // clear the fixed floating action strip regardless of breakpoint.
  const leftPx = isPlaywrightWorkspaceRoute
    ? "px-0"
    : isBrainRoute || isChatRoute || isDocumentosRoute || isDocsRoute
    ? "px-0"
    : isUsersPermissionsRoute
    ? "px-2 sm:px-2.5 lg:px-3 xl:px-4 2xl:px-5"
    : isUsersManagementRoute
    ? "px-2.5 sm:px-3 lg:px-4 xl:px-5 2xl:px-6"
    : isAccessRequestsRoute || isAdminClientsRoute
    ? "px-2 sm:px-3 lg:px-4 xl:px-5 2xl:px-6"
    : "px-2.5 sm:px-4 lg:px-5 xl:px-6 2xl:px-8";

  const topPt = isPlaywrightWorkspaceRoute || isBrainRoute || isChatRoute ? "pt-0" : "pt-3 sm:pt-4";
  const rightPr = isPlaywrightWorkspaceRoute || isBrainRoute || isChatRoute ? "pr-0" : "pr-(--content-pr)";

  const bottomPb = isPlaywrightWorkspaceRoute || isBrainRoute || isChatRoute || isDocumentosRoute || isDocsRoute
    ? "pb-0"
    : isUsersPermissionsRoute
    ? "pb-4 sm:pb-5"
    : isUsersManagementRoute || isAccessRequestsRoute
    ? "pb-4 sm:pb-5 lg:pb-6"
    : "pb-8";

  const beforeTopGap = isBrainRoute ? "" : isDocumentosRoute ? "mt-3 sm:mt-4 lg:mt-5" : isDocsRoute ? "mt-2 sm:mt-3" : "";
  const beforeBottomGap = isPlaywrightWorkspaceRoute || isBrainRoute || isChatRoute || isDocumentosRoute || isDocsRoute ? "mb-0" : "mb-6 sm:mb-7 lg:mb-8";
  const beforeHorizontalPad = isPlaywrightWorkspaceRoute || isBrainRoute || isDocsRoute ? "px-0" : "";
  const heightMode = isPlaywrightWorkspaceRoute || isBrainFullscreenRoute || isChatRoute
    ? "h-full overflow-hidden flex flex-col"
    : isDocsRoute
    ? "h-full overflow-hidden flex flex-col"
    : "min-h-full overflow-x-hidden";

  return (
    <main
      className={`flex-1 w-full min-w-0 ${topPt} ${rightPr} ${leftPx} ${bottomPb} ${heightMode}`}
    >
      {beforeContent && !isBrainRoute ? <div className={`shrink-0 ${beforeTopGap} ${beforeBottomGap} ${beforeHorizontalPad}`}>{beforeContent}</div> : null}
      {children}
    </main>
  );
}
