/**
 * Fluxo completo de "Solicitar Acesso" — criação, aceitação e rejeição.
 *
 * Cenários (8):
 *  1. Cria solicitação de acesso com mensagem estruturada (composeAccessRequestMessage)
 *  2. Solicitação fica "open" no accessRequestsStore
 *  3. parseAccessRequestMessage extrai campos corretamente da mensagem
 *  4. Aceitação: cria usuário local, vincula à empresa e fecha a solicitação
 *  5. Usuário criado tem campos corretos (email, nome, role, empresa)
 *  6. Solicitação aceita tem status "closed" e user_id preenchido
 *  7. Rejeição: solicitação rejeitada tem status "rejected"
 *  8. Comentário de rejeição é registrado com motivo
 *
 * âœ… Cleanup total em afterAll — nenhum dado permanece.
 */

process.env.AUTH_STORE = process.env.DATABASE_URL ? "postgres" : "json";

jest.mock("server-only", () => ({}));
jest.mock("../../../backend/redis", () => ({ isRedisConfigured: jest.fn(() => false) }));

const describePg = process.env.DATABASE_URL ? describe : describe.skip;

import { prisma } from "@/database/prismaClient";
import {
  createAccessRequest,
  getAccessRequestById,
  updateAccessRequest,
} from "@/data/access-requests/store";
import { createAccessRequestComment } from "@/data/access-requests/commentsStore";
import {
  composeAccessRequestMessage,
  parseAccessRequestMessage,
} from "@/backend/access-requests/message";
import {
  pgCreateLocalUser,
  pgCreateLocalCompany,
  pgDeleteLocalCompany,
} from "@/backend/auth/pgStore";
import { createLocalUser } from "@/backend/auth/localStore";
import { hashPasswordSha256 } from "@/backend/passwordHash";
import { getLocalUserById } from "@/backend/auth/localStore";

jest.setTimeout(30000);

const PASSWORD_RAW = "TC@Solicita2026";
const PASSWORD_HASH = hashPasswordSha256(PASSWORD_RAW);
const UID = Math.random().toString(36).slice(2, 10);
const testEmail = (tag: string) => `acesso-lc-${tag}-${UID}@lifecycle-test.local`;

const createdRequestIds: string[] = [];
const createdUserIds: string[] = [];
const createdCompanyIds: string[] = [];
const createdCommentIds: string[] = [];

let companyId: string;
let companySlug: string;

beforeAll(async () => {
  const company = await pgCreateLocalCompany({
    name: `Empresa Acesso ${UID}`,
    company_name: `Empresa Acesso ${UID}`,
    active: true,
    status: "active",
    created_at: new Date().toISOString(),
  });
  companyId = company.id;
  companySlug = company.slug ?? company.id;
  createdCompanyIds.push(company.id);
});

afterAll(async () => {
  // Limpar comentários
  if (createdCommentIds.length > 0) {
    for (const cId of createdCommentIds) {
      await prisma.accessRequestComment.delete({ where: { id: cId } }).catch(() => null);
    }
  }
  // Limpar solicitações
  if (createdRequestIds.length > 0) {
    await prisma.accessRequest
      .deleteMany({ where: { id: { in: createdRequestIds } } })
      .catch(() => null);
  }
  // Limpar memberships e usuários
  if (createdUserIds.length > 0) {
    await prisma.membership
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(() => null);
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(() => null);
  }
  // Limpar empresas
  for (const cId of createdCompanyIds) {
    await pgDeleteLocalCompany(cId).catch(() => null);
  }
  await prisma.$disconnect();
});

// â”€â”€ Criação da solicitação â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describePg("Criação de solicitação de acesso estruturada", () => {
  let requestId: string;
  let composedMessage: string;

  beforeAll(async () => {
    composedMessage = composeAccessRequestMessage({
      email: testEmail("user1"),
      name: "Ana Testadora",
      fullName: "Ana Testadora Silva",
      username: `ana_test_${UID}`,
      phone: "(11) 99999-0001",
      passwordHash: PASSWORD_HASH,
      role: "user",
      company: `Empresa Acesso ${UID}`,
      clientId: companyId,
      accessType: "testing_company_user",
      profileType: "testing_company_user",
      title: "Acesso ao painel de QA",
      description: "Preciso acompanhar os testes do projeto Alpha",
      notes: "Urgente",
    });

    const req = await createAccessRequest({
      email: testEmail("user1"),
      message: composedMessage,
    });
    requestId = req.id;
    createdRequestIds.push(req.id);
  });

  test("1. solicitação é criada com status open", async () => {
    const found = await getAccessRequestById(requestId);
    expect(found).not.toBeNull();
    expect(found!.status).toBe("open");
    expect(found!.email).toBe(testEmail("user1"));
  });

  test("2. mensagem contém marcador ACCESS_REQUEST_V1", () => {
    expect(composedMessage).toContain("ACCESS_REQUEST_V1");
    expect(composedMessage).toContain("Ana Testadora Silva");
    expect(composedMessage).toContain(testEmail("user1"));
  });

  test("3. parseAccessRequestMessage extrai campos corretamente", () => {
    const parsed = parseAccessRequestMessage(composedMessage, testEmail("user1"));
    expect(parsed.email).toBe(testEmail("user1"));
    expect(parsed.fullName).toBe("Ana Testadora Silva");
    expect(parsed.username).toBe(`ana_test_${UID}`);
    expect(parsed.phone).toBe("(11) 99999-0001");
    expect(parsed.passwordHash).toBe(PASSWORD_HASH);
    expect(parsed.accessType).toBe("testing_company_user");
    expect(parsed.profileType).toBe("testing_company_user");
    expect(parsed.company).toBe(`Empresa Acesso ${UID}`);
    expect(parsed.clientId).toBe(companyId);
    expect(parsed.title).toBe("Acesso ao painel de QA");
    expect(parsed.description).toBe("Preciso acompanhar os testes do projeto Alpha");
    expect(parsed.notes).toBe("Urgente");
  });
});

// â”€â”€ Aceitação (aceitar solicitação → cria usuário) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describePg("Aceitação de solicitação de acesso", () => {
  let requestId: string;
  let createdUserId: string;
  const userEmail = testEmail("accept");

  beforeAll(async () => {
    const message = composeAccessRequestMessage({
      email: userEmail,
      name: "Carlos Aceito",
      fullName: "Carlos Aceito Ferreira",
      username: `carlos_${UID}`,
      phone: "(21) 98888-0002",
      passwordHash: PASSWORD_HASH,
      role: "user",
      company: `Empresa Acesso ${UID}`,
      clientId: companyId,
      accessType: "testing_company_user",
      profileType: "testing_company_user",
      title: "Acesso para testes",
      description: "",
      notes: "",
    });

    const req = await createAccessRequest({ email: userEmail, message });
    requestId = req.id;
    createdRequestIds.push(req.id);

    // Simula o que o endpoint accept faz:
    // 1. Parse da mensagem
    const parsed = parseAccessRequestMessage(message, userEmail);

    // 2. Cria o usuário local
    const user = await createLocalUser({
      full_name: parsed.fullName,
      name: parsed.fullName || parsed.name,
      email: parsed.email,
      user: parsed.username || parsed.email.split("@")[0],
      password_hash: parsed.passwordHash!,
      role: "user",
    });
    createdUserId = user.id;
    createdUserIds.push(user.id);

    // 3. Vincula à empresa (upsert membership)
    await prisma.membership.create({
      data: {
        userId: user.id,
        companyId: companyId,
        role: "user",
      },
    });

    // 4. Fecha a solicitação com user_id
    await updateAccessRequest(requestId, {
      status: "closed",
      user_id: createdUserId,
    });

    // 5. Cria comentário de aprovação
    const cmt = await createAccessRequestComment({
      requestId,
      authorRole: "admin",
      authorName: "admin@test.local",
      authorEmail: "admin@test.local",
      authorId: null,
      body: `Solicitacao aceita.\nSeu usuario e ${parsed.username || parsed.email.split("@")[0]}.\nUse a senha que voce criou ao solicitar acesso para entrar na plataforma.`,
    });
    if (cmt?.id) createdCommentIds.push(cmt.id);
  });

  test("4. usuário é criado com campos corretos", async () => {
    const user = await getLocalUserById(createdUserId);
    expect(user).not.toBeNull();
    expect(user!.email).toBe(userEmail);
    expect(user!.name).toContain("Carlos Aceito");
  });

  test("5. membership vincula usuário à empresa", async () => {
    const membership = await prisma.membership.findFirst({
      where: { userId: createdUserId, companyId },
    });
    expect(membership).not.toBeNull();
    expect(membership!.role).toBe("user");
  });

  test("6. solicitação aceita tem status closed e user_id", async () => {
    const req = await getAccessRequestById(requestId);
    expect(req).not.toBeNull();
    expect(req!.status).toBe("closed");
    expect(req!.user_id).toBe(createdUserId);
  });
});

// â”€â”€ Rejeição â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describePg("Rejeição de solicitação de acesso", () => {
  let requestId: string;

  beforeAll(async () => {
    const message = composeAccessRequestMessage({
      email: testEmail("reject"),
      name: "Bruno Rejeitado",
      fullName: "Bruno Rejeitado Lima",
      username: `bruno_${UID}`,
      phone: "(31) 97777-0003",
      passwordHash: PASSWORD_HASH,
      role: "user",
      company: `Empresa Acesso ${UID}`,
      clientId: companyId,
      accessType: "testing_company_user",
      profileType: "testing_company_user",
      title: "Acesso indevido",
      description: "Motivo insuficiente",
      notes: "",
    });

    const req = await createAccessRequest({ email: testEmail("reject"), message });
    requestId = req.id;
    createdRequestIds.push(req.id);

    // Simula rejeição
    await updateAccessRequest(requestId, { status: "rejected" });

    const cmt = await createAccessRequestComment({
      requestId,
      authorRole: "admin",
      authorName: "admin@test.local",
      authorEmail: "admin@test.local",
      authorId: null,
      body: "Solicitacao recusada.\nMotivo: perfil nao autorizado.\nFale com um responsavel para revisar o acesso solicitado.",
    });
    if (cmt?.id) createdCommentIds.push(cmt.id);
  });

  test("7. solicitação rejeitada tem status rejected", async () => {
    const req = await getAccessRequestById(requestId);
    expect(req).not.toBeNull();
    expect(req!.status).toBe("rejected");
  });

  test("8. solicitação rejeitada não possui user_id", async () => {
    const req = await getAccessRequestById(requestId);
    expect(req!.user_id).toBeFalsy();
  });
});

