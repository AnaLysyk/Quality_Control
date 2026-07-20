import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveOperationalContext } from "@/backend/context/operationalContext";
import { createQaseClient, QaseError } from "@/backend/qaseSdk";
import { validateJiraCloudCredentials } from "@/backend/jiraCloud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const trimmedUrl = z.string().trim().pipe(z.url());
const trimmedEmail = z.string().trim().pipe(z.email());

const Schema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("qase"), token: z.string().trim().min(1) }),
  z.object({
    provider: z.literal("jira"),
    baseUrl: trimmedUrl,
    email: trimmedEmail,
    token: z.string().trim().min(1),
  }),
]);

type RouteContext = Readonly<{ params: Promise<{ slug: string }> }>;

export async function PATCH(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const input = parsed.data;

  const context = await resolveOperationalContext(request, {
    moduleId: input.provider,
    action: "sync",
    companySlug: slug,
    requireCompany: true,
  });
  if (!context.ok) return context.response;

  const { prisma } = await import("@/database/prismaClient");
  const company = await prisma.company.findUnique({ where: { slug }, select: { id: true } });
  if (!company) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

  if (input.provider === "qase") {
    try {
      const client = createQaseClient({ token: input.token, defaultFetchOptions: { cache: "no-store" } });
      await client.listProjects({ limit: 1, offset: 0 });
    } catch (error) {
      const status = error instanceof QaseError ? error.status : 400;
      return NextResponse.json({ error: "Token do Qase inválido ou sem acesso aos projetos." }, { status });
    }
    await prisma.company.update({ where: { id: company.id }, data: { qase_token: input.token, integration_mode: "qase" } });
    return NextResponse.json({ ok: true, provider: "qase" });
  }

  const validation = await validateJiraCloudCredentials({ baseUrl: input.baseUrl, email: input.email, apiToken: input.token });
  if (!validation.valid) return NextResponse.json({ error: validation.errorMessage }, { status: validation.status ?? 400 });
  await prisma.company.update({
    where: { id: company.id },
    data: {
      jira_base_url: validation.baseUrl,
      jira_email: input.email,
      jira_api_token: input.token,
      integration_mode: "jira",
    },
  });
  return NextResponse.json({ ok: true, provider: "jira", accountName: validation.accountName });
}
