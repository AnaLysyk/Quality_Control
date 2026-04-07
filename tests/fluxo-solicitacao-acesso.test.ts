/**
 * Fluxo completo de Solicitação de Acesso — perspectiva de quem manda e de quem recebe.
 * ✅ cleanup total em afterAll — nenhum dado permanece.
 *
 * QUEM MANDA (Solicitante):
 *  1.  Solicitante abre pedido de acesso com e-mail e mensagem
 *  2.  Solicitante pode abrir mais de uma solicitação (sem trava de duplicata)
 *  3.  Solicitante consulta sua solicitação por id
 *  4.  Solicitante adiciona um comentário explicando o motivo
 *  5.  Solicitante responde comentário do admin (segunda rodada)
 *
 * QUEM RECEBE (Admin):
 *  6.  Admin visualiza todas as solicitações abertas
 *  7.  Admin lê a mensagem e os comentários do solicitante
 *  8.  Admin adiciona comentário pedindo mais informações
 *  9.  Admin aceita a solicitação (status → closed) e vincula ao usuário criado
 * 10. Admin rejeita outra solicitação (status → rejected) com justificativa
 *
 * FLUXO ACEITE completo (ida e volta):
 * 11. Solicitante abre pedido → Admin comenta → Solicitante responde → Admin aceita
 * 12. Após aceite: status é closed, user_id está vinculado, histórico de comentários completo
 *
 * FLUXO RECUSA completo (ida e volta):
 * 13. Solicitante abre pedido → Admin comenta pedindo justificativa → Solicitante responde → Admin rejeita
 * 14. Após recusa: status é rejected, comentários de ambos os lados estão gravados em ordem
 *
 * ISOLAMENTO:
 * 15. Comentários de uma solicitação não aparecem em outra
 * 16. Solicitações de e-mails diferentes não se misturam na listagem
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
  listAccessRequestComments,
  createAccessRequestComment,
} from "../data/accessRequestCommentsStore";
import { pgCreateLocalUser } from "../lib/core/auth/pgStore";
import { hashPasswordSha256 } from "../lib/passwordHash";

jest.setTimeout(30000);

const UID = Math.random().toString(36).slice(2, 10);
const solicitanteEmail = (tag: string) => `solicit-${tag}-${UID}@req-flow.local`;

const createdRequestIds: string[] = [];
const createdUserIds: string[] = [];

// Personas
const ADMIN = { id: `usr_adm_flow_${UID}`, name: "Admin QA", email: `admin-flow-${UID}@qa.local` };
const SOLICITANTE_A = { name: "Maria Souza", email: solicitanteEmail("maria") };
const SOLICITANTE_B = { name: "João Neto", email: solicitanteEmail("joao") };

beforeAll(async () => {
  const admin = await pgCreateLocalUser({
    email: ADMIN.email,
    name: ADMIN.name,
    password_hash: hashPasswordSha256("TC@Teste2026"),
    role: "admin",
  });
  createdUserIds.push(admin.id);
  ADMIN.id = admin.id;
});

afterAll(async () => {
  if (createdRequestIds.length > 0) {
    await prisma.accessRequestComment.deleteMany({ where: { requestId: { in: createdRequestIds } } }).catch(() => null);
    await prisma.accessRequest.deleteMany({ where: { id: { in: createdRequestIds } } }).catch(() => null);
  }
  if (createdUserIds.length > 0) {
    await prisma.membership.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => null);
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => null);
  }
  await prisma.$disconnect();
});

// ── QUEM MANDA (Solicitante) ───────────────────────────────────────────────────

describe("Perspectiva do Solicitante", () => {
  test("1. solicitante abre pedido de acesso com e-mail e mensagem", async () => {
    const req = await createAccessRequest({
      email: SOLICITANTE_A.email,
      message: "Preciso de acesso para acompanhar os testes do projeto X",
    });
    createdRequestIds.push(req.id);

    expect(req.id).toBeTruthy();
    expect(req.email).toBe(SOLICITANTE_A.email);
    expect(req.message).toBe("Preciso de acesso para acompanhar os testes do projeto X");
    expect(req.status).toBe("open");
    expect(req.user_id).toBeNull();
  });

  test("2. solicitante pode abrir mais de uma solicitação (sem trava de duplicata)", async () => {
    const req = await createAccessRequest({
      email: SOLICITANTE_A.email,
      message: "Segunda tentativa, não recebi resposta",
    });
    createdRequestIds.push(req.id);

    expect(req.id).not.toBe(createdRequestIds[0]);
    expect(req.email).toBe(SOLICITANTE_A.email);
  });

  test("3. solicitante consulta sua solicitação por id", async () => {
    const id = createdRequestIds[0];
    const found = await getAccessRequestById(id);

    expect(found).not.toBeNull();
    expect(found!.email).toBe(SOLICITANTE_A.email);
    expect(found!.status).toBe("open");
  });

  test("4. solicitante adiciona comentário explicando o motivo", async () => {
    const id = createdRequestIds[0];
    const comment = await createAccessRequestComment({
      requestId: id,
      authorRole: "requester",
      authorName: SOLICITANTE_A.name,
      authorEmail: SOLICITANTE_A.email,
      body: "Faço parte do time de QA e preciso acompanhar os relatórios de execução.",
    });

    expect(comment.id).toBeTruthy();
    expect(comment.requestId).toBe(id);
    expect(comment.authorRole).toBe("requester");
    expect(comment.authorName).toBe(SOLICITANTE_A.name);
    expect(comment.body).toContain("relatórios de execução");
  });

  test("5. solicitante responde comentário do admin (segunda rodada)", async () => {
    const id = createdRequestIds[0];
    // Simulando que admin já comentou; solicitante responde
    const response = await createAccessRequestComment({
      requestId: id,
      authorRole: "requester",
      authorName: SOLICITANTE_A.name,
      authorEmail: SOLICITANTE_A.email,
      body: "Confirmo: meu gestor é Carlos Lima, cc: carlos@empresa.com",
    });

    const allComments = await listAccessRequestComments(id);
    const requesterComments = allComments.filter((c) => c.authorRole === "requester");
    expect(requesterComments.length).toBeGreaterThanOrEqual(2);
    expect(response.authorRole).toBe("requester");
  });
});

// ── QUEM RECEBE (Admin) ────────────────────────────────────────────────────────

describe("Perspectiva do Admin", () => {
  test("6. admin visualiza todas as solicitações abertas", async () => {
    const all = await listAccessRequests();
    const mine = all.filter((r) => createdRequestIds.includes(r.id));
    // As solicitações de A estão no topo (mais recentes)
    expect(mine.length).toBeGreaterThanOrEqual(2);
    mine.forEach((r) => expect(r.status).toBeTruthy());
  });

  test("7. admin lê a mensagem e os comentários do solicitante", async () => {
    const id = createdRequestIds[0];
    const req = await getAccessRequestById(id);
    const comments = await listAccessRequestComments(id);

    expect(req!.message).toContain("projeto X");
    expect(comments.length).toBeGreaterThanOrEqual(2);
    expect(comments.every((c) => c.requestId === id)).toBe(true);
    // Ordenados por createdAt asc — primeiro comentário é do solicitante
    expect(comments[0].authorRole).toBe("requester");
  });

  test("8. admin adiciona comentário pedindo mais informações", async () => {
    const id = createdRequestIds[0];
    const comment = await createAccessRequestComment({
      requestId: id,
      authorRole: "admin",
      authorName: ADMIN.name,
      authorEmail: ADMIN.email,
      authorId: ADMIN.id,
      body: "Por favor, informe o nome do seu gestor para prosseguir com a aprovação.",
    });

    expect(comment.authorRole).toBe("admin");
    expect(comment.authorId).toBe(ADMIN.id);
    expect(comment.body).toContain("gestor");

    const all = await listAccessRequestComments(id);
    const adminComments = all.filter((c) => c.authorRole === "admin");
    expect(adminComments.length).toBeGreaterThanOrEqual(1);
  });

  test("9. admin aceita a solicitação e vincula ao usuário criado", async () => {
    const id = createdRequestIds[0];
    // Cria conta para o solicitante aceito
    const newUser = await pgCreateLocalUser({
      email: SOLICITANTE_A.email,
      name: SOLICITANTE_A.name,
      password_hash: hashPasswordSha256("TC@Novo2026"),
      role: "user",
    });
    createdUserIds.push(newUser.id);

    const updated = await updateAccessRequest(id, {
      status: "closed",
      user_id: newUser.id,
    });

    expect(updated!.status).toBe("closed");
    expect(updated!.user_id).toBe(newUser.id);
  });

  test("10. admin rejeita outra solicitação com justificativa no comentário", async () => {
    const id = createdRequestIds[1]; // segunda solicitação de A ("Segunda tentativa")

    await createAccessRequestComment({
      requestId: id,
      authorRole: "admin",
      authorName: ADMIN.name,
      authorEmail: ADMIN.email,
      authorId: ADMIN.id,
      body: "Solicitação duplicada. A primeira já foi processada.",
    });

    const updated = await updateAccessRequest(id, { status: "rejected" });

    expect(updated!.status).toBe("rejected");
    const comments = await listAccessRequestComments(id);
    expect(comments.some((c) => c.body.includes("duplicada"))).toBe(true);
  });
});

// ── FLUXO ACEITE COMPLETO ─────────────────────────────────────────────────────

describe("Fluxo de Aceite completo (ida e volta)", () => {
  let reqId: string;
  let solicitanteUserId: string;

  test("11. solicitante abre → admin comenta → solicitante responde → admin aceita", async () => {
    // Passo 1: solicitante abre
    const req = await createAccessRequest({
      email: SOLICITANTE_B.email,
      message: "Quero acesso para validar releases do sistema financeiro.",
    });
    createdRequestIds.push(req.id);
    reqId = req.id;
    expect(req.status).toBe("open");

    // Passo 2: admin comenta
    await createAccessRequestComment({
      requestId: reqId,
      authorRole: "admin",
      authorName: ADMIN.name,
      authorId: ADMIN.id,
      body: "Qual é o seu cargo e empresa?",
    });

    // Passo 3: solicitante responde
    await createAccessRequestComment({
      requestId: reqId,
      authorRole: "requester",
      authorName: SOLICITANTE_B.name,
      authorEmail: SOLICITANTE_B.email,
      body: "Sou analista de QA na Empresa ABC.",
    });

    // Passo 4: admin cria usuário e aceita
    const newUser = await pgCreateLocalUser({
      email: SOLICITANTE_B.email,
      name: SOLICITANTE_B.name,
      password_hash: hashPasswordSha256("TC@Novo2026"),
      role: "user",
    });
    solicitanteUserId = newUser.id;
    createdUserIds.push(newUser.id);

    const accepted = await updateAccessRequest(reqId, {
      status: "closed",
      user_id: newUser.id,
    });

    expect(accepted!.status).toBe("closed");
    expect(accepted!.user_id).toBe(newUser.id);
  });

  test("12. após aceite: status é closed, user_id vinculado, histórico completo", async () => {
    const req = await getAccessRequestById(reqId);
    expect(req!.status).toBe("closed");
    expect(req!.user_id).toBe(solicitanteUserId);

    const comments = await listAccessRequestComments(reqId);
    expect(comments.length).toBe(2);

    // Primeiro comentário: admin
    expect(comments[0].authorRole).toBe("admin");
    expect(comments[0].body).toContain("cargo");

    // Segundo comentário: solicitante
    expect(comments[1].authorRole).toBe("requester");
    expect(comments[1].body).toContain("analista de QA");
  });
});

// ── FLUXO RECUSA COMPLETO ─────────────────────────────────────────────────────

describe("Fluxo de Recusa completo (ida e volta)", () => {
  let reqId: string;

  test("13. solicitante abre → admin pede justificativa → solicitante responde → admin rejeita", async () => {
    // Passo 1: solicitante abre
    const req = await createAccessRequest({
      email: solicitanteEmail("recusado"),
      message: "Preciso de acesso urgente.",
    });
    createdRequestIds.push(req.id);
    reqId = req.id;
    expect(req.status).toBe("open");

    // Mudança para in_progress enquanto analisa
    await updateAccessRequest(reqId, { status: "in_progress" });
    const inProg = await getAccessRequestById(reqId);
    expect(inProg!.status).toBe("in_progress");

    // Passo 2: admin pede justificativa
    await createAccessRequestComment({
      requestId: reqId,
      authorRole: "admin",
      authorName: ADMIN.name,
      authorId: ADMIN.id,
      body: "Por favor, detalhe o motivo do acesso urgente e qual sistema será utilizado.",
    });

    // Passo 3: solicitante responde de forma insuficiente
    await createAccessRequestComment({
      requestId: reqId,
      authorRole: "requester",
      authorName: "Anônimo",
      body: "Só preciso entrar.",
    });

    // Passo 4: admin rejeita com justificativa
    await createAccessRequestComment({
      requestId: reqId,
      authorRole: "admin",
      authorName: ADMIN.name,
      authorId: ADMIN.id,
      body: "Informações insuficientes. Solicitação encerrada.",
    });

    const rejected = await updateAccessRequest(reqId, { status: "rejected" });
    expect(rejected!.status).toBe("rejected");
  });

  test("14. após recusa: comentários de ambos os lados gravados em ordem", async () => {
    const req = await getAccessRequestById(reqId);
    expect(req!.status).toBe("rejected");

    const comments = await listAccessRequestComments(reqId);
    expect(comments.length).toBe(3);

    expect(comments[0].authorRole).toBe("admin");     // pedido de justificativa
    expect(comments[1].authorRole).toBe("requester"); // resposta insuficiente
    expect(comments[2].authorRole).toBe("admin");     // justificativa de recusa
    expect(comments[2].body).toContain("Informações insuficientes");
  });
});

// ── ISOLAMENTO ────────────────────────────────────────────────────────────────

describe("Isolamento entre solicitações", () => {
  test("15. comentários de uma solicitação não aparecem em outra", async () => {
    const [idA, idB] = createdRequestIds;
    const commentsA = await listAccessRequestComments(idA);
    const commentsB = await listAccessRequestComments(idB);

    commentsA.forEach((c) => expect(c.requestId).toBe(idA));
    commentsB.forEach((c) => expect(c.requestId).toBe(idB));
    // B foi rejeitada com 1 comentário do admin — não pode ter comentários de A
    expect(commentsB.every((c) => commentsA.every((ca) => ca.id !== c.id))).toBe(true);
  });

  test("16. solicitações de e-mails diferentes não se misturam na listagem", async () => {
    const all = await listAccessRequests();
    const mariaReqs = all.filter((r) => r.email === SOLICITANTE_A.email);
    const joaoReqs = all.filter((r) => r.email === SOLICITANTE_B.email);

    mariaReqs.forEach((r) => expect(r.email).toBe(SOLICITANTE_A.email));
    joaoReqs.forEach((r) => expect(r.email).toBe(SOLICITANTE_B.email));
    expect(mariaReqs.every((r) => joaoReqs.every((j) => j.id !== r.id))).toBe(true);
  });
});
