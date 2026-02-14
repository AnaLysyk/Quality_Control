

import { NextRequest, NextResponse } from "next/server";

type Role = "admin" | "company" | "client";

const VALID_ROLES: Role[] = ["admin", "company", "client"];

export function middleware(request: NextRequest) {
  const mockRole = request.cookies.get("mock_role")?.value as Role | undefined;
  const isValidRole = mockRole ? VALID_ROLES.includes(mockRole) : false;
  const mockUserId = request.cookies.get("mock_user_id")?.value?.trim();
  const mockCompanyIds = request.cookies.get("mock_company_ids")?.value?.trim();
  const headers = new Headers(request.headers);

  if (isValidRole && mockRole) {
    headers.set("x-user-role", mockRole);
    headers.set("x-user-email", `${mockRole}@mock.com`);
    headers.set("x-user-id", mockUserId && mockUserId.length > 0 ? mockUserId : `${mockRole}-mock-user`);

    if (mockCompanyIds && mockCompanyIds.length > 0) {
      const normalized = mockCompanyIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      if (normalized.length > 0) {
        headers.set("x-company-ids", normalized.join(","));
      } else {
        headers.delete("x-company-ids");
      }
    } else {
      headers.delete("x-company-ids");
    }
  } else {
    headers.delete("x-user-role");
    headers.delete("x-user-email");
    headers.delete("x-user-id");
    headers.delete("x-company-ids");
  }

  return NextResponse.next({
    request: {
      headers,
    },
  });
}

export const config = {
  matcher: ["/", "/api/:path*", "/empresas/:slug/:path*"],
};
