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

export const runtime = "nodejs";

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
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const [user, companies, links, notes] = await Promise.all([
    getLocalUserById(access.userId),
    listLocalCompanies(),
    listLocalLinksForUser(access.userId),
    listUserNotes(access.userId),
  ]);

  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  const hasFullCompanyAccess =
    access.isGlobalAdmin === true ||
    (access.role ?? "").toLowerCase() === "it_dev" ||
    (access.companyRole ?? "").toLowerCase() === "it_dev";

  const linkedCompanyIds = new Set(
    links
      .map((link) => link.companyId)
      .filter((companyId): companyId is string => typeof companyId === "string" && companyId.length > 0),
  );

  const visibleCompanies = hasFullCompanyAccess
    ? companies
    : companies.filter((company) => linkedCompanyIds.has(company.id));

  const activeLinkedCompanies = companies.filter((company) => {
    if (!linkedCompanyIds.has(company.id)) return false;
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
