import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/backend/jwtAuth";
import { resolveAutomationAccess, resolveAutomationAllowedCompanySlugs } from "@/backend/automations/access";
import { automationPool, ensureAutomationTables } from "@/database/automationPool";
import { ingestSystemEventIntoBrain } from "@/backend/brain/systemIngest";
import { parseRepository, publishFilesToRepo } from "@/backend/github/publishToRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PublishSchema = z.object({
  confirm: z.boolean(),
  repository: z.string().trim().min(1).default("AnaLysyk/Quality_Control"),
  baseBranch: z.string().trim().min(1).default("main"),
  companySlug: z.string().trim().min(1),
  projectId: z.string().trim().min(1).nullable().optional(),
  branch: z.string().trim().min(1),
  files: z
    .array(
      z.object({
        path: z.string().trim().min(1),
        content: z.string(),
      }),
    )
    .min(1),
  commitMessage: z.string().trim().min(1),
  prTitle: z.string().trim().min(1),
  prBody: z.string().trim().default(""),
});

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const allowedCompanySlugs = resolveAutomationAllowedCompanySlugs(user);
  const access = resolveAutomationAccess(user, allowedCompanySlugs.length);
  if (!access.canOpen) {
    return NextResponse.json({ message: "Sem permissão para publicar automações no GitHub." }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PublishSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Requisição inválida." }, { status: 400 });
  }

  const body = parsed.data;
  if (!access.hasGlobalCompanyVisibility && !allowedCompanySlugs.includes(body.companySlug)) {
    return NextResponse.json({ message: "Sem permissão para publicar automações desta empresa." }, { status: 403 });
  }
  if (!body.confirm) {
    return NextResponse.json({ message: "Confirmação explícita é obrigatória para publicar no GitHub." }, { status: 400 });
  }

  const parsedRepository = parseRepository(body.repository);
  if (!parsedRepository) {
    return NextResponse.json({ message: "Repositório inválido. Use owner/repo." }, { status: 400 });
  }

  try {
    await ensureAutomationTables();
    const primaryFile = body.files[0];
    const snapshot = await automationPool.query<{ id: string }>(
      `INSERT INTO automation_scripts (company_slug, path, content, status, created_by, updated_by)
       VALUES ($1, $2, $3, 'draft', $4, $4)
       ON CONFLICT (company_slug, path)
       DO UPDATE SET
         content = EXCLUDED.content,
         status = 'draft',
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING id`,
      [body.companySlug, primaryFile.path, primaryFile.content, user.id ?? user.email],
    );
    const snapshotId = snapshot.rows[0]?.id ?? `${body.companySlug}:${primaryFile.path}`;

    const result = await publishFilesToRepo({
      owner: parsedRepository.owner,
      repo: parsedRepository.repo,
      baseBranch: body.baseBranch,
      branch: body.branch,
      files: body.files,
      commitMessage: () => body.commitMessage,
      prTitle: body.prTitle,
      prBody: body.prBody,
    });

    await automationPool.query(
      `UPDATE automation_scripts
       SET status = 'published', updated_by = $3, updated_at = NOW()
       WHERE company_slug = $1 AND path = $2`,
      [body.companySlug, primaryFile.path, user.id ?? user.email],
    );

    try {
      await ingestSystemEventIntoBrain({
        action: "updated",
        entityType: "AutomationScript",
        entityId: snapshotId,
        entityLabel: primaryFile.path,
        actorUserId: user.id,
        actorEmail: user.email,
        metadata: {
          module: "Automacao",
          companySlug: body.companySlug,
          projectId: body.projectId ?? null,
          path: primaryFile.path,
          status: "published",
          source: "automation_scripts",
          githubRepository: body.repository,
          githubBranch: body.branch,
          githubCommitSha: result.latestCommitSha,
          githubPullRequestUrl: result.pullRequestUrl,
          snapshotId,
          snapshotStoredBeforePublish: true,
        },
      });
    } catch (brainError) {
      console.warn("[automation-publish] Brain snapshot ingestion failed", brainError);
    }

    return NextResponse.json({
      message: "Publicação GitHub concluída.",
      repository: body.repository,
      branch: body.branch,
      files: result.files,
      pullRequestUrl: result.pullRequestUrl,
      commitSha: result.latestCommitSha,
      snapshotId,
      snapshotStoredBeforePublish: true,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Falha na publicação GitHub.";
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
