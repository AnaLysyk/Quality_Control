

import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // RBAC mock: se mock_role=admin, injeta user admin no request
  const mockRole = request.cookies.get("mock_role")?.value;
  if (mockRole === "admin" || mockRole === "company" || mockRole === "client") {
    (request as any).user = { role: mockRole, email: `${mockRole}@mock.com` };
    (globalThis as any).user = { role: mockRole, email: `${mockRole}@mock.com` };
  } else {
    (request as any).user = undefined;
    (globalThis as any).user = undefined;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/api/:path*", "/empresas/:slug/:path*"],
};
