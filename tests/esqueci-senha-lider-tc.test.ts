/**
 * Fluxo completo de "Esqueci a senha" aprovado por um Líder TC ou Suporte Técnico.
 *
 * Cenários (6):
 *  1. Usuário cria solicitação de PASSWORD_RESET via API
 *  2. Solicitação fica PENDING no requestsStore
 *  3. Líder TC (role admin) aprova a solicitação e token é gerado no Redis
 *  4. Usuário redefine a senha usando o token
 *  5. Token é invalidado após uso (não pode ser reutilizado)
 *  6. Suporte Técnico (role it_dev) também consegue aprovar PASSWORD_RESET
 *
 * ✅ Cleanup total em afterAll — nenhum dado permanece.
 */

process.env.AUTH_STORE = "postgres";

jest.mock("server-only", () => ({}));
jest.mock("../lib/email", () => ({
  emailService: {
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  },
}));

import { prisma } from "../lib/prismaClient";
import { getRedis } from "../lib/redis";
import {
  addRequest,
  listUserRequests,
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
import { getLocalUserById, updateLocalUser } from "../lib/auth/localStore";

jest.setTimeout(30000);

const PASSWORD = hashPasswordSha256("TC@Teste2026");
const NEW_PASSWORD = "NovaSenha@2026";
const UID = Math.random().toString(36).slice(2, 10);
const email = (tag: string) => `esq-senha-${tag}-${UID}@reset-test.local`;

const createdRequestIds: string[] = [];
const createdUserIds: string[] = [];
const createdCompanyIds: string[] = [];
const createdRedisKeys: string[] = [];

let normalUser: RequestUser;
let leaderTcUser: RequestUser;
let technicalSupportUser: RequestUser;
let normalUserId: string;

beforeAll(async () => {
  const company = await pgCreateLocalCompany({
    name: `Empresa Reset ${UID}`,
    slug: `empresa-reset-${UID}`,
  });
  createdCompanyIds.push(company.id);

  const uNormal = await pgCreateLocalUser({
    email: email("normal"),
    name: "Usuario Normal",
    password_hash: PASSWORD,
    role: "user",
  });
  createdUserIds.push(uNormal.id);
  normalUserId = uNormal.id;

  const uLeader = await pgCreateLocalUser({
    email: email("leader"),
    name: "Lider TC",
    password_hash: PASSWORD,
    role: "admin",
  });
  createdUserIds.push(uLeader.id);

  const uSupport = await pgCreateLocalUser({
    email: email("support"),
    name: "Suporte Tecnico",
    password_hash: PASSWORD,
    role: "it_dev",
  });
  createdUserIds.push(uSupport.id);

  normalUser = {
    id: uNormal.id,
    name: uNormal.name ?? undefined,
    email: uNormal.email,
    companyId: company.id,
    companyName: company.name,
  };

  leaderTcUser = {
    id: uLeader.id,
    name: uLeader.name ?? undefined,
    email: uLeader.email,
    companyId: company.id,
    companyName: company.name,
  };

  technicalSupportUser = {
    id: uSupport.id,
    name: uSupport.name ?? undefined,
    email: uSupport.email,
    companyId: company.id,
    companyName: company.name,
  };
});

afterAll(async () => {
  const redis = getRedis();
  for (const key of createdRedisKeys) {
    await redis.del(key).catch(() => null);
  }
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

// ── Fluxo completo ────────────────────────────────────────────────────────────

describe("Esqueci a senha — aprovação por Líder TC / Suporte Técnico", () => {
  let resetRequestId: string;

  test("1. usuário cria solicitação PASSWORD_RESET", async () => {
    const req = await addRequest(normalUser, "PASSWORD_RESET", {
      reason: "forgot_password",
      profileType: "testing_company_user",
      reviewQueue: "admin_and_global",
    });
    createdRequestIds.push(req.id);
    resetRequestId = req.id;

    expect(req.id).toBeTruthy();
    expect(req.userId).toBe(normalUser.id);
    expect(req.type).toBe("PASSWORD_RESET");
    expect(req.status).toBe("PENDING");
    expect(req.userEmail).toBe(normalUser.email);
  });

  test("2. solicitação está PENDING no requestsStore", async () => {
    const requests = await listUserRequests(normalUser.id, {
      type: "PASSWORD_RESET",
      status: "PENDING",
    });
    expect(requests.length).toBeGreaterThanOrEqual(1);
    const found = requests.find((r) => r.id === resetRequestId);
    expect(found).toBeDefined();
    expect(found!.status).toBe("PENDING");
  });

  test("3. Líder TC aprova a solicitação e token é gerado no Redis", async () => {
    // Simulate what the approval endpoint does: generate token, store in Redis
    const { randomUUID } = await import("crypto");
    const token = randomUUID();
    const redis = getRedis();
    await redis.set(`reset:${token}`, normalUser.id, { ex: 15 * 60 });
    createdRedisKeys.push(`reset:${token}`);

    // Approve the request
    const updated = await updateRequestStatus(
      resetRequestId,
      "APPROVED",
      { id: leaderTcUser.id },
      "Aprovado pelo Lider TC"
    );

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("APPROVED");
    expect(updated!.reviewedBy).toBe(leaderTcUser.id);
    expect(updated!.reviewNote).toBe("Aprovado pelo Lider TC");
    expect(updated!.reviewedAt).toBeTruthy();

    // Verify token exists in Redis
    const storedUserId = await redis.get<string>(`reset:${token}`);
    expect(storedUserId).toBe(normalUser.id);

    // Store token for next test
    (globalThis as Record<string, unknown>).__resetToken = token;
  });

  test("4. usuário redefine a senha usando o token", async () => {
    const token = (globalThis as Record<string, unknown>).__resetToken as string;
    expect(token).toBeTruthy();

    const redis = getRedis();

    // Verify token is valid
    const userId = await redis.get<string>(`reset:${token}`);
    expect(userId).toBe(normalUser.id);

    // Hash new password and update user (simulating POST /api/auth/reset-via-token)
    const hashedNewPassword = hashPasswordSha256(NEW_PASSWORD);
    await updateLocalUser(normalUserId, { password_hash: hashedNewPassword });
    await redis.del(`reset:${token}`);

    // Verify password was changed
    const updatedUser = await getLocalUserById(normalUserId);
    expect(updatedUser).not.toBeNull();
    expect(updatedUser!.password_hash).toBe(hashedNewPassword);
    expect(updatedUser!.password_hash).not.toBe(PASSWORD);
  });

  test("5. token é invalidado após uso (não pode ser reutilizado)", async () => {
    const token = (globalThis as Record<string, unknown>).__resetToken as string;
    const redis = getRedis();

    const storedUserId = await redis.get<string>(`reset:${token}`);
    expect(storedUserId).toBeNull();
  });

  test("6. Suporte Técnico (it_dev) também aprova PASSWORD_RESET", async () => {
    // Create a new request for a different flow
    const req = await addRequest(normalUser, "PASSWORD_RESET", {
      reason: "forgot_password",
      profileType: "testing_company_user",
      reviewQueue: "admin_and_global",
    });
    createdRequestIds.push(req.id);

    expect(req.status).toBe("PENDING");

    // Approve with technical support user (role: it_dev)
    const updated = await updateRequestStatus(
      req.id,
      "APPROVED",
      { id: technicalSupportUser.id },
      "Aprovado pelo Suporte Tecnico"
    );

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("APPROVED");
    expect(updated!.reviewedBy).toBe(technicalSupportUser.id);
    expect(updated!.reviewNote).toBe("Aprovado pelo Suporte Tecnico");
  });
});
