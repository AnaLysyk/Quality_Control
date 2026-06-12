import {
  canAccessGlobalSupportScope,
  canCommentSupportTickets,
  canCreateSupportTickets,
  canManageSupportWorkflow,
  canViewSupportBoard,
} from "@/lib/supportAccess";

describe("supportAccess", () => {
  it("libera a tela para perfil empresa mesmo sem matriz carregada", () => {
    const user = {
      role: "company",
      permissionRole: "company",
      companyRole: "company_admin",
      permissions: {},
    };

    expect(canViewSupportBoard(user)).toBe(true);
    expect(canCreateSupportTickets(user)).toBe(true);
    expect(canCommentSupportTickets(user)).toBe(true);
    expect(canAccessGlobalSupportScope(user)).toBe(false);
    expect(canManageSupportWorkflow(user)).toBe(false);
  });

  it("mantem lider tc no escopo proprio", () => {
    const user = {
      role: "user",
      permissionRole: "leader_tc",
      companyRole: "user",
      permissions: {},
    };

    expect(canViewSupportBoard(user)).toBe(true);
    expect(canAccessGlobalSupportScope(user)).toBe(false);
    expect(canManageSupportWorkflow(user)).toBe(false);
  });

  it("mantem suporte tecnico com escopo global do kanban", () => {
    const user = {
      role: "user",
      permissionRole: "technical_support",
      companyRole: "user",
      permissions: {},
    };

    expect(canViewSupportBoard(user)).toBe(true);
    expect(canCreateSupportTickets(user)).toBe(true);
    expect(canCommentSupportTickets(user)).toBe(true);
    expect(canAccessGlobalSupportScope(user)).toBe(true);
    expect(canManageSupportWorkflow(user)).toBe(true);
  });

  it("normaliza it_dev legado para suporte tecnico global", () => {
    const user = {
      role: "it_dev",
      permissionRole: "dev",
      companyRole: "it_dev",
      permissions: {},
    };

    expect(canViewSupportBoard(user)).toBe(true);
    expect(canCreateSupportTickets(user)).toBe(true);
    expect(canCommentSupportTickets(user)).toBe(true);
    expect(canAccessGlobalSupportScope(user)).toBe(true);
    expect(canManageSupportWorkflow(user)).toBe(true);
  });

  it("mantem admin fora do fluxo global de suporte", () => {
    const user = {
      role: "admin",
      permissionRole: "admin",
      companyRole: "user",
      permissions: {},
      isGlobalAdmin: true,
    };

    expect(canViewSupportBoard(user)).toBe(true);
    expect(canCreateSupportTickets(user)).toBe(true);
    expect(canCommentSupportTickets(user)).toBe(true);
    expect(canAccessGlobalSupportScope(user)).toBe(false);
    expect(canManageSupportWorkflow(user)).toBe(false);
  });
});
