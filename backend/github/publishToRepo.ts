export type GithubFileCommitResult = {
  path: string;
  commitSha: string;
};

export type GithubPublishFile = {
  path: string;
  content: string;
};

export type GithubPublishRequest = {
  owner: string;
  repo: string;
  baseBranch: string;
  branch: string;
  files: GithubPublishFile[];
  commitMessage: (file: GithubPublishFile) => string;
  prTitle: string;
  prBody: string;
};

export type GithubPublishResult = {
  files: GithubFileCommitResult[];
  pullRequestUrl: string;
  latestCommitSha: string | null;
};

export function parseRepository(repository: string) {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) return null;
  return { owner, repo };
}

export async function githubRequest<T>(
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

export async function ensureBranch(
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

export async function upsertFileInBranch(
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

export async function createOrReusePullRequest(
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

/**
 * Publishes one or more files to a branch (creating it from baseBranch if needed)
 * and opens (or reuses) a Pull Request. Requires GITHUB_TOKEN in the environment.
 */
export async function publishFilesToRepo(request: GithubPublishRequest): Promise<GithubPublishResult> {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    throw new Error("GITHUB_TOKEN não configurado no servidor.");
  }
  if (!request.files.length) {
    throw new Error("Nenhum arquivo para publicar.");
  }

  const { owner, repo, baseBranch, branch } = request;

  await ensureBranch(token, owner, repo, baseBranch, branch);

  const publishedFiles: GithubFileCommitResult[] = [];
  for (const file of request.files) {
    publishedFiles.push(
      await upsertFileInBranch(token, owner, repo, branch, file.path, file.content, request.commitMessage(file)),
    );
  }

  const pullRequestUrl = await createOrReusePullRequest(
    token,
    owner,
    repo,
    branch,
    baseBranch,
    request.prTitle,
    request.prBody,
  );

  return {
    files: publishedFiles,
    pullRequestUrl,
    latestCommitSha: publishedFiles[publishedFiles.length - 1]?.commitSha ?? null,
  };
}
