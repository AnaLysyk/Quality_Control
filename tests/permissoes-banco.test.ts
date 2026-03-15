/**
 * Testes: Tabela user_permission_overrides no banco de dados
 *
 * Valida que as operações de override de permissões (allow/deny)
 * são persistidas e lidas corretamente da tabela user_permission_overrides.
 *
 * Cenários:
 *  1. Criar override (allow) para usuário → persistido no banco
 *  2. Criar override (deny) para usuário → persistido no banco
 *  3. Atualizar override existente via upsert → não duplica linha
 *  4. Deletar override → linha removida do banco
 *  5. Usuário sem override → getUserOverride retorna null
 *  6. listUserOverrides retorna todos os overrides cadastrados
 *  7. Allow + Deny na mesma linha → effectivePermissions aplica ambos
 *  8. updatedBy gravado corretamente
 *  9. Override persiste após leitura independente (isolamento)
 * 10. Deletar override → usuário volta às permissões padrão do perfil
 */

jest.setTimeout(30000);

// Suprimir import server-only
jest.mock("server-only", () => ({}));
jest.mock("../lib/redis", () => ({
  isRedisConfigured: jest.fn(() => false),
  getRedis: jest.fn(() => ({ get: jest.fn().mockResolvedValue(null) })),
}));

import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";

import { getUserOverride, setUserOverride, deleteUserOverride, listUserOverrides, effectivePermissions } from "../src/lib/store/permissionsStore";
import { hasPermissionAccess } from "../lib/permissionMatrix";
import { createLocalUser } from "../src/core/auth/localStore";

// Forçar uso do Postgres para estes testes
process.env.AUTH_STORE = "postgres";

const prisma = new PrismaClient();

// ── Cleanup ───────────────────────────────────────────────────────────────────
const createdUserIds: string[] = [];

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.userPermissionOverride.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
}, 30000);

// ── Helper ─────────────────────────────────────────────────────────────────────
function uid() {
  return randomUUID().slice(0, 8);
}

async function makeUser(tag: string) {
  const u = await createLocalUser({
    name: `Override Test ${tag}`,
    email: `override.${tag}@perm-override.local`,
    user: `override.${tag}`,
    password_hash: "hash-test",
    active: true,
    role: "user",
  });
  createdUserIds.push(u.id);
  return u;
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe("Tabela user_permission_overrides — gestão de permissões via DB", () => {

  test("1. Criar override allow → persistido no banco", async () => {
    const user = await makeUser(`allow-${uid()}`);

    await setUserOverride(user.id, { allow: { releases: ["view", "create"] } });

    const row = await prisma.userPermissionOverride.findUnique({ where: { userId: user.id } });
    expect(row).not.toBeNull();
    expect(row?.allow).toMatchObject({ releases: expect.arrayContaining(["view", "create"]) });

    const override = await getUserOverride(user.id);
    expect(override?.allow?.releases).toEqual(expect.arrayContaining(["view", "create"]));

    console.log(`✅ 1. allow persistido | userId=${user.id} | releases.allow=${JSON.stringify(override?.allow?.releases)}`);
  });

  test("2. Criar override deny → persistido no banco", async () => {
    const user = await makeUser(`deny-${uid()}`);

    await setUserOverride(user.id, { deny: { audit: ["view", "export"] } });

    const row = await prisma.userPermissionOverride.findUnique({ where: { userId: user.id } });
    expect(row).not.toBeNull();
    expect(row?.deny).toMatchObject({ audit: expect.arrayContaining(["view", "export"]) });

    const override = await getUserOverride(user.id);
    expect(override?.deny?.audit).toEqual(expect.arrayContaining(["view", "export"]));

    console.log(`✅ 2. deny persistido | userId=${user.id} | audit.deny=${JSON.stringify(override?.deny?.audit)}`);
  });

  test("3. Atualizar override via upsert → sem duplicação de linha", async () => {
    const user = await makeUser(`upsert-${uid()}`);

    await setUserOverride(user.id, { allow: { releases: ["view"] } });
    await setUserOverride(user.id, { allow: { releases: ["view", "create", "edit"] } });

    const count = await prisma.userPermissionOverride.count({ where: { userId: user.id } });
    expect(count).toBe(1);

    const override = await getUserOverride(user.id);
    expect(override?.allow?.releases).toEqual(expect.arrayContaining(["view", "create", "edit"]));

    console.log(`✅ 3. upsert sem duplicação | linhas=${count} | allow=${JSON.stringify(override?.allow?.releases)}`);
  });

  test("4. Deletar override → linha removida do banco", async () => {
    const user = await makeUser(`delete-${uid()}`);

    await setUserOverride(user.id, { allow: { runs: ["view"] } });
    const before = await prisma.userPermissionOverride.findUnique({ where: { userId: user.id } });
    expect(before).not.toBeNull();

    await deleteUserOverride(user.id);

    const after = await prisma.userPermissionOverride.findUnique({ where: { userId: user.id } });
    expect(after).toBeNull();

    const override = await getUserOverride(user.id);
    expect(override).toBeNull();

    console.log(`✅ 4. override deletado | userId=${user.id} | after=${after}`);
  });

  test("5. Usuário sem override → getUserOverride retorna null", async () => {
    const user = await makeUser(`nooverride-${uid()}`);

    const override = await getUserOverride(user.id);
    expect(override).toBeNull();

    console.log(`✅ 5. usuário sem override → null | userId=${user.id}`);
  });

  test("6. listUserOverrides retorna todos os overrides cadastrados", async () => {
    const userA = await makeUser(`list-a-${uid()}`);
    const userB = await makeUser(`list-b-${uid()}`);

    await setUserOverride(userA.id, { allow: { notes: ["edit"] } });
    await setUserOverride(userB.id, { deny: { tickets: ["delete"] } });

    const all = await listUserOverrides();
    const ids = all.map((o) => o.userId);
    expect(ids).toContain(userA.id);
    expect(ids).toContain(userB.id);

    console.log(`✅ 6. listUserOverrides retornou ${all.length} overrides (inclui userA e userB)`);
  });

  test("7. Allow + Deny na mesma linha → effectivePermissions aplica ambos", async () => {
    const user = await makeUser(`mixed-${uid()}`);

    // Para perfil 'admin': releases já tem create/edit/delete
    // Vamos vetar delete e adicionar releases.export (não existe por padrão em nenhum perfil)
    await setUserOverride(user.id, {
      allow: { releases: ["export"] },
      deny: { releases: ["delete"] },
    });

    const override = await getUserOverride(user.id);
    expect(override).not.toBeNull();

    const effective = effectivePermissions("admin", override!);
    const releaseActions = Array.from(effective["releases"] ?? new Set());

    expect(releaseActions).toContain("view");
    expect(releaseActions).toContain("create");
    expect(releaseActions).toContain("edit");
    expect(releaseActions).toContain("export");     // adicionado via allow
    expect(releaseActions).not.toContain("delete"); // removido via deny

    console.log(`✅ 7. allow+deny aplicados | releases=${releaseActions.join(",")}`);
  });

  test("8. updatedBy gravado corretamente na tabela", async () => {
    const user = await makeUser(`updby-${uid()}`);
    const adminId = "admin-teste-123";

    await setUserOverride(user.id, { allow: { audit: ["view"] }, updatedBy: adminId });

    const row = await prisma.userPermissionOverride.findUnique({ where: { userId: user.id } });
    expect(row?.updatedBy).toBe(adminId);

    const override = await getUserOverride(user.id);
    expect(override?.updatedBy).toBe(adminId);

    console.log(`✅ 8. updatedBy gravado | updatedBy=${row?.updatedBy}`);
  });

  test("9. Override mantém isolamento — outro usuário não é afetado", async () => {
    const userA = await makeUser(`iso-a-${uid()}`);
    const userB = await makeUser(`iso-b-${uid()}`);

    await setUserOverride(userA.id, { deny: { runs: ["view"] } });

    const overrideA = await getUserOverride(userA.id);
    const overrideB = await getUserOverride(userB.id);

    expect(overrideA?.deny?.runs).toEqual(expect.arrayContaining(["view"]));
    expect(overrideB).toBeNull(); // userB não deve ser afetado

    console.log(`✅ 9. isolamento confirmado | userA.deny.runs=${JSON.stringify(overrideA?.deny?.runs)} | userB=${overrideB}`);
  });

  test("10. Após deletar override, usuário volta às permissões padrão do perfil", async () => {
    const user = await makeUser(`reset-${uid()}`);

    // Perfil 'user' não tem releases.view por padrão
    // Adicionamos via allow, depois deletamos → deve voltar a não ter
    await setUserOverride(user.id, { allow: { releases: ["view"] } });

    const withOverride = await getUserOverride(user.id);
    const effectiveWith = effectivePermissions("user", withOverride!);
    expect(Array.from(effectiveWith["releases"] ?? new Set())).toContain("view");

    await deleteUserOverride(user.id);

    const afterDelete = await getUserOverride(user.id);
    const effectiveWithout = effectivePermissions("user", afterDelete ?? undefined);
    expect(Array.from(effectiveWithout["releases"] ?? new Set())).not.toContain("view");

    // Verifica que hasPermissionAccess retorna false com objeto de permissões normalizado
    const normalized: Record<string, string[]> = Object.fromEntries(
      Object.entries(effectiveWithout).map(([mod, acts]) => [mod, Array.from(acts)])
    );
    expect(hasPermissionAccess(normalized, "releases", "view")).toBe(false);

    console.log(`✅ 10. após delete, releases.view=${hasPermissionAccess(normalized,"releases","view")} (padrão perfil 'user')`);
  });
});
