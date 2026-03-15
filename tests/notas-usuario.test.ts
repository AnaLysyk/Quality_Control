/**
 * Cenários de notas de usuário no banco PostgreSQL.
 * ✅ cleanup total em afterAll — nenhum dado permanece.
 *
 * Fluxo:
 *  1. Cria nota 1 (rascunho, prioridade baixa)
 *  2. Cria nota 2 (em andamento, prioridade alta, com tags)
 *  3. Cria nota 3 (urgente, cor sky)
 *  4. Deleta nota 2
 *  5. Confirma que nota 2 foi removida e notas 1 e 3 permanecem
 *  6. Edita nota 1 (título, conteúdo, status, prioridade)
 *  7. Confirma edição persistida no banco
 */

import { prisma } from "../lib/prismaClient";
import {
  createUserNote,
  updateUserNote,
  deleteUserNote,
  listUserNotes,
} from "../lib/userNotesStore";
import { pgCreateLocalUser } from "../src/core/auth/pgStore";
import { hashPasswordSha256 } from "../lib/passwordHash";

jest.setTimeout(30000);

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

describe("Notas de usuário — criar 3, deletar 1, editar 1", () => {

  // ── Setup: cria usuário ─────────────────────────────────────────────────────
  beforeAll(async () => {
    const user = await pgCreateLocalUser({
      name: `Usuário Notas ${UID}`,
      email: `notas-${UID}@notas-test.local`,
      password_hash: PASSWORD,
      role: "user",
      is_global_admin: false,
      status: "active",
    });
    userId = user.id;
  }, 20000);

  // ── 1. Criar nota 1 ────────────────────────────────────────────────────────
  it("cria nota 1 — rascunho, prioridade baixa", async () => {
    const nota = await createUserNote(userId, {
      title: `Nota Um ${UID}`,
      content: "Conteúdo da primeira nota de teste do usuário.",
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
    console.log(`\n✅ Nota 1 criada: "${nota!.title}" | status=${nota!.status} | id=${nota!.id}`);
  });

  // ── 2. Criar nota 2 ────────────────────────────────────────────────────────
  it("cria nota 2 — em andamento, prioridade alta, com tags", async () => {
    const nota = await createUserNote(userId, {
      title: `Nota Dois ${UID}`,
      content: "Conteúdo da segunda nota, em andamento com alta prioridade.",
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
    console.log(`\n✅ Nota 2 criada: "${nota!.title}" | status=${nota!.status} | tags=[${nota!.tags.join(", ")}]`);
  });

  // ── 3. Criar nota 3 ────────────────────────────────────────────────────────
  it("cria nota 3 — urgente, cor sky", async () => {
    const nota = await createUserNote(userId, {
      title: `Nota Três ${UID}`,
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
    console.log(`\n✅ Nota 3 criada: "${nota!.title}" | priority=${nota!.priority} | color=${nota!.color}`);
  });

  // ── Confirma que as 3 notas existem ────────────────────────────────────────
  it("confirma que as 3 notas foram criadas para o usuário", async () => {
    const notas = await listUserNotes(userId);
    const ids = notas.map((n) => n.id);

    expect(ids).toContain(nota1Id);
    expect(ids).toContain(nota2Id);
    expect(ids).toContain(nota3Id);
    expect(notas.length).toBeGreaterThanOrEqual(3);

    console.log(`\n✅ ${notas.length} notas listadas para o usuário`);
  });

  // ── 4. Deletar nota 2 ──────────────────────────────────────────────────────
  it("deleta a nota 2", async () => {
    const resultado = await deleteUserNote(userId, nota2Id);

    expect(resultado).toBe(true);

    const row = await prisma.userNote.findUnique({ where: { id: nota2Id } });
    expect(row).toBeNull();

    console.log(`\n✅ Nota 2 deletada | id=${nota2Id}`);
  });

  // ── 5. Confirma que notas 1 e 3 permanecem ────────────────────────────────
  it("confirma que nota 1 e nota 3 permanecem após deletar nota 2", async () => {
    const notas = await listUserNotes(userId);
    const ids = notas.map((n) => n.id);

    expect(ids).toContain(nota1Id);
    expect(ids).toContain(nota3Id);
    expect(ids).not.toContain(nota2Id);

    console.log(`\n✅ Nota 2 ausente | Notas restantes: ${notas.length}`);
  });

  // ── 6. Editar nota 1 ───────────────────────────────────────────────────────
  it("edita nota 1 — altera título, conteúdo, status e prioridade", async () => {
    const updated = await updateUserNote(userId, nota1Id, {
      title: `Nota Um Editada ${UID}`,
      content: "Conteúdo atualizado com informações mais detalhadas sobre o item.",
      status: "Concluido",
      priority: "Media",
      color: "emerald",
      tags: ["editado", "concluido"],
    });

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe(`Nota Um Editada ${UID}`);
    expect(updated!.content).toBe("Conteúdo atualizado com informações mais detalhadas sobre o item.");
    expect(updated!.status).toBe("Concluido");
    expect(updated!.priority).toBe("Media");
    expect(updated!.color).toBe("emerald");
    expect(updated!.tags).toContain("editado");

    console.log(`\n✅ Nota 1 editada: "${updated!.title}" | status=${updated!.status} | priority=${updated!.priority}`);
  });

  // ── 7. Confirma persistência da edição no banco ────────────────────────────
  it("confirma que a edição da nota 1 foi persistida no banco", async () => {
    const row = await prisma.userNote.findUnique({ where: { id: nota1Id } });

    expect(row).not.toBeNull();
    expect(row!.title).toBe(`Nota Um Editada ${UID}`);
    expect(row!.status).toBe("Concluido");
    expect(row!.priority).toBe("Media");
    expect(row!.color).toBe("emerald");

    console.log(`\n✅ Persistência confirmada: title="${row!.title}" | status=${row!.status}`);
  });
});
