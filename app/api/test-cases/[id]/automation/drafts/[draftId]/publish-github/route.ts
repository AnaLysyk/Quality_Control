import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { canAccessTestCaseRecord } from "@/backend/test-cases/testCasePermissions";
import { getTestCaseRecord } from "@/backend/test-cases/testCaseRepository";
import { getAutomationDraft, recordAutomationAgentRun, updateAutomationDraft } from "@/backend/test-cases/automationDraftsStore";
import {
  type GithubFileCommitResult,
  ensureBranch,
  createOrReusePullRequest,
  parseRepository,
  upsertFileInBranch,
} from "@/backend/github/publishToRepo";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; draftId: string }> },
) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id, draftId } = await params;
  const record = await getTestCaseRecord(id);
  if (!record) return NextResponse.json({ message: "Caso não encontrado" }, { status: 404 });
  if (!canAccessTestCaseRecord(user, record)) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const confirmed = body?.confirm === true;
  if (!confirmed) {
    return NextResponse.json({ message: "Confirmação explícita é obrigatória para publicar no GitHub." }, { status: 400 });
  }

  const draft = await getAutomationDraft(record.testCase.id, draftId);
  if (!draft) return NextResponse.json({ message: "Draft não encontrado" }, { status: 404 });
  if (!draft.specFile) return NextResponse.json({ message: "Draft sem specFile não pode ser publicado." }, { status: 400 });
  if (draft.status !== "linked") {
    return NextResponse.json({ message: "Apenas drafts com status linked podem ser publicados no GitHub." }, { status: 400 });
  }

  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ message: "GITHUB_TOKEN não configurado no servidor." }, { status: 500 });
  }

  const repository =
    typeof body?.repository === "string" && body.repository.trim()
      ? body.repository.trim()
      : "testing-company/quality-control";
  const parsedRepository = parseRepository(repository);
  if (!parsedRepository) {
    return NextResponse.json({ message: "Repositório inválido. Use owner/repo." }, { status: 400 });
  }

  const baseBranch =
    typeof body?.baseBranch === "string" && body.baseBranch.trim()
      ? body.baseBranch.trim()
      : "main";
  const branch =
    typeof body?.branch === "string" && body.branch.trim()
      ? body.branch.trim()
      : `automation/${record.testCase.key?.toLowerCase() || record.testCase.id}`;

  const { owner, repo } = parsedRepository;

  try {
    await ensureBranch(token, owner, repo, baseBranch, branch);

    const publishedFiles: GithubFileCommitResult[] = [];

    const specResult = await upsertFileInBranch(
      token,
      owner,
      repo,
      branch,
      draft.specFile,
      draft.specCode ?? "// spec code indisponível no draft\n",
      `[automation] ${record.testCase.key || record.testCase.id} - publish spec`,
    );
    publishedFiles.push(specResult);

    if (draft.pomPath && draft.pomCode) {
      publishedFiles.push(
        await upsertFileInBranch(
          token,
          owner,
          repo,
          branch,
          draft.pomPath,
          draft.pomCode,
          `[automation] ${record.testCase.key || record.testCase.id} - publish pom`,
        ),
      );
    }

    if (draft.fixturePath && draft.fixtureCode) {
      publishedFiles.push(
        await upsertFileInBranch(
          token,
          owner,
          repo,
          branch,
          draft.fixturePath,
          draft.fixtureCode,
          `[automation] ${record.testCase.key || record.testCase.id} - publish fixture`,
        ),
      );
    }

    const pullRequestUrl = await createOrReusePullRequest(
      token,
      owner,
      repo,
      branch,
      baseBranch,
      `[Automation] ${record.testCase.key || record.testCase.id} - Playwright draft`,
      `Publicação automática do draft ${draft.id} para o caso ${record.testCase.key || record.testCase.id}.`,
    );

    const latestCommitSha = publishedFiles[publishedFiles.length - 1]?.commitSha ?? null;

    const updated = await updateAutomationDraft(record.testCase.id, draftId, {
      githubPublication: {
        status: "published",
        repository,
        branch,
        commitSha: latestCommitSha,
        pullRequestUrl,
        publishedAt: new Date().toISOString(),
        errorMessage: null,
      },
      reviewNotes: `${draft.reviewNotes ? `${draft.reviewNotes}\n` : ""}Publicado no GitHub em ${repository} (${branch}).`,
    });

    await recordAutomationAgentRun(
      record.testCase.id,
      user.id,
      "GitHubPublicationAgent",
      {
        draftId,
        repository,
        branch,
        baseBranch,
        confirmed: true,
      },
      {
        status: "published",
        repository,
        branch,
        commitSha: latestCommitSha,
        pullRequestUrl,
        files: publishedFiles,
      },
      "completed",
    );

    return NextResponse.json({
      testCaseId: record.testCase.id,
      draft: updated,
      publication: updated?.githubPublication,
      message: "Publicação GitHub concluída com confirmação explícita.",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Falha na publicação GitHub.";

    const failedDraft = await updateAutomationDraft(record.testCase.id, draftId, {
      githubPublication: {
        status: "failed",
        repository,
        branch,
        commitSha: null,
        pullRequestUrl: null,
        publishedAt: null,
        errorMessage,
      },
    });

    await recordAutomationAgentRun(
      record.testCase.id,
      user.id,
      "GitHubPublicationAgent",
      {
        draftId,
        repository,
        branch,
        baseBranch,
        confirmed: true,
      },
      {
        status: "failed",
        errorMessage,
      },
      "failed",
      errorMessage,
    );

    return NextResponse.json(
      {
        testCaseId: record.testCase.id,
        draft: failedDraft,
        message: errorMessage,
      },
      { status: 500 },
    );
  }
}
