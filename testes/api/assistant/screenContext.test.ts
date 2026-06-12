import { normalizeSearch } from "@/lib/assistant/helpers";
import { resolveAssistantScreenContext } from "@/lib/assistant/screenContext";

describe("resolveAssistantScreenContext", () => {
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

  it("matches /meus-chamados as support module", () => {
    const ctx = resolveAssistantScreenContext("/meus-chamados");
    expect(ctx.module).toBe("support");
    expect(ctx.screenLabel).toBe("Meus chamados");
  });

  it("matches /admin/users/permissions as permissions module", () => {
    const ctx = resolveAssistantScreenContext("/admin/users/permissions");
    expect(ctx.module).toBe("permissions");
    expect(ctx.entityType).toBe("permission_profile");
  });

  it("matches /empresas/acme/planos-de-teste as test_plans module", () => {
    const ctx = resolveAssistantScreenContext("/empresas/acme/planos-de-teste");
    expect(ctx.module).toBe("test_plans");
    expect(ctx.entityType).toBe("test_plan");
    expect(ctx.companySlug).toBe("acme");
  });

  it("matches /empresas/acme as company module", () => {
    const ctx = resolveAssistantScreenContext("/empresas/acme");
    expect(ctx.module).toBe("company");
    expect(ctx.companySlug).toBe("acme");
    expect(ctx.entityType).toBe("company");
    expect(ctx.entityId).toBe("acme");
  });

  it("matches /admin as dashboard module", () => {
    const ctx = resolveAssistantScreenContext("/admin");
    expect(ctx.module).toBe("dashboard");
    expect(ctx.entityType).toBe("screen");
  });

  it("falls back to general for unknown routes", () => {
    const ctx = resolveAssistantScreenContext("/settings");
    expect(ctx.module).toBe("general");
    expect(ctx.screenLabel).toBe("Plataforma Quality Control");
  });

  it("handles empty string as root", () => {
    const ctx = resolveAssistantScreenContext("");
    expect(ctx.route).toBe("/");
    expect(ctx.module).toBe("general");
  });

  it("always returns suggested prompts", () => {
    const ctx = resolveAssistantScreenContext("/random");
    expect(Array.isArray(ctx.suggestedPrompts)).toBe(true);
    expect(ctx.suggestedPrompts.length).toBeGreaterThan(0);
  });

  it("keeps support above dashboard for /admin/support", () => {
    const ctx = resolveAssistantScreenContext("/admin/support");
    expect(ctx.module).toBe("support");
  });

  it("keeps permissions above dashboard for /admin/users/permissions", () => {
    const ctx = resolveAssistantScreenContext("/admin/users/permissions");
    expect(ctx.module).toBe("permissions");
  });

  it("keeps test_plans above company for /empresas/acme/planos-de-teste", () => {
    const ctx = resolveAssistantScreenContext("/empresas/acme/planos-de-teste");
    expect(ctx.module).toBe("test_plans");
  });

  it.each([
    ["/admin/support", "chamados", "dica:"],
    ["/meus-chamados", "seus chamados", "impacto"],
    ["/admin/users/permissions", "permissoes", "bloqueios"],
    ["/empresas/acme/planos-de-teste", "casos de teste", "ticket"],
    ["/empresas/acme", "empresa", "chamados"],
    ["/dashboard", "operacao", "destravar"],
    ["/unknown", "navega", "deseja fazer"],
  ])("keeps an action-oriented summary for %s", (route, keywordA, keywordB) => {
    const ctx = resolveAssistantScreenContext(route);
    const summary = normalizeSearch(ctx.screenSummary);

    expect(summary).toContain("voce esta em:");
    expect(summary).toContain(keywordA);
    expect(summary).toContain(keywordB);
    expect(ctx.suggestedPrompts.length).toBeGreaterThanOrEqual(3);
  });
});
