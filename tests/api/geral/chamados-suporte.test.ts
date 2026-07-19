/**
 * Cenários de criação e edição de chamados (suporte) no banco PostgreSQL.
 * âœ… cleanup total em afterAll — nenhum dado permanece.
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

import { prisma } from "@/database/prismaClient";
import { describeDb } from "../../../tools/functions/banco-de-dados/descrever-banco";

jest.setTimeout(120000);

const describePg = describeDb;
import {
  createSuporte,
  updateSuporte,
  updateSuporteForUser,
  updateSuporteStatus,
  deleteSuporteForUser,
  getSuporteById,
  listSuportesForUser,
} from "@/backend/ticketsStore";
import {
  pgCreateLocalUser,
  pgCreateLocalCompany,
  pgDeleteLocalCompany,
} from "@/backend/auth/pgStore";
import { hashPasswordSha256 } from "@/backend/passwordHash";

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

describePg("Chamados (suporte) — criação e edição", () => {

  // â”€â”€ 1. Chamado básico â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("cria chamado básico com título e descrição", async () => {
    const user = await makeUser("basico");
    const ticket = await makeTicket(user.id);

    expect(ticket).not.toBeNull();
    expect(ticket!.title).toContain(UID);
    expect(ticket!.description).toBe("Descrição detalhada do problema relatado pelo usuário no sistema.");
    expect(ticket!.createdBy).toBe(user.id);

    const row = await prisma.ticket.findUnique({ where: { id: ticket!.id } });
    expect(row).not.toBeNull();
    console.log(`\nâœ… Chamado básico criado: ${ticket!.code} — "${ticket!.title}"`);
  });

  // â”€â”€ 2. Tipo bug + prioridade high â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("cria chamado do tipo bug com prioridade high", async () => {
    const user = await makeUser("bug");
    const ticket = await makeTicket(user.id, { type: "bug", priority: "high" });

    expect(ticket!.type).toBe("bug");
    expect(ticket!.priority).toBe("high");
    console.log(`\nâœ… Bug criado: ${ticket!.code} | tipo=${ticket!.type} | prioridade=${ticket!.priority}`);
  });

  // â”€â”€ 3. Tipo melhoria com tags â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    console.log(`\nâœ… Melhoria criada: ${ticket!.code} | tags=${ticket!.tags.join(", ")}`);
  });

  // â”€â”€ 4. Chamado vinculado a empresa e assignee â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    console.log(`\nâœ… Chamado vinculado: empresa=${company.slug} | assignee=${assignee.email}`);
  });

  // â”€â”€ 5. Rejeitar sem título e sem descrição â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("retorna null ao criar chamado sem título e sem descrição", async () => {
    const user = await makeUser("sem-titulo");
    const ticket = await createSuporte({
      title: "   ",
      description: "   ",
      createdBy: user.id,
    });

    expect(ticket).toBeNull();
    console.log(`\nâœ… Chamado inválido rejeitado (sem título e descrição) → null`);
  });

  // â”€â”€ 6. Código SP-XXXXXX gerado automaticamente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("gera código SP-XXXXXX automaticamente", async () => {
    const user = await makeUser("codigo");
    const ticket = await makeTicket(user.id);

    expect(ticket!.code).toMatch(/^SP-\d{6}$/);
    console.log(`\nâœ… Código gerado: ${ticket!.code}`);
  });

  // â”€â”€ 7. Status padrão = backlog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("status padrão do chamado criado é backlog", async () => {
    const user = await makeUser("status-default");
    const ticket = await makeTicket(user.id);

    expect(ticket!.status).toBe("backlog");
    console.log(`\nâœ… Status padrão: ${ticket!.status}`);
  });

  // â”€â”€ 8. Editar título e descrição (pelo criador) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    console.log(`\nâœ… Título editado: "${updated!.title}" | updatedBy=${updated!.updatedBy}`);
  });

  // â”€â”€ 9. Editar tipo e prioridade (admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    console.log(`\nâœ… Tipo e prioridade editados: tipo=${updated!.type} | prioridade=${updated!.priority}`);
  });

  // â”€â”€ 10. Editar tags â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    console.log(`\nâœ… Tags editadas: [${updated!.tags.join(", ")}]`);
  });

  // â”€â”€ 11. Atribuir assignee â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    console.log(`\nâœ… Assignee atribuído: ${assignee.email}`);
  });

  // â”€â”€ 12. Fluxo de status: backlog → doing → review → done â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    console.log(`\nâœ… Fluxo de status: backlog → doing → review → done | eventos=${events.length}`);
  });

  // â”€â”€ 13. Retorna null para chamado inexistente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("retorna null ao editar chamado com id inexistente", async () => {
    const user = await makeUser("inexistente");
    const result = await updateSuporte("id-que-nao-existe-9999", {
      title: "Fantasma",
      updatedBy: user.id,
    });
    expect(result).toBeNull();
    console.log(`\nâœ… Chamado inexistente → null`);
  });

  // â”€â”€ 14. updateSuporteForUser ignora chamado de outro usuário â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    console.log(`\nâœ… Edição por outro usuário bloqueada → null`);
  });

  // â”€â”€ 15. Listar chamados por usuário â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    console.log(`\nâœ… Listagem por usuário: userA tem ${chamadosA.filter(t => t.createdBy === userA.id).length} chamados`);
  });
});

