process.env.AUTH_STORE = process.env.DATABASE_URL ? "postgres" : "json";
process.env.USE_JSON_STORE = "true";

jest.mock("server-only", () => ({}));
jest.mock("../../../backend/redis", () => ({
  isRedisConfigured: jest.fn(() => false),
  getRedis: jest.fn(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
  })),
}));
jest.mock("../../../backend/notificationService", () => ({
  notifyAccessRequestAccepted: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/data/auditLogRepository", () => ({
  addAuditLogSafe: jest.fn(),
}));

jest.setTimeout(30000);

const describePg = process.env.DATABASE_URL ? describe : describe.skip;

import { POST } from "@/api/admin/access-requests/[id]/accept/route";
import { createAccessRequest, getAccessRequestById } from "@/data/accessRequestsStore";
import { prisma } from "@/database/prismaClient";
import { composeAccessRequestMessage } from "@/backend/accessRequestMessage";
import { pgCreateLocalCompany, pgDeleteLocalCompany } from "@/backend/auth/pgStore";
import { hashPasswordSha256 } from "@/backend/passwordHash";

const uid = Math.random().toString(36).slice(2, 10);
const createdCompanyIds: string[] = [];
const createdRequestIds: string[] = [];
const createdUserIds: string[] = [];

afterAll(async () => {
  if (createdRequestIds.length) {
    await prisma.accessRequestComment.deleteMany({ where: { requestId: { in: createdRequestIds } } }).catch(() => null);
    await prisma.accessRequest.deleteMany({ where: { id: { in: createdRequestIds } } }).catch(() => null);
  }
  if (createdUserIds.length) {
    await prisma.membership.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => null);
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => null);
  }
  for (const companyId of createdCompanyIds) {
    await pgDeleteLocalCompany(companyId).catch(() => null);
  }
  await prisma.$disconnect();
});

describePg("access request accept route", () => {
  it("links company_user requests to the selected company instead of creating another company", async () => {
    const company = await pgCreateLocalCompany({
      name: `Empresa Usuario Empresa ${uid}`,
      company_name: `Empresa Usuario Empresa ${uid}`,
      active: true,
      status: "active",
      created_at: new Date().toISOString(),
    });
    createdCompanyIds.push(company.id);

    const email = `company-user-${uid}@access-flow.local`;
    const message = composeAccessRequestMessage({
      email,
      name: "Usuario Empresa",
      fullName: "Usuario Empresa Fluxo",
      username: `company.user.${uid}`,
      phone: "",
      passwordHash: hashPasswordSha256("SenhaFluxo@2026"),
      role: "Analista",
      company: company.name ?? company.company_name ?? company.id,
      clientId: company.id,
      accessType: "empresa",
      profileType: "company_user",
      title: "Acesso de usuario da empresa",
      description: "",
      notes: "",
    });
    const request = await createAccessRequest({ email, message });
    createdRequestIds.push(request.id);

    const response = await POST(
      new Request(`http://localhost/api/admin/access-requests/${request.id}/accept`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-test-admin": "true",
          "x-test-role": "leader_tc",
        },
        body: JSON.stringify({ comment: "Aprovado em teste" }),
      }),
      { params: Promise.resolve({ id: request.id }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);

    const accepted = await getAccessRequestById(request.id);
    expect(accepted?.status).toBe("closed");
    expect(accepted?.user_id).toBeTruthy();
    createdUserIds.push(accepted!.user_id!);

    const user = await prisma.user.findUnique({ where: { id: accepted!.user_id! } });
    expect(user?.user_origin).toBe("client_company");
    expect(user?.user_scope).toBe("company_only");
    expect(user?.home_company_id).toBe(company.id);

    const membership = await prisma.membership.findFirst({
      where: { userId: accepted!.user_id!, companyId: company.id },
    });
    expect(membership).not.toBeNull();

    const companiesWithSameName = await prisma.company.count({
      where: { name: company.name ?? company.company_name ?? company.id },
    });
    expect(companiesWithSameName).toBe(1);
  });
});

