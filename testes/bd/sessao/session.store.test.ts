// Mocks for dependencies (synchronous for Jest CommonJS environment)
jest.mock('../../../lib/redis', () => ({
  getRedis: jest.fn(),
}));
jest.mock('../../../lib/auth/localStore', () => ({
  getLocalUserById: jest.fn(),
  listLocalCompanies: jest.fn(),
  listLocalLinksForUser: jest.fn(),
  normalizeGlobalRole: jest.fn(),
  normalizeLocalRole: jest.fn(),
  toLegacyRole: jest.fn(),
}));
jest.mock('../../../lib/permissions', () => ({
  resolveCapabilities: jest.fn(),
}));
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));
jest.mock('@/database/prismaClient', () => ({
  prisma: {
    projectTeamAssignment: { findMany: jest.fn().mockResolvedValue([]) },
    project: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

// Import the module under test after setting up mocks
import * as sessionStore from '@/lib/auth/session';

// Import the mocked implementations for assertions
const { getRedis } = require("@/lib/redis");
const {
  getLocalUserById,
  listLocalCompanies,
  listLocalLinksForUser,
  normalizeGlobalRole,
  normalizeLocalRole,
  toLegacyRole,
} = require("@/lib/auth/localStore");
const { resolveCapabilities } = require("@/lib/permissions");
const jwt = require('jsonwebtoken');
const { prisma } = require('@/database/prismaClient');

describe('session.store', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.JWT_SECRET;
    delete process.env.E2E_USE_JSON;
    (prisma.projectTeamAssignment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.project.findMany as jest.Mock).mockResolvedValue([]);
  });

  test('getSessionPayload reads session from redis using session cookie', async () => {
    const payload = { userId: 'u1', email: 'u1@example.com' };
    const fakeRedis = { get: jest.fn().mockResolvedValue(JSON.stringify(payload)) };
    (getRedis as unknown as jest.Mock).mockReturnValue(fakeRedis);

    const req = { headers: { get: (name: string) => (name === 'cookie' ? 'session_id=abc' : null) } } as unknown as Request;
    const result = await sessionStore.getSessionPayload(req);
    expect(result).toEqual(payload);
    expect(fakeRedis.get).toHaveBeenCalledWith('session:abc');
  });

  test('getSessionPayload decodes JWT when JWT_SECRET present and Authorization header used', async () => {
    process.env.JWT_SECRET = 'sekrit';
    const tokenPayload = { userId: 'u2', email: 'u2@example.com', permissionRole: 'technical_support' };
    (jwt.verify as unknown as jest.Mock).mockReturnValue(tokenPayload);

    const req = { headers: { get: (name: string) => (name === 'authorization' ? 'Bearer token-xyz' : null) } } as unknown as Request;
    const result = await sessionStore.getSessionPayload(req);
    expect(result).toEqual({ userId: 'u2', email: 'u2@example.com', permissionRole: 'technical_support', isGlobalAdmin: false });
    expect(jwt.verify).toHaveBeenCalledWith('token-xyz', 'sekrit');
  });

  test('getAccessContext returns null if no session', async () => {
    const req = { headers: { get: () => null } } as unknown as Request;
    const result = await sessionStore.getAccessContext(req);
    expect(result).toBeNull();
  });

  test('getAccessContext returns AccessContext when user active and linked', async () => {
    // Prepare session payload returned from getSessionPayload by mocking read from redis
    const payload = { userId: 'u3', companyId: 'c1', companySlug: 'slug1', companyRole: 'company_admin' };
    const fakeRedis = { get: jest.fn().mockResolvedValue(JSON.stringify(payload)) };
    (getRedis as unknown as jest.Mock).mockReturnValue(fakeRedis);

    // Local user
    const localUser = { id: 'u3', email: 'u3@x.com', active: true, status: 'ok', default_company_slug: 'slug1', is_global_admin: false };
    (getLocalUserById as unknown as jest.Mock).mockResolvedValue(localUser);
    (listLocalLinksForUser as unknown as jest.Mock).mockResolvedValue([{ companyId: 'c1', role: 'company_admin', capabilities: ['a'] }]);
    (listLocalCompanies as unknown as jest.Mock).mockResolvedValue([{ id: 'c1', slug: 'slug1' }]);

    (normalizeGlobalRole as unknown as jest.Mock).mockReturnValue(null);
    (normalizeLocalRole as unknown as jest.Mock).mockReturnValue('company_admin');
    (resolveCapabilities as unknown as jest.Mock).mockReturnValue(['a']);
    (toLegacyRole as unknown as jest.Mock).mockReturnValue('admin');

    const req = { headers: { get: (name: string) => (name === 'cookie' ? 'session_id=xyz' : null) } } as unknown as Request;
    const ctx = await sessionStore.getAccessContext(req);
    expect(ctx).not.toBeNull();
    expect(ctx?.userId).toBe('u3');
    expect(ctx?.companyId).toBe('c1');
    expect(ctx?.isGlobalAdmin).toBe(false);
    expect(ctx?.companySlugs).toContain('slug1');
  });

  test('getAccessContext preserves suporte tecnico mesmo com empresa ativa vinculada', async () => {
    const payload = { userId: 'u4', companyId: 'c1', companySlug: 'slug1', companyRole: 'company_user' };
    const fakeRedis = { get: jest.fn().mockResolvedValue(JSON.stringify(payload)) };
    (getRedis as unknown as jest.Mock).mockReturnValue(fakeRedis);

    const localUser = {
      id: 'u4',
      email: 'support@x.com',
      active: true,
      status: 'ok',
      default_company_slug: 'slug1',
      role: 'technical_support',
      user_origin: 'testing_company',
      is_global_admin: false,
    };
    (getLocalUserById as unknown as jest.Mock).mockResolvedValue(localUser);
    (listLocalLinksForUser as unknown as jest.Mock).mockResolvedValue([{ companyId: 'c1', role: 'company_user', capabilities: ['a'] }]);
    (listLocalCompanies as unknown as jest.Mock).mockResolvedValue([{ id: 'c1', slug: 'slug1' }]);

    (normalizeGlobalRole as unknown as jest.Mock).mockReturnValue(null);
    (normalizeLocalRole as unknown as jest.Mock).mockImplementation((value: unknown) => value);
    (resolveCapabilities as unknown as jest.Mock).mockReturnValue(['a']);

    const req = { headers: { get: (name: string) => (name === 'cookie' ? 'session_id=xyz' : null) } } as unknown as Request;
    const ctx = await sessionStore.getAccessContext(req);

    expect(ctx).not.toBeNull();
    expect(ctx?.role).toBe('technical_support');
    expect(ctx?.permissionRole).toBe('technical_support');
    expect(ctx?.companyRole).toBe('company_user');
    expect(ctx?.companyId).toBeNull();
    expect(ctx?.companySlug).toBeNull();
    expect(ctx?.companySlugs).toEqual(['slug1']);
  });

  // ── Etapa 2.3A/2.3B: contrato relacional / compatibilidade legada ─────

  test('10/11. admin global real: projectScope=unrestricted, allowedProjectIds legado=null (comportamento antigo preservado), assignments sem source=global e sem vínculo inventado', async () => {
    const payload = { userId: 'u5' };
    const fakeRedis = { get: jest.fn().mockResolvedValue(JSON.stringify(payload)) };
    (getRedis as unknown as jest.Mock).mockReturnValue(fakeRedis);

    const localUser = { id: 'u5', email: 'admin@x.com', active: true, status: 'ok', is_global_admin: true };
    (getLocalUserById as unknown as jest.Mock).mockResolvedValue(localUser);
    (listLocalLinksForUser as unknown as jest.Mock).mockResolvedValue([]);
    (listLocalCompanies as unknown as jest.Mock).mockResolvedValue([
      { id: 'c1', slug: 'slug1', name: 'Empresa 1' },
      { id: 'c2', slug: 'slug2', name: 'Empresa 2' },
    ]);
    (normalizeGlobalRole as unknown as jest.Mock).mockReturnValue(null);
    (normalizeLocalRole as unknown as jest.Mock).mockImplementation((value: unknown) => value);
    (resolveCapabilities as unknown as jest.Mock).mockReturnValue([]);

    const req = { headers: { get: (name: string) => (name === 'cookie' ? 'session_id=xyz' : null) } } as unknown as Request;
    const ctx = await sessionStore.getAccessContext(req);

    expect(ctx).not.toBeNull();
    expect(ctx?.isGlobalAdmin).toBe(true);
    expect(ctx?.projectScope).toBe('unrestricted');
    // Correção 5: campo legado não muda de comportamento antes da migração.
    expect(ctx?.allowedProjectIds).toBeNull();
    // companySlugs legado continua vindo de allowedCompanies, cobrindo
    // todas as empresas (comportamento antigo preservado).
    expect(ctx?.companySlugs.sort()).toEqual(['slug1', 'slug2']);
    // Correção 2: sem vínculo real (links=[]), assignments fica vazio --
    // nunca uma entrada sintética "source=global".
    expect(ctx?.assignments).toEqual([]);
    expect(ctx?.assignments.some((a: any) => a.source === 'global')).toBe(false);
  });

  test('company_user com Membership.allowedProjectIds vazio: campo legado preserva comportamento antigo (null); contrato novo representa como all_company_projects', async () => {
    const payload = { userId: 'u6', companyId: 'c1', companySlug: 'slug1', companyRole: 'company_user' };
    const fakeRedis = { get: jest.fn().mockResolvedValue(JSON.stringify(payload)) };
    (getRedis as unknown as jest.Mock).mockReturnValue(fakeRedis);

    const localUser = {
      id: 'u6',
      email: 'user@x.com',
      active: true,
      status: 'ok',
      role: 'company_user',
      user_origin: 'client_company',
      default_company_slug: 'slug1',
      is_global_admin: false,
    };
    (getLocalUserById as unknown as jest.Mock).mockResolvedValue(localUser);
    (listLocalLinksForUser as unknown as jest.Mock).mockResolvedValue([
      { companyId: 'c1', role: 'company_user', capabilities: [], allowedProjectIds: [] },
    ]);
    (listLocalCompanies as unknown as jest.Mock).mockResolvedValue([{ id: 'c1', slug: 'slug1', name: 'Empresa 1' }]);
    (normalizeGlobalRole as unknown as jest.Mock).mockReturnValue(null);
    (normalizeLocalRole as unknown as jest.Mock).mockImplementation((value: unknown) => value);
    (resolveCapabilities as unknown as jest.Mock).mockReturnValue([]);

    const req = { headers: { get: (name: string) => (name === 'cookie' ? 'session_id=xyz' : null) } } as unknown as Request;
    const ctx = await sessionStore.getAccessContext(req);

    expect(ctx).not.toBeNull();
    // Correção 5: campo legado preserva EXATAMENTE o comportamento de antes
    // da Etapa 2.3A (Membership.allowedProjectIds=[] em papel
    // project-scoped -> null, não []). Não alterar isso antes da migração
    // dos consumidores.
    expect(ctx?.allowedProjectIds).toBeNull();
    expect(ctx?.companySlugs).toEqual(['slug1']);
    // 4. Contrato novo representa a mesma situação corretamente como
    // all_company_projects (nunca "unrestricted").
    expect(ctx?.projectScope).toBe('restricted');
    expect(ctx?.assignments).toHaveLength(1);
    expect(ctx?.assignments[0].projectAccess).toBe('all_company_projects');
    expect(ctx?.assignments[0].projectId).toBeNull();
  });

  test('7. Membership não escopado por projeto (role "empresa") vira company_only e nunca libera projeto', async () => {
    const payload = { userId: 'u7', companyId: 'c1', companySlug: 'slug1', companyRole: 'empresa' };
    const fakeRedis = { get: jest.fn().mockResolvedValue(JSON.stringify(payload)) };
    (getRedis as unknown as jest.Mock).mockReturnValue(fakeRedis);

    const localUser = {
      id: 'u7', email: 'empresa@x.com', active: true, status: 'ok', role: 'empresa',
      user_origin: 'client_company', default_company_slug: 'slug1', is_global_admin: false,
    };
    (getLocalUserById as unknown as jest.Mock).mockResolvedValue(localUser);
    (listLocalLinksForUser as unknown as jest.Mock).mockResolvedValue([
      { companyId: 'c1', role: 'empresa', capabilities: [] },
    ]);
    (listLocalCompanies as unknown as jest.Mock).mockResolvedValue([{ id: 'c1', slug: 'slug1', name: 'Empresa 1' }]);
    (normalizeGlobalRole as unknown as jest.Mock).mockReturnValue(null);
    (normalizeLocalRole as unknown as jest.Mock).mockImplementation((value: unknown) => value);
    (resolveCapabilities as unknown as jest.Mock).mockReturnValue([]);

    const req = { headers: { get: (name: string) => (name === 'cookie' ? 'session_id=xyz' : null) } } as unknown as Request;
    const ctx = await sessionStore.getAccessContext(req);

    expect(ctx?.assignments).toHaveLength(1);
    expect(ctx?.assignments[0].projectAccess).toBe('company_only');
    expect(ctx?.projectScope).toBe('none');
  });

  test('1/2/3. Membership A (A1,A2) + Membership B (B1): todos os pares preservados, inclusive o vínculo secundário B', async () => {
    const payload = { userId: 'u8', companyId: 'cA', companySlug: 'empresa-a', companyRole: 'company_user' };
    const fakeRedis = { get: jest.fn().mockResolvedValue(JSON.stringify(payload)) };
    (getRedis as unknown as jest.Mock).mockReturnValue(fakeRedis);

    const localUser = {
      id: 'u8', email: 'multi@x.com', active: true, status: 'ok', role: 'company_user',
      user_origin: 'client_company', default_company_slug: 'empresa-a', is_global_admin: false,
    };
    (getLocalUserById as unknown as jest.Mock).mockResolvedValue(localUser);
    (listLocalLinksForUser as unknown as jest.Mock).mockResolvedValue([
      { companyId: 'cA', role: 'company_user', capabilities: [], allowedProjectIds: ['pA1', 'pA2'] },
      { companyId: 'cB', role: 'company_user', capabilities: [], allowedProjectIds: ['pB1'] },
    ]);
    (listLocalCompanies as unknown as jest.Mock).mockResolvedValue([
      { id: 'cA', slug: 'empresa-a', name: 'Empresa A' },
      { id: 'cB', slug: 'empresa-b', name: 'Empresa B' },
    ]);
    (normalizeGlobalRole as unknown as jest.Mock).mockReturnValue(null);
    (normalizeLocalRole as unknown as jest.Mock).mockImplementation((value: unknown) => value);
    (resolveCapabilities as unknown as jest.Mock).mockReturnValue([]);
    (prisma.project.findMany as jest.Mock).mockResolvedValue([
      { id: 'pA1', companyId: 'cA', slug: 'projeto-a1', name: 'Projeto A1' },
      { id: 'pA2', companyId: 'cA', slug: 'projeto-a2', name: 'Projeto A2' },
      { id: 'pB1', companyId: 'cB', slug: 'projeto-b1', name: 'Projeto B1' },
    ]);

    const req = { headers: { get: (name: string) => (name === 'cookie' ? 'session_id=xyz' : null) } } as unknown as Request;
    const ctx = await sessionStore.getAccessContext(req);

    expect(ctx?.assignments).toHaveLength(3);
    const pairs = ctx?.assignments.map((a: any) => `${a.companyId}:${a.projectId}`).sort();
    expect(pairs).toEqual(['cA:pA1', 'cA:pA2', 'cB:pB1']);
    expect(ctx?.assignments.every((a: any) => a.projectAccess === 'selected_projects')).toBe(true);
    // 9. projectSlug/projectName preenchidos a partir da consulta em lote.
    const aAssignment = ctx?.assignments.find((a: any) => a.projectId === 'pA1');
    expect(aAssignment?.projectSlug).toBe('projeto-a1');
    expect(aAssignment?.projectName).toBe('Projeto A1');
    expect(prisma.project.findMany).toHaveBeenCalledTimes(1);
    const callArgs = (prisma.project.findMany as jest.Mock).mock.calls[0][0];
    expect(callArgs.where.id.in.sort()).toEqual(['pA1', 'pA2', 'pB1']);
  });

  test('8/15. Membership da Empresa A contendo projectId real da Empresa B: ID ignorado, não gera assignment, não concede acesso', async () => {
    const payload = { userId: 'u9', companyId: 'cA', companySlug: 'empresa-a', companyRole: 'company_user' };
    const fakeRedis = { get: jest.fn().mockResolvedValue(JSON.stringify(payload)) };
    (getRedis as unknown as jest.Mock).mockReturnValue(fakeRedis);

    const localUser = {
      id: 'u9', email: 'corrompido@x.com', active: true, status: 'ok', role: 'company_user',
      user_origin: 'client_company', default_company_slug: 'empresa-a', is_global_admin: false,
    };
    (getLocalUserById as unknown as jest.Mock).mockResolvedValue(localUser);
    // Membership da empresa A aponta pra um projectId que na verdade
    // pertence à empresa B -- dado corrompido/malicioso.
    (listLocalLinksForUser as unknown as jest.Mock).mockResolvedValue([
      { companyId: 'cA', role: 'company_user', capabilities: [], allowedProjectIds: ['pB1'] },
    ]);
    (listLocalCompanies as unknown as jest.Mock).mockResolvedValue([
      { id: 'cA', slug: 'empresa-a', name: 'Empresa A' },
      { id: 'cB', slug: 'empresa-b', name: 'Empresa B' },
    ]);
    (normalizeGlobalRole as unknown as jest.Mock).mockReturnValue(null);
    (normalizeLocalRole as unknown as jest.Mock).mockImplementation((value: unknown) => value);
    (resolveCapabilities as unknown as jest.Mock).mockReturnValue([]);
    (prisma.project.findMany as jest.Mock).mockResolvedValue([
      { id: 'pB1', companyId: 'cB', slug: 'projeto-b1', name: 'Projeto B1' },
    ]);

    const req = { headers: { get: (name: string) => (name === 'cookie' ? 'session_id=xyz' : null) } } as unknown as Request;
    const ctx = await sessionStore.getAccessContext(req);

    // Nenhum assignment gerado para esse ID corrompido -- nem selected_projects
    // (empresa errada) nem fallback silencioso para outro modo.
    expect(ctx?.assignments).toEqual([]);
    expect(ctx?.projectScope).toBe('none');
  });

  test('ID de projeto inexistente no banco também é ignorado (não derruba a sessão, não concede acesso)', async () => {
    const payload = { userId: 'u10', companyId: 'cA', companySlug: 'empresa-a', companyRole: 'company_user' };
    const fakeRedis = { get: jest.fn().mockResolvedValue(JSON.stringify(payload)) };
    (getRedis as unknown as jest.Mock).mockReturnValue(fakeRedis);

    const localUser = {
      id: 'u10', email: 'inexistente@x.com', active: true, status: 'ok', role: 'company_user',
      user_origin: 'client_company', default_company_slug: 'empresa-a', is_global_admin: false,
    };
    (getLocalUserById as unknown as jest.Mock).mockResolvedValue(localUser);
    (listLocalLinksForUser as unknown as jest.Mock).mockResolvedValue([
      { companyId: 'cA', role: 'company_user', capabilities: [], allowedProjectIds: ['id-que-nao-existe'] },
    ]);
    (listLocalCompanies as unknown as jest.Mock).mockResolvedValue([{ id: 'cA', slug: 'empresa-a', name: 'Empresa A' }]);
    (normalizeGlobalRole as unknown as jest.Mock).mockReturnValue(null);
    (normalizeLocalRole as unknown as jest.Mock).mockImplementation((value: unknown) => value);
    (resolveCapabilities as unknown as jest.Mock).mockReturnValue([]);
    (prisma.project.findMany as jest.Mock).mockResolvedValue([]); // nada resolvido

    const req = { headers: { get: (name: string) => (name === 'cookie' ? 'session_id=xyz' : null) } } as unknown as Request;
    const ctx = await sessionStore.getAccessContext(req);

    expect(ctx).not.toBeNull();
    expect(ctx?.assignments).toEqual([]);
  });
});
