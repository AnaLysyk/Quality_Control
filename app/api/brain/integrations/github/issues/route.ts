import { type NextRequest, NextResponse } from "next/server";

import { resolveBrainAccess } from "@/lib/brain/access";
import { createGithubIssueFromSource } from "@/lib/brain/integrations/githubIssues";
import { isBrainSourceStorageUnavailable } from "@/lib/brain/sourceSettings";

export async function POST(req: NextRequest) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  const body = await req.json().catch(() => ({}));
  const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const bodyText = typeof body.body === "string" ? body.body : "";
  const labels = Array.isArray(body.labels) ? body.labels.filter((label: unknown): label is string => typeof label === "string") : [];

  if (!sourceId || !title) {
    return NextResponse.json({ error: "sourceId e title são obrigatórios" }, { status: 400 });
  }

  try {
    const issue = await createGithubIssueFromSource(accessResult.context, { sourceId, title, body: bodyText, labels });
    return NextResponse.json({ issue }, { status: 201 });
  } catch (error) {
    if (isBrainSourceStorageUnavailable(error)) {
      return NextResponse.json({ error: "Tabelas de configuração do Brain ainda não existem." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Erro ao criar issue no GitHub";
    const status = /permissao/i.test(message) ? 403 : /nao encontrada|nao configurado|desativada/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
