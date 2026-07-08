import openApiDocument from "../../../docs/openapi/quality-control.openapi.json";
import {
  collectOpenApiOperations,
  extractHttpMethods,
  findUndocumentedOperations,
  routeFileToApiPath,
} from "@/lib/documentation/apiDocsCoverage";
import {
  buildQualityControlOfficialDocsStore,
  getOfficialCompanyDocsForSlug,
} from "@/lib/documentation/qualityControlOfficialDocs";

describe("quality control official docs", () => {
  it("exposes manual and OpenAPI content for Testing Company", () => {
    const store = buildQualityControlOfficialDocsStore();

    expect(store.categories.length).toBeGreaterThan(0);
    expect(store.docs.some((doc) => doc.slug === "manual-do-sistema-quality-control")).toBe(true);
    expect(store.docs.some((doc) => doc.slug === "swagger-openapi-inicial")).toBe(true);
    expect(store.docs.some((doc) => doc.slug === "manual-ui-com-prints-e-elementos")).toBe(true);
    expect(store.docs.some((doc) => doc.slug === "agentes-consulta-insercao-documentacao")).toBe(true);
    expect(store.docs.some((doc) => doc.slug === "banco-de-dados-e-estrutura-do-sistema")).toBe(true);
    expect(store.docs.some((doc) => doc.slug === "ferramentas-usadas-na-construcao")).toBe(true);
    expect(getOfficialCompanyDocsForSlug("testing-company")?.docs.length).toBe(store.docs.length);
    expect(getOfficialCompanyDocsForSlug("outra-empresa")).toBeNull();
  });

  it("keeps UI screenshots and project context in the company wiki", () => {
    const store = buildQualityControlOfficialDocsStore();
    const manual = store.docs.find((doc) => doc.slug === "manual-do-sistema-quality-control");
    const uiDoc = store.docs.find((doc) => doc.slug === "manual-ui-com-prints-e-elementos");

    expect(manual?.blocks.some((block) => JSON.stringify(block).includes("Testing Company > Quality Control"))).toBe(true);
    expect(uiDoc?.blocks.some((block) => block.type === "image" && block.src.includes("documentacao.png"))).toBe(true);
    expect(uiDoc?.blocks.some((block) => block.type === "table" && block.rows.some((row) => row.includes("`usuarios-listagem.png`")))).toBe(true);
  });

  it("documents critical operations in the OpenAPI spec", () => {
    const operations = collectOpenApiOperations(openApiDocument);

    expect(operations.has("GET /api/admin/users")).toBe(true);
    expect(operations.has("POST /api/admin/users")).toBe(true);
    expect(operations.has("POST /api/admin/access-requests/{id}/accept")).toBe(true);
    expect(operations.has("GET /api/chat/contacts")).toBe(true);
    expect(operations.has("POST /api/chat/messages")).toBe(true);
    expect(operations.has("POST /api/company-docs/{companySlug}/docs")).toBe(true);
    expect(operations.has("PATCH /api/company-docs/{companySlug}/docs/{id}")).toBe(true);
    expect(operations.has("GET /api/brain/search")).toBe(true);
    expect(operations.has("POST /api/brain/query/hybrid")).toBe(true);
  });

  it("detects API routes that are still undocumented", () => {
    const missing = findUndocumentedOperations(
      [
        {
          filePath: "app/api/admin/users/route.ts",
          routePath: "/api/admin/users",
          methods: ["GET", "POST"],
        },
        {
          filePath: "app/api/agenda/route.ts",
          routePath: "/api/agenda",
          methods: ["GET"],
        },
      ],
      openApiDocument,
    );

    expect(missing).toEqual([
      {
        method: "GET",
        routePath: "/api/agenda",
        filePath: "app/api/agenda/route.ts",
      },
    ]);
  });

  it("normalizes dynamic route paths and method extraction", () => {
    expect(routeFileToApiPath("app/api/company-docs/[companySlug]/route.ts", process.cwd())).toBe(
      "/api/company-docs/{companySlug}",
    );
    expect(extractHttpMethods("export async function GET() {}\nexport async function POST() {}")).toEqual([
      "GET",
      "POST",
    ]);
  });
});
