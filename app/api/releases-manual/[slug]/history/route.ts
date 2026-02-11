import { NextResponse } from "next/server";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";
import { slugifyRelease } from "@/lib/slugifyRelease";
import { getMockRole } from "@/lib/rbac/defects";
import { readManualReleases } from "@/lib/manualReleaseStore";
import { resolveManualReleaseKind } from "@/lib/manualReleaseKind";
import { listDefectHistory } from "@/lib/manualDefectHistoryStore";

function resolveAllowedSlugs(user: AuthUser): string[] {
  if (Array.isArray(user.companySlugs) && user.companySlugs.length) return user.companySlugs;
  if (user.companySlug) return [user.companySlug];
  return [];
}

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const authUser = await authenticateRequest(req);
  const mockRole = await getMockRole();
  const effectiveAuthUser =
    authUser ?? (mockRole ? { id: "mock-user", isGlobalAdmin: mockRole === "admin" } : null);
  if (!effectiveAuthUser) {
    return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
  }

  const { slug } = await context.params;
  const targetSlug = slugifyRelease(slug);
  const releases = await readManualReleases();
  const release = releases.find((r) => r.slug === targetSlug) ?? null;
  if (!release) {
    return NextResponse.json({ message: "Nao encontrado", items: [] }, { status: 404 });
  }

  if (!effectiveAuthUser.isGlobalAdmin) {
    const allowed = resolveAllowedSlugs(effectiveAuthUser as AuthUser);
    if (release.clientSlug && !allowed.includes(release.clientSlug)) {
      return NextResponse.json({ message: "Acesso proibido", items: [] }, { status: 403 });
    }
  }

  if (resolveManualReleaseKind(release) !== "defect") {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const items = await listDefectHistory(targetSlug);
  return NextResponse.json({ items }, { status: 200 });
}
