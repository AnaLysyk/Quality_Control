import type { APIRequestContext } from "@playwright/test";

import { slugifyRelease as slugifyRun } from "../../../../lib/slugifyRelease";
import { EMPRESA_CLIENTE_E2E } from "../../ui/runs/rotas-runs";

type DadosRunManualApi = {
  titulo: string;
  app?: string;
  pass?: number;
  fail?: number;
  blocked?: number;
  notRun?: number;
};

function slugificarTituloRun(titulo: string) {
  return slugifyRun(titulo.replace(/^run\s+/i, ""));
}

export async function criarRunManualPorApi(
  request: APIRequestContext,
  dados: DadosRunManualApi,
  companySlug = EMPRESA_CLIENTE_E2E.slug,
) {
  const slug = slugificarTituloRun(dados.titulo);
  const response = await request.post("/api/releases-manual", {
    data: {
      name: dados.titulo,
      slug,
      app: dados.app ?? "SMART",
      kind: "run",
      clientSlug: companySlug,
      stats: {
        pass: dados.pass ?? 80,
        fail: dados.fail ?? 10,
        blocked: dados.blocked ?? 0,
        notRun: dados.notRun ?? 0,
      },
    },
  });

  if (!response.ok()) {
    throw new Error(`Falha ao criar run manual por API: HTTP ${response.status()} ${await response.text().catch(() => "")}`);
  }

  const payload = (await response.json().catch(() => null)) as { slug?: string } | null;
  return {
    slug: payload?.slug ?? slug,
  };
}
