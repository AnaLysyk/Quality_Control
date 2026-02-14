import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { hasCapability } from "@/lib/permissions";
import type { Capability } from "@/core/permissions/permissions.types";
import { rateLimit } from "@/lib/rateLimit";
import {
  createCountry,
  listCountries,
  CountryStoreError,
} from "@/lib/countryStore";

function normalizeRole(role?: string | null) {
  return (role ?? "").trim().toLowerCase();
}

function canManageCountry(user: Awaited<ReturnType<typeof authenticateRequest>>) {
  if (!user) return false;
  if (user.isGlobalAdmin) return true;
  if (hasCapability((user.capabilities ?? []) as Capability[], "company:write")) return true;
  const role = normalizeRole(user.role);
  return role === "admin" || role === "company" || role === "company_admin";
}

function resolveCompanyId(user: NonNullable<Awaited<ReturnType<typeof authenticateRequest>>>, req: NextRequest) {
  const override = user.isGlobalAdmin ? req.nextUrl.searchParams.get("companyId") : null;
  const target = (override ?? user.companyId ?? "").trim();
  return target;
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
  }

  const limiter = await rateLimit(req, `countries:create:${user.id}`, 10, 60);
  if (limiter.limited) {
    return limiter.response ?? NextResponse.json({ message: "Rate limit exceedido" }, { status: 429 });
  }

  if (!canManageCountry(user)) {
    return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
  }

  const companyId = resolveCompanyId(user, req);
  if (!companyId) {
    return NextResponse.json({ message: "companyId obrigatorio" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ message: "Nome obrigatorio" }, { status: 400 });
  }

  try {
    const country = await createCountry({
      companyId,
      name,
      createdBy: user.id,
      createdByEmail: user.email,
    });
    return NextResponse.json({ ok: true, country }, { status: 201 });
  } catch (error) {
    if (error instanceof CountryStoreError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("[countries] Failed to create country", error);
    return NextResponse.json({ message: "Erro ao criar pais" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
  }

  const limiter = await rateLimit(req, `countries:list:${user.id}`, 60, 60);
  if (limiter.limited) {
    return limiter.response ?? NextResponse.json({ message: "Rate limit exceedido" }, { status: 429 });
  }

  const companyId = resolveCompanyId(user, req);
  if (!companyId) {
    return NextResponse.json({ message: "companyId obrigatorio" }, { status: 400 });
  }

  if (!user.isGlobalAdmin && user.companyId !== companyId && !(user.companySlugs ?? []).includes(companyId)) {
    return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
  }

  try {
    const countries = await listCountries(companyId);
    return NextResponse.json({ ok: true, countries, count: countries.length }, { status: 200 });
  } catch (error) {
    console.error("[countries] Failed to list countries", error);
    return NextResponse.json({ message: "Erro ao listar paises" }, { status: 500 });
  }
}
