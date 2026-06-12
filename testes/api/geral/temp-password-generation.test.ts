/**
 * Testa a geração e validação de senhas temporárias para novos usuários.
 *
 * Cobre:
 * - Formato e unicidade da senha gerada
 * - Compatibilidade com o hash SHA-256 armazenado
 * - Integração de criação de usuário com senha temporária persistida e verificável
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prismaClient";
import { pgCreateLocalUser } from "@/lib/core/auth/pgStore";
import { generateTempPassword, hashPasswordSha256, safeEqualHex } from "@/lib/passwordHash";

const describePg = process.env.DATABASE_URL ? describe : describe.skip;

const createdUserIds: string[] = [];
const uid = randomUUID().slice(0, 8);

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.membership.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

describe("generateTempPassword()", () => {
  it("retorna string com comprimento correto", () => {
    const pwd = generateTempPassword();
    expect(pwd).toHaveLength(12);
  });

  it("contém apenas caracteres permitidos (sem 0, O, 1, l, I)", () => {
    const forbidden = /[0O1lI]/;
    for (let i = 0; i < 50; i++) {
      expect(forbidden.test(generateTempPassword())).toBe(false);
    }
  });

  it("gera senhas únicas a cada chamada", () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generateTempPassword()));
    expect(passwords.size).toBe(20);
  });

  it("tem ao menos 8 caracteres (valida requisito mínimo do sistema)", () => {
    expect(generateTempPassword().length).toBeGreaterThanOrEqual(8);
  });
});

describePg("Criação de usuário com senha temporária", () => {
  it("armazena hash correto e permite verificar a senha plain-text posteriormente", async () => {
    const tempPassword = generateTempPassword();
    const passwordHash = hashPasswordSha256(tempPassword);

    const user = await pgCreateLocalUser({
      name: "Temp Pwd User",
      email: `temp-pwd-${uid}@test.local`,
      password_hash: passwordHash,
    });
    createdUserIds.push(user.id);

    const row = await prisma.user.findUnique({ where: { id: user.id } });
    expect(row).not.toBeNull();

    // O hash armazenado deve bater com a senha temporária original
    expect(safeEqualHex(row!.password_hash, hashPasswordSha256(tempPassword))).toBe(true);

    // Não deve bater com outra senha qualquer
    expect(safeEqualHex(row!.password_hash, hashPasswordSha256("outra-senha"))).toBe(false);
  });

  it("hash de senha diferente não autentica com a senha temporária", () => {
    const tempPassword = generateTempPassword();
    const otherHash = hashPasswordSha256("senha-errada");
    expect(safeEqualHex(otherHash, hashPasswordSha256(tempPassword))).toBe(false);
  });
});
