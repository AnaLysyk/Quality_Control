import type { APIRequestContext } from "@playwright/test";

import { EMPRESA_CLIENTE_E2E } from "../../ui/runs/rotas-runs";

export async function exportarPdfRunManualPorApi(
  request: APIRequestContext,
  runSlug: string,
  companySlug = EMPRESA_CLIENTE_E2E.slug,
) {
  return request.get(`/api/empresas/${companySlug}/releases/${runSlug}/export?format=pdf`);
}

