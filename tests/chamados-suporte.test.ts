/**
 * Cenários de criação e edição de chamados (suporte) no banco PostgreSQL.
 * ✅ cleanup total em afterAll — nenhum dado permanece.
 *
 * Criação (7 cenários):
 *  1. Chamado básico (título + descrição)
 *  2. Chamado tipo bug com prioridade high
 *  3. Chamado tipo melhoria com tags
 *  4. Chamado vinculado a empresa e assignee
 *  5. Rejeitar chamado sem título e sem descrição
 *  6. Código SP-XXXXXX gerado automaticamente
 *  7. Status padrão = backlog
 *
 * Edição (8 cenários):
 *  8.  Editar título e descrição (pelo criador)
 *  9.  Editar tipo e prioridade (admin)
 * 10.  Editar tags
 *  11. Atribuir assignee
 * 12.  Alterar status backlog → doing → review → done
 * 13.  Retornar null ao editar chamado inexistente
 * 14.  updateSuporteForUser ignora chamado de outro usuário
 * 15.  Listar chamados por usuário criador
 */

import { prisma } from "../lib/prismaClient";

jest.setTimeout(30000);
import {
  createSuporte,
  updateSuporte,
  updateSuporteForUser,
  updateSuporteStatus,
  deleteSuporteForUser,
  getSuporteById,
  listSuportesForUser,
} from "../lib/ticketsStore";
import {
  pgCreateLocalUser,
  pgCreateLocalCompany,
  pgDeleteLocalCompany,
} from "../lib/core/auth/pgStore";
import { hashPasswordSha256 } from "../lib/passwordHash";

const PASSWORD = hashPasswordSha256("TC@Teste2026");
const UID = Math.random().toString(36).slice(2, 10);
const email = (tag: string) => `chamado-${tag}-${UID}@suporte-test.local`;

const createdTicketIds: string[] = [];
const createdUserIds: string[] = [];
const createdCompanyIds: string[] = [];

afterAll(async () => {
  // Remove tickets criados
  for (const id of createdTicketIds) {
    await prisma.ticket.deleteMany({ where: { id } }).catch(() => null);
  }
  // Remove memberships e usuários criados
  await prisma.membership.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => null);
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => null);
  // Remove empresas criadas
  for (const id of createdCompanyIds) {
    await pgDeleteLocalCompany(id).catch(() => null);
  }
  await prisma.$disconnect();
}, 30000);

async function makeUser(tag: string, overrides: Record<string, unknown> = {}) {
  const user = await pgCreateLocalUser({
    name: `Chamado ${tag} ${UID}`,
    email: email(tag),
    password_hash: PASSWORD,
    role: "user",
    is_global_admin: false,
    status: "active",
    ...overrides,
  });
  createdUserIds.push(user.id);
  return user;
}

async function makeTicket(userId: string, overrides: Record<string, unknown> = {}) {
  const ticket = await createSuporte({
    title: `Chamado de teste ${UID}`,
    description: "Descrição detalhada do problema relatado pelo usuário no sistema.",
    createdBy: userId,
    ...overrides,
  });
  if (ticket) createdTicketIds.push(ticket.id);
  return ticket;
}

describe("Chamados (suporte) — criação e edição", () => {

  // ── 1. Chamado básico ──────────────────────────────────────────────────────
  it("cria chamado básico com título e descrição", async () => {
    const user = await makeUser("basico");
    const ticket = await makeTicket(user.id);

    expect(ticket).not.toBeNull();
    expect(ticket!.title).toContain(UID);
    expect(ticket!.description).toBe("Descrição detalhada do problema relatado pelo usuário no sistema.");
    expect(ticket!.createdBy).toBe(user.id);

    const row = await prisma.ticket.findUnique({ where: { id: ticket!.id } });
    expect(row).not.toBeNull();
    console.log(`\n✅ Chamado básico criado: ${ticket!.code} — "${ticket!.title}"`);
  });

  // ── 2. Tipo bug + prioridade high ──────────────────────────────────────────
  it("cria chamado do tipo bug com prioridade high", async () => {
    const user = await makeUser("bug");
    const ticket = await makeTicket(user.id, { type: "bug", priority: "high" });

    expect(ticket!.type).toBe("bug");
    expect(ticket!.priority).toBe("high");
    console.log(`\n✅ Bug criado: ${ticket!.code} | tipo=${ticket!.type} | prioridade=${ticket!.priority}`);
  });

  // ── 3. Tipo melhoria com tags ──────────────────────────────────────────────
  it("cria chamado do tipo melhoria com tags", async () => {
    const user = await makeUser("melhoria");
    const ticket = await makeTicket(user.id, {
      type: "melhoria",
      priority: "low",
      tags: ["ui", "performance", "ux"],
    });

    expect(ticket!.type).toBe("melhoria");
    expect(ticket!.tags).toContain("ui");
    expect(ticket!.tags).toContain("performance");
    expect(ticket!.tags).toContain("ux");
    console.log(`\n✅ Melhoria criada: ${ticket!.code} | tags=${ticket!.tags.join(", ")}`);
  });

  // ── 4. Chamado vinculado a empresa e assignee ──────────────────────────────
  it("cria chamado vinculado a empresa e com assignee", async () => {
    const company = await pgCreateLocalCompany({
      name: `Empresa Chamado ${UID}`,
      slug: `empresa-chamado-${UID}`,
      status: "active",
    });
    createdCompanyIds.push(company.id);

    const criador = await makeUser("vinculado-criador");
    const assignee = await makeUser("vinculado-assignee", { role: "it_dev", is_global_admin: true });

    const ticket = await makeTicket(criador.id, {
      companyId: company.id,
      companySlug: company.slug,
      assignedToUserId: assignee.id,
      createdByName: criador.name,
      createdByEmail: criador.email,
    });

    expect(ticket!.companyId).toBe(company.id);
    expect(ticket!.assignedToUserId).toBe(assignee.id);
    expect(ticket!.createdByName).toBe(criador.name);

    const row = await prisma.ticket.findUnique({ where: { id: ticket!.id } });
    expect(row!.companyId).toBe(company.id);
    expect(row!.assignedToUserId).toBe(assignee.id);
    console.log(`\n✅ Chamado vinculado: empresa=${company.slug} | assignee=${assignee.email}`);
  });

  // ── 5. Rejeitar sem título e sem descrição ─────────────────────────────────
  it("retorna null ao criar chamado sem título e sem descrição", async () => {
    const user = await makeUser("sem-titulo");
    const ticket = await createSuporte({
      title: "   ",
      description: "   ",
      createdBy: user.id,
    });

    expect(ticket).toBeNull();
    console.log(`\n✅ Chamado inválido rejeitado (sem título e descrição) → null`);
  });

  // ── 6. Código SP-XXXXXX gerado automaticamente ────────────────────────────
  it("gera código SP-XXXXXX automaticamente", async () => {
    const user = await makeUser("codigo");
    const ticket = await makeTicket(user.id);

    expect(ticket!.code).toMatch(/^SP-\d{6}$/);
    console.log(`\n✅ Código gerado: ${ticket!.code}`);
  });

  // ── 7. Status padrão = backlog ─────────────────────────────────────────────
  it("status padrão do chamado criado é backlog", async () => {
    const user = await makeUser("status-default");
    const ticket = await makeTicket(user.id);

    expect(ticket!.status).toBe("backlog");
    console.log(`\n✅ Status padrão: ${ticket!.status}`);
  });

  // ── 8. Editar título e descrição (pelo criador) ────────────────────────────
  it("criador edita título e descrição do próprio chamado", async () => {
    const user = await makeUser("edit-titulo");
    const ticket = await makeTicket(user.id);

    const updated = await updateSuporteForUser(user.id, ticket!.id, {
      title: `Título Editado ${UID}`,
      description: "Descrição atualizada com mais detalhes do problema encontrado.",
    });

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe(`Título Editado ${UID}`);
    expect(updated!.description).toBe("Descrição atualizada com mais detalhes do problema encontrado.");
    expect(updated!.updatedBy).toBe(user.id);

    const row = await prisma.ticket.findUnique({ where: { id: ticket!.id } });
    expect(row!.title).toBe(`Título Editado ${UID}`);
    console.log(`\n✅ Título editado: "${updated!.title}" | updatedBy=${updated!.updatedBy}`);
  });

  // ── 9. Editar tipo e prioridade (admin) ────────────────────────────────────
  it("admin edita tipo e prioridade do chamado", async () => {
    const criador = await makeUser("edit-tipo-criador");
    const admin = await makeUser("edit-tipo-admin", { role: "it_dev", is_global_admin: true });
    const ticket = await makeTicket(criador.id, { type: "tarefa", priority: "low" });

    const updated = await updateSuporte(ticket!.id, {
      type: "bug",
      priority: "high",
      updatedBy: admin.id,
    });

    expect(updated!.type).toBe("bug");
    expect(updated!.priority).toBe("high");
    expect(updated!.updatedBy).toBe(admin.id);
    console.log(`\n✅ Tipo e prioridade editados: tipo=${updated!.type} | prioridade=${updated!.priority}`);
  });

  // ── 10. Editar tags ────────────────────────────────────────────────────────
  it("edita as tags do chamado", async () => {
    const user = await makeUser("edit-tags");
    const ticket = await makeTicket(user.id, { tags: ["inicial"] });

    const updated = await updateSuporte(ticket!.id, {
      tags: ["backend", "auth", "critico"],
      updatedBy: user.id,
    });

    expect(updated!.tags).toContain("backend");
    expect(updated!.tags).toContain("auth");
    expect(updated!.tags).toContain("critico");
    expect(updated!.tags).not.toContain("inicial");
    console.log(`\n✅ Tags editadas: [${updated!.tags.join(", ")}]`);
  });

  // ── 11. Atribuir assignee ──────────────────────────────────────────────────
  it("atribui assignee ao chamado", async () => {
    const criador = await makeUser("assignee-criador");
    const assignee = await makeUser("assignee-dev", { role: "it_dev", is_global_admin: true });
    const ticket = await makeTicket(criador.id);

    expect(ticket!.assignedToUserId).toBeNull();

    const updated = await updateSuporte(ticket!.id, {
      assignedToUserId: assignee.id,
      updatedBy: criador.id,
    });

    expect(updated!.assignedToUserId).toBe(assignee.id);
    const row = await prisma.ticket.findUnique({ where: { id: ticket!.id } });
    expect(row!.assignedToUserId).toBe(assignee.id);
    console.log(`\n✅ Assignee atribuído: ${assignee.email}`);
  });

  // ── 12. Fluxo de status: backlog → doing → review → done ──────────────────
  it("altera status do chamado: backlog → doing → review → done", async () => {
    const user = await makeUser("status-flow");
    const ticket = await makeTicket(user.id);
    expect(ticket!.status).toBe("backlog");

    const doing = await updateSuporteStatus(ticket!.id, "doing", user.id);
    expect(doing!.status).toBe("doing");

    const review = await updateSuporteStatus(ticket!.id, "review", user.id);
    expect(review!.status).toBe("review");

    const done = await updateSuporteStatus(ticket!.id, "done", user.id);
    expect(done!.status).toBe("done");

    // Verifica no banco
    const row = await prisma.ticket.findUnique({ where: { id: ticket!.id } });
    expect(row!.status).toBe("done");

    // Verifica eventos gravados
    const events = await prisma.ticketEvent.findMany({
      where: { ticketId: ticket!.id, type: "STATUS_CHANGED" },
      orderBy: { createdAt: "asc" },
    });
    expect(events.length).toBe(3);
    expect((events[0].payload as { from: string; to: string }).from).toBe("backlog");
    expect((events[0].payload as { from: string; to: string }).to).toBe("doing");
    expect((events[2].payload as { from: string; to: string }).to).toBe("done");

    console.log(`\n✅ Fluxo de status: backlog → doing → review → done | eventos=${events.length}`);
  });

  // ── 13. Retorna null para chamado inexistente ──────────────────────────────
  it("retorna null ao editar chamado com id inexistente", async () => {
    const user = await makeUser("inexistente");
    const result = await updateSuporte("id-que-nao-existe-9999", {
      title: "Fantasma",
      updatedBy: user.id,
    });
    expect(result).toBeNull();
    console.log(`\n✅ Chamado inexistente → null`);
  });

  // ── 14. updateSuporteForUser ignora chamado de outro usuário ───────────────
  it("updateSuporteForUser não permite editar chamado de outro usuário", async () => {
    const dono = await makeUser("dono");
    const outro = await makeUser("outro");
    const ticket = await makeTicket(dono.id);

    const result = await updateSuporteForUser(outro.id, ticket!.id, {
      title: "Tentativa de edição indevida",
    });

    expect(result).toBeNull();

    // Garante que o ticket não foi alterado
    const row = await prisma.ticket.findUnique({ where: { id: ticket!.id } });
    expect(row!.title).toBe(ticket!.title);
    console.log(`\n✅ Edição por outro usuário bloqueada → null`);
  });

  // ── 15. Listar chamados por usuário ───────────────────────────────────────
  it("lista apenas os chamados do usuário criador", async () => {
    const userA = await makeUser("lista-a");
    const userB = await makeUser("lista-b");

    const t1 = await makeTicket(userA.id, { title: `Lista A1 ${UID}`, description: "Primeiro chamado do usuário A listagem" });
    const t2 = await makeTicket(userA.id, { title: `Lista A2 ${UID}`, description: "Segundo chamado do usuário A listagem" });
    await makeTicket(userB.id, { title: `Lista B1 ${UID}`, description: "Chamado do usuário B não deve aparecer" });

    const chamadosA = await listSuportesForUser(userA.id);
    const idsA = chamadosA.map((t) => t.id);

    expect(idsA).toContain(t1!.id);
    expect(idsA).toContain(t2!.id);
    // Nenhum chamado de userB deve aparecer
    const chamadosDeB = chamadosA.filter((t) => t.createdBy === userB.id);
    expect(chamadosDeB.length).toBe(0);

    console.log(`\n✅ Listagem por usuário: userA tem ${chamadosA.filter(t => t.createdBy === userA.id).length} chamados`);
  });
});
