/**
 * Testes: Gestão de permissões
 *
 * Verifica que todas as permissões SÃO BLOQUEADAS quando não estão ativas no perfil.
 *
 * Seções:
 *  A) Perfil 'user' (viewer) — permissões ausentes verificadas
 *  B) Perfil 'company' (company_admin) — permissões ausentes verificadas
 *  C) Perfil 'support' — módulos completamente ausentes
 *  D) Overrides de permissão (deny / allow)
 *  E) Mapeamento de role (resolvePermissionRoleForUser)
 *  F) Integração DB — resolvePermissionAccessForUser com usuários reais
 */

jest.setTimeout(30000);

// Mock redis para evitar erros de conexão nos testes
jest.mock("../lib/redis", () => ({
  isRedisConfigured: jest.fn(() => false),
  getRedis: jest.fn(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
  })),
}));

import { randomUUID } from "crypto";
import { prisma } from "../lib/prismaClient";
import { resolveRoleDefaults } from "../lib/permissions/roleDefaults";
import { effectivePermissions } from "../lib/store/permissionsStore";
import {
  hasPermissionAccess,
  applyPermissionOverride,
  toVisibilityMap,
  getTicketViewScope,
} from "../lib/permissionMatrix";
import { resolvePermissionRoleForUser } from "../lib/adminUsers";
import { resolvePermissionAccessForUser } from "../lib/serverPermissionAccess";
import {
  createLocalUser,
  createLocalCompany,
  upsertLocalLink,
} from "../lib/core/auth/localStore";

// ── Helper: retorna a matriz de permissões padrão para um perfil ───────────
function perm(role: string): Record<string, string[]> {
  return resolveRoleDefaults(role);
}

// ── Cleanup state ─────────────────────────────────────────────────────────────
const createdUserIds: string[] = [];
const createdCompanyIds: string[] = [];

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.membership.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  if (createdCompanyIds.length) {
    await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
  }
  await prisma.$disconnect();
}, 30000);

// ─────────────────────────────────────────────────────────────────────────────
// A) Perfil 'user' (viewer) — permissões ausentes
// ─────────────────────────────────────────────────────────────────────────────

describe("A) Perfil 'user' (viewer) — permissões bloqueadas", () => {
  const p = perm("testing_company_user");

  test("A1. releases: view/create/edit/delete todos bloqueados", () => {
    expect(hasPermissionAccess(p, "releases", "view")).toBe(false);
    expect(hasPermissionAccess(p, "releases", "create")).toBe(false);
    expect(hasPermissionAccess(p, "releases", "edit")).toBe(false);
    expect(hasPermissionAccess(p, "releases", "delete")).toBe(false);
    console.log("✅ A1. user: releases totalmente bloqueado");
  });

  test("A2. runs: view/create/edit/delete/export todos bloqueados", () => {
    expect(hasPermissionAccess(p, "runs", "view")).toBe(false);
    expect(hasPermissionAccess(p, "runs", "create")).toBe(false);
    expect(hasPermissionAccess(p, "runs", "edit")).toBe(false);
    expect(hasPermissionAccess(p, "runs", "delete")).toBe(false);
    expect(hasPermissionAccess(p, "runs", "export")).toBe(false);
    console.log("✅ A2. user: runs totalmente bloqueado");
  });

  test("A3. defects: view/create/edit/delete todos bloqueados", () => {
    expect(hasPermissionAccess(p, "defects", "view")).toBe(false);
    expect(hasPermissionAccess(p, "defects", "create")).toBe(false);
    expect(hasPermissionAccess(p, "defects", "edit")).toBe(false);
    expect(hasPermissionAccess(p, "defects", "delete")).toBe(false);
    console.log("✅ A3. user: defects totalmente bloqueado");
  });

  test("A4. users: view/create/edit/delete todos bloqueados", () => {
    expect(hasPermissionAccess(p, "users", "view")).toBe(false);
    expect(hasPermissionAccess(p, "users", "create")).toBe(false);
    expect(hasPermissionAccess(p, "users", "edit")).toBe(false);
    expect(hasPermissionAccess(p, "users", "delete")).toBe(false);
    console.log("✅ A4. user: users totalmente bloqueado");
  });

  test("A5. permissions: view/edit/reset/clone todos bloqueados", () => {
    expect(hasPermissionAccess(p, "permissions", "view")).toBe(false);
    expect(hasPermissionAccess(p, "permissions", "edit")).toBe(false);
    expect(hasPermissionAccess(p, "permissions", "reset")).toBe(false);
    expect(hasPermissionAccess(p, "permissions", "clone")).toBe(false);
    console.log("✅ A5. user: permissions totalmente bloqueado");
  });

  test("A6. audit: view/export bloqueados", () => {
    expect(hasPermissionAccess(p, "audit", "view")).toBe(false);
    expect(hasPermissionAccess(p, "audit", "export")).toBe(false);
    console.log("✅ A6. user: audit totalmente bloqueado");
  });

  test("A7. access_requests: view bloqueado", () => {
    expect(hasPermissionAccess(p, "access_requests", "view")).toBe(false);
    console.log("✅ A7. user: access_requests bloqueado");
  });

  test("A8. tickets: ações privilegiadas bloqueadas (edit/delete/assign/status/view_all/view_company)", () => {
    // O que é permitido para user
    expect(hasPermissionAccess(p, "tickets", "view")).toBe(true);
    expect(hasPermissionAccess(p, "tickets", "create")).toBe(true);
    expect(hasPermissionAccess(p, "tickets", "comment")).toBe(true);
    expect(hasPermissionAccess(p, "tickets", "view_own")).toBe(true);
    // O que NÃO é permitido
    expect(hasPermissionAccess(p, "tickets", "edit")).toBe(false);
    expect(hasPermissionAccess(p, "tickets", "delete")).toBe(false);
    expect(hasPermissionAccess(p, "tickets", "assign")).toBe(false);
    expect(hasPermissionAccess(p, "tickets", "status")).toBe(false);
    expect(hasPermissionAccess(p, "tickets", "view_all")).toBe(false);
    expect(hasPermissionAccess(p, "tickets", "view_company")).toBe(false);
    console.log("✅ A8. user: tickets restrito a view/create/comment/view_own");
  });

  test("A9. notes: edit/delete bloqueados (view/create permitidos)", () => {
    expect(hasPermissionAccess(p, "notes", "view")).toBe(true);
    expect(hasPermissionAccess(p, "notes", "create")).toBe(true);
    expect(hasPermissionAccess(p, "notes", "edit")).toBe(false);
    expect(hasPermissionAccess(p, "notes", "delete")).toBe(false);
    console.log("✅ A9. user: notes somente view/create (edit/delete bloqueados)");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B) Perfil 'company' (company_admin) — permissões ausentes
// ─────────────────────────────────────────────────────────────────────────────

describe("B) Perfil 'company' (company_admin) — permissões bloqueadas", () => {
  const p = perm("empresa");

  test("B1. users: view/create/edit/delete todos bloqueados", () => {
    expect(hasPermissionAccess(p, "users", "view")).toBe(false);
    expect(hasPermissionAccess(p, "users", "create")).toBe(false);
    expect(hasPermissionAccess(p, "users", "edit")).toBe(false);
    expect(hasPermissionAccess(p, "users", "delete")).toBe(false);
    console.log("✅ B1. company: users totalmente bloqueado");
  });

  test("B2. permissions: view/edit/reset/clone todos bloqueados", () => {
    expect(hasPermissionAccess(p, "permissions", "view")).toBe(false);
    expect(hasPermissionAccess(p, "permissions", "edit")).toBe(false);
    expect(hasPermissionAccess(p, "permissions", "reset")).toBe(false);
    expect(hasPermissionAccess(p, "permissions", "clone")).toBe(false);
    console.log("✅ B2. company: permissions totalmente bloqueado");
  });

  test("B3. access_requests: view/comment/approve/reject todos bloqueados", () => {
    expect(hasPermissionAccess(p, "access_requests", "view")).toBe(false);
    expect(hasPermissionAccess(p, "access_requests", "comment")).toBe(false);
    expect(hasPermissionAccess(p, "access_requests", "approve")).toBe(false);
    expect(hasPermissionAccess(p, "access_requests", "reject")).toBe(false);
    console.log("✅ B3. company: access_requests totalmente bloqueado");
  });

  test("B4. audit: view/export bloqueados", () => {
    expect(hasPermissionAccess(p, "audit", "view")).toBe(false);
    expect(hasPermissionAccess(p, "audit", "export")).toBe(false);
    console.log("✅ B4. company: audit totalmente bloqueado");
  });

  test("B5. releases: apenas view (create/edit/delete bloqueados)", () => {
    expect(hasPermissionAccess(p, "releases", "view")).toBe(true);
    expect(hasPermissionAccess(p, "releases", "create")).toBe(false);
    expect(hasPermissionAccess(p, "releases", "edit")).toBe(false);
    expect(hasPermissionAccess(p, "releases", "delete")).toBe(false);
    console.log("✅ B5. company: releases somente view (sem escrita)");
  });

  test("B6. runs: apenas view (create/edit/delete/export bloqueados)", () => {
    expect(hasPermissionAccess(p, "runs", "view")).toBe(true);
    expect(hasPermissionAccess(p, "runs", "create")).toBe(false);
    expect(hasPermissionAccess(p, "runs", "edit")).toBe(false);
    expect(hasPermissionAccess(p, "runs", "delete")).toBe(false);
    expect(hasPermissionAccess(p, "runs", "export")).toBe(false);
    console.log("✅ B6. company: runs somente view (sem escrita/export)");
  });

  test("B7. defects: apenas view (create/edit/delete bloqueados)", () => {
    expect(hasPermissionAccess(p, "defects", "view")).toBe(true);
    expect(hasPermissionAccess(p, "defects", "create")).toBe(false);
    expect(hasPermissionAccess(p, "defects", "edit")).toBe(false);
    expect(hasPermissionAccess(p, "defects", "delete")).toBe(false);
    console.log("✅ B7. company: defects somente view (sem escrita)");
  });

  test("B8. applications: delete/export bloqueados (view/create/edit permitidos)", () => {
    expect(hasPermissionAccess(p, "applications", "view")).toBe(true);
    expect(hasPermissionAccess(p, "applications", "create")).toBe(true);
    expect(hasPermissionAccess(p, "applications", "edit")).toBe(true);
    expect(hasPermissionAccess(p, "applications", "delete")).toBe(false);
    expect(hasPermissionAccess(p, "applications", "export")).toBe(false);
    console.log("✅ B8. company: applications sem delete/export");
  });

  test("B9. tickets: ações privilegiadas bloqueadas (edit/delete/assign/status/view_all/view_company)", () => {
    expect(hasPermissionAccess(p, "tickets", "view")).toBe(true);
    expect(hasPermissionAccess(p, "tickets", "create")).toBe(true);
    expect(hasPermissionAccess(p, "tickets", "comment")).toBe(true);
    expect(hasPermissionAccess(p, "tickets", "view_own")).toBe(true);
    expect(hasPermissionAccess(p, "tickets", "edit")).toBe(false);
    expect(hasPermissionAccess(p, "tickets", "delete")).toBe(false);
    expect(hasPermissionAccess(p, "tickets", "assign")).toBe(false);
    expect(hasPermissionAccess(p, "tickets", "status")).toBe(false);
    expect(hasPermissionAccess(p, "tickets", "view_all")).toBe(false);
    expect(hasPermissionAccess(p, "tickets", "view_company")).toBe(false);
    console.log("✅ B9. company: tickets sem assign/status/delete/edit/view_all/view_company");
  });

  test("B10. notes: edit/delete bloqueados (view/create permitidos)", () => {
    expect(hasPermissionAccess(p, "notes", "view")).toBe(true);
    expect(hasPermissionAccess(p, "notes", "create")).toBe(true);
    expect(hasPermissionAccess(p, "notes", "edit")).toBe(false);
    expect(hasPermissionAccess(p, "notes", "delete")).toBe(false);
    console.log("✅ B10. company: notes somente view/create (sem edit/delete)");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C) Perfil 'support' — módulos completamente ausentes
// ─────────────────────────────────────────────────────────────────────────────

describe("C) Perfil 'support' — módulos ausentes verificados", () => {
  const p = perm("technical_support");

  test("C1. applications: view bloqueado (módulo ausente)", () => {
    expect(hasPermissionAccess(p, "applications", "view")).toBe(false);
    expect(hasPermissionAccess(p, "applications", "create")).toBe(false);
    console.log("✅ C1. support: módulo applications ausente");
  });

  test("C2. releases: view bloqueado (módulo ausente)", () => {
    expect(hasPermissionAccess(p, "releases", "view")).toBe(false);
    expect(hasPermissionAccess(p, "releases", "create")).toBe(false);
    console.log("✅ C2. support: módulo releases ausente");
  });

  test("C3. runs: view bloqueado (módulo ausente)", () => {
    expect(hasPermissionAccess(p, "runs", "view")).toBe(false);
    expect(hasPermissionAccess(p, "runs", "create")).toBe(false);
    console.log("✅ C3. support: módulo runs ausente");
  });

  test("C4. defects: view bloqueado (módulo ausente)", () => {
    expect(hasPermissionAccess(p, "defects", "view")).toBe(false);
    console.log("✅ C4. support: módulo defects ausente");
  });

  test("C5. notes: view bloqueado (módulo ausente)", () => {
    expect(hasPermissionAccess(p, "notes", "view")).toBe(false);
    console.log("✅ C5. support: módulo notes ausente");
  });

  test("C6. settings: view bloqueado (módulo ausente)", () => {
    expect(hasPermissionAccess(p, "settings", "view")).toBe(false);
    expect(hasPermissionAccess(p, "settings", "edit")).toBe(false);
    console.log("✅ C6. support: módulo settings ausente");
  });

  test("C7. audit: view bloqueado (módulo ausente)", () => {
    expect(hasPermissionAccess(p, "audit", "view")).toBe(false);
    console.log("✅ C7. support: módulo audit ausente");
  });

  test("C8. permissions: edit bloqueado (módulo ausente)", () => {
    expect(hasPermissionAccess(p, "permissions", "view")).toBe(false);
    expect(hasPermissionAccess(p, "permissions", "edit")).toBe(false);
    console.log("✅ C8. support: módulo permissions ausente");
  });

  test("C9. support possui tickets/suporte com permissões corretas", () => {
    // O que support DEVE ter
    expect(hasPermissionAccess(p, "tickets", "view")).toBe(true);
    expect(hasPermissionAccess(p, "tickets", "assign")).toBe(true);
    expect(hasPermissionAccess(p, "tickets", "status")).toBe(true);
    expect(hasPermissionAccess(p, "support", "assign")).toBe(true);
    expect(hasPermissionAccess(p, "support", "status")).toBe(true);
    // O que support NÃO deve ter em tickets
    expect(hasPermissionAccess(p, "tickets", "view_all")).toBe(false);
    expect(hasPermissionAccess(p, "tickets", "delete")).toBe(false);
    console.log("✅ C9. support: tickets/suporte com escopo correto");
  });

  test("C10. support nao administra access_requests", () => {
    expect(hasPermissionAccess(p, "access_requests", "view")).toBe(false);
    expect(hasPermissionAccess(p, "access_requests", "comment")).toBe(false);
    expect(hasPermissionAccess(p, "access_requests", "approve")).toBe(false);
    expect(hasPermissionAccess(p, "access_requests", "reject")).toBe(false);
    console.log("C10. support: access_requests bloqueado para revisao institucional");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D) Overrides de permissão (deny / allow)
// ─────────────────────────────────────────────────────────────────────────────

describe("D) Overrides de permissão (deny/allow)", () => {
  test("D1. effectivePermissions com deny remove ação disponível do leader_tc", () => {
    const override = { userId: "test", deny: { users: ["edit"] } };
    const effective = effectivePermissions("leader_tc", override);
    const userActions = Array.from(effective["users"] ?? new Set());
    expect(userActions).not.toContain("edit");
    expect(userActions).toContain("view"); // view deve continuar
    console.log(`D1. leader_tc: users.edit removido via deny | restantes=${userActions.join(",")}`);
  });

  test("D2. effectivePermissions com allow adiciona ação ao 'user'", () => {
    const override = { userId: "test", allow: { releases: ["view"] } };
    const effective = effectivePermissions("testing_company_user", override);
    const releaseActions = Array.from(effective["releases"] ?? new Set());
    expect(releaseActions).toContain("view");
    console.log(`✅ D2. user: releases.view adicionado via allow`);
  });

  test("D3. deny não afeta outros módulos", () => {
    const override = { userId: "test", deny: { audit: ["view", "export"] } };
    const effective = effectivePermissions("leader_tc", override);
    // applications não deve ser afetado
    const appActions = Array.from(effective["applications"] ?? new Set());
    expect(appActions).toContain("view");
    expect(appActions).toContain("create");
    expect(appActions).toContain("edit");
    console.log(`✅ D3. deny em audit não afeta applications`);
  });

  test("D4. applyPermissionOverride: deny remove, allow adiciona na mesma chamada", () => {
    const baseDefaults = perm("empresa");
    const override = {
      allow: { releases: ["create"] },
      deny: { releases: ["view"] },
    };
    const result = applyPermissionOverride(baseDefaults, override);
    // view foi negado
    expect(hasPermissionAccess(result, "releases", "view")).toBe(false);
    // create foi permitido via allow
    expect(hasPermissionAccess(result, "releases", "create")).toBe(true);
    console.log(`✅ D4. applyPermissionOverride: releases.view negado + releases.create adicionado`);
  });

  test("D5. effectivePermissions múltiplos deny no mesmo módulo", () => {
    const override = {
      userId: "test",
      deny: { tickets: ["delete", "assign", "status"] },
    };
    const effective = effectivePermissions("technical_support", override);
    const ticketActions = Array.from(effective["tickets"] ?? new Set());
    expect(ticketActions).not.toContain("delete");
    expect(ticketActions).not.toContain("assign");
    expect(ticketActions).not.toContain("status");
    expect(ticketActions).toContain("view"); // view permanece
    expect(ticketActions).toContain("create"); // create permanece
    console.log(`D5. technical_support: tickets.delete/assign/status negados | restantes=${ticketActions.join(",")}`);
  });

  test("D6. toVisibilityMap retorna false para módulos sem view", () => {
    const userPerms = perm("testing_company_user");
    const visibility = toVisibilityMap(userPerms);
    expect(visibility["releases"]).toBe(false);
    expect(visibility["runs"]).toBe(false);
    expect(visibility["defects"]).toBe(false);
    expect(visibility["dashboard"]).toBe(true);
    expect(visibility["applications"]).toBe(true);
    console.log(`✅ D6. toVisibilityMap: user sem releases/runs/defects visíveis`);
  });

  test("D7. getTicketViewScope retorna 'own' para perfil user", () => {
    const userPerms = perm("testing_company_user");
    expect(getTicketViewScope(userPerms)).toBe("own");
    console.log(`✅ D7. getTicketViewScope: user → 'own'`);
  });

  test("D8. getTicketViewScope retorna 'company' para suporte tecnico", () => {
    const supportPerms = perm("technical_support");
    expect(getTicketViewScope(supportPerms)).toBe("company");
    console.log(`D8. getTicketViewScope: technical_support -> 'company'`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E) Mapeamento de role (resolvePermissionRoleForUser)
// ─────────────────────────────────────────────────────────────────────────────

describe("E) Mapeamento de role — resolvePermissionRoleForUser", () => {
  test("E1. Usuário viewer legado → permissionRole 'testing_company_user'", () => {
    const user = { globalRole: null, is_global_admin: false, role: null };
    const links = [{ role: "viewer" }];
    expect(resolvePermissionRoleForUser(user, links)).toBe("testing_company_user");
    console.log(`E1. viewer legado -> permissionRole='testing_company_user'`);
  });

  test("E2. Membership company_admin legado → permissionRole 'empresa'", () => {
    const user = { globalRole: null, is_global_admin: false, role: null };
    const links = [{ role: "company_admin" }];
    expect(resolvePermissionRoleForUser(user, links)).toBe("empresa");
    console.log(`E2. company_admin legado -> permissionRole='empresa'`);
  });

  test("E3. Membership it_dev legado → permissionRole 'technical_support'", () => {
    const user = { globalRole: null, is_global_admin: false, role: null };
    const links = [{ role: "it_dev" }];
    expect(resolvePermissionRoleForUser(user, links)).toBe("technical_support");
    console.log(`E3. it_dev legado -> permissionRole='technical_support'`);
  });

  test("E4. Usuário global_admin legado → permissionRole 'leader_tc'", () => {
    const user = { globalRole: "global_admin" as const, is_global_admin: true, role: null };
    const links: Array<{ role: string }> = [];
    expect(resolvePermissionRoleForUser(user, links)).toBe("leader_tc");
    console.log(`E4. global_admin legado -> permissionRole='leader_tc'`);
  });

  test("E5. Sem links e sem role → permissionRole 'testing_company_user'", () => {
    const user = { globalRole: null, is_global_admin: false, role: null };
    const links: Array<{ role: string }> = [];
    expect(resolvePermissionRoleForUser(user, links)).toBe("testing_company_user");
    console.log(`E5. sem links nem role -> permissionRole='testing_company_user'`);
  });

  test("E6. it_dev legado tem precedência sobre company_admin legado", () => {
    const user = { globalRole: null, is_global_admin: false, role: null };
    const links = [{ role: "company_admin" }, { role: "it_dev" }];
    expect(resolvePermissionRoleForUser(user, links)).toBe("technical_support");
    console.log(`E6. it_dev legado > company_admin legado -> permissionRole='technical_support'`);
  });

  test("E7. company_admin legado tem precedência sobre viewer legado", () => {
    const user = { globalRole: null, is_global_admin: false, role: null };
    const links = [{ role: "viewer" }, { role: "company_admin" }];
    expect(resolvePermissionRoleForUser(user, links)).toBe("empresa");
    console.log(`E7. company_admin legado > viewer legado -> permissionRole='empresa'`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F) Integração DB — resolvePermissionAccessForUser com usuários reais
// ─────────────────────────────────────────────────────────────────────────────

describe("F) Integração DB — resolvePermissionAccessForUser", () => {
  function uid() {
    return randomUUID().slice(0, 8);
  }

  async function makeUser(tag: string, extra?: Partial<{ role: string; globalRole: "global_admin" | null; is_global_admin: boolean }>) {
    const u = await createLocalUser({
      name: `Perm Test ${tag}`,
      email: `perm.${tag}@perm-test.local`,
      user: `perm.${tag}`,
      password_hash: "hash-test",
      active: true,
      role: extra?.role ?? "user",
      globalRole: extra?.globalRole ?? null,
      is_global_admin: extra?.is_global_admin ?? false,
    });
    createdUserIds.push(u.id);
    return u;
  }

  async function makeCompany(tag: string) {
    const c = await createLocalCompany({ name: `PermCo ${tag}`, slug: `permco-${tag}`, status: "active" });
    createdCompanyIds.push(c.id);
    return c;
  }

  test("F1. Usuário viewer → roleKey='user', releases/runs/defects bloqueados", async () => {
    const tag = uid();
    const user = await makeUser(`viewer-${tag}`);
    const company = await makeCompany(tag);
    await upsertLocalLink({ userId: user.id, companyId: company.id, role: "viewer" });

    const access = await resolvePermissionAccessForUser(user.id);

    expect(access.roleKey).toBe("testing_company_user");
    expect(hasPermissionAccess(access.permissions, "releases", "view")).toBe(false);
    expect(hasPermissionAccess(access.permissions, "runs", "view")).toBe(false);
    expect(hasPermissionAccess(access.permissions, "defects", "view")).toBe(false);
    expect(hasPermissionAccess(access.permissions, "users", "view")).toBe(false);
    expect(hasPermissionAccess(access.permissions, "audit", "view")).toBe(false);
    // Dashboard e applications permitidos
    expect(hasPermissionAccess(access.permissions, "dashboard", "view")).toBe(true);
    expect(hasPermissionAccess(access.permissions, "applications", "view")).toBe(true);

    console.log(`✅ F1. viewer (DB) → roleKey=${access.roleKey} | releases=${hasPermissionAccess(access.permissions,"releases","view")} | dashboard=${hasPermissionAccess(access.permissions,"dashboard","view")}`);
  });

  test("F2. Usuário company_admin → roleKey='company', users/permissions/audit bloqueados", async () => {
    const tag = uid();
    const user = await makeUser(`cadmin-${tag}`);
    const company = await makeCompany(`ca-${tag}`);
    await upsertLocalLink({ userId: user.id, companyId: company.id, role: "company_admin" });

    const access = await resolvePermissionAccessForUser(user.id);

    expect(access.roleKey).toBe("empresa");
    expect(hasPermissionAccess(access.permissions, "users", "view")).toBe(false);
    expect(hasPermissionAccess(access.permissions, "permissions", "edit")).toBe(false);
    expect(hasPermissionAccess(access.permissions, "audit", "view")).toBe(false);
    expect(hasPermissionAccess(access.permissions, "access_requests", "view")).toBe(false);
    // Tem releases view mas não create
    expect(hasPermissionAccess(access.permissions, "releases", "view")).toBe(true);
    expect(hasPermissionAccess(access.permissions, "releases", "create")).toBe(false);

    console.log(`✅ F2. company_admin (DB) → roleKey=${access.roleKey} | users=${hasPermissionAccess(access.permissions,"users","view")} | releases.view=${hasPermissionAccess(access.permissions,"releases","view")}`);
  });

  test("F3. Usuário it_dev → roleKey='technical_support', sem access_requests.approve", async () => {
    const tag = uid();
    const user = await makeUser(`itdev-${tag}`, { role: "it_dev" });
    const company = await makeCompany(`dev-${tag}`);
    await upsertLocalLink({ userId: user.id, companyId: company.id, role: "it_dev" });

    const access = await resolvePermissionAccessForUser(user.id);

    expect(access.roleKey).toBe("technical_support");
    expect(hasPermissionAccess(access.permissions, "releases", "delete")).toBe(false);
    expect(hasPermissionAccess(access.permissions, "runs", "export")).toBe(false);
    expect(hasPermissionAccess(access.permissions, "defects", "delete")).toBe(false);
    expect(hasPermissionAccess(access.permissions, "users", "view")).toBe(false);
    expect(hasPermissionAccess(access.permissions, "audit", "export")).toBe(false);
    expect(hasPermissionAccess(access.permissions, "access_requests", "approve")).toBe(false);
    expect(hasPermissionAccess(access.permissions, "access_requests", "reject")).toBe(false);

    console.log(`✅ F3. it_dev (DB) → roleKey=${access.roleKey} | audit.export=${hasPermissionAccess(access.permissions,"audit","export")} | access_requests.approve=${hasPermissionAccess(access.permissions,"access_requests","approve")}`);
  });

  test("F4. Usuário global_admin → roleKey='admin', permissões completas", async () => {
    const tag = uid();
    const user = await makeUser(`gadmin-${tag}`, { globalRole: "global_admin", is_global_admin: true });

    const access = await resolvePermissionAccessForUser(user.id);

    expect(access.roleKey).toBe("leader_tc");
    expect(hasPermissionAccess(access.permissions, "permissions", "reset")).toBe(true);
    expect(hasPermissionAccess(access.permissions, "permissions", "clone")).toBe(true);
    expect(hasPermissionAccess(access.permissions, "audit", "export")).toBe(false);
    expect(hasPermissionAccess(access.permissions, "users", "delete")).toBe(false);
    expect(hasPermissionAccess(access.permissions, "tickets", "view_all")).toBe(false);

    console.log(`✅ F4. global_admin (DB) → roleKey=${access.roleKey} | permissions.reset=${hasPermissionAccess(access.permissions,"permissions","reset")}`);
  });
});
