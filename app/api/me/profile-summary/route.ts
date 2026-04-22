import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth/session";
import { normalizeDefectStatus } from "@/lib/defectNormalization";
import {
  getLocalUserById,
  listLocalCompanies,
  listLocalLinksForUser,
} from "@/lib/auth/localStore";
import { listUserNotes } from "@/lib/userNotesStore";
import { resolveVisibleCompanies } from "@/lib/companyVisibility";

export const runtime = "nodejs";
export const revalidate = 0;

type DefectRecord = {
  createdBy?: string | null;
  status?: string | null;
  deletedAt?: string | null;
};

function normalizeComparableValue(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

async function readCompanyDefects(companyId: string): Promise<DefectRecord[]> {
  const filePath = path.join(process.cwd(), "data", "companies", companyId, "defects.json");

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DefectRecord[]) : [];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const [user, companies, links, notes] = await Promise.all([
    getLocalUserById(access.userId),
    listLocalCompanies(),
    listLocalLinksForUser(access.userId),
    listUserNotes(access.userId),
  ]);

  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  const visibleCompanies = resolveVisibleCompanies(companies, {
    user: {
      role: access.role ?? null,
      companyRole: access.companyRole ?? null,
      userOrigin: access.userOrigin ?? null,
      isGlobalAdmin: access.isGlobalAdmin === true,
      companySlug: access.companySlug ?? null,
      clientSlug: access.companySlug ?? null,
      companySlugs: access.companySlugs ?? [],
      clientSlugs: access.companySlugs ?? [],
    },
    links,
    preferredSlug: access.companySlug ?? null,
  });

  const activeLinkedCompanies = visibleCompanies.filter((company) => {
    if (company.active === false) return false;
    if ((company.status ?? "active") === "archived") return false;
    return true;
  });

  const userKeys = new Set(
    [user.id, user.user, user.email]
      .map((value) => normalizeComparableValue(value))
      .filter(Boolean),
  );

  const defectsPerCompany = await Promise.all(
    visibleCompanies.map((company) => readCompanyDefects(company.id)),
  );

  const openDefects = defectsPerCompany
    .flat()
    .filter((defect) => {
      if (normalizeDefectStatus(defect.status) === "done") return false;
      if (typeof defect.deletedAt === "string" && defect.deletedAt.trim()) return false;
      return userKeys.has(normalizeComparableValue(defect.createdBy));
    });

  return NextResponse.json(
    {
      openDefectsCount: openDefects.length,
      notesCreatedCount: notes.length,
      linkedCompaniesCount: activeLinkedCompanies.length,
      createdAt: user.createdAt ?? null,
    },
    { status: 200 },
  );
}
