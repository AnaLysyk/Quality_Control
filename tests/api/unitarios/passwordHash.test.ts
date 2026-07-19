import {
  hashPassword,
  hashPasswordSha256,
  passwordHashNeedsUpgrade,
  verifyPassword,
} from "@/backend/passwordHash";

describe("password hashing", () => {
  it("gera hashes scrypt salgados e valida somente a senha correta", () => {
    const first = hashPassword("SenhaSegura@2026");
    const second = hashPassword("SenhaSegura@2026");

    expect(first).toMatch(/^scrypt\$v1\$/);
    expect(second).toMatch(/^scrypt\$v1\$/);
    expect(first).not.toBe(second);
    expect(verifyPassword("SenhaSegura@2026", first)).toBe(true);
    expect(verifyPassword("senha-incorreta", first)).toBe(false);
    expect(passwordHashNeedsUpgrade(first)).toBe(false);
  });

  it("aceita SHA-256 legado apenas para migração no próximo login", () => {
    const legacy = hashPasswordSha256("SenhaLegada@2026");

    expect(verifyPassword("SenhaLegada@2026", legacy)).toBe(true);
    expect(verifyPassword("senha-incorreta", legacy)).toBe(false);
    expect(passwordHashNeedsUpgrade(legacy)).toBe(true);
  });

  it("falha fechado para hashes malformados ou adulterados", () => {
    const valid = hashPassword("SenhaSegura@2026");
    const tampered = `${valid.slice(0, -1)}${valid.endsWith("A") ? "B" : "A"}`;

    expect(verifyPassword("SenhaSegura@2026", tampered)).toBe(false);
    expect(verifyPassword("SenhaSegura@2026", "sha256$invalido")).toBe(false);
  });
});
