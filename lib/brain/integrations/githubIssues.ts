import "server-only";

import type { BrainAccessContext } from "@/lib/brain/access";
import { canAccess } from "@/lib/permissions/can-access";
import { getBrainSourceById, getDecryptedSourceSecret } from "@/lib/brain/sourceSettings";
import { safeOutboundFetch } from "@/lib/brain/ssrfGuard";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

// Reutiliza a acao ja existente no catalogo (lib/permissionCatalog.ts, modulo "assistant"):
// nao inventa permissao nova para enviar dados a um sistema externo.
export function canSendToGithub(access: BrainAccessContext) {
  return (
    access.user.isGlobalAdmin ||
    access.canManage ||
    canAccess(access.userAccess, { moduleId: "assistant", action: "create_external_ticket" })
  );
}

export type GithubIssueInput = {
  sourceId: string;
  title: string;
  body: string;
  labels?: string[];
};

/**
 * Cria uma issue no repositorio GitHub configurado como BrainSourceConfig (sourceType
 * "external_api", provider "github"). Acao disparada manualmente pelo usuario a partir de
 * um no do Brain (defeito ou execucao) — nunca automatica.
 */
export async function createGithubIssueFromSource(access: BrainAccessContext, input: GithubIssueInput) {
  if (!canSendToGithub(access)) {
    throw new Error("Sem permissao para enviar informacoes ao GitHub");
  }

  const source = await getBrainSourceById(input.sourceId, access);
  if (!source) throw new Error("Fonte do GitHub nao encontrada ou fora do escopo permitido");
  if (source.sourceType !== "external_api" || (source.provider ?? "").toLowerCase() !== "github") {
    throw new Error("Fonte informada nao e uma integracao GitHub valida");
  }
  if (source.status !== "active") throw new Error("Fonte do GitHub esta desativada");

  const config = asRecord(source.config);
  const github = asRecord(config.github);
  const owner = typeof github.owner === "string" ? github.owner.trim() : "";
  const repo = typeof github.repo === "string" ? github.repo.trim() : "";
  if (!owner || !repo) throw new Error("Fonte do GitHub sem owner/repo configurado");

  const token = await getDecryptedSourceSecret(input.sourceId, "token", access);
  if (!token) throw new Error("Token do GitHub nao configurado para esta fonte");

  const title = input.title.trim().slice(0, 250);
  if (!title) throw new Error("Titulo e obrigatorio para criar a issue");
  const body = input.body.trim().slice(0, 8000);
  const labels = (input.labels ?? []).filter((label) => typeof label === "string" && label.trim()).slice(0, 10);

  const response = await safeOutboundFetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "quality-control-brain",
    },
    body: JSON.stringify({ title, body, labels }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`GitHub retornou erro ${response.status}: ${message.slice(0, 300)}`);
  }

  const issue = (await response.json()) as { number: number; html_url: string; id: number };
  return { number: issue.number, url: issue.html_url, id: issue.id };
}
