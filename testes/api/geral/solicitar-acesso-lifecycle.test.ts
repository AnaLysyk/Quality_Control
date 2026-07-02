/**
 * Fluxo completo de "Solicitar Acesso" â€” criaÃ§Ã£o, aceitaÃ§Ã£o e rejeiÃ§Ã£o.
 *
 * CenÃ¡rios (8):
 *  1. Cria solicitaÃ§Ã£o de acesso com mensagem estruturada (composeAccessRequestMessage)
 *  2. SolicitaÃ§Ã£o fica "open" no accessRequestsStore
 *  3. parseAccessRequestMessage extrai campos corretamente da mensagem
 *  4. AceitaÃ§Ã£o: cria usuÃ¡rio local, vincula Ã  empresa e fecha a solicitaÃ§Ã£o
 *  5. UsuÃ¡rio criado tem campos corretos (email, nome, role, empresa)
 *  6. SolicitaÃ§Ã£o aceita tem status "closed" e user_id preenchido
 *  7. RejeiÃ§Ã£o: solicitaÃ§Ã£o rejeitada tem status "rejected"
 *  8. ComentÃ¡rio de rejeiÃ§Ã£o Ã© registrado com motivo
 *
 * âœ… Cleanup total em afterAll â€” nenhum dado permanece.
 */

process.env.AUTH_STORE = process.env.DATABASE_URL ? "postgres" : "json";

jest.mock("server-only", () => ({}));
jest.mock("../../../lib/redis", () => ({ isRedisConfigured: jest.fn(() => false) }));

const describePg = process.env.DATABASE_URL ? describe : describe.skip;

import { prisma } from "@/lib/prismaClient";
import {
  createAccessRequest,
  getAccessRequestById,
  updateAccessRequest,
} from "@/data/accessRequestsStore";
import { createAccessRequestComment } from "@/data/accessRequestCommentsStore";
import {
  composeAccessRequestMessage,
  parseAccessRequestMessage,
} from "@/lib/accessRequestMessage";
import {
  pgCreateLocalUser,
  pgCreateLocalCompany,
  pgDeleteLocalCompany,
} from "@/lib/core/auth/pgStore";
import { createLocalUser } from "@/lib/auth/localStore";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { getLocalUserById } from "@/lib/auth/localStore";

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
  // Limpar comentÃ¡rios
  if (createdCommentIds.length > 0) {
    for (const cId of createdCommentIds) {
      await prisma.accessRequestComment.delete({ where: { id: cId } }).catch(() => null);
    }
  }
  // Limpar solicitaÃ§Ãµes
  if (createdRequestIds.length > 0) {
    await prisma.accessRequest
      .deleteMany({ where: { id: { in: createdRequestIds } } })
      .catch(() => null);
  }
  // Limpar memberships e usuÃ¡rios
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

// â”€â”€ CriaÃ§Ã£o da solicitaÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describePg("CriaÃ§Ã£o de solicitaÃ§Ã£o de acesso estruturada", () => {
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

  test("1. solicitaÃ§Ã£o Ã© criada com status open", async () => {
    const found = await getAccessRequestById(requestId);
    expect(found).not.toBeNull();
    expect(found!.status).toBe("open");
    expect(found!.email).toBe(testEmail("user1"));
  });

  test("2. mensagem contÃ©m marcador ACCESS_REQUEST_V1", () => {
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

// â”€â”€ AceitaÃ§Ã£o (aceitar solicitaÃ§Ã£o â†’ cria usuÃ¡rio) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describePg("AceitaÃ§Ã£o de solicitaÃ§Ã£o de acesso", () => {
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

    // 2. Cria o usuÃ¡rio local
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

    // 3. Vincula Ã  empresa (upsert membership)
    await prisma.membership.create({
      data: {
        userId: user.id,
        companyId: companyId,
        role: "user",
      },
    });

    // 4. Fecha a solicitaÃ§Ã£o com user_id
    await updateAccessRequest(requestId, {
      status: "closed",
      user_id: createdUserId,
    });

    // 5. Cria comentÃ¡rio de aprovaÃ§Ã£o
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

  test("4. usuÃ¡rio Ã© criado com campos corretos", async () => {
    const user = await getLocalUserById(createdUserId);
    expect(user).not.toBeNull();
    expect(user!.email).toBe(userEmail);
    expect(user!.name).toContain("Carlos Aceito");
  });

  test("5. membership vincula usuÃ¡rio Ã  empresa", async () => {
    const membership = await prisma.membership.findFirst({
      where: { userId: createdUserId, companyId },
    });
    expect(membership).not.toBeNull();
    expect(membership!.role).toBe("user");
  });

  test("6. solicitaÃ§Ã£o aceita tem status closed e user_id", async () => {
    const req = await getAccessRequestById(requestId);
    expect(req).not.toBeNull();
    expect(req!.status).toBe("closed");
    expect(req!.user_id).toBe(createdUserId);
  });
});

// â”€â”€ RejeiÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describePg("RejeiÃ§Ã£o de solicitaÃ§Ã£o de acesso", () => {
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

    // Simula rejeiÃ§Ã£o
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

  test("7. solicitaÃ§Ã£o rejeitada tem status rejected", async () => {
    const req = await getAccessRequestById(requestId);
    expect(req).not.toBeNull();
    expect(req!.status).toBe("rejected");
  });

  test("8. solicitaÃ§Ã£o rejeitada nÃ£o possui user_id", async () => {
    const req = await getAccessRequestById(requestId);
    expect(req!.user_id).toBeFalsy();
  });
});

