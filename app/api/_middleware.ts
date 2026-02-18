import { NextResponse } from "next/server";

// Exemplo simples de autenticação e RBAC
const PUBLIC_PATHS = ["/api/auth", "/api/docs"];

export function middleware(req: any) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  // Exemplo: token JWT no header Authorization
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  // Aqui você validaria o JWT e extrairia o perfil/role
  // const user = verifyJwt(auth.split(" ")[1]);
  // if (!user) return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  // req.user = user;
  return NextResponse.next();
}
