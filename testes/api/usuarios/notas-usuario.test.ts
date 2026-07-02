/**
 * CenÃ¡rios de notas de usuÃ¡rio no banco PostgreSQL.
 * âœ… cleanup total em afterAll â€” nenhum dado permanece.
 *
 * Fluxo:
 *  1. Cria nota 1 (rascunho, prioridade baixa)
 *  2. Cria nota 2 (em andamento, prioridade alta, com tags)
 *  3. Cria nota 3 (urgente, cor sky)
 *  4. Deleta nota 2
 *  5. Confirma que nota 2 foi removida e notas 1 e 3 permanecem
 *  6. Edita nota 1 (tÃ­tulo, conteÃºdo, status, prioridade)
 *  7. Confirma ediÃ§Ã£o persistida no banco
 */

import { prisma } from "@/lib/prismaClient";
import {
  createUserNote,
  updateUserNote,
  deleteUserNote,
  listUserNotes,
} from "@/lib/userNotesStore";
import { pgCreateLocalUser } from "@/lib/core/auth/pgStore";
import { hashPasswordSha256 } from "@/lib/passwordHash";

jest.setTimeout(30000);

const describePg = process.env.DATABASE_URL ? describe : describe.skip;

const PASSWORD = hashPasswordSha256("TC@Teste2026");
const UID = Math.random().toString(36).slice(2, 10);

let userId: string;
let nota1Id: string;
let nota2Id: string;
let nota3Id: string;

afterAll(async () => {
  await prisma.userNote.deleteMany({ where: { userId } }).catch(() => null);
  await prisma.membership.deleteMany({ where: { userId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { id: userId } }).catch(() => null);
  await prisma.$disconnect();
}, 30000);

describePg("Notas de usuÃ¡rio â€” criar 3, deletar 1, editar 1", () => {

  // â”€â”€ Setup: cria usuÃ¡rio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  beforeAll(async () => {
    const user = await pgCreateLocalUser({
      name: `UsuÃ¡rio Notas ${UID}`,
      email: `notas-${UID}@notas-test.local`,
      password_hash: PASSWORD,
      role: "user",
      is_global_admin: false,
      status: "active",
    });
    userId = user.id;
  }, 20000);

  // â”€â”€ 1. Criar nota 1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("cria nota 1 â€” rascunho, prioridade baixa", async () => {
    const nota = await createUserNote(userId, {
      title: `Nota Um ${UID}`,
      content: "ConteÃºdo da primeira nota de teste do usuÃ¡rio.",
      color: "amber",
      status: "Rascunho",
      priority: "Baixa",
      tags: ["teste", "rascunho"],
    });

    expect(nota).not.toBeNull();
    expect(nota!.title).toBe(`Nota Um ${UID}`);
    expect(nota!.status).toBe("Rascunho");
    expect(nota!.priority).toBe("Baixa");
    expect(nota!.color).toBe("amber");
    expect(nota!.tags).toContain("teste");

    const row = await prisma.userNote.findUnique({ where: { id: nota!.id } });
    expect(row).not.toBeNull();
    expect(row!.userId).toBe(userId);

    nota1Id = nota!.id;
    console.log(`\nâœ… Nota 1 criada: "${nota!.title}" | status=${nota!.status} | id=${nota!.id}`);
  });

  // â”€â”€ 2. Criar nota 2 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("cria nota 2 â€” em andamento, prioridade alta, com tags", async () => {
    const nota = await createUserNote(userId, {
      title: `Nota Dois ${UID}`,
      content: "ConteÃºdo da segunda nota, em andamento com alta prioridade.",
      color: "rose",
      status: "Em andamento",
      priority: "Alta",
      tags: ["urgente", "backend", "auth"],
    });

    expect(nota).not.toBeNull();
    expect(nota!.status).toBe("Em andamento");
    expect(nota!.priority).toBe("Alta");
    expect(nota!.tags).toContain("urgente");
    expect(nota!.tags).toContain("backend");

    const row = await prisma.userNote.findUnique({ where: { id: nota!.id } });
    expect(row!.userId).toBe(userId);

    nota2Id = nota!.id;
    console.log(`\nâœ… Nota 2 criada: "${nota!.title}" | status=${nota!.status} | tags=[${nota!.tags.join(", ")}]`);
  });

  // â”€â”€ 3. Criar nota 3 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("cria nota 3 â€” urgente, cor sky", async () => {
    const nota = await createUserNote(userId, {
      title: `Nota TrÃªs ${UID}`,
      content: "Terceira nota com prioridade urgente e cor sky.",
      color: "sky",
      status: "Em andamento",
      priority: "Urgente",
      tags: ["critico"],
    });

    expect(nota).not.toBeNull();
    expect(nota!.priority).toBe("Urgente");
    expect(nota!.color).toBe("sky");

    const row = await prisma.userNote.findUnique({ where: { id: nota!.id } });
    expect(row!.userId).toBe(userId);

    nota3Id = nota!.id;
    console.log(`\nâœ… Nota 3 criada: "${nota!.title}" | priority=${nota!.priority} | color=${nota!.color}`);
  });

  // â”€â”€ Confirma que as 3 notas existem â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("confirma que as 3 notas foram criadas para o usuÃ¡rio", async () => {
    const notas = await listUserNotes(userId);
    const ids = notas.map((n) => n.id);

    expect(ids).toContain(nota1Id);
    expect(ids).toContain(nota2Id);
    expect(ids).toContain(nota3Id);
    expect(notas.length).toBeGreaterThanOrEqual(3);

    console.log(`\nâœ… ${notas.length} notas listadas para o usuÃ¡rio`);
  });

  // â”€â”€ 4. Deletar nota 2 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("deleta a nota 2", async () => {
    const resultado = await deleteUserNote(userId, nota2Id);

    expect(resultado).toBe(true);

    const row = await prisma.userNote.findUnique({ where: { id: nota2Id } });
    expect(row).toBeNull();

    console.log(`\nâœ… Nota 2 deletada | id=${nota2Id}`);
  });

  // â”€â”€ 5. Confirma que notas 1 e 3 permanecem â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("confirma que nota 1 e nota 3 permanecem apÃ³s deletar nota 2", async () => {
    const notas = await listUserNotes(userId);
    const ids = notas.map((n) => n.id);

    expect(ids).toContain(nota1Id);
    expect(ids).toContain(nota3Id);
    expect(ids).not.toContain(nota2Id);

    console.log(`\nâœ… Nota 2 ausente | Notas restantes: ${notas.length}`);
  });

  // â”€â”€ 6. Editar nota 1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("edita nota 1 â€” altera tÃ­tulo, conteÃºdo, status e prioridade", async () => {
    const updated = await updateUserNote(userId, nota1Id, {
      title: `Nota Um Editada ${UID}`,
      content: "ConteÃºdo atualizado com informaÃ§Ãµes mais detalhadas sobre o item.",
      status: "Concluido",
      priority: "Media",
      color: "emerald",
      tags: ["editado", "concluido"],
    });

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe(`Nota Um Editada ${UID}`);
    expect(updated!.content).toBe("ConteÃºdo atualizado com informaÃ§Ãµes mais detalhadas sobre o item.");
    expect(updated!.status).toBe("Concluido");
    expect(updated!.priority).toBe("Media");
    expect(updated!.color).toBe("emerald");
    expect(updated!.tags).toContain("editado");

    console.log(`\nâœ… Nota 1 editada: "${updated!.title}" | status=${updated!.status} | priority=${updated!.priority}`);
  });

  // â”€â”€ 7. Confirma persistÃªncia da ediÃ§Ã£o no banco â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it("confirma que a ediÃ§Ã£o da nota 1 foi persistida no banco", async () => {
    const row = await prisma.userNote.findUnique({ where: { id: nota1Id } });

    expect(row).not.toBeNull();
    expect(row!.title).toBe(`Nota Um Editada ${UID}`);
    expect(row!.status).toBe("Concluido");
    expect(row!.priority).toBe("Media");
    expect(row!.color).toBe("emerald");

    console.log(`\nâœ… PersistÃªncia confirmada: title="${row!.title}" | status=${row!.status}`);
  });
});

