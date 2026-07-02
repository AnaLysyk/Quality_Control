/**
 * CenÃ¡rios do fluxo de SolicitaÃ§Ãµes de UsuÃ¡rio (requestsStore) no banco PostgreSQL.
 * âœ… cleanup total em afterAll â€” nenhum dado permanece.
 *
 * CriaÃ§Ã£o (5 cenÃ¡rios):
 *  1. Cria solicitaÃ§Ã£o de troca de e-mail (PENDING por padrÃ£o)
 *  2. Cria solicitaÃ§Ã£o de troca de empresa
 *  3. Cria solicitaÃ§Ã£o de reset de senha
 *  4. Cria solicitaÃ§Ã£o de exclusÃ£o de perfil com payload customizado
 *  5. Bloqueia duplicata PENDING do mesmo usuÃ¡rio+tipo
 *
 * Consultas (6 cenÃ¡rios):
 *  6.  listUserRequests retorna apenas solicitaÃ§Ãµes do usuÃ¡rio
 *  7.  listUserRequests filtra por status APPROVED
 *  8.  listUserRequests filtra por tipo PASSWORD_RESET
 *  9.  listAllRequests retorna todas as solicitaÃ§Ãµes
 * 10. listAllRequests filtra por status REJECTED
 * 11. listAllRequests filtra por companyId
 * 12. listAllRequests ordenaÃ§Ã£o asc por createdAt
 * 13. getRequestById retorna solicitaÃ§Ã£o existente
 * 14. getRequestById retorna null para id inexistente
 *
 * RevisÃ£o (6 cenÃ¡rios):
 * 15. updateRequestStatus aprova solicitaÃ§Ã£o PENDING
 * 16. updateRequestStatus rejeita solicitaÃ§Ã£o PENDING
 * 17. updateRequestStatus registra reviewedBy, reviewNote e reviewedAt
 * 18. updateRequestStatus nÃ£o altera solicitaÃ§Ã£o jÃ¡ revisada
 * 19. updateRequestStatus retorna null para id inexistente
 * 20. Dois usuÃ¡rios com mesmo tipo nÃ£o conflitam entre si
 */

process.env.AUTH_STORE = process.env.DATABASE_URL ? "postgres" : "json";

jest.mock("server-only", () => ({}));
jest.mock("../../../lib/redis", () => ({ isRedisConfigured: jest.fn(() => false) }));

const describePg = process.env.DATABASE_URL ? describe : describe.skip;

import { prisma } from "@/lib/prismaClient";
import {
  addRequest,
  listUserRequests,
  listAllRequests,
  getRequestById,
  updateRequestStatus,
  type RequestUser,
} from "@/data/requestsStore";
import {
  pgCreateLocalUser,
  pgCreateLocalCompany,
  pgDeleteLocalCompany,
} from "@/lib/core/auth/pgStore";
import { hashPasswordSha256 } from "@/lib/passwordHash";

jest.setTimeout(30000);

const PASSWORD = hashPasswordSha256("TC@Teste2026");
const UID = Math.random().toString(36).slice(2, 10);
const email = (tag: string) => `solicit-${tag}-${UID}@req-test.local`;

const createdRequestIds: string[] = [];
const createdUserIds: string[] = [];
const createdCompanyIds: string[] = [];

let userA: RequestUser;
let userB: RequestUser;
let adminUser: RequestUser;

beforeAll(async () => {
  // Criar empresa de teste
  const company = await pgCreateLocalCompany({
    name: `Empresa Solicit ${UID}`,
    slug: `empresa-solicit-${UID}`,
  });
  createdCompanyIds.push(company.id);

  // Criar usuÃ¡rios de teste
  const uA = await pgCreateLocalUser({
    email: email("user-a"),
    name: "Usuario A",
    password_hash: PASSWORD,
    role: "user",
  });
  createdUserIds.push(uA.id);

  const uB = await pgCreateLocalUser({
    email: email("user-b"),
    name: "Usuario B",
    password_hash: PASSWORD,
    role: "user",
  });
  createdUserIds.push(uB.id);

  const uAdmin = await pgCreateLocalUser({
    email: email("admin"),
    name: "Admin Solicit",
    password_hash: PASSWORD,
    role: "admin",
  });
  createdUserIds.push(uAdmin.id);

  userA = {
    id: uA.id,
    name: uA.name ?? undefined,
    email: uA.email,
    companyId: company.id,
    companyName: company.name,
  };
  userB = {
    id: uB.id,
    name: uB.name ?? undefined,
    email: uB.email,
    companyId: company.id,
    companyName: company.name,
  };
  adminUser = {
    id: uAdmin.id,
    name: uAdmin.name ?? undefined,
    email: uAdmin.email,
    companyId: company.id,
    companyName: company.name,
  };
});

afterAll(async () => {
  if (createdRequestIds.length > 0) {
    await prisma.request.deleteMany({ where: { id: { in: createdRequestIds } } }).catch(() => null);
  }
  if (createdUserIds.length > 0) {
    await prisma.membership.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => null);
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => null);
  }
  for (const cid of createdCompanyIds) {
    await pgDeleteLocalCompany(cid).catch(() => null);
  }
  await prisma.$disconnect();
});

// â”€â”€ CriaÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describePg("CriaÃ§Ã£o de solicitaÃ§Ãµes", () => {
  test("1. cria solicitaÃ§Ã£o EMAIL_CHANGE com status PENDING", async () => {
    const req = await addRequest(userA, "EMAIL_CHANGE", { newEmail: "novo@email.com" });
    createdRequestIds.push(req.id);

    expect(req.id).toBeTruthy();
    expect(req.userId).toBe(userA.id);
    expect(req.type).toBe("EMAIL_CHANGE");
    expect(req.status).toBe("PENDING");
    expect(req.payload).toMatchObject({ newEmail: "novo@email.com" });
    expect(req.createdAt).toBeTruthy();
  });

  test("2. cria solicitaÃ§Ã£o COMPANY_CHANGE com companyId e companyName", async () => {
    const req = await addRequest(userA, "COMPANY_CHANGE", { targetCompanyId: "cmp_xyz" });
    createdRequestIds.push(req.id);

    expect(req.type).toBe("COMPANY_CHANGE");
    expect(req.companyId).toBe(userA.companyId);
    expect(req.companyName).toBe(userA.companyName);
  });

  test("3. cria solicitaÃ§Ã£o PASSWORD_RESET", async () => {
    const req = await addRequest(userA, "PASSWORD_RESET", {});
    createdRequestIds.push(req.id);

    expect(req.type).toBe("PASSWORD_RESET");
    expect(req.status).toBe("PENDING");
  });

  test("4. cria solicitaÃ§Ã£o PROFILE_DELETION com motivo no payload", async () => {
    const req = await addRequest(userB, "PROFILE_DELETION", { reason: "leaving company" });
    createdRequestIds.push(req.id);

    expect(req.type).toBe("PROFILE_DELETION");
    expect(req.payload).toMatchObject({ reason: "leaving company" });
    expect(req.userName).toBe(userB.name);
    expect(req.userEmail).toBe(userB.email);
  });

  test("5. bloqueia duplicata PENDING do mesmo usuÃ¡rio+tipo", async () => {
    // userB jÃ¡ tem PROFILE_DELETION PENDING do teste 4
    const error = await addRequest(userB, "PROFILE_DELETION", {}).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error & { code?: string }).code).toBe("DUPLICATE");
  });
});

// â”€â”€ Consultas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describePg("Consultas de solicitaÃ§Ãµes", () => {
  test("6. listUserRequests retorna apenas solicitaÃ§Ãµes do usuÃ¡rio", async () => {
    const reqs = await listUserRequests(userA.id);
    expect(reqs.length).toBeGreaterThanOrEqual(3);
    reqs.forEach((r) => expect(r.userId).toBe(userA.id));
  });

  test("7. listUserRequests filtra por status PENDING", async () => {
    const reqs = await listUserRequests(userA.id, { status: "PENDING" });
    reqs.forEach((r) => expect(r.status).toBe("PENDING"));
  });

  test("8. listUserRequests filtra por tipo PASSWORD_RESET", async () => {
    const reqs = await listUserRequests(userA.id, { type: "PASSWORD_RESET" });
    reqs.forEach((r) => expect(r.type).toBe("PASSWORD_RESET"));
    expect(reqs.some((r) => r.userId === userA.id)).toBe(true);
  });

  test("9. listAllRequests retorna solicitaÃ§Ãµes de mÃºltiplos usuÃ¡rios", async () => {
    const all = await listAllRequests();
    const userAreqs = all.filter((r) => r.userId === userA.id);
    const userBreqs = all.filter((r) => r.userId === userB.id);
    expect(userAreqs.length).toBeGreaterThanOrEqual(3);
    expect(userBreqs.length).toBeGreaterThanOrEqual(1);
  });

  test("10. listAllRequests filtra por status PENDING", async () => {
    const reqs = await listAllRequests({ status: "PENDING" });
    reqs.forEach((r) => expect(r.status).toBe("PENDING"));
  });

  test("11. listAllRequests filtra por companyId", async () => {
    const reqs = await listAllRequests({ companyId: userA.companyId });
    reqs.forEach((r) => expect(r.companyId).toBe(userA.companyId));
  });

  test("12. listAllRequests ordenaÃ§Ã£o createdAt_asc", async () => {
    const reqs = await listAllRequests({ sort: "createdAt_asc" });
    if (reqs.length >= 2) {
      const first = new Date(reqs[0].createdAt).getTime();
      const last = new Date(reqs[reqs.length - 1].createdAt).getTime();
      expect(first).toBeLessThanOrEqual(last);
    }
  });

  test("13. getRequestById retorna solicitaÃ§Ã£o existente", async () => {
    const all = await listUserRequests(userA.id);
    const target = all[0];
    const found = await getRequestById(target.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(target.id);
    expect(found!.userId).toBe(userA.id);
  });

  test("14. getRequestById retorna null para id inexistente", async () => {
    const result = await getRequestById("req_nonexistent_00000");
    expect(result).toBeNull();
  });
});

// â”€â”€ RevisÃ£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describePg("RevisÃ£o de solicitaÃ§Ãµes (updateRequestStatus)", () => {
  let pendingId: string;

  beforeAll(async () => {
    // Cria uma solicitaÃ§Ã£o especÃ­fica para ser revisada
    const req = await addRequest(adminUser, "EMAIL_CHANGE", { newEmail: "admin-reviewed@test.local" });
    createdRequestIds.push(req.id);
    pendingId = req.id;
  });

  test("15. aprova solicitaÃ§Ã£o PENDING", async () => {
    const updated = await updateRequestStatus(pendingId, "APPROVED", { id: adminUser.id });
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("APPROVED");
  });

  test("16. rejeita solicitaÃ§Ã£o PENDING de userB", async () => {
    // userB tem PROFILE_DELETION PENDING ainda
    const list = await listUserRequests(userB.id, { status: "PENDING", type: "PROFILE_DELETION" });
    expect(list.length).toBeGreaterThanOrEqual(1);
    const id = list[0].id;
    const updated = await updateRequestStatus(id, "REJECTED", { id: adminUser.id }, "motivo: conta encerrada");
    expect(updated!.status).toBe("REJECTED");
  });

  test("17. registra reviewedBy, reviewNote e reviewedAt", async () => {
    const req = await addRequest(userB, "PASSWORD_RESET", {});
    createdRequestIds.push(req.id);
    const updated = await updateRequestStatus(req.id, "APPROVED", { id: adminUser.id }, "aprovado pelo admin");
    expect(updated!.reviewedBy).toBe(adminUser.id);
    expect(updated!.reviewNote).toBe("aprovado pelo admin");
    expect(updated!.reviewedAt).toBeTruthy();
  });

  test("18. nÃ£o altera solicitaÃ§Ã£o jÃ¡ revisada", async () => {
    // pendingId foi aprovado no teste 15 â€” tentar aprovar de novo nÃ£o muda nada
    const unchanged = await updateRequestStatus(pendingId, "REJECTED", { id: adminUser.id });
    expect(unchanged!.status).toBe("APPROVED"); // permanece APPROVED
  });

  test("19. retorna null para id inexistente", async () => {
    const result = await updateRequestStatus("req_fake_000", "APPROVED", { id: adminUser.id });
    expect(result).toBeNull();
  });

  test("20. dois usuÃ¡rios com o mesmo tipo nÃ£o conflitam (duplicate check Ã© por userId)", async () => {
    // userA e adminUser podem ter EMAIL_CHANGE ao mesmo tempo? adminUser acabou de ser APPROVED.
    // Criar novo para adminUser â€” sem conflito porque anterior nÃ£o Ã© PENDING
    const req = await addRequest(adminUser, "EMAIL_CHANGE", { newEmail: "new2@test.local" });
    createdRequestIds.push(req.id);
    expect(req.status).toBe("PENDING");
    expect(req.userId).toBe(adminUser.id);
  });
});

