import { NextResponse } from "next/server";

// Exemplo de documentação OpenAPI mínima
const openApiDoc = {
  openapi: "3.0.0",
  info: {
    title: "Quality Control API",
    version: "1.0.0",
    description: "Documentação das rotas principais do sistema."
  },
  paths: {
    "/api/companies": { get: { summary: "Lista empresas" }, post: { summary: "Cria empresa" } },
    "/api/companies/{companyId}/users": { get: { summary: "Lista usuários" }, post: { summary: "Cria usuário" } },
    "/api/companies/{companyId}/tickets": { get: { summary: "Lista tickets" }, post: { summary: "Cria ticket" } },
    "/api/companies/{companyId}/defects": { get: { summary: "Lista defeitos" }, post: { summary: "Cria defeito" } },
    "/api/companies/{companyId}/runs": { get: { summary: "Lista runs" }, post: { summary: "Cria run" } },
    "/api/companies/{companyId}/test-plans": { get: { summary: "Lista planos de teste" }, post: { summary: "Cria plano de teste" } },
    "/api/history": { get: { summary: "Consulta histórico/auditoria" } },
    "/api/backup": { get: { summary: "Exporta backup de empresa" } },
    "/api/restore": { post: { summary: "Restaura backup de empresa" } }
  }
};

export async function GET() {
  return NextResponse.json(openApiDoc);
}
