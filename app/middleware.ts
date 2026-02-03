

import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // RBAC mock: se mock_role=admin, injeta user admin no request
  const mockRole = request.cookies.get("mock_role")?.value;
  const reqWithUser = request as NextRequest & { user?: { role: string; email: string } };
  const globalScope = globalThis as { user?: { role: string; email: string } };
  if (mockRole === "admin" || mockRole === "company" || mockRole === "client") {
    reqWithUser.user = { role: mockRole, email: `${mockRole}@mock.com` };
    globalScope.user = { role: mockRole, email: `${mockRole}@mock.com` };
  } else {
    reqWithUser.user = undefined;
    globalScope.user = undefined;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/api/:path*", "/empresas/:slug/:path*"],
};
