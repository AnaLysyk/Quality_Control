import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/jwtAuth";
import { resolveAutomationAccess } from "@/lib/automations/access";
import { parseRepository, publishFilesToRepo } from "@/lib/github/publishToRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PublishSchema = z.object({
  confirm: z.boolean(),
  repository: z.string().trim().min(1).default("AnaLysyk/Quality_Control"),
  baseBranch: z.string().trim().min(1).default("main"),
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

  const access = resolveAutomationAccess(user);
  if (!access.canOpen) {
    return NextResponse.json({ message: "Sem permissão para publicar automações no GitHub." }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PublishSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Requisição inválida." }, { status: 400 });
  }

  const body = parsed.data;
  if (!body.confirm) {
    return NextResponse.json({ message: "Confirmação explícita é obrigatória para publicar no GitHub." }, { status: 400 });
  }

  const parsedRepository = parseRepository(body.repository);
  if (!parsedRepository) {
    return NextResponse.json({ message: "Repositório inválido. Use owner/repo." }, { status: 400 });
  }

  try {
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

    return NextResponse.json({
      message: "Publicação GitHub concluída.",
      repository: body.repository,
      branch: body.branch,
      files: result.files,
      pullRequestUrl: result.pullRequestUrl,
      commitSha: result.latestCommitSha,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Falha na publicação GitHub.";
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
