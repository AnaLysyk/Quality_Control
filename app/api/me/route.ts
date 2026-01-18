import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

type SessionPayload = {
  userId?: string;
  email?: string | null;
  name?: string | null;
  companyId?: string | null;
  companySlug?: string | null;
  role?: string | null;
};

type AuthCompany = {
  id: string;
  slug: string;
  name: string;
  role: string;
  active: boolean;
};

type LandingRole = "admin" | "company" | "user";

function readCookieValue(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split("=");
    if (key === name) {
      return rest.join("=").trim();
    }
  }
  return null;
}

function toTitleCase(value: string) {
  return value
    .split("-")
    .map((segment) => {
      if (!segment) return "";
      return segment[0].toUpperCase() + segment.slice(1).toLowerCase();
    })
    .join(" ");
}

function parseMockCompanySlugs(cookieHeader: string) {
  const rawValue = readCookieValue(cookieHeader, "mock_companies");
  if (rawValue) {
    const trimmed = rawValue.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter((item) => item.length > 0);
        }
      } catch {
        // ignore and fallback to comma split
      }
    }
    return trimmed
      .split(",")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
  }

  const fallback = (readCookieValue(cookieHeader, "mock_client_slug") ?? "griaule").trim();
  return fallback ? [fallback] : [];
}

function buildMockCompanies(cookieHeader: string) {
  const normalizedRole = (readCookieValue(cookieHeader, "mock_role") ?? "admin").trim().toLowerCase();
  const uniqueSlugs = Array.from(new Set(parseMockCompanySlugs(cookieHeader)));
  const slugs = uniqueSlugs.length ? uniqueSlugs : ["griaule"];
  const companyRole: "ADMIN" | "USER" =
    normalizedRole === "admin" || normalizedRole === "company" ? "ADMIN" : "USER";

  const companies: AuthCompany[] = slugs.map((slug) => ({
    id: `mock-company-${slug}`,
    slug,
    name: toTitleCase(slug),
    role: companyRole,
    active: true,
  }));

  const landingRole: LandingRole =
    normalizedRole === "admin" ? "admin" : normalizedRole === "company" ? "company" : "user";

  const first = companies[0];
  return {
    user: {
      id: `mock-${landingRole}-${slugs.join("_")}`,
      email: `${landingRole}@example.com`,
      name: landingRole === "admin" ? "Mock Admin" : "Mock User",
      role: landingRole,
      clientId: first?.id ?? null,
      clientSlug: first?.slug ?? null,
      defaultClientSlug: first?.slug ?? null,
      clientSlugs: companies.map((company) => company.slug),
      isGlobalAdmin: landingRole === "admin",
    },
    companies: companies,
  };
}

function dedupeCompanies(companies: AuthCompany[]) {
  const seen = new Set<string>();
  const output: AuthCompany[] = [];
  for (const company of companies) {
    if (!company.slug) continue;
    if (seen.has(company.slug)) continue;
    seen.add(company.slug);
    output.push(company);
  }
  return output;
}

function decideLandingRole(linked: AuthCompany[], sessionRole?: string | null): LandingRole {
  const normalizedSession = (sessionRole ?? "").toLowerCase();
  if (normalizedSession === "admin") return "admin";
  if (normalizedSession === "company") return "company";

  const hasAdminLink = linked.some((company) => company.role.toLowerCase() === "admin");
  if (hasAdminLink) return "admin";
  if (linked.length === 1) return "company";
  return "user";
}

function getSessionIdFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/session_id=([^;]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  return null;
}

function buildUserPayload(userRecord: {
  id: string;
  email: string;
  name: string;
}, companies: AuthCompany[], landingRole: LandingRole) {
  const first = companies[0];
  return {
    id: userRecord.id,
    email: userRecord.email,
    name: userRecord.name,
    role: landingRole,
    clientId: first?.id ?? null,
    clientSlug: first?.slug ?? null,
    defaultClientSlug: first?.slug ?? null,
    clientSlugs: companies.map((company) => company.slug),
    isGlobalAdmin: landingRole === "admin",
  };
}

export async function GET(req: Request) {
  if (SUPABASE_MOCK) {
    const mock = buildMockCompanies(req.headers.get("cookie") ?? "");
    return NextResponse.json({ user: mock.user, companies: mock.companies });
  }

  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return NextResponse.json({ user: null, companies: [], error: { code: "NO_SESSION" } }, { status: 401 });
  }

  const redis = getRedis();
  const raw = await redis.get(`session:${sessionId}`);
  if (!raw) {
    return NextResponse.json(
      { user: null, companies: [], error: { code: "INVALID_SESSION" } },
      { status: 401 }
    );
  }

  const sessionUser = (typeof raw === "string" ? JSON.parse(raw) : raw) as SessionPayload;
  const userId = typeof sessionUser?.userId === "string" ? sessionUser.userId : null;
  if (!userId) {
    return NextResponse.json(
      { user: null, companies: [], error: { code: "INVALID_SESSION" } },
      { status: 401 }
    );
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userCompanies: {
        include: {
          company: true,
        },
      },
    },
  });

  if (!userRecord) {
    return NextResponse.json(
      { user: null, companies: [], error: { code: "INVALID_SESSION" } },
      { status: 401 }
    );
  }

  const linkedCompanies = userRecord.userCompanies
    .map((link) => {
      const company = link.company;
      if (!company) return null;
      return {
        id: company.id,
        slug: company.slug,
        name: company.name,
        role: (link.role ?? "user").toUpperCase(),
        active: true,
      };
    })
    .filter((value): value is AuthCompany => Boolean(value));

  const companies = dedupeCompanies(linkedCompanies);
  const landingRole = decideLandingRole(companies, sessionUser.role ?? null);
  const user = buildUserPayload(userRecord, companies, landingRole);

  await redis.expire(`session:${sessionId}`, 60 * 60 * 8);

  const res = NextResponse.json({ user, companies });
  res.cookies.set("session_id", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
  });

  return res;
}

// PATCH não suportado neste modelo minimalista
export async function PATCH() {
  return NextResponse.json({ error: "Not implemented" }, { status: 405 });
}
