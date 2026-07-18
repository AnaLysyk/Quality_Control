/// <reference types="node" />

import fs from "fs/promises";
import path from "path";
import {
  collectApiRouteDescriptors,
  findUndocumentedOperations,
  type OpenApiDocument,
} from "../../../backend/documentation/apiDocsCoverage";

async function main() {
  const rootDir = process.cwd();
  const openApiPath = path.join(rootDir, "docs", "openapi", "quality-control.openapi.json");
  const raw = await fs.readFile(openApiPath, "utf8");
  const document = JSON.parse(raw) as OpenApiDocument;
  const routes = await collectApiRouteDescriptors(rootDir);
  const missing = findUndocumentedOperations(routes, document);

  console.log(`[docs:check-api] Rotas encontradas: ${routes.length}`);
  console.log(`[docs:check-api] Operacoes documentadas: ${Object.keys(document.paths ?? {}).length} paths`);

  if (missing.length === 0) {
    console.log("[docs:check-api] Nenhuma operacao sem documentacao encontrada.");
    return;
  }

  console.log(`[docs:check-api] Operacoes sem cobertura OpenAPI: ${missing.length}`);
  for (const item of missing) {
    console.log(`- ${item.method} ${item.routePath} (${item.filePath})`);
  }

  const strict = ["1", "true", "yes", "on"].includes((process.env.DOCS_CHECK_STRICT ?? "").toLowerCase());
  if (strict) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[docs:check-api] Falha ao validar cobertura OpenAPI.");
  console.error(error);
  process.exitCode = 1;
});
