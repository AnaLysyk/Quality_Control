import { resolveAssistantScreenContext } from "@/lib/assistant/screenContext";

describe("resolveAssistantScreenContext", () => {
  /* ── Support module ── */

  it("matches /admin/support as support module", () => {
    const ctx = resolveAssistantScreenContext("/admin/support");
    expect(ctx.module).toBe("support");
    expect(ctx.screenLabel).toBe("Kanban global de suporte");
    expect(ctx.entityType).toBe("screen");
  });

  it("matches /kanban-it as support module", () => {
    const ctx = resolveAssistantScreenContext("/kanban-it");
    expect(ctx.module).toBe("support");
  });

  it("matches /admin/support/anything nested", () => {
    const ctx = resolveAssistantScreenContext("/admin/support/SP-123");
    expect(ctx.module).toBe("support");
  });

  /* ── Meus chamados ── */

  it("matches /meus-chamados as support module (meus chamados)", () => {
    const ctx = resolveAssistantScreenContext("/meus-chamados");
    expect(ctx.module).toBe("support");
    expect(ctx.screenLabel).toBe("Meus chamados");
  });

  it("matches /meus-chamados/123 nested", () => {
    const ctx = resolveAssistantScreenContext("/meus-chamados/123");
    expect(ctx.module).toBe("support");
  });

  /* ── Permissions ── */

  it("matches /admin/users/permissions as permissions module", () => {
    const ctx = resolveAssistantScreenContext("/admin/users/permissions");
    expect(ctx.module).toBe("permissions");
    expect(ctx.entityType).toBe("permission_profile");
  });

  it("matches /admin/users/permissions/some-id nested", () => {
    const ctx = resolveAssistantScreenContext("/admin/users/permissions/user-1");
    expect(ctx.module).toBe("permissions");
  });

  /* ── Test plans ── */

  it("matches /empresas/acme/planos-de-teste as test_plans module", () => {
    const ctx = resolveAssistantScreenContext("/empresas/acme/planos-de-teste");
    expect(ctx.module).toBe("test_plans");
    expect(ctx.entityType).toBe("test_plan");
    expect(ctx.companySlug).toBe("acme");
  });

  it("matches /planos-de-teste standalone", () => {
    const ctx = resolveAssistantScreenContext("/planos-de-teste");
    expect(ctx.module).toBe("test_plans");
  });

  /* ── Company ── */

  it("matches /empresas/acme as company module", () => {
    const ctx = resolveAssistantScreenContext("/empresas/acme");
    expect(ctx.module).toBe("company");
    expect(ctx.companySlug).toBe("acme");
    expect(ctx.entityType).toBe("company");
    expect(ctx.entityId).toBe("acme");
  });

  it("matches /admin/clients as company module", () => {
    const ctx = resolveAssistantScreenContext("/admin/clients");
    expect(ctx.module).toBe("company");
  });

  it("decodes URL-encoded company slugs", () => {
    const ctx = resolveAssistantScreenContext("/empresas/testing%20co/settings");
    expect(ctx.companySlug).toBe("testing co");
  });

  /* ── Dashboard ── */

  it("matches /admin as dashboard module", () => {
    const ctx = resolveAssistantScreenContext("/admin");
    expect(ctx.module).toBe("dashboard");
    expect(ctx.entityType).toBe("screen");
  });

  it("matches /dashboard as dashboard module", () => {
    const ctx = resolveAssistantScreenContext("/dashboard");
    expect(ctx.module).toBe("dashboard");
  });

  /* ── General (fallback) ── */

  it("falls back to general for unknown routes", () => {
    const ctx = resolveAssistantScreenContext("/settings");
    expect(ctx.module).toBe("general");
    expect(ctx.screenLabel).toBe("Plataforma Quality Control");
  });

  it("falls back to general for root /", () => {
    const ctx = resolveAssistantScreenContext("/");
    expect(ctx.module).toBe("general");
  });

  /* ── Edge cases ── */

  it("handles empty string as /", () => {
    const ctx = resolveAssistantScreenContext("");
    expect(ctx.route).toBe("/");
    expect(ctx.module).toBe("general");
  });

  it("always returns suggestedPrompts array", () => {
    const ctx = resolveAssistantScreenContext("/random");
    expect(Array.isArray(ctx.suggestedPrompts)).toBe(true);
    expect(ctx.suggestedPrompts.length).toBeGreaterThan(0);
  });

  /* ── Rule priority: earlier rule wins ── */

  it("support beats dashboard for /admin/support", () => {
    const ctx = resolveAssistantScreenContext("/admin/support");
    expect(ctx.module).toBe("support");
  });

  it("permissions beats dashboard for /admin/users/permissions", () => {
    const ctx = resolveAssistantScreenContext("/admin/users/permissions");
    expect(ctx.module).toBe("permissions");
  });

  it("test_plans beats company for /empresas/acme/planos-de-teste", () => {
    const ctx = resolveAssistantScreenContext("/empresas/acme/planos-de-teste");
    expect(ctx.module).toBe("test_plans");
  });
});
