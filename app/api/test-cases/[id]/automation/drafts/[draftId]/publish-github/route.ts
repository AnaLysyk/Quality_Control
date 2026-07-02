import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { canAccessTestCaseRecord } from "@/lib/test-cases/testCasePermissions";
import { getTestCaseRecord } from "@/lib/test-cases/testCaseRepository";
import { getAutomationDraft, recordAutomationAgentRun, updateAutomationDraft } from "@/lib/test-cases/automationDraftsStore";

type GithubFileCommitResult = {
  path: string;
  commitSha: string;
};

function parseRepository(repository: string) {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) return null;
  return { owner, repo };
}

async function githubRequest<T>(
  token: string,
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json().catch(() => null)) as T | null;
  return { ok: response.ok, status: response.status, data };
}

async function ensureBranch(
  token: string,
  owner: string,
  repo: string,
  baseBranch: string,
  targetBranch: string,
) {
  const baseRefUrl = `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(baseBranch)}`;
  const baseRefResponse = await githubRequest<{ object?: { sha?: string } }>(token, baseRefUrl);
  if (!baseRefResponse.ok || !baseRefResponse.data?.object?.sha) {
    throw new Error(`Não foi possível ler branch base ${baseBranch} no repositório ${owner}/${repo}.`);
  }

  const targetRefUrl = `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(targetBranch)}`;
  const targetRefResponse = await githubRequest<{ object?: { sha?: string } }>(token, targetRefUrl);
  if (targetRefResponse.ok && targetRefResponse.data?.object?.sha) {
    return targetRefResponse.data.object.sha;
  }

  const createRefResponse = await githubRequest<{ object?: { sha?: string } }>(
    token,
    `https://api.github.com/repos/${owner}/${repo}/git/refs`,
    {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${targetBranch}`,
        sha: baseRefResponse.data.object.sha,
      }),
    },
  );

  if (!createRefResponse.ok || !createRefResponse.data?.object?.sha) {
    throw new Error(`Não foi possível criar branch ${targetBranch} em ${owner}/${repo}.`);
  }

  return createRefResponse.data.object.sha;
}

async function upsertFileInBranch(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  commitMessage: string,
): Promise<GithubFileCommitResult> {
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const contentUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
  const existing = await githubRequest<{ sha?: string }>(token, contentUrl);
  const existingSha = existing.ok ? existing.data?.sha : undefined;

  const putResult = await githubRequest<{
    commit?: { sha?: string };
  }>(token, `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`, {
    method: "PUT",
    body: JSON.stringify({
      message: commitMessage,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
      sha: existingSha,
    }),
  });

  if (!putResult.ok || !putResult.data?.commit?.sha) {
    throw new Error(`Não foi possível publicar arquivo ${path} em ${owner}/${repo}.`);
  }

  return {
    path,
    commitSha: putResult.data.commit.sha,
  };
}

async function createOrReusePullRequest(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  baseBranch: string,
  title: string,
  body: string,
) {
  const create = await githubRequest<{ html_url?: string }>(
    token,
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    {
      method: "POST",
      body: JSON.stringify({
        title,
        head: branch,
        base: baseBranch,
        body,
      }),
    },
  );

  if (create.ok && create.data?.html_url) return create.data.html_url;
  if (create.status !== 422) {
    throw new Error("Não foi possível abrir Pull Request no GitHub.");
  }

  const list = await githubRequest<Array<{ html_url?: string }>>(
    token,
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`,
  );

  const existingPr = list.ok && Array.isArray(list.data) ? list.data[0]?.html_url : null;
  if (!existingPr) {
    throw new Error("Não foi possível reutilizar Pull Request existente.");
  }

  return existingPr;
}

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
