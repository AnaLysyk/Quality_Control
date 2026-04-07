/**
 * Cenários do fluxo de Solicitações de Acesso (accessRequestsStore) no banco PostgreSQL.
 * ✅ cleanup total em afterAll — nenhum dado permanece.
 *
 * Criação (4 cenários):
 *  1. Cria solicitação de acesso com status padrão "open"
 *  2. Cria solicitação com status explícito "in_progress"
 *  3. Cria solicitação com ip_address, user_agent e user_id
 *  4. Cria múltiplas solicitações para o mesmo e-mail (sem unicidade)
 *
 * Consultas (5 cenários):
 *  5. listAccessRequests retorna todas as solicitações
 *  6. listAccessRequests ordena por createdAt desc (mais recente primeiro)
 *  7. getAccessRequestById retorna registro existente
 *  8. getAccessRequestById retorna null para id inexistente
 *  9. Campos opcionais (ip_address, user_agent) são preservados
 *
 * Atualização (6 cenários):
 * 10. updateAccessRequest altera status para in_progress
 * 11. updateAccessRequest fecha a solicitação (closed)
 * 12. updateAccessRequest rejeita a solicitação
 * 13. updateAccessRequest atualiza o e-mail
 * 14. updateAccessRequest atualiza a mensagem
 * 15. updateAccessRequest vincula user_id
 */

process.env.AUTH_STORE = "postgres";

jest.mock("server-only", () => ({}));
jest.mock("../lib/redis", () => ({ isRedisConfigured: jest.fn(() => false) }));

import { prisma } from "../lib/prismaClient";
import {
  createAccessRequest,
  listAccessRequests,
  getAccessRequestById,
  updateAccessRequest,
} from "../data/accessRequestsStore";
import {
  pgCreateLocalUser,
} from "../lib/core/auth/pgStore";
import { hashPasswordSha256 } from "../lib/passwordHash";

jest.setTimeout(30000);

const PASSWORD = hashPasswordSha256("TC@Teste2026");
const UID = Math.random().toString(36).slice(2, 10);
const testEmail = (tag: string) => `acesso-${tag}-${UID}@access-test.local`;

const createdIds: string[] = [];
const createdUserIds: string[] = [];

afterAll(async () => {
  if (createdIds.length > 0) {
    await prisma.accessRequest.deleteMany({ where: { id: { in: createdIds } } }).catch(() => null);
  }
  if (createdUserIds.length > 0) {
    await prisma.membership.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => null);
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => null);
  }
  await prisma.$disconnect();
});

// ── Criação ───────────────────────────────────────────────────────────────────

describe("Criação de solicitações de acesso", () => {
  test("1. cria solicitação com status padrão open", async () => {
    const req = await createAccessRequest({
      email: testEmail("solicit1"),
      message: "Preciso de acesso ao painel de QA",
    });
    createdIds.push(req.id);

    expect(req.id).toBeTruthy();
    expect(req.email).toBe(testEmail("solicit1"));
    expect(req.message).toBe("Preciso de acesso ao painel de QA");
    expect(req.status).toBe("open");
    expect(req.created_at).toBeTruthy();
  });

  test("2. cria solicitação com status explícito in_progress", async () => {
    const req = await createAccessRequest({
      email: testEmail("solicit2"),
      message: "Em processamento",
      status: "in_progress",
    });
    createdIds.push(req.id);

    expect(req.status).toBe("in_progress");
  });

  test("3. cria solicitação com ip_address, user_agent e user_id", async () => {
    const user = await pgCreateLocalUser({
      email: testEmail("linked-user"),
      name: "User Vinculado",
      password_hash: PASSWORD,
      role: "user",
    });
    createdUserIds.push(user.id);

    const req = await createAccessRequest({
      email: testEmail("solicit3"),
      message: "Acesso via portal",
      user_id: user.id,
      ip_address: "192.168.1.100",
      user_agent: "Mozilla/5.0 (TestAgent)",
    });
    createdIds.push(req.id);

    expect(req.user_id).toBe(user.id);
    expect(req.ip_address).toBe("192.168.1.100");
    expect(req.user_agent).toBe("Mozilla/5.0 (TestAgent)");
  });

  test("4. permite múltiplas solicitações para o mesmo e-mail", async () => {
    const email = testEmail("multi");
    const req1 = await createAccessRequest({ email, message: "Primeira" });
    const req2 = await createAccessRequest({ email, message: "Segunda" });
    createdIds.push(req1.id, req2.id);

    expect(req1.id).not.toBe(req2.id);
    expect(req1.email).toBe(email);
    expect(req2.email).toBe(email);
  });
});

// ── Consultas ─────────────────────────────────────────────────────────────────

describe("Consultas de solicitações de acesso", () => {
  test("5. listAccessRequests retorna as solicitações criadas", async () => {
    const all = await listAccessRequests();
    const mine = all.filter((r) => r.id && createdIds.includes(r.id));
    expect(mine.length).toBeGreaterThanOrEqual(4);
  });

  test("6. listAccessRequests retorna ordenado por createdAt desc", async () => {
    const all = await listAccessRequests();
    if (all.length >= 2) {
      const first = new Date(all[0].created_at).getTime();
      const second = new Date(all[1].created_at).getTime();
      expect(first).toBeGreaterThanOrEqual(second);
    }
  });

  test("7. getAccessRequestById retorna registro existente", async () => {
    const id = createdIds[0];
    const found = await getAccessRequestById(id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(id);
  });

  test("8. getAccessRequestById retorna null para id inexistente", async () => {
    const result = await getAccessRequestById("acc_nonexistent_00000");
    expect(result).toBeNull();
  });

  test("9. campos opcionais são preservados após criação", async () => {
    const id = createdIds[2]; // solicitação com ip_address e user_agent (teste 3)
    const found = await getAccessRequestById(id);
    expect(found!.ip_address).toBe("192.168.1.100");
    expect(found!.user_agent).toBe("Mozilla/5.0 (TestAgent)");
  });
});

// ── Atualização ───────────────────────────────────────────────────────────────

describe("Atualização de solicitações de acesso", () => {
  let targetId: string;

  beforeAll(async () => {
    const req = await createAccessRequest({
      email: testEmail("update-target"),
      message: "Para ser atualizada",
    });
    createdIds.push(req.id);
    targetId = req.id;
  });

  test("10. altera status para in_progress", async () => {
    const updated = await updateAccessRequest(targetId, { status: "in_progress" });
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("in_progress");
  });

  test("11. fecha a solicitação (closed)", async () => {
    const updated = await updateAccessRequest(targetId, { status: "closed" });
    expect(updated!.status).toBe("closed");
  });

  test("12. rejeita solicitação", async () => {
    const req = await createAccessRequest({
      email: testEmail("rejected"),
      message: "Para ser rejeitada",
    });
    createdIds.push(req.id);
    const updated = await updateAccessRequest(req.id, { status: "rejected" });
    expect(updated!.status).toBe("rejected");
  });

  test("13. atualiza o e-mail da solicitação", async () => {
    const req = await createAccessRequest({
      email: testEmail("old-email"),
      message: "Atualização de e-mail",
    });
    createdIds.push(req.id);
    const newEmail = testEmail("new-email");
    const updated = await updateAccessRequest(req.id, { email: newEmail });
    expect(updated!.email).toBe(newEmail);
  });

  test("14. atualiza a mensagem da solicitação", async () => {
    const req = await createAccessRequest({
      email: testEmail("msg-upd"),
      message: "Mensagem original",
    });
    createdIds.push(req.id);
    const updated = await updateAccessRequest(req.id, { message: "Mensagem atualizada pelo admin" });
    expect(updated!.message).toBe("Mensagem atualizada pelo admin");
  });

  test("15. vincula user_id a uma solicitação existente", async () => {
    const req = await createAccessRequest({
      email: testEmail("link-user"),
      message: "Vincular usuário",
    });
    createdIds.push(req.id);

    const userId = createdUserIds[0];
    const updated = await updateAccessRequest(req.id, { user_id: userId });
    expect(updated!.user_id).toBe(userId);
  });
});
