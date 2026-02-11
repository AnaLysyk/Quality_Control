import { NextResponse } from "next/server";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";
import { slugifyRelease } from "@/lib/slugifyRelease";
import { getMockRole } from "@/lib/rbac/defects";
import { readManualReleases } from "@/lib/manualReleaseStore";
import { resolveManualReleaseKind } from "@/lib/manualReleaseKind";
import { listDefectHistory } from "@/lib/manualDefectHistoryStore";
import { getLocalUserById } from "@/lib/auth/localStore";

function resolveAllowedSlugs(user: AuthUser): string[] {
  if (Array.isArray(user.companySlugs) && user.companySlugs.length) return user.companySlugs;
  if (user.companySlug) return [user.companySlug];
  return [];
}

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const authUser = await authenticateRequest(req);
  const mockRole = await getMockRole();
  const effectiveAuthUser: AuthUser | null =
    authUser ??
    (mockRole ? { id: "mock-user", email: "mock@local", isGlobalAdmin: mockRole === "admin" } : null);
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
  const uniqueActors = Array.from(
    new Set(items.map((event) => event.actorId).filter((value): value is string => Boolean(value))),
  );
  const actors = await Promise.all(uniqueActors.map((actorId) => getLocalUserById(actorId)));
  const actorMap = new Map(uniqueActors.map((actorId, idx) => [actorId, actors[idx] ?? null]));

  const enriched = items.map((event) => {
    if (event.actorName || !event.actorId) return event;
    const actor = actorMap.get(event.actorId) ?? null;
    if (!actor) return event;
    return { ...event, actorName: actor.name ?? actor.email ?? event.actorName ?? null };
  });

  return NextResponse.json({ items: enriched }, { status: 200 });
}
