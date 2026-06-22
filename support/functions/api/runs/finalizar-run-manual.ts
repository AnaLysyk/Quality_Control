import type { APIRequestContext } from "@playwright/test";

export async function finalizarRunManualPorApi(
  request: APIRequestContext,
  runSlug: string,
  status = "FINALIZADA",
) {
  return request.patch(`/api/releases-manual/${runSlug}`, {
    data: { status },
  });
}
