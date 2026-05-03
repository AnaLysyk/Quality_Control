import { NextResponse } from "next/server";
import { listApplications, createApplication } from "../../../lib/applicationsStore";
import { getCompanyIntegratedDefects } from "../../../lib/companyDefects";
import { syncApplicationToBrain } from "@/lib/brain-sync";
import { getClientQaseSettings } from "@/lib/qaseConfig";

function normalizeProjectCode(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const companySlug = url.searchParams.get("companySlug") || undefined;
  const items = await listApplications(companySlug ? { companySlug } : undefined);
  if (!companySlug) {
    return NextResponse.json({ items });
  }

  const integrated = await getCompanyIntegratedDefects(companySlug);
  const qaseSettings = await getClientQaseSettings(companySlug);
  const configuredProjectCodes = Array.from(
    new Set(
      [
        ...(Array.isArray(qaseSettings?.projectCodes) ? qaseSettings.projectCodes : []),
        qaseSettings?.projectCode,
        ...integrated.projects.map((project) => project.projectCode),
      ]
        .map((projectCode) => normalizeProjectCode(projectCode))
        .filter((projectCode): projectCode is string => Boolean(projectCode)),
    ),
  );
  const blockedProjects = integrated.projects.filter((project) => !project.accessible);
  const blockedProjectMap = new Map(blockedProjects.map((project) => [project.projectCode, project]));
  const existingProjectCodes = new Set(
    items
      .map((item) => normalizeProjectCode(item.qaseProjectCode))
      .filter((projectCode): projectCode is string => Boolean(projectCode)),
  );
  const syntheticProjectItems = configuredProjectCodes
    .filter((projectCode) => !existingProjectCodes.has(projectCode))
    .map((projectCode) => ({
      id: `qase_${companySlug}_${projectCode}`,
      companySlug,
      name: projectCode,
      slug: projectCode.toLowerCase(),
      description: null,
      imageUrl: null,
      qaseProjectCode: projectCode,
      source: "qase",
      active: true,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }));

  const visibleItems = [...items, ...syntheticProjectItems].filter((item) => {
    const projectCode = normalizeProjectCode(item.qaseProjectCode);
    return !projectCode || !blockedProjectMap.has(projectCode);
  });

  const blockedItems = [
    ...items
      .filter((item) => {
        const projectCode = normalizeProjectCode(item.qaseProjectCode);
        return Boolean(projectCode && blockedProjectMap.has(projectCode));
      })
      .map((item) => {
        const projectCode = normalizeProjectCode(item.qaseProjectCode);
        const blocked = projectCode ? blockedProjectMap.get(projectCode) ?? null : null;
        return {
          ...item,
          accessReason: blocked?.reason ?? "error",
          accessMessage: blocked?.message ?? "Projeto Qase indisponivel",
          unavailable: true,
        };
      }),
    ...blockedProjects
      .filter((project) => {
        return !items.some((item) => normalizeProjectCode(item.qaseProjectCode) === project.projectCode);
      })
      .map((project) => ({
        id: `blocked_${project.projectCode}`,
        companySlug,
        name: project.projectCode,
        slug: project.projectCode.toLowerCase(),
        description: null,
        imageUrl: null,
        qaseProjectCode: project.projectCode,
        source: "qase",
        active: false,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        accessReason: project.reason,
        accessMessage: project.message ?? "Projeto Qase indisponivel",
        unavailable: true,
      })),
  ];

  return NextResponse.json({ items: visibleItems, blockedItems });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const created = await createApplication({
      name: String(body.name),
      slug: body.slug ? String(body.slug) : undefined,
      description: body.description ?? null,
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : null,
      qaseProjectCode: typeof body.qaseProjectCode === "string" ? body.qaseProjectCode : null,
      source: typeof body.source === "string" ? body.source : null,
      companySlug: body.companySlug ?? body.companyId ?? undefined,
      companyId: body.companyId ?? body.companySlug ?? undefined,
      active: body.active ?? true,
    });
    syncApplicationToBrain({
      id: created.id,
      name: created.name,
      slug: created.slug,
      description: created.description,
      companyId: created.companyId ?? body.companyId ?? null,
      active: created.active,
      qaseProjectCode: created.qaseProjectCode,
      source: created.source,
    }).catch(() => {});
    return NextResponse.json({ item: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
}
// Duplicate block removed — this route already exports a GET/POST above
