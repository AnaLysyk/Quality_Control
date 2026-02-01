import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

// Middleware para proteger rotas e garantir que o usuário só acesse dados da própria empresa
export async function middleware(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || !user.companyId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  // Permite acesso normalmente
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/painel-releases-manuais-autenticado/:path*",
    "/api/release-manual/:path*",
    "/api/defect/:path*",
  ],
};
