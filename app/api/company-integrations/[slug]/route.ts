import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveOperationalContext } from "@/backend/context/operationalContext";
import { createQaseClient, QaseError } from "@/backend/qaseSdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Provider = "qase" | "jira";

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function basicAuth(email: string, token: string) {
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

async function listQaseProjects(token: string) {
  const client = createQaseClient({ token, defaultFetchOptions: { cache: "no-store" } });
  const items: Array<{ key: string; name: string }> = [];
  let offset = 0;

  while (true) {
    const data = await client.listProjects({ limit: 100, offset });
    const entities = Array.isArray(data.result?.entities) ? data.result.entities : [];

    for (const raw of entities) {
      if (!raw || typeof raw !== "object") continue;
      const record = raw as Record<string, unknown>;
      const key = typeof record.code === "string" ? record.code.trim().toUpperCase() : "";
      if (!key) continue;
      const name = typeof record.title === "string" && record.title.trim() ? record.title.trim() : key;
      items.push({ key, name });
    }

    if (entities.length < 100) break;
    offset += 100;
  }

  return items;
}

async function listJiraProjects(baseUrl: string, email: string, token: string) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/rest/api/3/project/search?maxResults=100`, {
    headers: { Authorization: basicAuth(email, token), Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Jira respondeu ${response.status}`);

  const payload = (await response.json().catch(() => null)) as { values?: unknown[] } | null;
  return (Array.isArray(payload?.values) ? payload.values : []).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const record = raw as Record<string, unknown>;
    const key = typeof record.key === "string" ? record.key.trim().toUpperCase() : "";
    if (!key) return [];
    const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : key;
    return [{ key, name }];
  });
}

const LinkSchema = z.object({
  provider: z.enum(["qase", "jira"]),
  externalKey: z.string().trim().min(1),
  externalName: z.string().trim().optional(),
  projectId: z.string().trim().optional(),
  createProject: z.boolean().optional(),
  confirmIntegratedRepository: z.boolean().optional(),
  forceReplace: z.boolean().optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const provider = new URL(request.url).searchParams.get("provider") as Provider | null;

  if (provider !== "qase" && provider !== "jira") {
    return NextResponse.json({ error: "provider inválido" }, { status: 400 });
  }

  const context = await resolveOperationalContext(request, {
    moduleId: provider,
    action: "view_projects",
    companySlug: slug,
    requireCompany: true,
  });
  if (!context.ok) return context.response;

  const { prisma } = await import("@/database/prismaClient");
  const company = await prisma.company.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      qase_token: true,
      jira_base_url: true,
      jira_email: true,
      jira_api_token: true,
    },
  });
  if (!company) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

  const projects = await prisma.project.findMany({
    where: { companyId: company.id, status: "active" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      qaseProjectCode: true,
      jiraProjectKey: true,
      manualCreationDisabled: true,
    },
  });

  try {
    const externalProjects =
      provider === "qase"
        ? company.qase_token
          ? await listQaseProjects(company.qase_token)
          : []
        : company.jira_base_url && company.jira_email && company.jira_api_token
          ? await listJiraProjects(company.jira_base_url, company.jira_email, company.jira_api_token)
          : [];

    return NextResponse.json({
      provider,
      company: {
        id: company.id,
        name: company.name,
        slug,
        configured:
          provider === "qase"
            ? Boolean(company.qase_token)
            : Boolean(company.jira_base_url && company.jira_email && company.jira_api_token),
      },
      projects,
      externalProjects: externalProjects.map((external) => ({
        ...external,
        linkedProject:
          projects.find((project) =>
            provider === "qase"
              ? project.qaseProjectCode === external.key
              : project.jiraProjectKey === external.key,
          ) ?? null,
      })),
    });
  } catch (error) {
    const status = error instanceof QaseError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao consultar integração" },
      { status },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = LinkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const input = parsed.data;
  const externalKey = input.externalKey.toUpperCase();

  const context = await resolveOperationalContext(request, {
    moduleId: input.provider,
    action: "sync",
    companySlug: slug,
    requireCompany: true,
  });
  if (!context.ok) return context.response;

  if (input.provider === "qase" && !input.confirmIntegratedRepository) {
    return NextResponse.json(
      { error: "Confirme que o projeto passará a usar o repositório integrado do Qase." },
      { status: 400 },
    );
  }

  const { prisma } = await import("@/database/prismaClient");
  const company = await prisma.company.findUnique({ where: { slug }, select: { id: true } });
  if (!company) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

  const duplicate = await prisma.project.findFirst({
    where: {
      companyId: company.id,
      ...(input.provider === "qase"
        ? { qaseProjectCode: externalKey }
        : { jiraProjectKey: externalKey }),
    },
    select: { id: true, name: true },
  });

  if (duplicate && duplicate.id !== input.projectId) {
    return NextResponse.json(
      { error: `Integração já vinculada ao projeto ${duplicate.name}.` },
      { status: 409 },
    );
  }

  let projectId = input.projectId;

  if (!projectId || input.createProject) {
    const baseSlug = normalizeSlug(input.externalName || input.externalKey);
    let projectSlug = baseSlug || `projeto-${Date.now()}`;
    let suffix = 2;

    while (
      await prisma.project.findUnique({
        where: { companyId_slug: { companyId: company.id, slug: projectSlug } },
        select: { id: true },
      })
    ) {
      projectSlug = `${baseSlug}-${suffix++}`;
    }

    const created = await prisma.project.create({
      data: {
        companyId: company.id,
        name: input.externalName || externalKey,
        slug: projectSlug,
        description: `Projeto criado a partir da integração ${input.provider === "qase" ? "Qase" : "Jira"}.`,
        qaseProjectCode: input.provider === "qase" ? externalKey : null,
        jiraProjectKey: input.provider === "jira" ? externalKey : null,
        manualCreationDisabled: false,
        createdById: context.context.access.userId,
      },
      select: { id: true },
    });
    projectId = created.id;
  } else {
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId: company.id },
      select: { id: true, name: true, qaseProjectCode: true, jiraProjectKey: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Projeto interno não encontrado nesta empresa" }, { status: 404 });
    }

    const currentExternalKey =
      input.provider === "qase" ? project.qaseProjectCode : project.jiraProjectKey;

    if (currentExternalKey && currentExternalKey !== externalKey && !input.forceReplace) {
      return NextResponse.json(
        {
          error: `O projeto ${project.name} já está vinculado a ${currentExternalKey}. Confirme a substituição para continuar.`,
          code: "EXTERNAL_LINK_REPLACEMENT_REQUIRES_CONFIRMATION",
          currentExternalKey,
          requestedExternalKey: externalKey,
        },
        { status: 409 },
      );
    }

    await prisma.project.update({
      where: { id: projectId },
      data:
        input.provider === "qase"
          ? { qaseProjectCode: externalKey, manualCreationDisabled: false }
          : { jiraProjectKey: externalKey },
    });
  }

  return NextResponse.json({
    ok: true,
    projectId,
    provider: input.provider,
    externalKey,
  });
}
