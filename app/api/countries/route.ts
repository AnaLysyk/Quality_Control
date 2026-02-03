import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { hasCapability, type Capability } from "@/lib/permissions";

type Country = {
  id: string;
  name: string;
  companyId: string;
  createdAt: string;
};

const store: Country[] = [];

function normalizeRole(role?: string | null) {
  return (role ?? "").trim().toLowerCase();
}

function canCreateCountry(user: Awaited<ReturnType<typeof authenticateRequest>>) {
  if (!user) return false;
  if (user.isGlobalAdmin) return true;
  if (hasCapability((user.capabilities ?? []) as Capability[], "company:write")) return true;
  const role = normalizeRole(user.role);
  return role === "admin" || role === "company" || role === "company_admin";
}

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId") ?? user.companyId ?? "";
  if (!companyId) {
    return NextResponse.json({ message: "companyId obrigatorio" }, { status: 400 });
  }

  if (!canCreateCountry(user)) {
    return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ message: "Nome obrigatorio" }, { status: 400 });
  }

  const country: Country = {
    id: `${companyId}:${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    companyId,
    createdAt: new Date().toISOString(),
  };

  store.push(country);
  return NextResponse.json({ ok: true, country }, { status: 201 });
}
