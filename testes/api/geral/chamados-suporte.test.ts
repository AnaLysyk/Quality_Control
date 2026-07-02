/**
 * CenÃ¡rios de criaÃ§Ã£o e ediÃ§Ã£o de chamados (suporte) no banco PostgreSQL.
 * âœ… cleanup total em afterAll â€” nenhum dado permanece.
 *
 * CriaÃ§Ã£o (7 cenÃ¡rios):
 *  1. Chamado bÃ¡sico (tÃ­tulo + descriÃ§Ã£o)
 *  2. Chamado tipo bug com prioridade high
 *  3. Chamado tipo melhoria com tags
 *  4. Chamado vinculado a empresa e assignee
 *  5. Rejeitar chamado sem tÃ­tulo e sem descriÃ§Ã£o
 *  6. CÃ³digo SP-XXXXXX gerado automaticamente
 *  7. Status padrÃ£o = backlog
 *
 * EdiÃ§Ã£o (8 cenÃ¡rios):
 *  8.  Editar tÃ­tulo e descriÃ§Ã£o (pelo criador)
 *  9.  Editar tipo e prioridade (admin)
 * 10.  Editar tags
 *  11. Atribuir assignee
 * 12.  Alterar status backlog â†’ doing â†’ review â†’ done
 * 13.  Retornar null ao editar chamado inexistente
 * 14.  updateSuporteForUser ignora chamado de outro usuÃ¡rio
 * 15.  Listar chamados por usuÃ¡rio criador
 */

import { prisma } from "@/lib/prismaClient";
import { describeDb } from "../../../support/functions/banco-de-dados/descrever-banco";

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
} from "@/lib/ticketsStore";
import {
  pgCreateLocalUser,
  pgCreateLocalCompany,
  pgDeleteLocalCompany,
} from "@/lib/core/auth/pgStore";
import { hashPasswordSha256 } from "@/lib/passwordHash";

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
  // Remove memberships e usuÃ¡rios criados
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
    description: "DescriÃ§Ã£o detalhada do problema relatado pelo usuÃ¡rio no sistema.",
    createdBy: userId,
    ...overrides,
  });
  if (ticket) createdTicketIds.push(ticket.id);
  return ticket;
}

describePg("Chamados (suporte) â€” criaÃ§Ã£o e ediÃ§Ã£o", () => {

  // â”€â”€ 1. Chamado bÃ¡sico â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("cria chamado bÃ¡sico com tÃ­tulo e descriÃ§Ã£o", async () => {
    const user = await makeUser("basico");
    const ticket = await makeTicket(user.id);

    expect(ticket).not.toBeNull();
    expect(ticket!.title).toContain(UID);
    expect(ticket!.description).toBe("DescriÃ§Ã£o detalhada do problema relatado pelo usuÃ¡rio no sistema.");
    expect(ticket!.createdBy).toBe(user.id);

    const row = await prisma.ticket.findUnique({ where: { id: ticket!.id } });
    expect(row).not.toBeNull();
    console.log(`\nâœ… Chamado bÃ¡sico criado: ${ticket!.code} â€” "${ticket!.title}"`);
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

  // â”€â”€ 5. Rejeitar sem tÃ­tulo e sem descriÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("retorna null ao criar chamado sem tÃ­tulo e sem descriÃ§Ã£o", async () => {
    const user = await makeUser("sem-titulo");
    const ticket = await createSuporte({
      title: "   ",
      description: "   ",
      createdBy: user.id,
    });

    expect(ticket).toBeNull();
    console.log(`\nâœ… Chamado invÃ¡lido rejeitado (sem tÃ­tulo e descriÃ§Ã£o) â†’ null`);
  });

  // â”€â”€ 6. CÃ³digo SP-XXXXXX gerado automaticamente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("gera cÃ³digo SP-XXXXXX automaticamente", async () => {
    const user = await makeUser("codigo");
    const ticket = await makeTicket(user.id);

    expect(ticket!.code).toMatch(/^SP-\d{6}$/);
    console.log(`\nâœ… CÃ³digo gerado: ${ticket!.code}`);
  });

  // â”€â”€ 7. Status padrÃ£o = backlog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("status padrÃ£o do chamado criado Ã© backlog", async () => {
    const user = await makeUser("status-default");
    const ticket = await makeTicket(user.id);

    expect(ticket!.status).toBe("backlog");
    console.log(`\nâœ… Status padrÃ£o: ${ticket!.status}`);
  });

  // â”€â”€ 8. Editar tÃ­tulo e descriÃ§Ã£o (pelo criador) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("criador edita tÃ­tulo e descriÃ§Ã£o do prÃ³prio chamado", async () => {
    const user = await makeUser("edit-titulo");
    const ticket = await makeTicket(user.id);

    const updated = await updateSuporteForUser(user.id, ticket!.id, {
      title: `TÃ­tulo Editado ${UID}`,
      description: "DescriÃ§Ã£o atualizada com mais detalhes do problema encontrado.",
    });

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe(`TÃ­tulo Editado ${UID}`);
    expect(updated!.description).toBe("DescriÃ§Ã£o atualizada com mais detalhes do problema encontrado.");
    expect(updated!.updatedBy).toBe(user.id);

    const row = await prisma.ticket.findUnique({ where: { id: ticket!.id } });
    expect(row!.title).toBe(`TÃ­tulo Editado ${UID}`);
    console.log(`\nâœ… TÃ­tulo editado: "${updated!.title}" | updatedBy=${updated!.updatedBy}`);
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
    console.log(`\nâœ… Assignee atribuÃ­do: ${assignee.email}`);
  });

  // â”€â”€ 12. Fluxo de status: backlog â†’ doing â†’ review â†’ done â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("altera status do chamado: backlog â†’ doing â†’ review â†’ done", async () => {
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

    console.log(`\nâœ… Fluxo de status: backlog â†’ doing â†’ review â†’ done | eventos=${events.length}`);
  });

  // â”€â”€ 13. Retorna null para chamado inexistente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("retorna null ao editar chamado com id inexistente", async () => {
    const user = await makeUser("inexistente");
    const result = await updateSuporte("id-que-nao-existe-9999", {
      title: "Fantasma",
      updatedBy: user.id,
    });
    expect(result).toBeNull();
    console.log(`\nâœ… Chamado inexistente â†’ null`);
  });

  // â”€â”€ 14. updateSuporteForUser ignora chamado de outro usuÃ¡rio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("updateSuporteForUser nÃ£o permite editar chamado de outro usuÃ¡rio", async () => {
    const dono = await makeUser("dono");
    const outro = await makeUser("outro");
    const ticket = await makeTicket(dono.id);

    const result = await updateSuporteForUser(outro.id, ticket!.id, {
      title: "Tentativa de ediÃ§Ã£o indevida",
    });

    expect(result).toBeNull();

    // Garante que o ticket nÃ£o foi alterado
    const row = await prisma.ticket.findUnique({ where: { id: ticket!.id } });
    expect(row!.title).toBe(ticket!.title);
    console.log(`\nâœ… EdiÃ§Ã£o por outro usuÃ¡rio bloqueada â†’ null`);
  });

  // â”€â”€ 15. Listar chamados por usuÃ¡rio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("lista apenas os chamados do usuÃ¡rio criador", async () => {
    const userA = await makeUser("lista-a");
    const userB = await makeUser("lista-b");

    const t1 = await makeTicket(userA.id, { title: `Lista A1 ${UID}`, description: "Primeiro chamado do usuÃ¡rio A listagem" });
    const t2 = await makeTicket(userA.id, { title: `Lista A2 ${UID}`, description: "Segundo chamado do usuÃ¡rio A listagem" });
    await makeTicket(userB.id, { title: `Lista B1 ${UID}`, description: "Chamado do usuÃ¡rio B nÃ£o deve aparecer" });

    const chamadosA = await listSuportesForUser(userA.id);
    const idsA = chamadosA.map((t) => t.id);

    expect(idsA).toContain(t1!.id);
    expect(idsA).toContain(t2!.id);
    // Nenhum chamado de userB deve aparecer
    const chamadosDeB = chamadosA.filter((t) => t.createdBy === userB.id);
    expect(chamadosDeB.length).toBe(0);

    console.log(`\nâœ… Listagem por usuÃ¡rio: userA tem ${chamadosA.filter(t => t.createdBy === userA.id).length} chamados`);
  });
});

