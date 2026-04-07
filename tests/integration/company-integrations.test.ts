import { randomUUID } from "crypto";
import { prisma } from "../../lib/prismaClient";
import { pgCreateLocalCompany, pgFindLocalCompanyBySlug } from "../../lib/core/auth/pgStore";

const uid = randomUUID().slice(0, 8);
const COMPANY_NAME = `Empresa Integrações Teste ${uid}`;
const COMPANY_SLUG = `empresa-integracoes-teste-${uid}`;

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Company integrations persistence", () => {
  let createdId: string;

  it("creates a company with Qase and Jira integrations", async () => {
    const company = await pgCreateLocalCompany({
      name: COMPANY_NAME,
      slug: COMPANY_SLUG,
      status: "active",
      integrations: [
        { type: "QASE", config: { token: "test-token-123", projects: ["PROJ1", "PROJ2"] } },
        { type: "JIRA", config: { baseUrl: "https://jira.example.com", email: "admin@example.com", apiToken: "jira-token-abc" } },
      ],
    } as any);

    createdId = company.id;

    expect(company.id).toBeTruthy();
    expect(company.slug).toBe(COMPANY_SLUG);
  });

  it("finds integrations saved in the database", async () => {
    const dbRow = await prisma.company.findUnique({ where: { slug: COMPANY_SLUG }, include: { integrations: true } as any });
    expect(dbRow).not.toBeNull();
    const integrations = (dbRow?.integrations ?? []) as any[];
    const types = integrations.map((i: any) => i.type).sort();
    expect(types).toEqual(["JIRA", "QASE"].sort());

    const q = integrations.find((i: any) => i.type === "QASE");
    expect(q).toBeDefined();
    expect((q?.config as any).token).toBe("test-token-123");

    const j = integrations.find((i: any) => i.type === "JIRA");
    expect(j).toBeDefined();
    expect((j?.config as any).baseUrl).toBe("https://jira.example.com");
  });
});
