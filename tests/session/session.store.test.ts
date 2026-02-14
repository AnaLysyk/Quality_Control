// Mocks for dependencies (synchronous for Jest CommonJS environment)
jest.mock('../../lib/redis', () => ({
  getRedis: jest.fn(),
}));
jest.mock('../../lib/auth/localStore', () => ({
  getLocalUserById: jest.fn(),
  listLocalCompanies: jest.fn(),
  listLocalLinksForUser: jest.fn(),
  normalizeGlobalRole: jest.fn(),
  normalizeLocalRole: jest.fn(),
  toLegacyRole: jest.fn(),
}));
jest.mock('../../lib/permissions', () => ({
  resolveCapabilities: jest.fn(),
}));
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

// Import the module under test after setting up mocks
import * as sessionStore from '../../src/core/session/session.store';

// Import the mocked implementations for assertions
const { getRedis } = require('../../lib/redis');
const {
  getLocalUserById,
  listLocalCompanies,
  listLocalLinksForUser,
  normalizeGlobalRole,
  normalizeLocalRole,
  toLegacyRole,
} = require('../../lib/auth/localStore');
const { resolveCapabilities } = require('../../lib/permissions');
const jwt = require('jsonwebtoken');

describe('session.store', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.JWT_SECRET;
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
    const tokenPayload = { userId: 'u2', email: 'u2@example.com' };
    (jwt.verify as unknown as jest.Mock).mockReturnValue(tokenPayload);

    const req = { headers: { get: (name: string) => (name === 'authorization' ? 'Bearer token-xyz' : null) } } as unknown as Request;
    const result = await sessionStore.getSessionPayload(req);
    expect(result).toEqual({ userId: 'u2', email: 'u2@example.com', isGlobalAdmin: false });
    expect(jwt.verify).toHaveBeenCalledWith('token-xyz', 'sekrit');
  });

  test('getSessionPayloadFromStores reads cookies without fabricating Request', async () => {
    const payload = { userId: 'store-user', email: 'store@example.com' };
    const fakeRedis = { get: jest.fn().mockResolvedValue(JSON.stringify(payload)) };
    (getRedis as unknown as jest.Mock).mockReturnValue(fakeRedis);

    const headerStore = { get: jest.fn(() => null) };
    const cookieStore = {
      get: jest.fn((name: string) => (name === 'session_id' ? { value: 'cookie-session' } : undefined)),
    };

    const result = await sessionStore.getSessionPayloadFromStores(
      headerStore as unknown as Headers,
      cookieStore,
    );

    expect(result).toEqual(payload);
    expect(fakeRedis.get).toHaveBeenCalledWith('session:cookie-session');
    expect(headerStore.get).toHaveBeenCalledWith('authorization');
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

  test('getAccessContextFromStores mirrors getAccessContext without request', async () => {
    const payload = { userId: 'u4', companyId: 'c2', companySlug: 'slug2', companyRole: 'user' };
    const fakeRedis = { get: jest.fn().mockResolvedValue(JSON.stringify(payload)) };
    (getRedis as unknown as jest.Mock).mockReturnValue(fakeRedis);

    const localUser = { id: 'u4', email: 'u4@x.com', active: true, status: 'ok', default_company_slug: 'slug2', is_global_admin: false };
    (getLocalUserById as unknown as jest.Mock).mockResolvedValue(localUser);
    (listLocalLinksForUser as unknown as jest.Mock).mockResolvedValue([{ companyId: 'c2', role: 'user', capabilities: [] }]);
    (listLocalCompanies as unknown as jest.Mock).mockResolvedValue([{ id: 'c2', slug: 'slug2', active: true, status: 'active' }]);

    (normalizeGlobalRole as unknown as jest.Mock).mockReturnValue(null);
    (normalizeLocalRole as unknown as jest.Mock).mockReturnValue('user');
    (resolveCapabilities as unknown as jest.Mock).mockReturnValue([]);
    (toLegacyRole as unknown as jest.Mock).mockReturnValue('user');

    const headerStore = { get: jest.fn((name: string) => (name === 'cookie' ? 'session_id=store' : null)) };
    const cookieStore = {
      get: jest.fn((name: string) => (name === 'session_id' ? { value: 'store' } : undefined)),
    };

    const ctx = await sessionStore.getAccessContextFromStores(headerStore as unknown as Headers, cookieStore);
    expect(ctx).not.toBeNull();
    expect(ctx?.userId).toBe('u4');
    expect(ctx?.companySlug).toBe('slug2');
  });

  test('getAccessContextFromStores accepts missing header store', async () => {
    const payload = { userId: 'u5', companyId: 'c3', companySlug: 'slug3', companyRole: 'user' };
    const fakeRedis = { get: jest.fn().mockResolvedValue(JSON.stringify(payload)) };
    (getRedis as unknown as jest.Mock).mockReturnValue(fakeRedis);

    const localUser = { id: 'u5', email: 'u5@x.com', active: true, status: 'ok', default_company_slug: 'slug3', is_global_admin: false };
    (getLocalUserById as unknown as jest.Mock).mockResolvedValue(localUser);
    (listLocalLinksForUser as unknown as jest.Mock).mockResolvedValue([{ companyId: 'c3', role: 'user', capabilities: [] }]);
    (listLocalCompanies as unknown as jest.Mock).mockResolvedValue([{ id: 'c3', slug: 'slug3', active: true, status: 'active' }]);

    (normalizeGlobalRole as unknown as jest.Mock).mockReturnValue(null);
    (normalizeLocalRole as unknown as jest.Mock).mockReturnValue('user');
    (resolveCapabilities as unknown as jest.Mock).mockReturnValue([]);
    (toLegacyRole as unknown as jest.Mock).mockReturnValue('user');

    const cookieStore = {
      get: jest.fn((name: string) => (name === 'session_id' ? { value: 'no-header' } : undefined)),
    };

    const ctx = await sessionStore.getAccessContextFromStores(undefined, cookieStore);
    expect(ctx).not.toBeNull();
    expect(ctx?.userId).toBe('u5');
    expect(cookieStore.get).toHaveBeenCalledWith('session_id');
  });
});
