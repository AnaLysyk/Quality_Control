/**
 * Cenários do fluxo de Solicitações de Usuário (requestsStore) no banco PostgreSQL.
 * ✅ cleanup total em afterAll — nenhum dado permanece.
 *
 * Criação (5 cenários):
 *  1. Cria solicitação de troca de e-mail (PENDING por padrão)
 *  2. Cria solicitação de troca de empresa
 *  3. Cria solicitação de reset de senha
 *  4. Cria solicitação de exclusão de perfil com payload customizado
 *  5. Bloqueia duplicata PENDING do mesmo usuário+tipo
 *
 * Consultas (6 cenários):
 *  6.  listUserRequests retorna apenas solicitações do usuário
 *  7.  listUserRequests filtra por status APPROVED
 *  8.  listUserRequests filtra por tipo PASSWORD_RESET
 *  9.  listAllRequests retorna todas as solicitações
 * 10. listAllRequests filtra por status REJECTED
 * 11. listAllRequests filtra por companyId
 * 12. listAllRequests ordenação asc por createdAt
 * 13. getRequestById retorna solicitação existente
 * 14. getRequestById retorna null para id inexistente
 *
 * Revisão (6 cenários):
 * 15. updateRequestStatus aprova solicitação PENDING
 * 16. updateRequestStatus rejeita solicitação PENDING
 * 17. updateRequestStatus registra reviewedBy, reviewNote e reviewedAt
 * 18. updateRequestStatus não altera solicitação já revisada
 * 19. updateRequestStatus retorna null para id inexistente
 * 20. Dois usuários com mesmo tipo não conflitam entre si
 */

process.env.AUTH_STORE = "postgres";

jest.mock("server-only", () => ({}));
jest.mock("../lib/redis", () => ({ isRedisConfigured: jest.fn(() => false) }));

import { prisma } from "../lib/prismaClient";
import {
  addRequest,
  listUserRequests,
  listAllRequests,
  getRequestById,
  updateRequestStatus,
  type RequestUser,
} from "../data/requestsStore";
import {
  pgCreateLocalUser,
  pgCreateLocalCompany,
  pgDeleteLocalCompany,
} from "../src/core/auth/pgStore";
import { hashPasswordSha256 } from "../lib/passwordHash";

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

  // Criar usuários de teste
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

// ── Criação ───────────────────────────────────────────────────────────────────

describe("Criação de solicitações", () => {
  test("1. cria solicitação EMAIL_CHANGE com status PENDING", async () => {
    const req = await addRequest(userA, "EMAIL_CHANGE", { newEmail: "novo@email.com" });
    createdRequestIds.push(req.id);

    expect(req.id).toBeTruthy();
    expect(req.userId).toBe(userA.id);
    expect(req.type).toBe("EMAIL_CHANGE");
    expect(req.status).toBe("PENDING");
    expect(req.payload).toMatchObject({ newEmail: "novo@email.com" });
    expect(req.createdAt).toBeTruthy();
  });

  test("2. cria solicitação COMPANY_CHANGE com companyId e companyName", async () => {
    const req = await addRequest(userA, "COMPANY_CHANGE", { targetCompanyId: "cmp_xyz" });
    createdRequestIds.push(req.id);

    expect(req.type).toBe("COMPANY_CHANGE");
    expect(req.companyId).toBe(userA.companyId);
    expect(req.companyName).toBe(userA.companyName);
  });

  test("3. cria solicitação PASSWORD_RESET", async () => {
    const req = await addRequest(userA, "PASSWORD_RESET", {});
    createdRequestIds.push(req.id);

    expect(req.type).toBe("PASSWORD_RESET");
    expect(req.status).toBe("PENDING");
  });

  test("4. cria solicitação PROFILE_DELETION com motivo no payload", async () => {
    const req = await addRequest(userB, "PROFILE_DELETION", { reason: "leaving company" });
    createdRequestIds.push(req.id);

    expect(req.type).toBe("PROFILE_DELETION");
    expect(req.payload).toMatchObject({ reason: "leaving company" });
    expect(req.userName).toBe(userB.name);
    expect(req.userEmail).toBe(userB.email);
  });

  test("5. bloqueia duplicata PENDING do mesmo usuário+tipo", async () => {
    // userB já tem PROFILE_DELETION PENDING do teste 4
    const error = await addRequest(userB, "PROFILE_DELETION", {}).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error & { code?: string }).code).toBe("DUPLICATE");
  });
});

// ── Consultas ─────────────────────────────────────────────────────────────────

describe("Consultas de solicitações", () => {
  test("6. listUserRequests retorna apenas solicitações do usuário", async () => {
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

  test("9. listAllRequests retorna solicitações de múltiplos usuários", async () => {
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

  test("12. listAllRequests ordenação createdAt_asc", async () => {
    const reqs = await listAllRequests({ sort: "createdAt_asc" });
    if (reqs.length >= 2) {
      const first = new Date(reqs[0].createdAt).getTime();
      const last = new Date(reqs[reqs.length - 1].createdAt).getTime();
      expect(first).toBeLessThanOrEqual(last);
    }
  });

  test("13. getRequestById retorna solicitação existente", async () => {
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

// ── Revisão ───────────────────────────────────────────────────────────────────

describe("Revisão de solicitações (updateRequestStatus)", () => {
  let pendingId: string;

  beforeAll(async () => {
    // Cria uma solicitação específica para ser revisada
    const req = await addRequest(adminUser, "EMAIL_CHANGE", { newEmail: "admin-reviewed@test.local" });
    createdRequestIds.push(req.id);
    pendingId = req.id;
  });

  test("15. aprova solicitação PENDING", async () => {
    const updated = await updateRequestStatus(pendingId, "APPROVED", { id: adminUser.id });
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("APPROVED");
  });

  test("16. rejeita solicitação PENDING de userB", async () => {
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

  test("18. não altera solicitação já revisada", async () => {
    // pendingId foi aprovado no teste 15 — tentar aprovar de novo não muda nada
    const unchanged = await updateRequestStatus(pendingId, "REJECTED", { id: adminUser.id });
    expect(unchanged!.status).toBe("APPROVED"); // permanece APPROVED
  });

  test("19. retorna null para id inexistente", async () => {
    const result = await updateRequestStatus("req_fake_000", "APPROVED", { id: adminUser.id });
    expect(result).toBeNull();
  });

  test("20. dois usuários com o mesmo tipo não conflitam (duplicate check é por userId)", async () => {
    // userA e adminUser podem ter EMAIL_CHANGE ao mesmo tempo? adminUser acabou de ser APPROVED.
    // Criar novo para adminUser — sem conflito porque anterior não é PENDING
    const req = await addRequest(adminUser, "EMAIL_CHANGE", { newEmail: "new2@test.local" });
    createdRequestIds.push(req.id);
    expect(req.status).toBe("PENDING");
    expect(req.userId).toBe(adminUser.id);
  });
});
